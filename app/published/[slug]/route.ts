import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function escapeScript(source: string) {
  return source.replace(/<\/script/gi, '<\\/script');
}

function buildDocument(site: {
  name: string;
  slug: string;
  html: string | null;
  css: string | null;
  javascript: string | null;
}) {
  const html = site.html || '';
  const css = site.css || '';
  const javascript = escapeScript(site.javascript || '');

  // Forms stay inside the Vercel iframe, so they can post to CanvasForge's
  // existing /api/forms/[slug] route without cross-origin problems.
  const formBridge = `
<script>
(() => {
  const slug = ${JSON.stringify(site.slug)};
  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    event.preventDefault();

    const status = form.querySelector('[data-canvasforge-status]');
    const submitButton = form.querySelector('[type="submit"]');

    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;
    if (status) status.textContent = 'Sending…';

    try {
      const fields = Object.fromEntries(new FormData(form).entries());
      const response = await fetch('/api/forms/' + encodeURIComponent(slug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to send form.');

      form.reset();
      if (status) status.textContent = 'Thanks! Your message was sent.';
    } catch (error) {
      if (status) {
        status.textContent =
          error instanceof Error ? error.message : 'Unable to send form.';
      }
    } finally {
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
    }
  });
})();
</script>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${site.name.replace(/[<>&"]/g, '')}</title>
  <style>${css}</style>
</head>
<body>
${html}
${javascript ? `<script>${javascript}</script>` : ''}
${formBridge}
</body>
</html>`;
}

export async function GET(
  request: NextRequest,
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
    return new NextResponse(
      '<!doctype html><html><body style="font-family:system-ui;padding:40px"><h1>Website not found</h1><p>This website is not published.</p></body></html>',
      {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      }
    );
  }

  return new NextResponse(buildDocument(site), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  });
}
