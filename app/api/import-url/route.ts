import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_HTML = 5 * 1024 * 1024;
const MAX_ASSET = 12 * 1024 * 1024;
const MAX_ASSETS = 80;

function blockedIp(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }

  const v = ip.toLowerCase();
  return (
    v === '::' ||
    v === '::1' ||
    v.startsWith('fc') ||
    v.startsWith('fd') ||
    v.startsWith('fe8') ||
    v.startsWith('fe9') ||
    v.startsWith('fea') ||
    v.startsWith('feb')
  );
}

async function safeUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid website URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(
      'Only http and https URLs can be imported.'
    );
  }

  const host = url.hostname.toLowerCase();

  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error(
      'Private network addresses cannot be imported.'
    );
  }

  if (isIP(host)) {
    if (blockedIp(host)) {
      throw new Error(
        'Private network addresses cannot be imported.'
      );
    }
  } else {
    const addresses = await lookup(host, {
      all: true,
      verbatim: true
    });

    if (
      !addresses.length ||
      addresses.some((item) =>
        blockedIp(item.address)
      )
    ) {
      throw new Error(
        'The website host could not be safely resolved.'
      );
    }
  }

  return url;
}

async function safeFetch(
  value: string,
  init: RequestInit = {}
) {
  let url = await safeUrl(value);

  for (let index = 0; index < 6; index += 1) {
    const response = await fetch(url, {
      ...init,
      redirect: 'manual',
      headers: {
        'user-agent':
          'CanvasForge Importer/1.0',
        accept: '*/*',
        ...(init.headers || {})
      }
    });

    if (
      [301, 302, 303, 307, 308].includes(
        response.status
      )
    ) {
      const location =
        response.headers.get('location');

      if (!location) {
        throw new Error(
          'The website returned an invalid redirect.'
        );
      }

      url = await safeUrl(
        new URL(location, url).toString()
      );

      continue;
    }

    return {
      response,
      finalUrl: url
    };
  }

  throw new Error(
    'The website redirected too many times.'
  );
}

async function readBytes(
  response: Response,
  limit: number
) {
  const buffer = new Uint8Array(
    await response.arrayBuffer()
  );

  if (buffer.byteLength > limit) {
    throw new Error(
      'A downloaded file was too large to import safely.'
    );
  }

  return buffer;
}

function extensionFor(
  contentType: string,
  pathname: string
) {
  const match = pathname.match(
    /\.([a-z0-9]{2,8})$/i
  );

  if (match) {
    return match[1].toLowerCase();
  }

  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'font/woff': 'woff',
    'font/woff2': 'woff2'
  };

  return (
    map[
      contentType
        .split(';')[0]
        .trim()
        .toLowerCase()
    ] || 'bin'
  );
}

