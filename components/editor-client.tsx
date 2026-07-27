'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import JSZip, { type JSZipObject } from 'jszip';
import { getSupabase } from '@/lib/supabase';
import type { Site } from '@/lib/types';

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';
type CodeTab = 'html' | 'css' | 'javascript';

const COMMON_FONTS = [
  'Arial',
  'Arial Black',
  'Alegreya',
  'Archivo',
  'Barlow',
  'Barlow Condensed',
  'Bebas Neue',
  'Cabin',
  'Cormorant Garamond',
  'DM Sans',
  'Fira Sans',
  'IBM Plex Sans',
  'Inter',
  'Lato',
  'Libre Baskerville',
  'Manrope',
  'Merriweather',
  'Montserrat',
  'Nunito',
  'Open Sans',
  'Oswald',
  'Playfair Display',
  'Poppins',
  'Raleway',
  'Roboto',
  'Roboto Condensed',
  'Source Sans 3',
  'Ubuntu',
  'Work Sans'
];

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 63);
}

function getMimeType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const types: Record<string, string> = {
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    mjs: 'text/javascript',
    json: 'application/json',
    txt: 'text/plain',
    xml: 'application/xml',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pdf: 'application/pdf'
  };
  return types[extension] || 'application/octet-stream';
}

function normalizePath(path: string) {
  return decodeURIComponent(path)
    .replace(/\\/g, '/')
    .split('?')[0]
    .split('#')[0]
    .replace(/^\.\//, '')
    .replace(/^\//, '');
}

function dirname(path: string) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index < 0 ? '' : normalized.slice(0, index + 1);
}

function resolveRelativePath(baseFile: string, reference: string) {
  const cleanReference = normalizePath(reference);
  if (!cleanReference || /^(https?:|data:|blob:|mailto:|tel:|#)/i.test(reference)) {
    return cleanReference;
  }

  const stack = dirname(baseFile).split('/').filter(Boolean);
  for (const part of cleanReference.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function replaceReferences(source: string, replacements: Map<string, string>) {
  let result = source;
  const entries = [...replacements.entries()].sort((a, b) => b[0].length - a[0].length);

  for (const [path, url] of entries) {
    const clean = normalizePath(path);
    const variants = new Set([path, clean, `./${clean}`, `/${clean}`]);
    for (const variant of variants) {
      if (variant) result = result.split(variant).join(url);
    }
  }
  return result;
}

function injectCode(html: string, css: string, javascript: string) {
  const source = html.trim() || '<!doctype html><html><head></head><body><main><h1>Start editing</h1></main></body></html>';
  const safeScript = javascript.replace(/<\/script/gi, '<\\/script');
  const styleTag = css.trim() ? `<style data-canvasforge-css>\n${css}\n</style>` : '';
  const scriptTag = safeScript.trim() ? `<script data-canvasforge-js>\n${safeScript}\n</script>` : '';

  if (/<html[\s>]/i.test(source)) {
    let output = source;
    output = /<\/head>/i.test(output)
      ? output.replace(/<\/head>/i, `${styleTag}</head>`)
      : output.replace(/<html[^>]*>/i, (match) => `${match}<head>${styleTag}</head>`);
    output = /<\/body>/i.test(output)
      ? output.replace(/<\/body>/i, `${scriptTag}</body>`)
      : `${output}${scriptTag}`;
    return output;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styleTag}</head><body>${source}${scriptTag}</body></html>`;
}

function insertBeforeBodyEnd(html: string, block: string) {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}\n</body>`);
  return `${html}\n${block}`;
}

const CONTACT_FORM_HTML = `
<section class="canvasforge-contact-section" id="contact">
  <div class="canvasforge-contact-wrap">
    <div class="canvasforge-contact-copy">
      <p class="canvasforge-contact-kicker">GET IN TOUCH</p>
      <h2>Contact me</h2>
      <p>Tell me a little about what you are looking for and I will get back to you.</p>
    </div>
    <form class="canvasforge-contact-form">
      <label>
        Name
        <input type="text" name="name" autocomplete="name" required>
      </label>
      <label>
        Email
        <input type="email" name="email" autocomplete="email" required>
      </label>
      <label>
        Phone
        <input type="tel" name="phone" autocomplete="tel">
      </label>
      <label>
        Message
        <textarea name="message" rows="6" required></textarea>
      </label>
      <input name="_cf_website" tabindex="-1" autocomplete="off" aria-hidden="true" class="canvasforge-honeypot">
      <button type="submit">Send message</button>
      <p data-canvasforge-status aria-live="polite"></p>
    </form>
  </div>
</section>`;

const CONTACT_FORM_CSS = `
.canvasforge-contact-section{padding:80px 24px;background:#f7f7f5;color:#111}
.canvasforge-contact-wrap{width:min(1100px,100%);margin:auto;display:grid;grid-template-columns:minmax(0,.8fr) minmax(320px,1.2fr);gap:56px;align-items:start}
.canvasforge-contact-kicker{font-size:.78rem;font-weight:800;letter-spacing:.16em;margin:0 0 14px}
.canvasforge-contact-copy h2{font-size:clamp(2.4rem,6vw,5rem);line-height:.95;margin:0 0 22px}
.canvasforge-contact-copy p{line-height:1.7;max-width:520px}
.canvasforge-contact-form{display:grid;gap:18px}
.canvasforge-contact-form label{display:grid;gap:8px;font-weight:700}
.canvasforge-contact-form input,.canvasforge-contact-form textarea{width:100%;padding:13px 14px;border:1px solid #c9c9c3;background:#fff;color:#111;font:inherit}
.canvasforge-contact-form textarea{resize:vertical}
.canvasforge-contact-form button{justify-self:start;border:0;padding:14px 22px;background:#111;color:#fff;font:inherit;font-weight:800;cursor:pointer}
.canvasforge-contact-form [data-canvasforge-status]{min-height:1.4em;margin:0}
.canvasforge-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
@media(max-width:760px){.canvasforge-contact-wrap{grid-template-columns:1fr;gap:34px}}
`;

export function EditorClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zipInput = useRef<HTMLInputElement | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [javascript, setJavascript] = useState('');
  const [tab, setTab] = useState<CodeTab>('html');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [error, setError] = useState('');
  const [showPublish, setShowPublish] = useState(false);
  const [publishSlug, setPublishSlug] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [customFontUrl, setCustomFontUrl] = useState('');
  const [customFontFamily, setCustomFontFamily] = useState('');

  const publicBaseUrl =
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ||
    'https://canvasforge-starter.vercel.app/published';

  const publicUrl = site
    ? `${publicBaseUrl.replace(/\/$/, '')}/${site.slug}`
    : '';

  const previewDocument = useMemo(
    () => injectCode(html, css, javascript),
    [html, css, javascript]
  );

  useEffect(() => {
    void loadSite();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [params.id]);

  async function loadSite() {
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return router.replace('/login');

      const { data, error: fetchError } = await supabase
        .from('sites')
        .select('*')
        .eq('id', params.id)
        .single();
      if (fetchError) throw fetchError;

      const loaded = data as Site;
      setSite(loaded);
      setHtml(loaded.html || '');
      setCss(loaded.css || '');
      setJavascript(loaded.javascript || '');
      setPublishSlug(loaded.slug || '');
      setFormEmail(loaded.form_email || '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load website.');
    } finally {
      setLoading(false);
    }
  }

  function markChanged() {
    setSaveState('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveSite(), 1000);
  }

  async function saveSite() {
    if (!site) return;
    setSaveState('saving');
    setError('');
    try {
      const payload = {
        html,
        css,
        javascript,
        project_data: null,
        updated_at: new Date().toISOString()
      };
      const { error: updateError } = await getSupabase()
        .from('sites')
        .update(payload)
        .eq('id', site.id);
      if (updateError) throw updateError;
      setSite({ ...site, ...payload });
      setSaveState('saved');
    } catch (caught) {
      setSaveState('error');
      setError(caught instanceof Error ? caught.message : 'Save failed.');
    }
  }

  function updateHtml(value: string) {
    setHtml(value);
    markChanged();
  }

  function updateCss(value: string) {
    setCss(value);
    markChanged();
  }

  function updateJavascript(value: string) {
    setJavascript(value);
    markChanged();
  }

  async function uploadAsset(file: File, pathHint: string) {
    if (!site) throw new Error('Website not loaded.');
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Your session has expired.');

    const cleanName = normalizePath(pathHint).replace(/[^a-zA-Z0-9._/-]/g, '-');
    const filename = cleanName.split('/').pop() || file.name;
    const storagePath = `${authData.user.id}/${site.id}/${crypto.randomUUID()}-${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('site-assets')
      .upload(storagePath, file, {
        cacheControl: '31536000',
        contentType: getMimeType(pathHint),
        upsert: true
      });
    if (uploadError) throw new Error(`Could not upload ${pathHint}: ${uploadError.message}`);

    return supabase.storage.from('site-assets').getPublicUrl(storagePath).data.publicUrl;
  }

  async function importZip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError('');

    try {
      const zip = await JSZip.loadAsync(file);
      const files = (Object.values(zip.files) as JSZipObject[]).filter(
        (entry) => !entry.dir && !entry.name.includes('__MACOSX')
      );
      const htmlEntry =
        files.find((entry) => /(^|\/)index\.html?$/i.test(entry.name)) ||
        files.find((entry) => /\.html?$/i.test(entry.name));
      if (!htmlEntry) throw new Error('The ZIP must contain index.html.');

      let importedHtml = await htmlEntry.async('text');
      const replacements = new Map<string, string>();

      for (const entry of files) {
        if (entry === htmlEntry || /\.(css|js|mjs|html?)$/i.test(entry.name)) continue;
        const blob = await entry.async('blob');
        const uploadedFile = new File(
          [blob],
          entry.name.split('/').pop() || 'asset',
          { type: getMimeType(entry.name) }
        );
        const url = await uploadAsset(uploadedFile, entry.name);
        replacements.set(normalizePath(entry.name), url);

        const relativeToHtml = resolveRelativePath(htmlEntry.name, entry.name);
        replacements.set(relativeToHtml, url);
      }

      importedHtml = replaceReferences(importedHtml, replacements);

      const parser = new DOMParser();
      const doc = parser.parseFromString(importedHtml, 'text/html');
      const cssParts: string[] = [];
      const jsParts: string[] = [];

      for (const style of Array.from(doc.querySelectorAll('style'))) {
        cssParts.push(replaceReferences(style.textContent || '', replacements));
        style.remove();
      }

      for (const link of Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'))) {
        const href = link.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href)) continue;
        const resolved = resolveRelativePath(htmlEntry.name, href);
        const cssEntry = files.find((entry) => normalizePath(entry.name) === resolved);
        if (cssEntry) {
          cssParts.push(replaceReferences(await cssEntry.async('text'), replacements));
          link.remove();
        }
      }

      for (const script of Array.from(doc.querySelectorAll<HTMLScriptElement>('script'))) {
        const src = script.getAttribute('src');
        if (src && !/^https?:\/\//i.test(src)) {
          const resolved = resolveRelativePath(htmlEntry.name, src);
          const scriptEntry = files.find((entry) => normalizePath(entry.name) === resolved);
          if (scriptEntry) {
            jsParts.push(await scriptEntry.async('text'));
            script.remove();
          }
        } else if (!src && script.textContent) {
          jsParts.push(script.textContent);
          script.remove();
        }
      }

      const completeHtml = `<!doctype html>\n${doc.documentElement.outerHTML}`;
      setHtml(completeHtml);
      setCss(cssParts.join('\n\n'));
      setJavascript(jsParts.join('\n\n'));
      setTab('html');
      setSaveState('unsaved');
      setTimeout(() => void saveSite(), 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ZIP import failed.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  }

  function addContactForm() {
    setHtml((current) => insertBeforeBodyEnd(current, CONTACT_FORM_HTML));
    setCss((current) => `${current}\n\n${CONTACT_FORM_CSS}`);
    setTab('html');
    markChanged();
  }

  function addGoogleFont() {
    const family = fontFamily.trim();
    if (!family) return;
    const encoded = family.replace(/ /g, '+');
    const importLine = `@import url('https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700;800;900&display=swap');`;
    const bodyRule = `\nbody { font-family: '${family}', sans-serif; }`;
    setCss((current) => `${importLine}\n${current}${bodyRule}`);
    setTab('css');
    markChanged();
  }

  function addCustomFont() {
    const url = customFontUrl.trim();
    const family = customFontFamily.trim();
    if (!url || !family) {
      setError('Enter both a font stylesheet URL and the font-family name.');
      return;
    }
    const importLine = `@import url('${url.replace(/'/g, '%27')}');`;
    setCss((current) => `${importLine}\n${current}\nbody { font-family: '${family}', sans-serif; }`);
    setTab('css');
    markChanged();
  }

  async function updatePublishing(publish: boolean) {
    if (!site) return;
    const slug = sanitizeSlug(publishSlug);
    if (!slug) return setError('Enter a valid published-site name.');
    if (formEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
      return setError('Enter a valid form recipient email.');
    }

    setPublishing(true);
    setError('');
    try {
      await saveSite();
      const payload = {
        slug,
        form_email: formEmail.trim() || null,
        is_published: publish,
        published_at: publish ? new Date().toISOString() : null
      };
      const { error: updateError } = await getSupabase()
        .from('sites')
        .update(payload)
        .eq('id', site.id);
      if (updateError) throw updateError;
      setSite({ ...site, ...payload });
      setPublishSlug(slug);
      setShowPublish(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Publishing failed.');
    } finally {
      setPublishing(false);
    }
  }

  const status =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'unsaved'
        ? 'Unsaved changes'
        : saveState === 'error'
          ? 'Save failed'
          : 'Saved';

  if (loading) {
    return <div className="loading-screen"><div><div className="spinner"/><p>Opening code editor…</p></div></div>;
  }

  if (!site) {
    return <div className="loading-screen"><div>{error || 'Website not found.'}<br/><Link href="/dashboard">Return to dashboard</Link></div></div>;
  }

  return (
    <div className="code-builder-shell">
      <header className="code-builder-header">
        <div className="code-builder-brand">
          <Link href="/dashboard" className="button-ghost button-small" style={{ color: 'white' }}>← Dashboard</Link>
          <strong>{site.name}</strong>
          <span className="save-status">{status}</span>
        </div>
        <div className="code-builder-actions">
          <input ref={zipInput} type="file" accept=".zip,application/zip" hidden onChange={importZip}/>
          <button className="button-ghost button-small" style={{ color: 'white' }} onClick={() => zipInput.current?.click()} disabled={importing}>{importing ? 'Importing…' : 'Import ZIP'}</button>
          <button className="button-ghost button-small" style={{ color: 'white' }} onClick={addContactForm}>+ Contact form</button>
          <button className="button-secondary button-small" onClick={() => setShowPublish(true)}>{site.is_published ? 'Publishing settings' : 'Publish'}</button>
          <button className="button-primary button-small" onClick={() => void saveSite()}>Save</button>
        </div>
      </header>

      {error && <div className="message-error code-builder-error" onClick={() => setError('')}>{error}</div>}

      <section className="code-builder-main">
        <aside className="code-builder-sidebar">
          <h3>Code</h3>
          <button className={tab === 'html' ? 'code-side-tab active' : 'code-side-tab'} onClick={() => setTab('html')}>HTML</button>
          <button className={tab === 'css' ? 'code-side-tab active' : 'code-side-tab'} onClick={() => setTab('css')}>CSS</button>
          <button className={tab === 'javascript' ? 'code-side-tab active' : 'code-side-tab'} onClick={() => setTab('javascript')}>JavaScript</button>

          <div className="code-tool-section">
            <h3>Fonts</h3>
            <label>Online font</label>
            <select className="input" value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>
              {COMMON_FONTS.map((font) => <option key={font}>{font}</option>)}
            </select>
            <button className="button-secondary button-small" onClick={addGoogleFont}>Add font</button>
            <p className="code-help">For any font not listed, paste its stylesheet URL and exact font-family name.</p>
            <input className="input" value={customFontUrl} onChange={(event) => setCustomFontUrl(event.target.value)} placeholder="https://fonts.example.com/font.css"/>
            <input className="input" value={customFontFamily} onChange={(event) => setCustomFontFamily(event.target.value)} placeholder="Font family name"/>
            <button className="button-secondary button-small" onClick={addCustomFont}>Add custom font</button>
          </div>
        </aside>

        <div className="code-builder-editor">
          <div className="code-editor-titlebar">
            <strong>{tab === 'html' ? 'index.html' : tab === 'css' ? 'styles.css' : 'script.js'}</strong>
            <span>Paste or edit code. Preview updates immediately.</span>
          </div>
          {tab === 'html' && <textarea className="code-builder-textarea" value={html} onChange={(event) => updateHtml(event.target.value)} spellCheck={false}/>} 
          {tab === 'css' && <textarea className="code-builder-textarea" value={css} onChange={(event) => updateCss(event.target.value)} spellCheck={false}/>} 
          {tab === 'javascript' && <textarea className="code-builder-textarea" value={javascript} onChange={(event) => updateJavascript(event.target.value)} spellCheck={false}/>} 
        </div>

        <div className="code-builder-preview">
          <div className="code-editor-titlebar">
            <strong>Live preview</strong>
            {site.is_published && <a href={publicUrl} target="_blank" rel="noreferrer">Open live site ↗</a>}
          </div>
          <iframe
            title="Live website preview"
            className="code-preview-frame"
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            srcDoc={previewDocument}
          />
        </div>
      </section>

      {showPublish && (
        <div className="modal-backdrop">
          <div className="modal publish-modal">
            <div className="modal-header">
              <h2>Publish website</h2>
              <button className="button-ghost" onClick={() => setShowPublish(false)}>✕</button>
            </div>
            <div className="modal-body form-stack">
              <div className="field">
                <label>Published website address</label>
                <div className="published-path-field">
                  <span>{publicBaseUrl.replace(/\/$/, '')}/</span>
                  <input className="input" value={publishSlug} onChange={(event) => setPublishSlug(event.target.value)}/>
                </div>
              </div>
              <div className="field">
                <label>Send website form submissions to</label>
                <input type="email" className="input" value={formEmail} onChange={(event) => setFormEmail(event.target.value)} placeholder="you@example.com"/>
                <small>The contact-form block and other normal HTML forms send to this address.</small>
              </div>
              {site.is_published && <div className="message-success">Live at <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></div>}
            </div>
            <div className="modal-footer">
              {site.is_published && <button className="button-danger" disabled={publishing} onClick={() => void updatePublishing(false)}>Unpublish</button>}
              <button className="button-secondary" onClick={() => setShowPublish(false)}>Cancel</button>
              <button className="button-primary" disabled={publishing} onClick={() => void updatePublishing(true)}>{publishing ? 'Publishing…' : 'Save and publish'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
