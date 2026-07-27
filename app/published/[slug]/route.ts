import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function escapeInlineScript(source: string) {
  return source.replace(/<\/script/gi, '<\\/script');
}

function buildPublishedDocument(site: {
  name: string;
  slug: string;
  html: string | null;
  css: string | null;
  javascript: string | null;
}) {
  const rawHtml = site.html?.trim() || '<!doctype html><html><head></head><body></body></html>';
  const css = site.css || '';
  const javascript = escapeInlineScript(site.javascript || '');

  const formBridge = `<script data-canvasforge-form-bridge>
(() => {
  const slug = ${JSON.stringify(site.slug)};
  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();

    const status = form.querySelector('[data-canvasforge-status]');
    const submit = form.querySelector('[type="submit"]');
    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    if (status) status.textContent = 'Sending…';

    try {
      const response = await fetch('/api/forms/' + encodeURIComponent(slug), {
        method: 'POST',
        body: new FormData(form)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to send message.');
      form.reset();
      if (status) status.textContent = result.message || 'Thanks! Your message was sent.';
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : 'Unable to send message.';
    } finally {
      if (submit instanceof HTMLButtonElement) submit.disabled = false;
    }
  });
})();
</script>`;

  const styleTag = css.trim() ? `<style data-canvasforge-css>\n${css}\n</style>` : '';
  const scriptTag = javascript.trim() ? `<script data-canvasforge-js>\n${javascript}\n</script>` : '';

  if (/<html[\s>]/i.test(rawHtml)) {
    let output = rawHtml;
    output = /<\/head>/i.test(output)
      ? output.replace(/<\/head>/i, `${styleTag}</head>`)
      : output.replace(/<html[^>]*>/i, (match) => `${match}<head><title>${site.name}</title>${styleTag}</head>`);
    output = /<\/body>/i.test(output)
      ? output.replace(/<\/body>/i, `${scriptTag}${formBridge}</body>`)
      : `${output}${scriptTag}${formBridge}`;
    return output;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${site.name}</title>${styleTag}</head><body>${rawHtml}${scriptTag}${formBridge}</body></html>`;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new NextResponse('Publishing is not configured.', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: site, error } = await supabase
    .from('sites')
    .select('name, slug, html, css, javascript, is_published')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) {
    console.error('Published site lookup failed:', error);
    return new NextResponse('Unable to load this website.', { status: 500 });
  }

  if (!site) {
    return new NextResponse('<!doctype html><html><body style="font-family:system-ui;padding:40px"><h1>Website not found</h1><p>This website is not currently published.</p></body></html>', {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }

  return new NextResponse(buildPublishedDocument(site), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  });
}