export async function POST(
  request: NextRequest
) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      {
        error:
          'CanvasForge import is not configured.'
      },
      {
        status: 503
      }
    );
  }

  const authorization =
    request.headers.get('authorization') || '';

  const token =
    authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';

  if (!token) {
    return NextResponse.json(
      {
        error: 'Please sign in again.'
      },
      {
        status: 401
      }
    );
  }

  const admin = createClient(
    supabaseUrl,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  const {
    data: authData,
    error: authError
  } = await admin.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json(
      {
        error: 'Please sign in again.'
      },
      {
        status: 401
      }
    );
  }

  const userId: string = authData.user.id;

  let input: {
    url?: string;
  };

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid import request.'
      },
      {
        status: 400
      }
    );
  }

  try {
    const {
      response,
      finalUrl
    } = await safeFetch(
      String(input.url || '').trim(),
      {
        headers: {
          accept:
            'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5'
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `The website returned HTTP ${response.status}.`
      );
    }

    const responseType =
      response.headers.get('content-type') || '';

    if (
      !responseType.includes('text/html') &&
      !responseType.includes(
        'application/xhtml+xml'
      )
    ) {
      throw new Error(
        'That URL did not return a web page.'
      );
    }

    const source = new TextDecoder().decode(
      await readBytes(response, MAX_HTML)
    );

    const $ = cheerio.load(source);

    const base = new URL(
      $('base').attr('href') ||
        finalUrl.toString(),
      finalUrl
    );

    $('base').remove();

    $(
      'meta[http-equiv="Content-Security-Policy"]'
    ).remove();

    const title = $('title')
      .first()
      .text()
      .trim();

    const inlineStyles = $('style')
      .map(
        (_, element) =>
          $(element).html() || ''
      )
      .get();

    const stylesheetUrls = $(
      'link[rel~="stylesheet"]'
    )
      .map(
        (_, element) =>
          $(element).attr('href')
      )
      .get()
      .filter(Boolean)
      .slice(0, 20)
      .map((href) =>
        new URL(href!, base).toString()
      );

    $('style, link[rel~="stylesheet"]')
      .remove();

    const assetCache =
      new Map<string, string>();

    let assetCount = 0;

    async function copyAsset(
      value: string
    ) {
      if (assetCache.has(value)) {
        return assetCache.get(value)!;
      }

      if (assetCount >= MAX_ASSETS) {
        return value;
      }

      assetCount += 1;

      try {
        const {
          response: assetResponse,
          finalUrl: assetUrl
        } = await safeFetch(value);

        if (!assetResponse.ok) {
          return value;
        }

        const assetType =
          assetResponse.headers.get(
            'content-type'
          ) ||
          'application/octet-stream';

        const data = await readBytes(
          assetResponse,
          MAX_ASSET
        );

        const hash = createHash('sha256')
          .update(assetUrl.toString())
          .digest('hex')
          .slice(0, 20);

        const path =
          `${userId}/imports/${Date.now()}-${hash}.${extensionFor(
            assetType,
            assetUrl.pathname
          )}`;

        const {
          error: uploadError
        } = await admin.storage
          .from('site-assets')
          .upload(path, data, {
            contentType:
              assetType.split(';')[0],
            upsert: true
          });

        if (uploadError) {
          return value;
        }

        const {
          data: publicData
        } = admin.storage
          .from('site-assets')
          .getPublicUrl(path);

        assetCache.set(
          value,
          publicData.publicUrl
        );

        return publicData.publicUrl;
      } catch {
        return value;
      }
    }

    async function rewriteCss(
      css: string,
      cssBase: URL
    ) {
      const matches = Array.from(
        css.matchAll(
          /url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi
        )
      );

      let output = css;

      for (const match of matches) {
        const raw = match[2].trim();

        if (
          !raw ||
          raw.startsWith('data:') ||
          raw.startsWith('#')
        ) {
          continue;
        }

        try {
          const copied =
            await copyAsset(
              new URL(
                raw,
                cssBase
              ).toString()
            );

          output = output
            .split(match[0])
            .join(
              `url("${copied}")`
            );
        } catch {}
      }

      return output;
    }

    const cssParts = [
      ...inlineStyles
    ];

    for (
      const stylesheetUrl of stylesheetUrls
    ) {
      try {
        const {
          response: cssResponse,
          finalUrl: cssUrl
        } = await safeFetch(
          stylesheetUrl,
          {
            headers: {
              accept:
                'text/css,*/*;q=0.5'
            }
          }
        );

        if (!cssResponse.ok) {
          continue;
        }

        const css =
          new TextDecoder().decode(
            await readBytes(
              cssResponse,
              2 * 1024 * 1024
            )
          );

        cssParts.push(
          await rewriteCss(
            css,
            cssUrl
          )
        );
      } catch {}
    }

    const assetAttributes:
      Array<[string, string]> = [
        ['img', 'src'],
        ['source', 'src'],
        ['video', 'poster'],
        ['audio', 'src'],
        ['input[type="image"]', 'src']
      ];

    for (
      const [
        selector,
        attribute
      ] of assetAttributes
    ) {
      for (
        const element of $(selector).toArray()
      ) {
        const node = $(element);
        const raw = node.attr(attribute);

        if (
          !raw ||
          raw.startsWith('data:')
        ) {
          continue;
        }

        try {
          node.attr(
            attribute,
            await copyAsset(
              new URL(
                raw,
                base
              ).toString()
            )
          );
        } catch {}
      }
    }

    for (
      const element of $(
        'img[srcset], source[srcset]'
      ).toArray()
    ) {
      const node = $(element);
      const value =
        node.attr('srcset');

      if (!value) {
        continue;
      }

      const parts: string[] = [];

      for (
        const entry of value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      ) {
        const bits =
          entry.split(/\s+/);

        try {
          bits[0] =
            await copyAsset(
              new URL(
                bits[0],
                base
              ).toString()
            );
        } catch {}

        parts.push(
          bits.join(' ')
        );
      }

      node.attr(
        'srcset',
        parts.join(', ')
      );
    }

    for (
      const element of $('[style]').toArray()
    ) {
      const node = $(element);
      const style =
        node.attr('style');

      if (style) {
        node.attr(
          'style',
          await rewriteCss(
            style,
            base
          )
        );
      }
    }

    $('a[href]').each(
      (_, element) => {
        const node = $(element);
        const href =
          node.attr('href');

        if (
          !href ||
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:')
        ) {
          return;
        }

        try {
          node.attr(
            'href',
            new URL(
              href,
              base
            ).toString()
          );
        } catch {}
      }
    );

    $('form').each(
      (
        formIndex,
        form
      ) => {
        const currentForm = $(form)
          .attr(
            'data-canvasforge-form',
            'true'
          )
          .attr(
            'method',
            'post'
          )
          .removeAttr('action');

        currentForm
          .find(
            'input,textarea,select'
          )
          .each(
            (
              fieldIndex,
              field
            ) => {
              const node =
                $(field);

              const fieldType =
                (
                  node.attr('type') ||
                  ''
                ).toLowerCase();

              if (
                [
                  'submit',
                  'button',
                  'reset'
                ].includes(
                  fieldType
                ) ||
                node.attr('name')
              ) {
                return;
              }

              const label =
                node
                  .closest(
                    'label'
                  )
                  .text()
                  .trim() ||
                node.attr(
                  'placeholder'
                ) ||
                node.attr(
                  'aria-label'
                ) ||
                `field-${formIndex + 1}-${fieldIndex + 1}`;

              node.attr(
                'name',
                label
                  .toLowerCase()
                  .replace(
                    /[^a-z0-9]+/g,
                    '-'
                  )
                  .replace(
                    /^-+|-+$/g,
                    ''
                  )
                  .slice(0, 60)
              );
            }
          );

        const button =
          currentForm
            .find('button')
            .first();

        if (button.length) {
          button.attr(
            'type',
            'submit'
          );
        }

        if (
          !currentForm
            .find(
              '[data-canvasforge-status]'
            )
            .length
        ) {
          currentForm.append(
            '<p data-canvasforge-status aria-live="polite"></p>'
          );
        }
      }
    );

    const scripts: string[] = [];

    $('script').each(
      (_, element) => {
        const node = $(element);
        const sourceUrl =
          node.attr('src');

        const scriptType =
          (
            node.attr('type') ||
            ''
          ).toLowerCase();

        if (
          !sourceUrl &&
          (
            !scriptType ||
            scriptType ===
              'text/javascript' ||
            scriptType ===
              'application/javascript'
          )
        ) {
          const code =
            node.html();

          if (code) {
            scripts.push(code);
          }
        }

        node.remove();
      }
    );

    return NextResponse.json({
      title,
      sourceUrl:
        finalUrl.toString(),
      html:
        $('body').html() || '',
      css:
        await rewriteCss(
          cssParts.join('\n\n'),
          base
        ),
      javascript:
        scripts.join('\n\n'),
      importedAssets:
        assetCache.size
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'CanvasForge could not import that website.'
      },
      {
        status: 400
      }
    );
  }
}
