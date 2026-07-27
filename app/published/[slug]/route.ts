import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PublishedPage = {
  id: string;
  name: string;
  path: string;
  html: string;
  css: string;
  javascript: string;
  title?: string;
  description?: string;
};

type ProjectData = {
  pages?: PublishedPage[];
};

type PublishedSite = {
  name: string;
  slug: string;
  html: string | null;
  css: string | null;
  javascript: string | null;
  project_data: ProjectData | null;
  is_published: boolean;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[character] ?? character
  );
}

function escapeInlineScript(value: string): string {
  return value.replace(/<\/script/gi, '<\\/script');
}

function normalizePagePath(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

function getFallbackPages(site: PublishedSite): PublishedPage[] {
  return [
    {
      id: 'home',
      name: 'Home',
      path: '',
      html: site.html || '',
      css: site.css || '',
      javascript: site.javascript || '',
      title: site.name,
      description: ''
    }
  ];
}

function getPages(site: PublishedSite): PublishedPage[] {
  const pages = site.project_data?.pages;

  if (!Array.isArray(pages) || pages.length === 0) {
    return getFallbackPages(site);
  }

  return pages.map((page, index) => ({
    id: page.id || `page-${index + 1}`,
    name: page.name || `Page ${index + 1}`,
    path: normalizePagePath(page.path || ''),
    html: page.html || '',
    css: page.css || '',
    javascript: page.javascript || '',
    title: page.title || page.name || site.name,
    description: page.description || ''
  }));
}

function formBridgeScript(slug: string): string {
  const encodedSlug = JSON.stringify(slug);

  return `
<script data-canvasforge-form-bridge>
(() => {
  const slug = ${encodedSlug};

  document.addEventListener('submit', async (event) => {
    const form = event.target;

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    event.preventDefault();

    const status = form.querySelector('[data-canvasforge-status]');
    const submitButton = form.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

    if (submitButton instanceof HTMLButtonElement ||
        submitButton instanceof HTMLInputElement) {
      submitButton.disabled = true;
    }

    if (status) {
      status.textContent = 'Sending…';
    }

    try {
      const formData = new FormData(form);
      const fields = Object.fromEntries(formData.entries());

      const response = await fetch(
        '/api/forms/' + encodeURIComponent(slug),
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(fields)
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : 'Unable to send the form.'
        );
      }

      form.reset();

      if (status) {
        status.textContent =
          typeof result.message === 'string'
            ? result.message
            : 'Thanks! Your message was sent.';
      }
    } catch (error) {
      if (status) {
        status.textContent =
          error instanceof Error
            ? error.message
            : 'Unable to send the form.';
      }
    } finally {
      if (submitButton instanceof HTMLButtonElement ||
          submitButton instanceof HTMLInputElement) {
        submitButton.disabled = false;
      }
    }
  });
})();
</script>`;
}

function buildPublishedDocument(
  page: PublishedPage,
  site: PublishedSite
): string {
  const source =
    page.html.trim() ||
    '<!doctype html><html><head></head><body></body></html>';

  const title = escapeHtml(page.title || page.name || site.name);
  const description = escapeHtml(page.description || '');

  const styleTag = page.css.trim()
    ? `<style data-canvasforge-published-css>\n${page.css}\n</style>`
    : '';

  const scriptTag = page.javascript.trim()
    ? `<script data-canvasforge-published-js>\n${escapeInlineScript(
        page.javascript
      )}\n</script>`
    : '';

  const formBridge = formBridgeScript(site.slug);

  if (/<html[\s>]/i.test(source)) {
    let output = source;

    if (/<\/head>/i.test(output)) {
      output = output.replace(
        /<\/head>/i,
        [
          `<title>${title}</title>`,
          `<meta name="description" content="${description}">`,
          styleTag,
          '</head>'
        ].join('\n')
      );
    } else {
      output = output.replace(
        /<html([^>]*)>/i,
        (match) =>
          `${match}<head><title>${title}</title>` +
          `<meta name="description" content="${description}">` +
          `${styleTag}</head>`
      );
    }

    if (/<\/body>/i.test(output)) {
      output = output.replace(
        /<\/body>/i,
        `${scriptTag}\n${formBridge}\n</body>`
      );
    } else {
      output = `${output}\n${scriptTag}\n${formBridge}`;
    }

    return output;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  ${styleTag}
</head>
<body>
  ${source}
  ${scriptTag}
  ${formBridge}
</body>
</html>`;
}

function htmlResponse(
  body: string,
  status = 200,
  cacheControl = 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': cacheControl,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  });
}

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      path?: string[];
    }>;
  }
) {
  const { slug, path = [] } = await context.params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return htmlResponse(
      '<!doctype html><html><body><h1>Publishing is not configured.</h1></body></html>',
      500,
      'no-store'
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  const { data, error } = await supabase
    .from('sites')
    .select(
      'name, slug, html, css, javascript, project_data, is_published'
    )
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) {
    console.error('Published website lookup failed:', error);

    return htmlResponse(
      '<!doctype html><html><body><h1>Unable to load this website.</h1></body></html>',
      500,
      'no-store'
    );
  }

  if (!data) {
    return htmlResponse(
      '<!doctype html><html><body><h1>Website not found.</h1><p>This website may be unpublished.</p></body></html>',
      404,
      'no-store'
    );
  }

  const site = data as PublishedSite;
  const pages = getPages(site);
  const requestedPath = normalizePagePath(path.join('/'));

  const page =
    pages.find(
      (candidate) =>
        normalizePagePath(candidate.path) === requestedPath
    ) ||
    (requestedPath === ''
      ? pages.find(
          (candidate) =>
            normalizePagePath(candidate.path) === ''
        )
      : undefined);

  if (!page) {
    return htmlResponse(
      '<!doctype html><html><body><h1>Page not found.</h1></body></html>',
      404,
      'no-store'
    );
  }

  return htmlResponse(
    buildPublishedDocument(page, site)
  );
}
