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
  const clean = decodeURIComponent(value.split('?')[0].split('#')[0])
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  const parts: string[] = [];
  for (const part of clean.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function zipDirectory(path: string) {
  const normalized = normalizeAssetPath(path);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

function joinZipPath(baseDir: string, value: string) {
  if (/^(?:[a-z]+:|\/\/|data:|blob:|#)/i.test(value.trim())) return '';
  return normalizeAssetPath(`${baseDir ? `${baseDir}/` : ''}${value}`);
}

function buildAssetVariants(
  assets: Map<string, string>,
  siteRoot: string
) {
  const variants = new Map<string, string>();
  const basenameCounts = new Map<string, number>();

  for (const path of assets.keys()) {
    const basename = path.split('/').pop() || path;
    basenameCounts.set(basename, (basenameCounts.get(basename) || 0) + 1);
  }

  for (const [fullPath, hostedUrl] of assets) {
    const cleanPath = normalizeAssetPath(fullPath);
    const relativePath = siteRoot && cleanPath.startsWith(`${siteRoot}/`)
      ? cleanPath.slice(siteRoot.length + 1)
      : cleanPath;
    const basename = cleanPath.split('/').pop() || cleanPath;

    const candidates = [
      cleanPath,
      `./${cleanPath}`,
      `/${cleanPath}`,
      relativePath,
      `./${relativePath}`,
      `/${relativePath}`
    ];

    if (basenameCounts.get(basename) === 1) candidates.push(basename);

    for (const candidate of candidates) {
      if (candidate) variants.set(candidate, hostedUrl);
    }
  }

  return variants;
}

function replaceAssetReferences(
  source: string,
  assets: Map<string, string>,
  siteRoot: string
) {
  if (!source || assets.size === 0) return source;

  const variants = buildAssetVariants(assets, siteRoot);
  const keys = Array.from(variants.keys()).sort((a, b) => b.length - a.length);
  if (!keys.length) return source;

  const escaped = keys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(escaped.join('|'), 'g');

  return source.replace(pattern, (matched) => variants.get(matched) || matched);
}

function findZipEntry(
  files: JSZipObject[],
  baseDir: string,
  reference: string
) {
  const resolved = joinZipPath(baseDir, reference);
  if (!resolved) return undefined;
  return files.find((entry) => normalizeAssetPath(entry.name) === resolved);
}


function prepareEditorCanvas(editor: Editor) {
  const frame = editor.Canvas.getFrameEl();
  const documentNode = frame?.contentDocument;
  if (!documentNode?.head || !documentNode.body) return;

  let editorStyle = documentNode.querySelector<HTMLStyleElement>('[data-canvasforge-editor-style]');
  if (!editorStyle) {
    editorStyle = documentNode.createElement('style');
    editorStyle.setAttribute('data-canvasforge-editor-style', 'true');
    editorStyle.textContent = `
      /* Show the completed design while keeping the canvas editable. */
      .page-loader,
      [class*="page-loader"],
      [id*="page-loader"],
      .preloader,
      #preloader,
      .loader-overlay {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      .reveal,
      [data-reveal],
      [data-animate],
      [class*="fade-in"],
      [class*="animate-in"] {
        opacity: 1 !important;
        visibility: visible !important;
        transform: none !important;
      }

      html { scroll-behavior: auto !important; }
      body { min-height: 100vh; }
      a, button, input, select, textarea { pointer-events: auto; }
    `;
    documentNode.head.appendChild(editorStyle);
  }

  documentNode.querySelectorAll('.page-loader, .preloader, #preloader, .loader-overlay').forEach((node) => {
    (node as HTMLElement).style.display = 'none';
  });
  documentNode.querySelectorAll('.reveal, [data-reveal], [data-animate]').forEach((node) => {
    node.classList.add('is-visible', 'visible', 'active');
  });
}

function runEditorJavascript(editor: Editor, javascript: string, enabled: boolean) {
  const frame = editor.Canvas.getFrameEl();
  const frameWindow = frame?.contentWindow;
  const documentNode = frame?.contentDocument;
  if (!documentNode?.body || !frameWindow) return;

  documentNode.querySelectorAll('[data-canvasforge-runtime]').forEach((node) => node.remove());
  prepareEditorCanvas(editor);
  if (!enabled || !javascript.trim()) return;

  const guard = documentNode.createElement('script');
  guard.setAttribute('data-canvasforge-runtime', 'guard');
  guard.textContent = `
    document.addEventListener('click', function(event) {
      var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (link && !link.hasAttribute('data-canvasforge-allow-navigation')) event.preventDefault();
    }, true);
    document.addEventListener('submit', function(event) { event.preventDefault(); }, true);
  `;
  documentNode.body.appendChild(guard);

  const runtime = documentNode.createElement('script');
  runtime.setAttribute('data-canvasforge-runtime', 'custom');
  runtime.textContent = `(() => {
    try {
      ${javascript.replace(/<\/script/gi, '<\\/script')}
    } catch (error) {
      console.error('CanvasForge editor JavaScript error:', error);
    }
  })();`;
  documentNode.body.appendChild(runtime);

  // Imported scripts frequently wait for these events. The editor iframe has
  // already loaded, so trigger them after installing the script.
  documentNode.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
  frameWindow.dispatchEvent(new Event('load'));
  window.setTimeout(() => prepareEditorCanvas(editor), 80);
}

function selectedComponentName(component: any) {
  if (!component) return 'Nothing selected';
  const tag = String(component.get?.('tagName') || component.get?.('type') || 'element').toLowerCase();
  const attributes = component.getAttributes?.() || {};
  const label = attributes['aria-label'] || attributes.alt || attributes.title;
  return label ? `${tag}: ${label}` : tag;
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
  const [liveCanvas, setLiveCanvas] = useState(false);
  const [selectedElement, setSelectedElement] = useState('Nothing selected');
  const [activeDevice, setActiveDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
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

  useEffect(() => {
    if (!editorReady || !editorRef.current) return;
    const timer = window.setTimeout(() => runEditorJavascript(editorRef.current!, javascriptRef.current, liveCanvas), 120);
    return () => window.clearTimeout(timer);
  }, [editorReady, javascript, liveCanvas]);

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
        { id: 'desktop', name: 'Desktop', width: '1440px' },
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
    // HTML and CSS are the source of truth after ZIP/code imports. Older saved
    // project_data can contain a stale, partially rendered canvas, so use it only
    // when the site has no stored HTML/CSS yet.
    if (loadedSite.html || loadedSite.css) {
      editor.setComponents(loadedSite.html || '');
      editor.setStyle(loadedSite.css || '');
    } else if (loadedSite.project_data && Object.keys(loadedSite.project_data).length) {
      editor.loadProjectData(loadedSite.project_data as never);
    } else {
      editor.setComponents('<main><h1>Start editing</h1></main>');
      editor.setStyle('');
    }
    editor.on('update', queueSave);
    editor.on('component:selected', (component: any) => setSelectedElement(selectedComponentName(component)));
    editor.on('component:deselected', () => setSelectedElement('Nothing selected'));
    editor.on('load', () => {
      window.setTimeout(() => {
        prepareEditorCanvas(editor);
        runEditorJavascript(editor, javascriptRef.current, liveCanvas);
      }, 120);
    });
    editor.on('canvas:frame:load', () => {
      window.setTimeout(() => {
        prepareEditorCanvas(editor);
        runEditorJavascript(editor, javascriptRef.current, liveCanvas);
      }, 120);
    });

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

  function setEditorDevice(device: 'desktop' | 'tablet' | 'mobile') {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setDevice(device);
    setActiveDevice(device);
  }

  function undoEditor() {
    editorRef.current?.UndoManager.undo();
  }

  function redoEditor() {
    editorRef.current?.UndoManager.redo();
  }

  function toggleLiveCanvas() {
    const next = !liveCanvas;
    setLiveCanvas(next);
    if (editorRef.current) window.setTimeout(() => runEditorJavascript(editorRef.current!, javascriptRef.current, next), 50);
  }

  function editSelectedText() {
    const editor = editorRef.current;
    const selected = editor?.getSelected();
    if (!editor || !selected) {
      setError('Select a heading, paragraph, button, or other text element first.');
      return;
    }

    const tag = String(selected.get('tagName') || '').toLowerCase();
    if (['img', 'video', 'iframe', 'input', 'textarea', 'select', 'form'].includes(tag)) {
      setError('That element does not contain editable text.');
      return;
    }

    const element = selected.getEl() as HTMLElement | undefined;
    const existing = element?.innerText ?? String(selected.get('content') || '');
    const next = window.prompt('Edit text', existing);
    if (next === null) return;

    // This intentionally replaces the selected element's inner content. It is
    // ideal for headings, paragraphs, links, and buttons.
    selected.components(next);
    editor.select(selected);
    queueSave();
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
    window.setTimeout(() => runEditorJavascript(editor, parsed.javascript || '', liveCanvas), 100);
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

    setImportingZip(true);
    setError('');

    try {
      const zip = await JSZip.loadAsync(file);
      const files = (Object.values(zip.files) as JSZipObject[]).filter(
        (entry) => !entry.dir && !entry.name.includes('__MACOSX')
      );

      const htmlEntry =
        files.find((entry) => /(^|\/)index\.html?$/i.test(entry.name)) ||
        files.find((entry) => /\.html?$/i.test(entry.name));

      if (!htmlEntry) throw new Error('The ZIP must include index.html.');

      const siteRoot = zipDirectory(htmlEntry.name);
      let source = await htmlEntry.async('text');
      const assetMap = new Map<string, string>();

      // Upload every non-code website asset and preserve its original ZIP path.
      const uploadable = files.filter((entry) =>
        !/\.(?:html?|css|js|mjs|cjs|map|md|txt)$/i.test(entry.name)
      );

      for (const entry of uploadable) {
        const blob = await entry.async('blob');
        const filename = entry.name.split('/').pop() || 'asset';
        const typedFile = new File([blob], filename, {
          type: getMimeType(entry.name)
        });
        const url = await uploadAsset(typedFile, entry.name);
        assetMap.set(normalizeAssetPath(entry.name), url);
      }

      // Determine the specific CSS and JavaScript files linked by index.html.
      const documentNode = new DOMParser().parseFromString(source, 'text/html');
      const allStylesheetRefs = Array.from(
        documentNode.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')
      )
        .map((node) => node.getAttribute('href') || '')
        .filter(Boolean);

      const stylesheetRefs = allStylesheetRefs.filter(
        (href) => !/^(?:https?:|\/\/|data:)/i.test(href)
      );
      const externalStylesheetRefs = allStylesheetRefs.filter((href) =>
        /^(?:https?:|\/\/)/i.test(href)
      );

      const scriptRefs = Array.from(
        documentNode.querySelectorAll<HTMLScriptElement>('script[src]')
      )
        .map((node) => node.getAttribute('src') || '')
        .filter((src) => src && !/^(?:https?:|\/\/|data:)/i.test(src));

      source = replaceAssetReferences(source, assetMap, siteRoot);
      const parsed = splitFullHtml(source);
      const cssParts: string[] = [
        ...externalStylesheetRefs.map((href) => `@import url("${href}");`),
        parsed.css
      ];
      const jsParts: string[] = [parsed.javascript];

      for (const href of stylesheetRefs) {
        const entry = findZipEntry(files, siteRoot, href);
        if (!entry) throw new Error(`The stylesheet ${href} was not found in the ZIP.`);
        const css = await entry.async('text');
        cssParts.push(replaceAssetReferences(css, assetMap, siteRoot));
      }

      for (const src of scriptRefs) {
        const entry = findZipEntry(files, siteRoot, src);
        if (!entry) throw new Error(`The script ${src} was not found in the ZIP.`);
        jsParts.push(await entry.async('text'));
      }

      // Fallback for exports that omit link/script tags but still include one CSS/JS file.
      if (stylesheetRefs.length === 0) {
        for (const entry of files.filter((item) => /\.css$/i.test(item.name))) {
          cssParts.push(
            replaceAssetReferences(await entry.async('text'), assetMap, siteRoot)
          );
        }
      }
      if (scriptRefs.length === 0) {
        for (const entry of files.filter((item) => /\.(?:js|mjs)$/i.test(item.name))) {
          jsParts.push(await entry.async('text'));
        }
      }

      const editor = editorRef.current;
      if (!editor) throw new Error('The editor is not ready yet.');

      editor.setComponents(parsed.html || '<main><h1>Start editing</h1></main>');
      editor.setStyle(cssParts.filter(Boolean).join('\n'));
      javascriptRef.current = jsParts.filter(Boolean).join('\n');
      setJavascript(javascriptRef.current);

      // Make uploaded assets available in GrapesJS's asset picker as well.
      for (const [originalPath, url] of assetMap) {
        editor.AssetManager.add({
          src: url,
          name: originalPath.split('/').pop() || originalPath
        });
      }

      queueSave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ZIP import failed.');
    } finally {
      setImportingZip(false);
      event.target.value = '';
    }
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
  const publicBaseUrl = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || 'https://canvasforge-starter.vercel.app/published';
  const publicUrl = site ? `${publicBaseUrl.replace(/\/$/, '')}/${site.slug}` : '';
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
    <div className="editor-workspace-bar">
      <div className="editor-workspace-group">
        <button className="workspace-icon-button" type="button" onClick={undoEditor} title="Undo">↶</button>
        <button className="workspace-icon-button" type="button" onClick={redoEditor} title="Redo">↷</button>
        <span className="workspace-divider" />
        <button className="workspace-device-button" type="button" onClick={editSelectedText}>Edit text</button>
        <span className="workspace-divider" />
        <button className={`workspace-device-button ${activeDevice==='desktop'?'active':''}`} type="button" onClick={()=>setEditorDevice('desktop')}>Desktop</button>
        <button className={`workspace-device-button ${activeDevice==='tablet'?'active':''}`} type="button" onClick={()=>setEditorDevice('tablet')}>Tablet</button>
        <button className={`workspace-device-button ${activeDevice==='mobile'?'active':''}`} type="button" onClick={()=>setEditorDevice('mobile')}>Mobile</button>
      </div>
      <div className="editor-selection-status"><strong>Selected:</strong> {selectedElement}</div>
      <button className={`workspace-live-button ${liveCanvas?'active':''}`} type="button" onClick={toggleLiveCanvas} title="Show menus, sliders, animations, and other JavaScript directly in the editor">
        {liveCanvas ? 'Interactions on' : 'Interactions off'}
      </button>
    </div>
    <div className="editor-help-strip">Click an element to select it. Double-click text to edit. Select an image, then choose <strong>Add / replace photo</strong>. The finished styling and images display in the editor. Double-click text or select it and click Edit text. Turn Interactions on only when testing menus, sliders, or animations.</div>
    <main className="editor-main"><div id="gjs" /></main>

    {showImport && <div className="modal-backdrop"><div className="modal"><div className="modal-header"><h2>Edit or import code</h2><button className="button-ghost" onClick={()=>setShowImport(false)}>✕</button></div><div className="modal-body"><div className="tabs"><button className={`tab ${importTab==='bundle'?'active':''}`} onClick={()=>setImportTab('bundle')}>Full HTML</button><button className={`tab ${importTab==='separate'?'active':''}`} onClick={()=>setImportTab('separate')}>Separate files</button></div>{importTab==='bundle'?<div className="field"><label>Paste complete HTML</label><textarea className="textarea tall" value={importBundle} onChange={(e)=>setImportBundle(e.target.value)}/><small>Inline &lt;script&gt; code is imported automatically. For sites with local image folders, use Import ZIP instead.</small></div>:<div className="field"><div className="tabs code-tabs"><button className={`tab ${codeTab==='html'?'active':''}`} onClick={()=>setCodeTab('html')}>HTML</button><button className={`tab ${codeTab==='css'?'active':''}`} onClick={()=>setCodeTab('css')}>CSS</button><button className={`tab ${codeTab==='javascript'?'active':''}`} onClick={()=>setCodeTab('javascript')}>JavaScript</button></div>{codeTab==='html'&&<textarea aria-label="HTML code" className="textarea code-editor-textarea" value={importHtml} onChange={(e)=>setImportHtml(e.target.value)} spellCheck={false}/>} {codeTab==='css'&&<textarea aria-label="CSS code" className="textarea code-editor-textarea" value={importCss} onChange={(e)=>setImportCss(e.target.value)} spellCheck={false}/>} {codeTab==='javascript'&&<><textarea aria-label="JavaScript code" className="textarea code-editor-textarea" value={importJs} onChange={(e)=>setImportJs(e.target.value)} spellCheck={false} placeholder="// Add your JavaScript here"/><small>JavaScript is saved with the site and now runs directly in the editor when “Interactions on” is enabled. It also runs on the published site.</small></>}</div>}</div><div className="modal-footer"><button className="button-secondary" onClick={()=>setShowImport(false)}>Cancel</button><button className="button-primary" onClick={applyImport}>Apply code</button></div></div></div>}

    {showPreview && <div className="modal-backdrop"><div className="modal large"><div className="modal-header"><h2>Preview</h2><button className="button-ghost" onClick={()=>setShowPreview(false)}>✕</button></div><div className="modal-body"><label className="checkbox-row"><input type="checkbox" checked={runScripts} onChange={(e)=>setRunScripts(e.target.checked)}/>Run custom JavaScript</label><iframe className="preview-frame" title="Website preview" sandbox={runScripts?'allow-scripts allow-forms allow-popups':''} srcDoc={previewSrc}/></div></div></div>}

    {showPublish && <div className="modal-backdrop"><div className="modal publish-modal"><div className="modal-header"><h2>Publish website</h2><button className="button-ghost" onClick={()=>setShowPublish(false)}>✕</button></div><div className="modal-body form-stack"><div className="field"><label>Published website address</label><div className="domain-field"><span>{publicBaseUrl.replace(/\/$/, '')}/</span><input className="input" value={publishSlug} onChange={(e)=>setPublishSlug(e.target.value)}/></div></div><div className="field"><label>Send all website forms to</label><input type="email" className="input" value={formEmail} onChange={(e)=>setFormEmail(e.target.value)} placeholder="you@example.com"/><small>Any normal HTML &lt;form&gt; on the published site will send here.</small></div>{site.is_published&&<div className="message-success">Live at <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></div>}</div><div className="modal-footer">{site.is_published&&<button className="button-danger" disabled={publishing} onClick={()=>updatePublishing(false)}>Unpublish</button>}<button className="button-secondary" onClick={()=>setShowPublish(false)}>Cancel</button><button className="button-primary" disabled={publishing} onClick={()=>updatePublishing(true)}>{publishing?'Publishing…':'Save and publish'}</button></div></div></div>}
  </div>;
}
