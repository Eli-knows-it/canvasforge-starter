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
type AnimationPreset = 'none' | 'fade' | 'slide-up' | 'slide-left' | 'spin' | 'pulse' | 'bounce';

type HistorySnapshot = {
  html: string;
  css: string;
  javascript: string;
};

type PageRecord = {
  id: string;
  name: string;
  path: string;
  html: string;
  css: string;
  javascript: string;
  title?: string;
  description?: string;
};

type SelectedElement = {
  id: string;
  tag: string;
  label: string;
  isText: boolean;
  isImage: boolean;
  isForm: boolean;
};

const PAGE_TEMPLATES: Record<string, Omit<PageRecord, 'id'>> = {
  blank: {
    name: 'Blank page',
    path: 'page',
    title: 'Blank page',
    description: '',
    html: '<!doctype html><html><head></head><body><main style="min-height:100vh;padding:64px"><h1>New page</h1><p>Start building here.</p></main></body></html>',
    css: '',
    javascript: ''
  },
  services: {
    name: 'Services',
    path: 'services',
    title: 'Services',
    description: 'Services page',
    html: '<!doctype html><html><head></head><body><main><section style="padding:88px 24px;text-align:center"><p>WHAT WE OFFER</p><h1>Services</h1><p>Describe your services and how people can work with you.</p></section><section style="padding:32px 24px 88px"><div style="max-width:1100px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px"><article><h2>Service one</h2><p>Add details here.</p></article><article><h2>Service two</h2><p>Add details here.</p></article><article><h2>Service three</h2><p>Add details here.</p></article></div></section></main></body></html>',
    css: 'body{margin:0;font-family:Inter,Arial,sans-serif;color:#111}article{padding:28px;border:1px solid #ddd;background:#fff}',
    javascript: ''
  },
  product: {
    name: 'Product',
    path: 'product',
    title: 'Product',
    description: 'Product sales page',
    html: '<!doctype html><html><head></head><body><main style="min-height:100vh;display:grid;place-items:center;padding:48px"><section style="width:min(1000px,100%);display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center"><div style="aspect-ratio:1;background:#eee;display:grid;place-items:center">Product image</div><div><p>FEATURED PRODUCT</p><h1>Your product</h1><p>Describe the product, class, event, or digital resource.</p><p style="font-size:2rem;font-weight:800">$99</p><a href="https://buy.stripe.com/" style="display:inline-block;padding:14px 22px;background:#111;color:white;text-decoration:none">Buy now</a></div></section></main></body></html>',
    css: 'body{margin:0;font-family:Inter,Arial,sans-serif}',
    javascript: ''
  },
  login: {
    name: 'Customer login',
    path: 'login',
    title: 'Customer login',
    description: 'Customer login page',
    html: '<!doctype html><html><head></head><body><main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f5f5"><form style="width:min(420px,100%);display:grid;gap:16px;padding:32px;background:white;border:1px solid #ddd"><h1>Customer login</h1><label>Email<input type="email" name="email" required style="width:100%;padding:12px"></label><label>Password<input type="password" name="password" required style="width:100%;padding:12px"></label><button type="submit" style="padding:13px;background:#111;color:white;border:0">Sign in</button></form></main></body></html>',
    css: 'body{margin:0;font-family:Inter,Arial,sans-serif}',
    javascript: ''
  },
  blog: {
    name: 'Blog',
    path: 'blog',
    title: 'Blog',
    description: 'Blog page',
    html: '<!doctype html><html><head></head><body><main style="padding:80px 24px"><header style="max-width:1000px;margin:auto 0 48px"><p>INSIGHTS</p><h1>Blog</h1></header><section style="max-width:1100px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:28px"><article><p>Category</p><h2>First article title</h2><p>Write a short introduction.</p></article><article><p>Category</p><h2>Second article title</h2><p>Write a short introduction.</p></article><article><p>Category</p><h2>Third article title</h2><p>Write a short introduction.</p></article></section></main></body></html>',
    css: 'body{margin:0;font-family:Inter,Arial,sans-serif}article{padding:24px;border-top:4px solid #111;background:#f7f7f7}',
    javascript: ''
  }
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

function rewriteCssAssetUrls(
  source: string,
  cssFile: string,
  replacements: Map<string, string>
) {
  return source.replace(
    /url\((['"]?)([^)'"\s]+)\1\)/gi,
    (match, quote: string, reference: string) => {
      if (/^(data:|https?:|blob:|#)/i.test(reference)) {
        return match;
      }

      const resolved = resolveRelativePath(cssFile, reference);
      const hosted = replacements.get(normalizePath(resolved));

      return hosted ? `url("${hosted}")` : match;
    }
  );
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

function editorBridgeScript(interactions: boolean, gridMode: boolean) {
  const encodedInteractions = JSON.stringify(interactions);
  const encodedGridMode = JSON.stringify(gridMode);

  return `
<script data-canvasforge-editor-bridge>
(() => {
  const interactionsEnabled = ${encodedInteractions};
  const gridModeEnabled = ${encodedGridMode};
  const GRID_SIZE = 20;
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
    body[data-canvasforge-grid="true"] {
      min-height: 100vh;
      background-image:
        linear-gradient(rgba(99,91,255,.12) 1px, transparent 1px),
        linear-gradient(90deg, rgba(99,91,255,.12) 1px, transparent 1px);
      background-size: 20px 20px;
    }
    [data-canvasforge-animation="fade"] { animation: canvasforgeFade .8s ease both; }
    [data-canvasforge-animation="slide-up"] { animation: canvasforgeSlideUp .8s ease both; }
    [data-canvasforge-animation="slide-left"] { animation: canvasforgeSlideLeft .8s ease both; }
    [data-canvasforge-animation="spin"] { animation: canvasforgeSpin 1.2s linear infinite; }
    [data-canvasforge-animation="pulse"] { animation: canvasforgePulse 1.3s ease-in-out infinite; }
    [data-canvasforge-animation="bounce"] { animation: canvasforgeBounce 1.2s ease infinite; }
    @keyframes canvasforgeFade { from { opacity:0 } to { opacity:1 } }
    @keyframes canvasforgeSlideUp { from { opacity:0; transform:translateY(36px) } to { opacity:1; transform:translateY(0) } }
    @keyframes canvasforgeSlideLeft { from { opacity:0; transform:translateX(36px) } to { opacity:1; transform:translateX(0) } }
    @keyframes canvasforgeSpin { to { transform:rotate(360deg) } }
    @keyframes canvasforgePulse { 50% { transform:scale(1.06) } }
    @keyframes canvasforgeBounce { 50% { transform:translateY(-14px) } }
  \`;
  document.head.appendChild(style);
  if (gridModeEnabled) document.body.setAttribute('data-canvasforge-grid', 'true');

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

    if (gridModeEnabled) {
      const bodyRect = document.body.getBoundingClientRect();
      const left = Math.max(0, Math.round((event.clientX - bodyRect.left) / GRID_SIZE) * GRID_SIZE);
      const top = Math.max(0, Math.round((event.clientY - bodyRect.top + window.scrollY) / GRID_SIZE) * GRID_SIZE);
      dragged.style.position = 'absolute';
      dragged.style.left = left + 'px';
      dragged.style.top = top + 'px';
      dragged.style.margin = '0';
      dragged.style.zIndex = '10';
      document.body.appendChild(dragged);
    } else {
      const rect = target.getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2;
      target.parentElement?.insertBefore(dragged, after ? target.nextSibling : target);
    }
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

    if (message.type === 'select-element') {
      selectElement(element);
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    if (message.type === 'insert-image') {
      const image = document.createElement('img');
      image.src = message.url || '';
      image.alt = message.alt || 'Uploaded image';
      image.style.maxWidth = '100%';
      image.style.height = 'auto';
      image.style.display = 'block';
      image.setAttribute('draggable', 'true');
      ensureId(image);
      document.body.appendChild(image);
      selectElement(image);
      sendDocument();
      return;
    }

    if (message.type === 'insert-shape') {
      const shape = document.createElement('div');
      const kind = message.kind || 'rectangle';
      shape.setAttribute('data-canvasforge-shape', kind);
      shape.style.width = kind === 'line' ? '220px' : '160px';
      shape.style.height = kind === 'line' ? '4px' : '120px';
      shape.style.background = message.color || '#635bff';
      shape.style.borderRadius = kind === 'circle' ? '999px' : '0';
      shape.style.display = 'block';
      shape.style.position = gridModeEnabled ? 'absolute' : 'relative';
      if (gridModeEnabled) {
        shape.style.left = '40px';
        shape.style.top = '40px';
      }
      shape.setAttribute('draggable', 'true');
      ensureId(shape);
      document.body.appendChild(shape);
      selectElement(shape);
      sendDocument();
      return;
    }

    if (message.type === 'apply-style') {
      const styles = message.styles || {};
      Object.entries(styles).forEach(([property, value]) => {
        if (typeof value === 'string') {
          if (value) element.style.setProperty(property, value);
          else element.style.removeProperty(property);
        }
      });
      if (message.animation) {
        if (message.animation === 'none') {
          element.removeAttribute('data-canvasforge-animation');
        } else {
          element.setAttribute('data-canvasforge-animation', message.animation);
        }
      }
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

  sendDocument();
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
  interactions: boolean,
  gridMode: boolean
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

  const bridge = visualEditing ? editorBridgeScript(interactions, gridMode) : '';

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
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const siteRef = useRef<Site | null>(null);
  const htmlRef = useRef('');
  const cssRef = useRef('');
  const javascriptRef = useRef('');
  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const applyingHistoryRef = useRef(false);

  const [site, setSite] = useState<Site | null>(null);
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [javascript, setJavascript] = useState('');
  const [tab, setTab] = useState<CodeTab>('html');
  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>('split');
  const [deviceMode, setDeviceMode] =
    useState<DeviceMode>('desktop');
  const [interactions, setInteractions] = useState(true);
  const [gridMode, setGridMode] = useState(false);
  const [selected, setSelected] =
    useState<SelectedElement | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [selectedTextColor, setSelectedTextColor] = useState('#111111');
  const [selectedBackground, setSelectedBackground] = useState('#ffffff');
  const [selectedFontSize, setSelectedFontSize] = useState('16');
  const [selectedWidth, setSelectedWidth] = useState('');
  const [selectedHeight, setSelectedHeight] = useState('');
  const [selectedRotation, setSelectedRotation] = useState('0');
  const [selectedAnimation, setSelectedAnimation] =
    useState<AnimationPreset>('none');
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [activePageId, setActivePageId] = useState('home');
  const [pageTemplate, setPageTemplate] = useState('blank');
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
        interactions,
        gridMode
      ),
    [html, css, javascript, visualEditing, interactions, gridMode]
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
        if (updatedHtml !== htmlRef.current) {
          htmlRef.current = updatedHtml;
          setHtml(updatedHtml);
          pushHistory();
          markChanged();
        }
        return;
      }

      if (message.type === 'selection-change') {
        const nextSelected = message.element as SelectedElement;
        setSelected(nextSelected);
        setTab('html');
        window.setTimeout(() => highlightCodeForElement(nextSelected.id), 0);
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
      const savedPages = (
        loaded.project_data as { pages?: PageRecord[] } | null
      )?.pages;
      const initialPages: PageRecord[] =
        Array.isArray(savedPages) && savedPages.length
          ? savedPages
          : [{
              id: 'home',
              name: 'Home',
              path: '',
              html: loaded.html || '',
              css: loaded.css || '',
              javascript: loaded.javascript || '',
              title: loaded.name,
              description: ''
            }];
      const firstPage = initialPages[0];

      siteRef.current = loaded;
      htmlRef.current = firstPage.html || '';
      cssRef.current = firstPage.css || '';
      javascriptRef.current = firstPage.javascript || '';
      setSite(loaded);
      setPages(initialPages);
      setActivePageId(firstPage.id);
      setHtml(htmlRef.current);
      setCss(cssRef.current);
      setJavascript(javascriptRef.current);
      setPublishSlug(loaded.slug || '');
      setFormEmail(loaded.form_email || '');

      historyRef.current = [{
        html: htmlRef.current,
        css: cssRef.current,
        javascript: javascriptRef.current
      }];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
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

  function updateHistoryButtons() {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(
      historyIndexRef.current >= 0 &&
      historyIndexRef.current < historyRef.current.length - 1
    );
  }

  function pushHistory() {
    if (applyingHistoryRef.current) return;

    const snapshot: HistorySnapshot = {
      html: htmlRef.current,
      css: cssRef.current,
      javascript: javascriptRef.current
    };
    const current = historyRef.current[historyIndexRef.current];

    if (
      current &&
      current.html === snapshot.html &&
      current.css === snapshot.css &&
      current.javascript === snapshot.javascript
    ) {
      return;
    }

    historyRef.current = historyRef.current.slice(
      0,
      historyIndexRef.current + 1
    );
    historyRef.current.push(snapshot);

    if (historyRef.current.length > 60) {
      historyRef.current.shift();
    }

    historyIndexRef.current = historyRef.current.length - 1;
    updateHistoryButtons();
  }

  function applySnapshot(snapshot: HistorySnapshot) {
    applyingHistoryRef.current = true;
    htmlRef.current = snapshot.html;
    cssRef.current = snapshot.css;
    javascriptRef.current = snapshot.javascript;
    setHtml(snapshot.html);
    setCss(snapshot.css);
    setJavascript(snapshot.javascript);
    applyingHistoryRef.current = false;
    markChanged();
  }

  function undo() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    updateHistoryButtons();
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    updateHistoryButtons();
  }

  function highlightCodeForElement(id: string) {
    const textarea = codeTextareaRef.current;
    if (!textarea) return;

    const marker = `data-canvasforge-editor-id="${id}"`;
    const markerIndex = htmlRef.current.indexOf(marker);
    if (markerIndex < 0) return;

    const start = htmlRef.current.lastIndexOf('<', markerIndex);
    const end = htmlRef.current.indexOf('>', markerIndex);
    textarea.focus();
    textarea.setSelectionRange(
      Math.max(0, start),
      end >= 0 ? end + 1 : markerIndex + marker.length
    );
    const ratio = Math.max(0, start) / Math.max(1, htmlRef.current.length);
    textarea.scrollTop =
      ratio * Math.max(0, textarea.scrollHeight - textarea.clientHeight);
  }

  function selectVisualFromCode(cursor: number) {
    const before = htmlRef.current.slice(0, cursor);
    const matches = [
      ...before.matchAll(/data-canvasforge-editor-id="([^"]+)"/g)
    ];
    const id = matches.at(-1)?.[1];
    if (!id) return;

    postToPreview({
      type: 'select-element',
      id
    });
  }

  function syncActivePage(): PageRecord[] {
    return pages.map((page) =>
      page.id === activePageId
        ? {
            ...page,
            html: htmlRef.current,
            css: cssRef.current,
            javascript: javascriptRef.current
          }
        : page
    );
  }

  function switchPage(pageId: string) {
    const updatedPages = syncActivePage();
    setPages(updatedPages);
    const nextPage = updatedPages.find((page) => page.id === pageId);
    if (!nextPage) return;

    setActivePageId(nextPage.id);
    htmlRef.current = nextPage.html;
    cssRef.current = nextPage.css;
    javascriptRef.current = nextPage.javascript;
    setHtml(nextPage.html);
    setCss(nextPage.css);
    setJavascript(nextPage.javascript);
    historyRef.current = [{
      html: nextPage.html,
      css: nextPage.css,
      javascript: nextPage.javascript
    }];
    historyIndexRef.current = 0;
    updateHistoryButtons();
  }

  function addPage() {
    const template = PAGE_TEMPLATES[pageTemplate] || PAGE_TEMPLATES.blank;
    const nextPages = syncActivePage();
    const basePath = template.path || 'page';
    let path = basePath;
    let suffix = 2;

    while (nextPages.some((page) => page.path === path)) {
      path = `${basePath}-${suffix}`;
      suffix += 1;
    }

    const page: PageRecord = {
      ...template,
      id: crypto.randomUUID(),
      name: template.name,
      path
    };
    setPages([...nextPages, page]);
    setActivePageId(page.id);
    htmlRef.current = page.html;
    cssRef.current = page.css;
    javascriptRef.current = page.javascript;
    setHtml(page.html);
    setCss(page.css);
    setJavascript(page.javascript);
    pushHistory();
    markChanged();
  }

  function deleteActivePage() {
    if (pages.length <= 1) {
      setError('A website must keep at least one page.');
      return;
    }

    const remaining = syncActivePage().filter(
      (page) => page.id !== activePageId
    );
    setPages(remaining);
    switchPage(remaining[0].id);
    markChanged();
  }

  async function saveSite() {
    const currentSite = siteRef.current;
    if (!currentSite) return;

    setSaveState('saving');
    setError('');

    try {
      const updatedPages = syncActivePage();
      const activePage =
        updatedPages.find((page) => page.id === activePageId) ||
        updatedPages[0];

      const payload = {
        html: activePage?.html || htmlRef.current,
        css: activePage?.css || cssRef.current,
        javascript: activePage?.javascript || javascriptRef.current,
        project_data: { pages: updatedPages },
        updated_at: new Date().toISOString()
      };
      setPages(updatedPages);

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
    pushHistory();
    markChanged();
  }

  function updateCss(value: string) {
    cssRef.current = value;
    setCss(value);
    pushHistory();
    markChanged();
  }

  function updateJavascript(value: string) {
    javascriptRef.current = value;
    setJavascript(value);
    pushHistory();
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
            rewriteCssAssetUrls(
              replaceReferences(
                await cssEntry.async('text'),
                replacements
              ),
              cssEntry.name,
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

    if (!file) return;

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

      if (selected?.isImage) {
        postToPreview({
          type: 'replace-image',
          id: selected.id,
          url,
          alt: file.name.replace(/\.[^.]+$/, '')
        });
      } else {
        postToPreview({
          type: 'insert-image',
          url,
          alt: file.name.replace(/\.[^.]+$/, '')
        });
      }
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

  function addShape(kind: 'rectangle' | 'circle' | 'line') {
    postToPreview({
      type: 'insert-shape',
      kind,
      color: selectedBackground
    });
  }

  function applySelectedStyles() {
    if (!selected) {
      setError('Select an element on the visual canvas first.');
      return;
    }

    const rotation = Number(selectedRotation) || 0;
    postToPreview({
      type: 'apply-style',
      id: selected.id,
      styles: {
        color: selectedTextColor,
        'background-color': selectedBackground,
        'font-family': fontFamily,
        'font-size': `${Math.max(1, Number(selectedFontSize) || 16)}px`,
        width: selectedWidth ? `${Math.max(1, Number(selectedWidth))}px` : '',
        height: selectedHeight ? `${Math.max(1, Number(selectedHeight))}px` : '',
        transform: `rotate(${rotation}deg)`
      },
      animation: selectedAnimation
    });
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
            onClick={() => imageInput.current?.click()}
            disabled={uploadingImage}
          >
            {uploadingImage ? 'Uploading…' : '+ Photo'}
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
          <button onClick={undo} disabled={!canUndo} title="Undo">↶ Undo</button>
          <button onClick={redo} disabled={!canRedo} title="Redo">↷ Redo</button>
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
            className={gridMode ? 'active' : ''}
            onClick={() => setGridMode((current) => !current)}
            title="Snap dragged elements to a 20-pixel grid."
          >
            Grid {gridMode ? 'on' : 'off'}
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

          <div className="selection-tools">
            <label title="Text color">
              Text <input type="color" value={selectedTextColor} onChange={(event) => setSelectedTextColor(event.target.value)} />
            </label>
            <label title="Background color">
              Fill <input type="color" value={selectedBackground} onChange={(event) => setSelectedBackground(event.target.value)} />
            </label>
            <label>
              Size <input className="mini-number" type="number" min="1" value={selectedFontSize} onChange={(event) => setSelectedFontSize(event.target.value)} />
            </label>
            <label>
              W <input className="mini-number" type="number" min="1" placeholder="auto" value={selectedWidth} onChange={(event) => setSelectedWidth(event.target.value)} />
            </label>
            <label>
              H <input className="mini-number" type="number" min="1" placeholder="auto" value={selectedHeight} onChange={(event) => setSelectedHeight(event.target.value)} />
            </label>
            <label>
              Rotate <input className="mini-number" type="number" value={selectedRotation} onChange={(event) => setSelectedRotation(event.target.value)} />
            </label>
            <select value={selectedAnimation} onChange={(event) => setSelectedAnimation(event.target.value as AnimationPreset)}>
              <option value="none">No animation</option>
              <option value="fade">Fade</option>
              <option value="slide-up">Slide up</option>
              <option value="slide-left">Slide left</option>
              <option value="spin">Spin</option>
              <option value="pulse">Pulse</option>
              <option value="bounce">Bounce</option>
            </select>
            <button onClick={applySelectedStyles}>Apply style</button>
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
                <h3>Pages</h3>
                <select className="input" value={activePageId} onChange={(event) => switchPage(event.target.value)}>
                  {pages.map((page) => <option key={page.id} value={page.id}>{page.name} {page.path ? `/${page.path}` : '/'}</option>)}
                </select>
                <select className="input" value={pageTemplate} onChange={(event) => setPageTemplate(event.target.value)}>
                  <option value="blank">Blank page</option>
                  <option value="services">Services page</option>
                  <option value="product">Product/payment page</option>
                  <option value="login">Customer login page</option>
                  <option value="blog">Blog page</option>
                </select>
                <button className="button-secondary button-small" onClick={addPage}>Add page</button>
                <button className="button-danger button-small" onClick={deleteActivePage}>Delete page</button>
              </div>

              <div className="code-tool-section">
                <h3>Shapes</h3>
                <div className="shape-buttons">
                  <button onClick={() => addShape('rectangle')}>Rectangle</button>
                  <button onClick={() => addShape('circle')}>Circle</button>
                  <button onClick={() => addShape('line')}>Line</button>
                </div>
              </div>

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
                  ref={codeTextareaRef}
                  className="code-builder-textarea"
                  value={html}
                  onChange={(event) =>
                    updateHtml(event.target.value)
                  }
                  onClick={(event) => selectVisualFromCode(event.currentTarget.selectionStart)}
                  onKeyUp={(event) => selectVisualFromCode(event.currentTarget.selectionStart)}
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
