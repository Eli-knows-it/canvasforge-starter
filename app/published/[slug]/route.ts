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


import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
export const dynamic='force-dynamic';
type Page={id:string;name:string;path:string;html:string;css:string;javascript:string;title?:string;description?:string};
function escapeScript(s:string){return s.replace(/<\/script/gi,'<\\/script')}
function render(page:Page,slug:string,name:string){let source=page.html||'<!doctype html><html><body></body></html>';const css=`<style>${page.css||''}</style>`;const js=page.javascript?`<script>${escapeScript(page.javascript)}</script>`:'';const form=`<script>(()=>{document.addEventListener('submit',async e=>{const f=e.target;if(!(f instanceof HTMLFormElement))return;e.preventDefault();const status=f.querySelector('[data-canvasforge-status]');if(status)status.textContent='Sending…';try{const fields=Object.fromEntries(new FormData(f).entries());const r=await fetch('/api/forms/${slug}',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(fields)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to send');f.reset();if(status)status.textContent='Thanks! Your message was sent.'}catch(err){if(status)status.textContent=err instanceof Error?err.message:'Unable to send'}})})()</script>`;if(/<html[\s>]/i.test(source)){source=/<\/head>/i.test(source)?source.replace(/<\/head>/i,`<title>${page.title||name}</title><meta name="description" content="${page.description||''}">${css}</head>`):source;return /<\/body>/i.test(source)?source.replace(/<\/body>/i,`${js}${form}</body>`):`${source}${js}${form}`}return `<!doctype html><html><head>${css}</head><body>${source}${js}${form}</body></html>`}
export async function GET(_request:NextRequest,context:{params:Promise<{slug:string;path?:string[]}>}){const {slug,path=[]}=await context.params;const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return new NextResponse('Publishing is not configured.',{status:500});const sb=createClient(url,key,{auth:{persistSession:false}});const {data,error}=await sb.from('sites').select('name,slug,html,css,javascript,project_data,is_published').eq('slug',slug).eq('is_published',true).maybeSingle();if(error)return new NextResponse('Unable to load site.',{status:500});if(!data)return new NextResponse('Website not found.',{status:404});const pages=((data.project_data as {pages?:Page[]}|null)?.pages)||[{id:'home',name:'Home',path:'',html:data.html,css:data.css,javascript:data.javascript}];const requested=path.join('/');const page=pages.find(p=>p.path===requested)||(requested===''?pages.find(p=>p.path===''):null);if(!page)return new NextResponse('Page not found.',{status:404});return new NextResponse(render(page,slug,data.name),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60, s-maxage=60'}})}
