'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import JSZip, { type JSZipObject } from 'jszip';
import { getSupabase } from '@/lib/supabase';
import type { Site } from '@/lib/types';

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';
type CodeTab = 'html' | 'css' | 'javascript';
type WorkspaceMode = 'split' | 'code' | 'visual';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

type SelectedElement = {
  id: string;
  tag: string;
  label: string;
  isText: boolean;
  isImage: boolean;
  isForm: boolean;
};

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
      <label data-canvasforge-phone-field>
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
  if (/^(https?:|data:|blob:|mailto:|tel:|#)/i.test(reference)) {
    return reference;
  }

  const cleanReference = normalizePath(reference);
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
  const entries = [...replacements.entries()].sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [path, url] of entries) {
    const clean = normalizePath(path);
    const variants = new Set([path, clean, `./${clean}`, `/${clean}`]);

    for (const variant of variants) {
      if (variant) result = result.split(variant).join(url);
    }
  }

  return result;
}

function insertBeforeBodyEnd(html: string, block: string) {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${block}\n</body>`);
  }

  return `${html}\n${block}`;
}

function replaceBodyContent(source: string, bodyHtml: string) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(source, 'text/html');
  documentNode.body.innerHTML = bodyHtml;
  return `<!doctype html>\n${documentNode.documentElement.outerHTML}`;
}

function editorBridgeScript(interactions: boolean) {
  const encodedInteractions = JSON.stringify(interactions);

  return `
<script data-canvasforge-editor-bridge>
(() => {
  const interactionsEnabled = ${encodedInteractions};
  const EDITOR_ATTRIBUTE = 'data-canvasforge-editor-id';
  let selected = null;
  let dragged = null;
  let counter = 0;

  const style = document.createElement('style');
  style.setAttribute('data-canvasforge-editor-style', '');
  style.textContent = \`
    [data-canvasforge-selected="true"] {
      outline: 3px solid #635bff !important;
      outline-offset: 2px !important;
    }
    [data-canvasforge-hover="true"] {
      outline: 2px dashed rgba(99,91,255,.7) !important;
      outline-offset: 2px !important;
    }
    [contenteditable="true"] {
      cursor: text !important;
      min-width: 1ch;
    }
    [data-canvasforge-dragging="true"] {
      opacity: .45 !important;
    }
  \`;
  document.head.appendChild(style);

  const ensureId = (element) => {
    if (!element.getAttribute(EDITOR_ATTRIBUTE)) {
      counter += 1;
      element.setAttribute(EDITOR_ATTRIBUTE, 'cf-' + counter);
    }
    return element.getAttribute(EDITOR_ATTRIBUTE);
  };

  const cleanEditorState = (root) => {
    root.querySelectorAll(
      '[data-canvasforge-selected],[data-canvasforge-hover],[data-canvasforge-dragging],[contenteditable],[draggable]'
    ).forEach((element) => {
      element.removeAttribute('data-canvasforge-selected');
      element.removeAttribute('data-canvasforge-hover');
      element.removeAttribute('data-canvasforge-dragging');
      element.removeAttribute('contenteditable');
      element.removeAttribute('draggable');
    });
  };

  const sendDocument = () => {
    const clone = document.body.cloneNode(true);
    cleanEditorState(clone);
    clone.querySelectorAll('script[data-canvasforge-editor-bridge]').forEach((node) => node.remove());

    parent.postMessage({
      source: 'canvasforge-visual-editor',
      type: 'document-change',
      bodyHtml: clone.innerHTML
    }, '*');
  };

  const describe = (element) => {
    const tag = element.tagName.toLowerCase();
    const text = (element.textContent || '').replace(/\\s+/g, ' ').trim();
    const label =
      element.getAttribute('aria-label') ||
      element.getAttribute('alt') ||
      element.getAttribute('name') ||
      text.slice(0, 50) ||
      tag;

    return {
      id: ensureId(element),
      tag,
      label,
      isText: [
        'p','h1','h2','h3','h4','h5','h6','span','a','button','label','li','strong','em','small','blockquote'
      ].includes(tag),
      isImage: tag === 'img',
      isForm: tag === 'form' || Boolean(element.closest('form'))
    };
  };

  const selectElement = (element) => {
    if (!(element instanceof HTMLElement)) return;

    if (selected) {
      selected.removeAttribute('data-canvasforge-selected');
    }

    selected = element;
    ensureId(selected);
    selected.setAttribute('data-canvasforge-selected', 'true');

    parent.postMessage({
      source: 'canvasforge-visual-editor',
      type: 'selection-change',
      element: describe(selected)
    }, '*');
  };

  const findById = (id) =>
    document.querySelector('[' + EDITOR_ATTRIBUTE + '="' + CSS.escape(id) + '"]');

  document.querySelectorAll('body *').forEach((element) => {
    if (!(element instanceof HTMLElement)) return;
    ensureId(element);
    element.setAttribute('draggable', 'true');
  });

  document.addEventListener('mouseover', (event) => {
    const element = event.target;
    if (!(element instanceof HTMLElement) || element === document.body) return;
    element.setAttribute('data-canvasforge-hover', 'true');
  }, true);

  document.addEventListener('mouseout', (event) => {
    const element = event.target;
    if (element instanceof HTMLElement) {
      element.removeAttribute('data-canvasforge-hover');
    }
  }, true);

  document.addEventListener('click', (event) => {
    const element = event.target;
    if (!(element instanceof HTMLElement) || element === document.body) return;

    if (!interactionsEnabled || element.closest('a,button,form')) {
      event.preventDefault();
      event.stopPropagation();
    }

    selectElement(element);
  }, true);

  document.addEventListener('dblclick', (event) => {
    const element = event.target;
    if (!(element instanceof HTMLElement)) return;

    const tag = element.tagName.toLowerCase();
    const textTags = new Set([
      'p','h1','h2','h3','h4','h5','h6','span','a','button','label','li','strong','em','small','blockquote'
    ]);

    if (!textTags.has(tag)) return;

    event.preventDefault();
    event.stopPropagation();
    selectElement(element);
    element.setAttribute('contenteditable', 'true');
    element.focus();

    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, true);

  document.addEventListener('input', () => {
    sendDocument();
  }, true);

  document.addEventListener('blur', (event) => {
    const element = event.target;
    if (element instanceof HTMLElement && element.hasAttribute('contenteditable')) {
      element.removeAttribute('contenteditable');
      sendDocument();
    }
  }, true);

  document.addEventListener('dragstart', (event) => {
    const element = event.target;
    if (!(element instanceof HTMLElement) || element === document.body) return;
    dragged = element;
    dragged.setAttribute('data-canvasforge-dragging', 'true');
    event.dataTransfer?.setData('text/plain', ensureId(dragged));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }, true);

  document.addEventListener('dragover', (event) => {
    if (!dragged) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }, true);

  document.addEventListener('drop', (event) => {
    if (!dragged) return;
    event.preventDefault();
    event.stopPropagation();

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target === dragged || dragged.contains(target)) return;

    const rect = target.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    target.parentElement?.insertBefore(dragged, after ? target.nextSibling : target);
    dragged.removeAttribute('data-canvasforge-dragging');
    selectElement(dragged);
    dragged = null;
    sendDocument();
  }, true);

  document.addEventListener('dragend', () => {
    dragged?.removeAttribute('data-canvasforge-dragging');
    dragged = null;
  }, true);

  document.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
  }, true);

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || message.source !== 'canvasforge-parent') return;

    const element = message.id ? findById(message.id) : selected;
    if (!(element instanceof HTMLElement)) return;

    if (message.type === 'edit-text') {
      element.setAttribute('contenteditable', 'true');
      element.focus();
      return;
    }

    if (message.type === 'delete-element') {
      const next = element.parentElement;
      element.remove();
      selected = null;
      if (next && next !== document.body) selectElement(next);
      sendDocument();
      return;
    }

    if (message.type === 'duplicate-element') {
      const clone = element.cloneNode(true);
      cleanEditorState(clone);
      element.insertAdjacentElement('afterend', clone);
      document.querySelectorAll('body *').forEach((child) => {
        if (child instanceof HTMLElement) {
          ensureId(child);
          child.setAttribute('draggable', 'true');
        }
      });
      selectElement(clone);
      sendDocument();
      return;
    }

    if (message.type === 'move-up') {
      const previous = element.previousElementSibling;
      if (previous) {
        element.parentElement?.insertBefore(element, previous);
        sendDocument();
      }
      return;
    }

    if (message.type === 'move-down') {
      const next = element.nextElementSibling;
      if (next) {
        element.parentElement?.insertBefore(next, element);
        sendDocument();
      }
      return;
    }

    if (message.type === 'replace-image' && element.tagName.toLowerCase() === 'img') {
      element.setAttribute('src', message.url || '');
      if (message.alt) element.setAttribute('alt', message.alt);
      sendDocument();
      return;
    }

    if (message.type === 'update-form') {
      const form = element.tagName.toLowerCase() === 'form' ? element : element.closest('form');
      if (!(form instanceof HTMLFormElement)) return;

      const section = form.closest('.canvasforge-contact-section') || form.parentElement;
      const heading = section?.querySelector('h1,h2,h3');
      const intro = section?.querySelector('.canvasforge-contact-copy p:not(.canvasforge-contact-kicker)');
      const button = form.querySelector('button[type="submit"],input[type="submit"]');
      const phoneField = form.querySelector('[data-canvasforge-phone-field]') ||
        Array.from(form.querySelectorAll('label')).find((label) =>
          label.querySelector('input[type="tel"],input[name="phone"]')
        );

      if (heading && typeof message.heading === 'string') {
        heading.textContent = message.heading;
      }

      if (intro && typeof message.intro === 'string') {
        intro.textContent = message.intro;
      }

      if (button instanceof HTMLButtonElement && typeof message.buttonText === 'string') {
        button.textContent = message.buttonText;
      }

      if (button instanceof HTMLInputElement && typeof message.buttonText === 'string') {
        button.value = message.buttonText;
      }

      if (phoneField instanceof HTMLElement) {
        phoneField.style.display = message.showPhone ? '' : 'none';
      }

      sendDocument();
    }
  });

  parent.postMessage({
    source: 'canvasforge-visual-editor',
    type: 'ready'
  }, '*');
})();
</script>`;
}

function injectCode(
  html: string,
  css: string,
  javascript: string,
  visualEditing: boolean,
  interactions: boolean
) {
  const source =
    html.trim() ||
    '<!doctype html><html><head></head><body><main><h1>Start editing</h1></main></body></html>';

  const safeScript = javascript.replace(/<\/script/gi, '<\\/script');
  const styleTag = css.trim()
    ? `<style data-canvasforge-css>\n${css}\n</style>`
    : '';

  const siteScript =
    safeScript.trim() && (!visualEditing || interactions)
      ? `<script data-canvasforge-js>\n${safeScript}\n</script>`
      : '';

  const bridge = visualEditing ? editorBridgeScript(interactions) : '';

  if (/<html[\s>]/i.test(source)) {
    let output = source;

    output = /<\/head>/i.test(output)
      ? output.replace(/<\/head>/i, `${styleTag}</head>`)
      : output.replace(
          /<html[^>]*>/i,
          (match) => `${match}<head>${styleTag}</head>`
        );

    output = /<\/body>/i.test(output)
      ? output.replace(/<\/body>/i, `${siteScript}${bridge}</body>`)
      : `${output}${siteScript}${bridge}`;

    return output;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styleTag}</head><body>${source}${siteScript}${bridge}</body></html>`;
}

export function EditorClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zipInput = useRef<HTMLInputElement | null>(null);
  const imageInput = useRef<HTMLInputElement | null>(null);
  const previewFrame = useRef<HTMLIFrameElement | null>(null);
  const siteRef = useRef<Site | null>(null);
  const htmlRef = useRef('');
  const cssRef = useRef('');
  const javascriptRef = useRef('');

  const [site, setSite] = useState<Site | null>(null);
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [javascript, setJavascript] = useState('');
  const [tab, setTab] = useState<CodeTab>('html');
  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>('split');
  const [deviceMode, setDeviceMode] =
    useState<DeviceMode>('desktop');
  const [interactions, setInteractions] = useState(false);
  const [selected, setSelected] =
    useState<SelectedElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] =
    useState<SaveState>('saved');
  const [error, setError] = useState('');
  const [showPublish, setShowPublish] = useState(false);
  const [showFormSettings, setShowFormSettings] = useState(false);
  const [publishSlug, setPublishSlug] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [customFontUrl, setCustomFontUrl] = useState('');
  const [customFontFamily, setCustomFontFamily] = useState('');
  const [formHeading, setFormHeading] = useState('Contact me');
  const [formIntro, setFormIntro] = useState(
    'Tell me a little about what you are looking for and I will get back to you.'
  );
  const [formButtonText, setFormButtonText] = useState('Send message');
  const [formShowPhone, setFormShowPhone] = useState(true);

  const publicBaseUrl =
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ||
    'https://canvasforge-starter.vercel.app/published';

  const publicUrl = site
    ? `${publicBaseUrl.replace(/\/$/, '')}/${site.slug}`
    : '';

  const visualEditing = workspaceMode !== 'code';

  const previewDocument = useMemo(
    () =>
      injectCode(
        html,
        css,
        javascript,
        visualEditing,
        interactions
      ),
    [html, css, javascript, visualEditing, interactions]
  );

  useEffect(() => {
    void loadSite();

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [params.id]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = event.data;

      if (
        !message ||
        message.source !== 'canvasforge-visual-editor'
      ) {
        return;
      }

      if (message.type === 'document-change') {
        const updatedHtml = replaceBodyContent(
          htmlRef.current,
          message.bodyHtml || ''
        );
        htmlRef.current = updatedHtml;
        setHtml(updatedHtml);
        markChanged();
        return;
      }

      if (message.type === 'selection-change') {
        setSelected(message.element as SelectedElement);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  async function loadSite() {
    setLoading(true);
    setError('');

    try {
      const supabase = getSupabase();
      const { data: authData } =
        await supabase.auth.getUser();

      if (!authData.user) {
        router.replace('/login');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('sites')
        .select('*')
        .eq('id', params.id)
        .single();

      if (fetchError) throw fetchError;

      const loaded = data as Site;
      siteRef.current = loaded;
      htmlRef.current = loaded.html || '';
      cssRef.current = loaded.css || '';
      javascriptRef.current = loaded.javascript || '';
      setSite(loaded);
      setHtml(htmlRef.current);
      setCss(cssRef.current);
      setJavascript(javascriptRef.current);
      setPublishSlug(loaded.slug || '');
      setFormEmail(loaded.form_email || '');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load website.'
      );
    } finally {
      setLoading(false);
    }
  }

  function markChanged() {
    setSaveState('unsaved');

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(
      () => void saveSite(),
      1000
    );
  }

  async function saveSite() {
    const currentSite = siteRef.current;
    if (!currentSite) return;

    setSaveState('saving');
    setError('');

    try {
      const payload = {
        html: htmlRef.current,
        css: cssRef.current,
        javascript: javascriptRef.current,
        project_data: null,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await getSupabase()
        .from('sites')
        .update(payload)
        .eq('id', currentSite.id);

      if (updateError) throw updateError;

      const updatedSite = { ...currentSite, ...payload } as Site;
      siteRef.current = updatedSite;
      setSite(updatedSite);
      setSaveState('saved');
    } catch (caught) {
      setSaveState('error');
      setError(
        caught instanceof Error
          ? caught.message
          : 'Save failed.'
      );
    }
  }

  function updateHtml(value: string) {
    htmlRef.current = value;
    setHtml(value);
    markChanged();
  }

  function updateCss(value: string) {
    cssRef.current = value;
    setCss(value);
    markChanged();
  }

  function updateJavascript(value: string) {
    javascriptRef.current = value;
    setJavascript(value);
    markChanged();
  }

  async function uploadAsset(file: File, pathHint: string) {
    if (!site) throw new Error('Website not loaded.');

    const supabase = getSupabase();
    const { data: authData } =
      await supabase.auth.getUser();

    if (!authData.user) {
      throw new Error('Your session has expired.');
    }

    const cleanName = normalizePath(pathHint)
      .replace(/[^a-zA-Z0-9._/-]/g, '-');

    const filename =
      cleanName.split('/').pop() || file.name;

    const storagePath =
      `${authData.user.id}/${site.id}/` +
      `${crypto.randomUUID()}-${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('site-assets')
      .upload(storagePath, file, {
        cacheControl: '31536000',
        contentType: getMimeType(pathHint),
        upsert: true
      });

    if (uploadError) {
      throw new Error(
        `Could not upload ${pathHint}: ${uploadError.message}`
      );
    }

    return supabase.storage
      .from('site-assets')
      .getPublicUrl(storagePath).data.publicUrl;
  }

  async function importZip(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError('');

    try {
      const zip = await JSZip.loadAsync(file);

      const files = (
        Object.values(zip.files) as JSZipObject[]
      ).filter(
        (entry) =>
          !entry.dir &&
          !entry.name.includes('__MACOSX')
      );

      const htmlEntry =
        files.find((entry) =>
          /(^|\/)index\.html?$/i.test(entry.name)
        ) ||
        files.find((entry) =>
          /\.html?$/i.test(entry.name)
        );

      if (!htmlEntry) {
        throw new Error(
          'The ZIP must contain index.html.'
        );
      }

      let importedHtml = await htmlEntry.async('text');
      const replacements = new Map<string, string>();

      for (const entry of files) {
        if (
          entry === htmlEntry ||
          /\.(css|js|mjs|html?)$/i.test(entry.name)
        ) {
          continue;
        }

        const blob = await entry.async('blob');

        const uploadedFile = new File(
          [blob],
          entry.name.split('/').pop() || 'asset',
          { type: getMimeType(entry.name) }
        );

        const url = await uploadAsset(
          uploadedFile,
          entry.name
        );

        replacements.set(normalizePath(entry.name), url);

        const relativeToHtml = resolveRelativePath(
          htmlEntry.name,
          entry.name
        );

        replacements.set(relativeToHtml, url);
      }

      importedHtml = replaceReferences(
        importedHtml,
        replacements
      );

      const parser = new DOMParser();
      const documentNode = parser.parseFromString(
        importedHtml,
        'text/html'
      );

      const cssParts: string[] = [];
      const jsParts: string[] = [];

      for (const style of Array.from(
        documentNode.querySelectorAll('style')
      )) {
        cssParts.push(
          replaceReferences(
            style.textContent || '',
            replacements
          )
        );
        style.remove();
      }

      for (const link of Array.from(
        documentNode.querySelectorAll<HTMLLinkElement>(
          'link[rel="stylesheet"][href]'
        )
      )) {
        const href = link.getAttribute('href') || '';

        if (/^https?:\/\//i.test(href)) continue;

        const resolved = resolveRelativePath(
          htmlEntry.name,
          href
        );

        const cssEntry = files.find(
          (entry) =>
            normalizePath(entry.name) === resolved
        );

        if (cssEntry) {
          cssParts.push(
            replaceReferences(
              await cssEntry.async('text'),
              replacements
            )
          );
          link.remove();
        }
      }

      for (const script of Array.from(
        documentNode.querySelectorAll<HTMLScriptElement>(
          'script'
        )
      )) {
        const src = script.getAttribute('src');

        if (src && !/^https?:\/\//i.test(src)) {
          const resolved = resolveRelativePath(
            htmlEntry.name,
            src
          );

          const scriptEntry = files.find(
            (entry) =>
              normalizePath(entry.name) === resolved
          );

          if (scriptEntry) {
            jsParts.push(
              await scriptEntry.async('text')
            );
            script.remove();
          }
        } else if (!src && script.textContent) {
          jsParts.push(script.textContent);
          script.remove();
        }
      }

      const completeHtml =
        `<!doctype html>\n` +
        documentNode.documentElement.outerHTML;

      const importedCss = cssParts.join('\n\n');
      const importedJavascript = jsParts.join('\n\n');
      htmlRef.current = completeHtml;
      cssRef.current = importedCss;
      javascriptRef.current = importedJavascript;
      setHtml(completeHtml);
      setCss(importedCss);
      setJavascript(importedJavascript);
      setTab('html');
      setWorkspaceMode('split');
      setSaveState('unsaved');

      setTimeout(() => void saveSite(), 0);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'ZIP import failed.'
      );
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  }

  async function replaceSelectedImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file || !selected?.isImage) return;

    setUploadingImage(true);
    setError('');

    try {
      if (
        !file.type.startsWith('image/') ||
        file.size > 12 * 1024 * 1024
      ) {
        throw new Error(
          'Choose an image no larger than 12 MB.'
        );
      }

      const url = await uploadAsset(file, file.name);

      postToPreview({
        type: 'replace-image',
        id: selected.id,
        url,
        alt: file.name.replace(/\.[^.]+$/, '')
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Image upload failed.'
      );
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  }

  function addContactForm() {
    const updatedHtml = insertBeforeBodyEnd(
      htmlRef.current,
      CONTACT_FORM_HTML
    );
    const updatedCss = cssRef.current.includes(
      '.canvasforge-contact-section'
    )
      ? cssRef.current
      : `${cssRef.current}\n\n${CONTACT_FORM_CSS}`;
    htmlRef.current = updatedHtml;
    cssRef.current = updatedCss;
    setHtml(updatedHtml);
    setCss(updatedCss);

    setWorkspaceMode('split');
    markChanged();
  }

  function addGoogleFont() {
    const family = fontFamily.trim();
    if (!family) return;

    const encoded = family.replace(/ /g, '+');

    const importLine =
      `@import url('https://fonts.googleapis.com/css2?family=` +
      `${encoded}:wght@300;400;500;600;700;800;900&display=swap');`;

    const bodyRule =
      `\nbody { font-family: '${family}', sans-serif; }`;

    const updatedCss = `${importLine}\n${cssRef.current}${bodyRule}`;
    cssRef.current = updatedCss;
    setCss(updatedCss);

    setTab('css');
    markChanged();
  }

  function addCustomFont() {
    const url = customFontUrl.trim();
    const family = customFontFamily.trim();

    if (!url || !family) {
      setError(
        'Enter both a font stylesheet URL and the font-family name.'
      );
      return;
    }

    const importLine =
      `@import url('${url.replace(/'/g, '%27')}');`;

    const updatedCss =
      `${importLine}\n${cssRef.current}\n` +
      `body { font-family: '${family}', sans-serif; }`;
    cssRef.current = updatedCss;
    setCss(updatedCss);

    setTab('css');
    markChanged();
  }

  function postToPreview(
    message: Record<string, unknown>
  ) {
    previewFrame.current?.contentWindow?.postMessage(
      {
        source: 'canvasforge-parent',
        ...message
      },
      '*'
    );
  }

  function openFormSettings() {
    if (!selected?.isForm) {
      setError(
        'Select a form or an element inside a form first.'
      );
      return;
    }

    setShowFormSettings(true);
  }

  function applyFormSettings() {
    if (!selected) return;

    postToPreview({
      type: 'update-form',
      id: selected.id,
      heading: formHeading,
      intro: formIntro,
      buttonText: formButtonText,
      showPhone: formShowPhone
    });

    setShowFormSettings(false);
  }

  async function updatePublishing(publish: boolean) {
    if (!site) return;

    const slug = sanitizeSlug(publishSlug);

    if (!slug) {
      setError('Enter a valid published-site name.');
      return;
    }

    if (
      formEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)
    ) {
      setError(
        'Enter a valid form recipient email.'
      );
      return;
    }

    setPublishing(true);
    setError('');

    try {
      await saveSite();

      const payload = {
        slug,
        form_email: formEmail.trim() || null,
        is_published: publish,
        published_at: publish
          ? new Date().toISOString()
          : null
      };

      const { error: updateError } = await getSupabase()
        .from('sites')
        .update(payload)
        .eq('id', site.id);

      if (updateError) throw updateError;

      const updatedSite = { ...siteRef.current!, ...payload } as Site;
      siteRef.current = updatedSite;
      setSite(updatedSite);
      setPublishSlug(slug);
      setShowPublish(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Publishing failed.'
      );
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
    return (
      <div className="loading-screen">
        <div>
          <div className="spinner" />
          <p>Opening editor…</p>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="loading-screen">
        <div>
          {error || 'Website not found.'}
          <br />
          <Link href="/dashboard">
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="hybrid-builder-shell">
      <header className="hybrid-builder-header">
        <div className="hybrid-builder-brand">
          <Link
            href="/dashboard"
            className="button-ghost button-small"
            style={{ color: 'white' }}
          >
            ← Dashboard
          </Link>

          <strong>{site.name}</strong>
          <span className="save-status">{status}</span>
        </div>

        <div className="hybrid-builder-actions">
          <input
            ref={zipInput}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={importZip}
          />

          <input
            ref={imageInput}
            type="file"
            accept="image/*"
            hidden
            onChange={replaceSelectedImage}
          />

          <button
            className="button-ghost button-small"
            style={{ color: 'white' }}
            onClick={() => zipInput.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importing…' : 'Import ZIP'}
          </button>

          <button
            className="button-ghost button-small"
            style={{ color: 'white' }}
            onClick={addContactForm}
          >
            + Contact form
          </button>

          <button
            className="button-secondary button-small"
            onClick={() => setShowPublish(true)}
          >
            {site.is_published
              ? 'Publishing settings'
              : 'Publish'}
          </button>

          <button
            className="button-primary button-small"
            onClick={() => void saveSite()}
          >
            Save
          </button>
        </div>
      </header>

      <div className="hybrid-modebar">
        <div className="hybrid-segmented">
          <button
            className={workspaceMode === 'split' ? 'active' : ''}
            onClick={() => setWorkspaceMode('split')}
          >
            Code + Visual
          </button>
          <button
            className={workspaceMode === 'code' ? 'active' : ''}
            onClick={() => setWorkspaceMode('code')}
          >
            Code only
          </button>
          <button
            className={workspaceMode === 'visual' ? 'active' : ''}
            onClick={() => setWorkspaceMode('visual')}
          >
            Visual only
          </button>
        </div>

        <div className="hybrid-visual-tools">
          <button
            className={deviceMode === 'desktop' ? 'active' : ''}
            onClick={() => setDeviceMode('desktop')}
          >
            Desktop
          </button>
          <button
            className={deviceMode === 'tablet' ? 'active' : ''}
            onClick={() => setDeviceMode('tablet')}
          >
            Tablet
          </button>
          <button
            className={deviceMode === 'mobile' ? 'active' : ''}
            onClick={() => setDeviceMode('mobile')}
          >
            Mobile
          </button>

          <button
            className={interactions ? 'active' : ''}
            onClick={() => setInteractions((current) => !current)}
            title="Turn this on only to test site animations and menus."
          >
            Interactions {interactions ? 'on' : 'off'}
          </button>
        </div>
      </div>

      {selected && visualEditing && (
        <div className="hybrid-selectionbar">
          <span>
            Selected: <strong>{selected.tag}</strong>
            {' — '}
            {selected.label}
          </span>

          <div>
            {selected.isText && (
              <button
                onClick={() =>
                  postToPreview({
                    type: 'edit-text',
                    id: selected.id
                  })
                }
              >
                Edit text
              </button>
            )}

            {selected.isImage && (
              <button
                onClick={() =>
                  imageInput.current?.click()
                }
                disabled={uploadingImage}
              >
                {uploadingImage
                  ? 'Uploading…'
                  : 'Replace image'}
              </button>
            )}

            {selected.isForm && (
              <button onClick={openFormSettings}>
                Form settings
              </button>
            )}

            <button
              onClick={() =>
                postToPreview({
                  type: 'move-up',
                  id: selected.id
                })
              }
            >
              Move up
            </button>

            <button
              onClick={() =>
                postToPreview({
                  type: 'move-down',
                  id: selected.id
                })
              }
            >
              Move down
            </button>

            <button
              onClick={() =>
                postToPreview({
                  type: 'duplicate-element',
                  id: selected.id
                })
              }
            >
              Duplicate
            </button>

            <button
              className="danger"
              onClick={() =>
                postToPreview({
                  type: 'delete-element',
                  id: selected.id
                })
              }
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          className="message-error hybrid-builder-error"
          onClick={() => setError('')}
        >
          {error}
        </div>
      )}

      <section
        className={[
          'hybrid-builder-main',
          `mode-${workspaceMode}`
        ].join(' ')}
      >
        {workspaceMode !== 'visual' && (
          <>
            <aside className="hybrid-builder-sidebar">
              <h3>Code</h3>

              <button
                className={
                  tab === 'html'
                    ? 'code-side-tab active'
                    : 'code-side-tab'
                }
                onClick={() => setTab('html')}
              >
                HTML
              </button>

              <button
                className={
                  tab === 'css'
                    ? 'code-side-tab active'
                    : 'code-side-tab'
                }
                onClick={() => setTab('css')}
              >
                CSS
              </button>

              <button
                className={
                  tab === 'javascript'
                    ? 'code-side-tab active'
                    : 'code-side-tab'
                }
                onClick={() =>
                  setTab('javascript')
                }
              >
                JavaScript
              </button>

              <div className="code-tool-section">
                <h3>Fonts</h3>

                <label>Online font</label>

                <select
                  className="input"
                  value={fontFamily}
                  onChange={(event) =>
                    setFontFamily(event.target.value)
                  }
                >
                  {COMMON_FONTS.map((font) => (
                    <option key={font}>{font}</option>
                  ))}
                </select>

                <button
                  className="button-secondary button-small"
                  onClick={addGoogleFont}
                >
                  Add font
                </button>

                <p className="code-help">
                  Use any provider by pasting its stylesheet
                  URL and exact font-family name.
                </p>

                <input
                  className="input"
                  value={customFontUrl}
                  onChange={(event) =>
                    setCustomFontUrl(event.target.value)
                  }
                  placeholder="https://fonts.example.com/font.css"
                />

                <input
                  className="input"
                  value={customFontFamily}
                  onChange={(event) =>
                    setCustomFontFamily(event.target.value)
                  }
                  placeholder="Font family name"
                />

                <button
                  className="button-secondary button-small"
                  onClick={addCustomFont}
                >
                  Add custom font
                </button>
              </div>
            </aside>

            <div className="hybrid-code-editor">
              <div className="code-editor-titlebar">
                <strong>
                  {tab === 'html'
                    ? 'index.html'
                    : tab === 'css'
                      ? 'styles.css'
                      : 'script.js'}
                </strong>
                <span>
                  Code and visual edits remain synchronized.
                </span>
              </div>

              {tab === 'html' && (
                <textarea
                  className="code-builder-textarea"
                  value={html}
                  onChange={(event) =>
                    updateHtml(event.target.value)
                  }
                  spellCheck={false}
                />
              )}

              {tab === 'css' && (
                <textarea
                  className="code-builder-textarea"
                  value={css}
                  onChange={(event) =>
                    updateCss(event.target.value)
                  }
                  spellCheck={false}
                />
              )}

              {tab === 'javascript' && (
                <textarea
                  className="code-builder-textarea"
                  value={javascript}
                  onChange={(event) =>
                    updateJavascript(event.target.value)
                  }
                  spellCheck={false}
                />
              )}
            </div>
          </>
        )}

        {workspaceMode !== 'code' && (
          <div className="hybrid-visual-editor">
            <div className="code-editor-titlebar">
              <strong>Visual editor</strong>
              <span>
                Click to select. Double-click text to edit.
                Drag elements to reorder.
              </span>

              {site.is_published && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open live site ↗
                </a>
              )}
            </div>

            <div className="hybrid-device-stage">
              <div
                className={`hybrid-device-frame ${deviceMode}`}
              >
                <iframe
                  ref={previewFrame}
                  title="Visual website editor"
                  className="hybrid-preview-frame"
                  sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
                  srcDoc={previewDocument}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {showPublish && (
        <div className="modal-backdrop">
          <div className="modal publish-modal">
            <div className="modal-header">
              <h2>Publish website</h2>
              <button
                className="button-ghost"
                onClick={() => setShowPublish(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body form-stack">
              <div className="field">
                <label>Published website address</label>
                <div className="published-path-field">
                  <span>
                    {publicBaseUrl.replace(/\/$/, '')}/
                  </span>

                  <input
                    className="input"
                    value={publishSlug}
                    onChange={(event) =>
                      setPublishSlug(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label>
                  Send website form submissions to
                </label>

                <input
                  type="email"
                  className="input"
                  value={formEmail}
                  onChange={(event) =>
                    setFormEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                />

                <small>
                  This recipient is used by the contact-form
                  block and normal HTML forms on the published
                  website.
                </small>
              </div>

              {site.is_published && (
                <div className="message-success">
                  Live at{' '}
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {publicUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {site.is_published && (
                <button
                  className="button-danger"
                  disabled={publishing}
                  onClick={() =>
                    void updatePublishing(false)
                  }
                >
                  Unpublish
                </button>
              )}

              <button
                className="button-secondary"
                onClick={() =>
                  setShowPublish(false)
                }
              >
                Cancel
              </button>

              <button
                className="button-primary"
                disabled={publishing}
                onClick={() =>
                  void updatePublishing(true)
                }
              >
                {publishing
                  ? 'Publishing…'
                  : 'Save and publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFormSettings && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Contact form settings</h2>
              <button
                className="button-ghost"
                onClick={() =>
                  setShowFormSettings(false)
                }
              >
                ✕
              </button>
            </div>

            <div className="modal-body form-stack">
              <div className="field">
                <label>Heading</label>
                <input
                  className="input"
                  value={formHeading}
                  onChange={(event) =>
                    setFormHeading(event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Introduction</label>
                <textarea
                  className="textarea"
                  value={formIntro}
                  onChange={(event) =>
                    setFormIntro(event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Submit button text</label>
                <input
                  className="input"
                  value={formButtonText}
                  onChange={(event) =>
                    setFormButtonText(event.target.value)
                  }
                />
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={formShowPhone}
                  onChange={(event) =>
                    setFormShowPhone(event.target.checked)
                  }
                />
                Show phone field
              </label>

              <div className="field">
                <label>Recipient email</label>
                <input
                  type="email"
                  className="input"
                  value={formEmail}
                  onChange={(event) =>
                    setFormEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                />
                <small>
                  This is saved when you click Save and
                  publish.
                </small>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="button-secondary"
                onClick={() =>
                  setShowFormSettings(false)
                }
              >
                Cancel
              </button>

              <button
                className="button-primary"
                onClick={applyFormSettings}
              >
                Apply form settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
