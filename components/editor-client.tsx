'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import { downloadSiteZip } from '@/lib/export-site';
import { getSupabase } from '@/lib/supabase';
import type { Site } from '@/lib/types';

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

function previewDocument(html: string, css: string, javascript: string, runScripts: boolean) {
  const scriptPolicy = runScripts ? "'unsafe-inline' https:" : "'none'";
  const connectPolicy = runScripts ? 'https:' : "'none'";
  const safeScript = runScripts ? javascript.replace(/<\/script/gi, '<\\/script') : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; style-src 'unsafe-inline' https:; font-src https: data:; script-src ${scriptPolicy}; connect-src ${connectPolicy}; media-src https: data: blob:; frame-src https:; form-action 'none'; base-uri 'none';" />
<style>${css}</style>
</head>
<body>
${html}
${runScripts ? `<script>${safeScript}</script>` : ''}
</body>
</html>`;
}

function splitFullHtml(source: string) {
  if (!source.trim()) return { html: '', css: '', javascript: '' };
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(source, 'text/html');
  const styles = Array.from(documentNode.querySelectorAll('style')).map((node) => node.textContent ?? '').join('\n');
  const scripts = Array.from(documentNode.querySelectorAll('script')).map((node) => node.textContent ?? '').join('\n');
  documentNode.querySelectorAll('style, script').forEach((node) => node.remove());
  return { html: documentNode.body.innerHTML || source, css: styles, javascript: scripts };
}

export function EditorClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const editorRef = useRef<Editor | null>(null);
  const siteRef = useRef<Site | null>(null);
  const javascriptRef = useRef('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [javascript, setJavascript] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [runScripts, setRunScripts] = useState(false);
  const [importBundle, setImportBundle] = useState('');
  const [importHtml, setImportHtml] = useState('');
  const [importCss, setImportCss] = useState('');
  const [importJs, setImportJs] = useState('');
  const [importTab, setImportTab] = useState<'bundle' | 'separate'>('bundle');
  const [error, setError] = useState('');

  useEffect(() => {
    void loadSite();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [params.id]);

  async function loadSite() {
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace('/login');
        return;
      }
      const { data, error: fetchError } = await supabase.from('sites').select('*').eq('id', params.id).single();
      if (fetchError) throw fetchError;
      const loadedSite = data as Site;
      siteRef.current = loadedSite;
      javascriptRef.current = loadedSite.javascript ?? '';
      setSite(loadedSite);
      setJavascript(loadedSite.javascript ?? '');
      await initializeEditor(loadedSite);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this website.');
    } finally {
      setLoading(false);
    }
  }

  async function initializeEditor(loadedSite: Site) {
    const grapesjs = (await import('grapesjs')).default;
    editorRef.current?.destroy();
    const editor = grapesjs.init({
      container: '#gjs',
      height: '100%',
      width: 'auto',
      storageManager: false,
      fromElement: false,
      selectorManager: { componentFirst: true },
      canvas: {
        styles: [],
        scripts: []
      },
      deviceManager: {
        devices: [
          { id: 'desktop', name: 'Desktop', width: '' },
          { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px' },
          { id: 'mobile', name: 'Mobile', width: '390px', widthMedia: '575px' }
        ]
      },
    });

    editor.BlockManager.add('section', {
      label: 'Section',
      category: 'Layout',
      content: '<section style="padding:80px 32px"><div style="max-width:1100px;margin:auto"><h2>New section</h2><p>Start writing here.</p></div></section>'
    });
    editor.BlockManager.add('two-columns', {
      label: '2 columns',
      category: 'Layout',
      content: '<section style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px;padding:64px 32px"><div><h3>Column one</h3><p>Add content.</p></div><div><h3>Column two</h3><p>Add content.</p></div></section>'
    });
    editor.BlockManager.add('heading', { label: 'Heading', category: 'Content', content: '<h2>New heading</h2>' });
    editor.BlockManager.add('text', { label: 'Text', category: 'Content', content: '<p>Double-click to edit this text.</p>' });
    editor.BlockManager.add('button', { label: 'Button', category: 'Content', content: '<a href="#" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#5b5cf0;color:#fff;text-decoration:none">Button</a>' });
    editor.BlockManager.add('image', { label: 'Image', category: 'Media', activate: true, content: { type: 'image' } });
    editor.BlockManager.add('video', { label: 'Video', category: 'Media', content: { type: 'video', src: 'https://www.youtube.com/embed/dQw4w9WgXcQ' } });

    if (loadedSite.project_data && Object.keys(loadedSite.project_data).length > 0) {
      editor.loadProjectData(loadedSite.project_data as never);
    } else {
      editor.setComponents(loadedSite.html || '');
      editor.setStyle(loadedSite.css || '');
    }

    editor.on('update', () => queueSave());
    editor.on('component:selected', () => setSaveState((current) => current));
    editorRef.current = editor;
  }

  function queueSave() {
    setSaveState('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void saveSite(), 900);
  }

  async function saveSite(nameOverride?: string) {
    const editor = editorRef.current;
    const currentSite = siteRef.current;
    if (!editor || !currentSite) return;
    setSaveState('saving');
    try {
      const nextName = nameOverride ?? currentSite.name;
      const payload = {
        name: nextName.trim() || 'Untitled website',
        html: editor.getHtml(),
        css: editor.getCss(),
        javascript: javascriptRef.current,
        project_data: editor.getProjectData(),
        updated_at: new Date().toISOString()
      };
      const supabase = getSupabase();
      const { error: updateError } = await supabase.from('sites').update(payload).eq('id', currentSite.id);
      if (updateError) throw updateError;
      const updatedSite = { ...currentSite, ...payload } as Site;
      siteRef.current = updatedSite;
      setSite(updatedSite);
      setSaveState('saved');
    } catch (caught) {
      setSaveState('error');
      setError(caught instanceof Error ? caught.message : 'Save failed.');
    }
  }

  function updateName(value: string) {
    if (siteRef.current) siteRef.current = { ...siteRef.current, name: value };
    setSite((current) => current ? { ...current, name: value } : current);
    setSaveState('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void saveSite(value), 900);
  }


  function openCodeModal() {
    const editor = editorRef.current;
    setImportTab('separate');
    setImportHtml(editor?.getHtml() ?? siteRef.current?.html ?? '');
    setImportCss(editor?.getCss() ?? siteRef.current?.css ?? '');
    setImportJs(javascriptRef.current);
    setImportBundle('');
    setShowImport(true);
  }

  function applyImport() {
    const editor = editorRef.current;
    if (!editor) return;
    let nextHtml = importHtml;
    let nextCss = importCss;
    let nextJs = importJs;
    if (importTab === 'bundle') {
      const parsed = splitFullHtml(importBundle);
      nextHtml = parsed.html;
      nextCss = parsed.css;
      nextJs = parsed.javascript;
    }
    editor.setComponents(nextHtml || '<main><h1>Start editing</h1></main>');
    editor.setStyle(nextCss || '');
    javascriptRef.current = nextJs || '';
    setJavascript(nextJs || '');
    setShowImport(false);
    setImportBundle('');
    setImportHtml('');
    setImportCss('');
    setImportJs('');
    queueSave();
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !site) return;
    if (!file.type.startsWith('image/')) {
      setError('Only image files can be uploaded.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Images must be 8 MB or smaller.');
      return;
    }
    try {
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('Your session has expired.');
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${authData.user.id}/${site.id}/${crypto.randomUUID()}-${cleanName}`;
      const { error: uploadError } = await supabase.storage.from('site-assets').upload(path, file, { cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path);
      editorRef.current?.AssetManager.add({ src: data.publicUrl, name: file.name });
      editorRef.current?.AssetManager.open();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Image upload failed.');
    } finally {
      event.target.value = '';
    }
  }

  const previewSrc = useMemo(() => {
    const editor = editorRef.current;
    return previewDocument(editor?.getHtml() ?? site?.html ?? '', editor?.getCss() ?? site?.css ?? '', javascript, runScripts);
  }, [showPreview, runScripts, javascript, site]);

  const statusText = saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved changes' : saveState === 'error' ? 'Save failed' : 'Saved';

  if (loading) return <div className="loading-screen"><div><div className="spinner"/><p>Opening editor…</p></div></div>;
  if (!site) return <div className="loading-screen"><div>{error || 'Website not found.'}<br/><Link href="/dashboard">Return to dashboard</Link></div></div>;

  return (
    <div className="editor-shell">
      <header className="editor-bar">
        <div className="editor-left">
          <Link className="button-ghost button-small" style={{ color: 'white' }} href="/dashboard">← Dashboard</Link>
          <input className="editor-name" value={site.name} onChange={(event) => updateName(event.target.value)} aria-label="Website name" maxLength={80}/>
          <span className="save-status">{statusText}</span>
        </div>
        <div className="editor-right">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={uploadImage}/>
          <button className="button-ghost button-small hide-mobile" style={{ color: 'white' }} onClick={() => fileRef.current?.click()}>Upload image</button>
          <button className="button-ghost button-small" style={{ color: 'white' }} onClick={openCodeModal}>Code / Import</button>
          <button className="button-ghost button-small" style={{ color: 'white' }} onClick={() => setShowPreview(true)}>Preview</button>
          <button className="button-secondary button-small hide-mobile" onClick={() => downloadSiteZip(site.name, editorRef.current?.getHtml() ?? site.html, editorRef.current?.getCss() ?? site.css, javascript)}>Export ZIP</button>
          <button className="button-primary button-small" onClick={() => saveSite()}>Save</button>
        </div>
      </header>
      {error && <div className="message-error" style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 150, maxWidth: 460 }} onClick={() => setError('')}>{error}</div>}
      <main className="editor-main"><div id="gjs" /></main>

      {showImport && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header"><h2>Edit or import code</h2><button className="button-ghost" onClick={() => setShowImport(false)}>✕</button></div>
            <div className="modal-body">
              <div className="tabs">
                <button className={`tab ${importTab === 'bundle' ? 'active' : ''}`} onClick={() => setImportTab('bundle')}>Full HTML file</button>
                <button className={`tab ${importTab === 'separate' ? 'active' : ''}`} onClick={() => setImportTab('separate')}>Separate files</button>
              </div>
              {importTab === 'bundle' ? (
                <div className="field">
                  <label htmlFor="bundle">Paste a complete HTML document</label>
                  <textarea id="bundle" className="textarea" style={{ minHeight: 330 }} value={importBundle} onChange={(event) => setImportBundle(event.target.value)} placeholder={'<!doctype html>\n<html>…</html>'}/>
                  <small>Inline &lt;style&gt; and &lt;script&gt; content will be separated automatically. External build-tool projects should be exported to plain HTML first.</small>
                </div>
              ) : (
                <div className="code-grid">
                  <div className="field full"><label>HTML</label><textarea className="textarea" value={importHtml} onChange={(event) => setImportHtml(event.target.value)} /></div>
                  <div className="field"><label>CSS</label><textarea className="textarea" value={importCss} onChange={(event) => setImportCss(event.target.value)} /></div>
                  <div className="field"><label>JavaScript</label><textarea className="textarea" value={importJs} onChange={(event) => setImportJs(event.target.value)} /></div>
                </div>
              )}
            </div>
            <div className="modal-footer"><button className="button-secondary" onClick={() => setShowImport(false)}>Cancel</button><button className="button-primary" onClick={applyImport}>Apply code</button></div>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal large">
            <div className="modal-header"><h2>Isolated preview</h2><button className="button-ghost" onClick={() => setShowPreview(false)}>✕</button></div>
            <div className="modal-body">
              <p className="preview-note">The preview runs in a sandbox without access to CanvasForge cookies or storage.</p>
              <label className="checkbox-row"><input type="checkbox" checked={runScripts} onChange={(event) => setRunScripts(event.target.checked)}/>Run custom JavaScript in the isolated preview</label>
              <iframe className="preview-frame" title="Website preview" sandbox={runScripts ? 'allow-scripts allow-forms allow-popups' : ''} srcDoc={previewSrc}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
