'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from 'grapesjs';
import JSZip, { type JSZipObject } from 'jszip';
import 'grapesjs/dist/css/grapes.min.css';
import { downloadSiteZip } from '@/lib/export-site';
import { getSupabase } from '@/lib/supabase';
import type { Site } from '@/lib/types';

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

function getMimeType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
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

  return mimeTypes[extension ?? ''] ?? 'application/octet-stream';
}



function previewDocument(html: string, css: string, javascript: string, runScripts: boolean) {
  const safeScript = runScripts ? javascript.replace(/<\/script/gi, '<\\/script') : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}${runScripts ? `<script>${safeScript}</script>` : ''}</body></html>`;
}

function splitFullHtml(source: string) {
  if (!source.trim()) return { html: '', css: '', javascript: '' };
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(source, 'text/html');
  const styles = Array.from(documentNode.querySelectorAll('style')).map((node) => node.textContent ?? '').join('\n');
  const scripts = Array.from(documentNode.querySelectorAll('script:not([src])')).map((node) => node.textContent ?? '').join('\n');
  documentNode.querySelectorAll('style, script, link[rel="stylesheet"]').forEach((node) => node.remove());
  return { html: documentNode.body.innerHTML || source, css: styles, javascript: scripts };
}

function normalizeAssetPath(value: string) {
  return decodeURIComponent(value.split('?')[0].split('#')[0]).replace(/^\.\//, '').replace(/^\//, '');
}

function replaceAssetReferences(source: string, assets: Map<string, string>) {
  let result = source;
  const entries = Array.from(assets.entries()).sort((a, b) => b[0].length - a[0].length);
  for (const [path, url] of entries) {
    const variants = new Set([path, `./${path}`, `/${path}`, path.split('/').pop() || path]);
    for (const variant of variants) result = result.split(variant).join(url);
  }
  return result;
}

export function EditorClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const editorRef = useRef<Editor | null>(null);
  const siteRef = useRef<Site | null>(null);
  const javascriptRef = useRef('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const zipRef = useRef<HTMLInputElement | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorReady, setEditorReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [javascript, setJavascript] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [runScripts, setRunScripts] = useState(false);
  const [importBundle, setImportBundle] = useState('');
  const [importHtml, setImportHtml] = useState('');
  const [importCss, setImportCss] = useState('');
  const [importJs, setImportJs] = useState('');
  const [importTab, setImportTab] = useState<'bundle' | 'separate'>('bundle');
  const [codeTab, setCodeTab] = useState<'html' | 'css' | 'javascript'>('html');
  const [publishSlug, setPublishSlug] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [importingZip, setImportingZip] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadSite();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      editorRef.current?.destroy();
    };
  }, [params.id]);

  // The original starter initialized GrapesJS before #gjs existed. This waits until the site is rendered.
  useEffect(() => {
    if (!loading && site && !editorRef.current) void initializeEditor(site);
  }, [loading, site?.id]);

  async function loadSite() {
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return router.replace('/login');
      const { data, error: fetchError } = await supabase.from('sites').select('*').eq('id', params.id).single();
      if (fetchError) throw fetchError;
      const loaded = data as Site;
      siteRef.current = loaded;
      javascriptRef.current = loaded.javascript || '';
      setJavascript(loaded.javascript || '');
      setPublishSlug(loaded.slug);
      setFormEmail(loaded.form_email || '');
      setSite(loaded);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this website.');
    } finally {
      setLoading(false);
    }
  }

  async function initializeEditor(loadedSite: Site) {
    const grapesjs = (await import('grapesjs')).default;
    const editor = grapesjs.init({
      container: '#gjs', height: '100%', width: 'auto', storageManager: false, fromElement: false,
      selectorManager: { componentFirst: true },
      canvas: { styles: [], scripts: [] },
      deviceManager: { devices: [
        { id: 'desktop', name: 'Desktop', width: '' },
        { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px' },
        { id: 'mobile', name: 'Mobile', width: '390px', widthMedia: '575px' }
      ]}
    });
    editor.BlockManager.add('section', { label: 'Section', category: 'Layout', content: '<section style="padding:80px 32px"><div style="max-width:1100px;margin:auto"><h2>New section</h2><p>Start writing here.</p></div></section>' });
    editor.BlockManager.add('two-columns', { label: '2 columns', category: 'Layout', content: '<section style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px;padding:64px 32px"><div><h3>Column one</h3><p>Add content.</p></div><div><h3>Column two</h3><p>Add content.</p></div></section>' });
    editor.BlockManager.add('heading', { label: 'Heading', category: 'Content', content: '<h2>New heading</h2>' });
    editor.BlockManager.add('text', { label: 'Text', category: 'Content', content: '<p>Double-click to edit this text.</p>' });
    editor.BlockManager.add('button', { label: 'Button', category: 'Content', content: '<a href="#" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#5b5cf0;color:#fff;text-decoration:none">Button</a>' });
    editor.BlockManager.add('form', { label: 'Contact form', category: 'Content', content: '<form><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Message<textarea name="message" required></textarea></label><input name="_cf_website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><button type="submit">Send message</button><p data-canvasforge-status></p></form>' });
    editor.BlockManager.add('image', { label: 'Image', category: 'Media', activate: true, content: { type: 'image' } });
    editor.BlockManager.add('video', { label: 'Video', category: 'Media', content: { type: 'video', src: 'https://www.youtube.com/embed/dQw4w9WgXcQ' } });
    if (loadedSite.project_data && Object.keys(loadedSite.project_data).length) editor.loadProjectData(loadedSite.project_data as never);
    else { editor.setComponents(loadedSite.html || ''); editor.setStyle(loadedSite.css || ''); }
    editor.on('update', queueSave);

    // Remove GrapesJS's built-in HTML/CSS-only code viewer so users always use
    // CanvasForge's HTML/CSS/JavaScript editor instead.
    editor.Panels.getPanels().forEach((panel: any) => {
      const buttons = panel.get('buttons');
    
      buttons?.models
        .filter(
          (button: any) =>
            button.get('command') === 'export-template' ||
            button.get('id') === 'export-template'
        )
        .forEach((button: any) => {
          buttons.remove(button);
        });
    });

    editorRef.current = editor;
    setEditorReady(true);
  }

  function queueSave() {
    setSaveState('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void saveSite(), 900);
  }

  async function saveSite(nameOverride?: string) {
    const editor = editorRef.current;
    const current = siteRef.current;
    if (!editor || !current) return;
    setSaveState('saving');
    try {
      const payload = {
        name: (nameOverride ?? current.name).trim() || 'Untitled website',
        html: editor.getHtml(), css: editor.getCss(), javascript: javascriptRef.current,
        project_data: editor.getProjectData(), updated_at: new Date().toISOString()
      };
      const { error: updateError } = await getSupabase().from('sites').update(payload).eq('id', current.id);
      if (updateError) throw updateError;
      const updated = { ...current, ...payload } as Site;
      siteRef.current = updated; setSite(updated); setSaveState('saved');
    } catch (caught) { setSaveState('error'); setError(caught instanceof Error ? caught.message : 'Save failed.'); }
  }

  function updateName(value: string) {
    if (siteRef.current) siteRef.current = { ...siteRef.current, name: value };
    setSite((current) => current ? { ...current, name: value } : current);
    queueSave();
  }

  function openCodeModal() {
    const editor = editorRef.current;
    setImportTab('separate');
    setCodeTab('html');
    setImportHtml(editor?.getHtml() || siteRef.current?.html || '');
    setImportCss(editor?.getCss() || siteRef.current?.css || '');
    setImportJs(javascriptRef.current);
    setShowImport(true);
  }

  function openJavascriptModal() {
    const editor = editorRef.current;
    setImportTab('separate');
    setCodeTab('javascript');
    setImportHtml(editor?.getHtml() || siteRef.current?.html || '');
    setImportCss(editor?.getCss() || siteRef.current?.css || '');
    setImportJs(javascriptRef.current);
    setShowImport(true);
  }

  function applyImport() {
    const editor = editorRef.current;
    if (!editor) return;
    const parsed = importTab === 'bundle' ? splitFullHtml(importBundle) : { html: importHtml, css: importCss, javascript: importJs };
    editor.setComponents(parsed.html || '<main><h1>Start editing</h1></main>');
    editor.setStyle(parsed.css || '');
    javascriptRef.current = parsed.javascript || '';
    setJavascript(parsed.javascript || '');
    setShowImport(false); queueSave();
  }

async function uploadAsset(file: File, pathHint?: string) {
  const current = siteRef.current;
  if (!current) throw new Error('Website not loaded.');

  const supabase = getSupabase();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    throw new Error('Your session has expired.');
  }

  const cleanName = (pathHint || file.name)
    .replace(/[^a-zA-Z0-9._/-]/g, '-')
    .replace(/\.\./g, '');

  const fileName = cleanName.split('/').pop() || file.name;

  const path =
    `${authData.user.id}/${current.id}/${crypto.randomUUID()}-${fileName}`;

  const contentType =
    getMimeType(pathHint || file.name);

  const { error: uploadError } = await supabase.storage
    .from('site-assets')
    .upload(path, file, {
      cacheControl: '31536000',
      contentType,
      upsert: true
    });

  if (uploadError) {
    throw new Error(
      `Could not upload ${pathHint || file.name}: ${uploadError.message}`
    );
  }

  return supabase.storage
    .from('site-assets')
    .getPublicUrl(path).data.publicUrl;
}

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError('');
    try {
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) throw new Error('Choose an image no larger than 8 MB.');
      const url = await uploadAsset(file);
      const editor = editorRef.current;
      if (!editor) throw new Error('The editor is not ready yet.');

      editor.AssetManager.add({ src: url, name: file.name });
      const selected = editor.getSelected();
      const selectedType = String(selected?.get('type') || '');
      const selectedTag = String(selected?.get('tagName') || '').toLowerCase();

      if (selected && (selectedType === 'image' || selectedTag === 'img')) {
        selected.addAttributes({ src: url, alt: selected.getAttributes().alt || file.name.replace(/\.[^.]+$/, '') });
        editor.select(selected);
      } else {
        const image = editor.addComponents({
          type: 'image',
          attributes: { src: url, alt: file.name.replace(/\.[^.]+$/, '') },
          style: { 'max-width': '100%', height: 'auto', display: 'block' }
        })[0];
        if (image) editor.select(image);
      }

      queueSave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  }

  async function importZip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportingZip(true); setError('');
    try {
      const zip = await JSZip.loadAsync(file);
      const files = (Object.values(zip.files) as JSZipObject[]).filter((entry) => !entry.dir && !entry.name.includes('__MACOSX'));
      const htmlEntry = files.find((entry) => /(^|\/)index\.html?$/i.test(entry.name)) || files.find((entry) => /\.html?$/i.test(entry.name));
      if (!htmlEntry) throw new Error('The ZIP must include index.html.');
      let source = await htmlEntry.async('text');
      const assetMap = new Map<string, string>();
      for (const entry of files) {
        if (!/\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(entry.name)) continue;
        const blob = await entry.async('blob');
        const uploaded = new File([blob], entry.name.split('/').pop() || 'image', { type: blob.type || 'application/octet-stream' });
        const url = await uploadAsset(uploaded, entry.name);
        assetMap.set(normalizeAssetPath(entry.name), url);
      }
      source = replaceAssetReferences(source, assetMap);
      const parsed = splitFullHtml(source);
      const cssParts: string[] = [parsed.css];
      const jsParts: string[] = [parsed.javascript];
      for (const entry of files) {
        if (/\.css$/i.test(entry.name)) cssParts.push(replaceAssetReferences(await entry.async('text'), assetMap));
        if (/\.js$/i.test(entry.name)) jsParts.push(await entry.async('text'));
      }
      editorRef.current?.setComponents(parsed.html);
      editorRef.current?.setStyle(cssParts.filter(Boolean).join('\n'));
      javascriptRef.current = jsParts.filter(Boolean).join('\n');
      setJavascript(javascriptRef.current);
      queueSave();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'ZIP import failed.'); }
    finally { setImportingZip(false); event.target.value = ''; }
  }

  async function updatePublishing(publish: boolean) {
    const current = siteRef.current;
    if (!current) return;
    const slug = publishSlug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) return setError('Enter a valid subdomain name.');
    if (formEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) return setError('Enter a valid form recipient email.');
    setPublishing(true); setError('');
    try {
      await saveSite();
      const payload = { slug, form_email: formEmail.trim() || null, is_published: publish, published_at: publish ? new Date().toISOString() : null };
      const { error: updateError } = await getSupabase().from('sites').update(payload).eq('id', current.id);
      if (updateError) throw updateError;
      const updated = { ...siteRef.current!, ...payload } as Site;
      siteRef.current = updated; setSite(updated); setPublishSlug(slug); setShowPublish(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Publishing failed. That subdomain may already be in use.'); }
    finally { setPublishing(false); }
  }

  const previewSrc = useMemo(() => previewDocument(editorRef.current?.getHtml() || site?.html || '', editorRef.current?.getCss() || site?.css || '', javascript, runScripts), [showPreview, runScripts, javascript, site]);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'canvasforge.com';
  const publicUrl = site ? `https://${site.slug}.${rootDomain}` : '';
  const statusText = !editorReady ? 'Loading editor…' : saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved changes' : saveState === 'error' ? 'Save failed' : 'Saved';

  if (loading) return <div className="loading-screen"><div><div className="spinner"/><p>Opening editor…</p></div></div>;
  if (!site) return <div className="loading-screen"><div>{error || 'Website not found.'}<br/><Link href="/dashboard">Return to dashboard</Link></div></div>;

  return <div className="editor-shell">
    <header className="editor-bar">
      <div className="editor-left"><Link className="button-ghost button-small" style={{color:'white'}} href="/dashboard">← Dashboard</Link><input className="editor-name" value={site.name} onChange={(e)=>updateName(e.target.value)} maxLength={80}/><span className="save-status">{statusText}</span></div>
      <div className="editor-right">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadImage}/><input ref={zipRef} type="file" accept=".zip,application/zip" hidden onChange={importZip}/>
        <button className="button-ghost button-small hide-mobile" style={{color:'white'}} disabled={uploadingImage} title="Select an image on the page to replace it, or upload with nothing selected to add a new image" onClick={()=>fileRef.current?.click()}>{uploadingImage?'Uploading…':'Add / replace photo'}</button>
        <button className="button-ghost button-small" style={{color:'white'}} disabled={importingZip} onClick={()=>zipRef.current?.click()}>{importingZip?'Importing…':'Import ZIP'}</button>
        <button className="button-ghost button-small" style={{color:'white'}} onClick={openCodeModal}>HTML / CSS</button>
        <button className="button-ghost button-small" style={{color:'white'}} onClick={openJavascriptModal}>JavaScript</button>
        <button className="button-ghost button-small" style={{color:'white'}} onClick={()=>setShowPreview(true)}>Preview</button>
        <button className="button-secondary button-small" onClick={()=>setShowPublish(true)}>{site.is_published?'Publishing settings':'Publish'}</button>
        <button className="button-primary button-small" onClick={()=>saveSite()}>Save</button>
      </div>
    </header>
    {error && <div className="message-error floating-error" onClick={()=>setError('')}>{error}</div>}
    <main className="editor-main"><div id="gjs" /></main>

    {showImport && <div className="modal-backdrop"><div className="modal"><div className="modal-header"><h2>Edit or import code</h2><button className="button-ghost" onClick={()=>setShowImport(false)}>✕</button></div><div className="modal-body"><div className="tabs"><button className={`tab ${importTab==='bundle'?'active':''}`} onClick={()=>setImportTab('bundle')}>Full HTML</button><button className={`tab ${importTab==='separate'?'active':''}`} onClick={()=>setImportTab('separate')}>Separate files</button></div>{importTab==='bundle'?<div className="field"><label>Paste complete HTML</label><textarea className="textarea tall" value={importBundle} onChange={(e)=>setImportBundle(e.target.value)}/><small>Inline &lt;script&gt; code is imported automatically. For sites with local image folders, use Import ZIP instead.</small></div>:<div className="field"><div className="tabs code-tabs"><button className={`tab ${codeTab==='html'?'active':''}`} onClick={()=>setCodeTab('html')}>HTML</button><button className={`tab ${codeTab==='css'?'active':''}`} onClick={()=>setCodeTab('css')}>CSS</button><button className={`tab ${codeTab==='javascript'?'active':''}`} onClick={()=>setCodeTab('javascript')}>JavaScript</button></div>{codeTab==='html'&&<textarea aria-label="HTML code" className="textarea code-editor-textarea" value={importHtml} onChange={(e)=>setImportHtml(e.target.value)} spellCheck={false}/>} {codeTab==='css'&&<textarea aria-label="CSS code" className="textarea code-editor-textarea" value={importCss} onChange={(e)=>setImportCss(e.target.value)} spellCheck={false}/>} {codeTab==='javascript'&&<><textarea aria-label="JavaScript code" className="textarea code-editor-textarea" value={importJs} onChange={(e)=>setImportJs(e.target.value)} spellCheck={false} placeholder="// Add your JavaScript here"/><small>JavaScript is saved with the site and runs in published sites. In Preview, enable “Run custom JavaScript.”</small></>}</div>}</div><div className="modal-footer"><button className="button-secondary" onClick={()=>setShowImport(false)}>Cancel</button><button className="button-primary" onClick={applyImport}>Apply code</button></div></div></div>}

    {showPreview && <div className="modal-backdrop"><div className="modal large"><div className="modal-header"><h2>Preview</h2><button className="button-ghost" onClick={()=>setShowPreview(false)}>✕</button></div><div className="modal-body"><label className="checkbox-row"><input type="checkbox" checked={runScripts} onChange={(e)=>setRunScripts(e.target.checked)}/>Run custom JavaScript</label><iframe className="preview-frame" title="Website preview" sandbox={runScripts?'allow-scripts allow-forms allow-popups':''} srcDoc={previewSrc}/></div></div></div>}

    {showPublish && <div className="modal-backdrop"><div className="modal publish-modal"><div className="modal-header"><h2>Publish website</h2><button className="button-ghost" onClick={()=>setShowPublish(false)}>✕</button></div><div className="modal-body form-stack"><div className="field"><label>CanvasForge subdomain</label><div className="domain-field"><input className="input" value={publishSlug} onChange={(e)=>setPublishSlug(e.target.value)}/><span>.{rootDomain}</span></div></div><div className="field"><label>Send all website forms to</label><input type="email" className="input" value={formEmail} onChange={(e)=>setFormEmail(e.target.value)} placeholder="you@example.com"/><small>Any normal HTML &lt;form&gt; on the published site will send here.</small></div>{site.is_published&&<div className="message-success">Live at <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></div>}</div><div className="modal-footer">{site.is_published&&<button className="button-danger" disabled={publishing} onClick={()=>updatePublishing(false)}>Unpublish</button>}<button className="button-secondary" onClick={()=>setShowPublish(false)}>Cancel</button><button className="button-primary" disabled={publishing} onClick={()=>updatePublishing(true)}>{publishing?'Publishing…':'Save and publish'}</button></div></div></div>}
  </div>;
}
