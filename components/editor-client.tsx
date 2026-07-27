'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
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
type EditorMode = 'live' | 'edit' | 'canvas';
type WorkspaceMode = 'split' | 'code' | 'visual';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';
type ToolTab = 'element' | 'add' | 'pages' | 'assets';

type PageData = {
  id: string;
  name: string;
  path: string;
  html: string;
  css: string;
  javascript: string;
  title: string;
  description: string;
};

type StudioData = {
  version: 2;
  activePageId: string;
  pages: PageData[];
};

type Snapshot = {
  studio: StudioData;
  pageId: string;
};

type SelectedElement = {
  id: string;
  tag: string;
  label: string;
  className: string;
  isText: boolean;
  isImage: boolean;
  isForm: boolean;
  styles: Record<string, string>;
};

const FONTS = [
  'Arial', 'Arial Black', 'Alegreya', 'Archivo', 'Barlow',
  'Barlow Condensed', 'Bebas Neue', 'Cabin', 'Cormorant Garamond',
  'DM Sans', 'Fira Sans', 'IBM Plex Sans', 'Inter', 'Lato',
  'Libre Baskerville', 'Manrope', 'Merriweather', 'Montserrat',
  'Nunito', 'Open Sans', 'Oswald', 'Playfair Display', 'Poppins',
  'Raleway', 'Roboto', 'Roboto Condensed', 'Source Sans 3',
  'Ubuntu', 'Work Sans'
];

const PAGE_TEMPLATES: Record<string, Omit<PageData, 'id' | 'path'>> = {
  blank: {
    name: 'Blank page', title: 'New page', description: '',
    html: '<!doctype html><html><head></head><body><main style="min-height:100vh;padding:64px"><h1>New page</h1><p>Start building here.</p></main></body></html>',
    css: '*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif}', javascript: ''
  },
  service: {
    name: 'Services', title: 'Services', description: 'Services page',
    html: '<!doctype html><html><head></head><body><header class="page-hero"><p>SERVICES</p><h1>How we can help</h1></header><main class="cards"><article><h2>Service one</h2><p>Describe your service.</p></article><article><h2>Service two</h2><p>Describe your service.</p></article><article><h2>Service three</h2><p>Describe your service.</p></article></main></body></html>',
    css: '*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif}.page-hero{padding:100px 7vw;background:#111827;color:white}.page-hero h1{font-size:clamp(3rem,8vw,7rem);margin:.2em 0}.cards{padding:70px 7vw;display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.cards article{padding:28px;border:1px solid #ddd}@media(max-width:760px){.cards{grid-template-columns:1fr}}',
    javascript: ''
  },
  product: {
    name: 'Product', title: 'Product', description: 'Product sales page',
    html: '<!doctype html><html><head></head><body><main class="product"><div class="product-image">Product image</div><div><p>FEATURED PRODUCT</p><h1>Product name</h1><p class="price">$99.00</p><p>Describe the product and its benefits.</p><a class="buy" href="https://buy.stripe.com/REPLACE_ME">Buy now</a></div></main></body></html>',
    css: '*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif}.product{min-height:100vh;padding:7vw;display:grid;grid-template-columns:1fr 1fr;gap:7vw;align-items:center}.product-image{aspect-ratio:1;background:#eee;display:grid;place-items:center}.product h1{font-size:clamp(3rem,7vw,6rem);line-height:.95}.price{font-size:1.6rem}.buy{display:inline-block;padding:14px 24px;background:#111;color:#fff;text-decoration:none;font-weight:800}@media(max-width:760px){.product{grid-template-columns:1fr}}',
    javascript: ''
  },
  login: {
    name: 'Login', title: 'Customer login', description: 'Customer login page',
    html: '<!doctype html><html><head></head><body><main class="auth"><form><h1>Welcome back</h1><label>Email<input type="email" name="email" required></label><label>Password<input type="password" name="password" required></label><button type="submit">Sign in</button><p><a href="#">Forgot password?</a></p></form></main></body></html>',
    css: '*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:#f3f4f6}.auth{min-height:100vh;display:grid;place-items:center;padding:24px}.auth form{width:min(440px,100%);padding:40px;background:white;display:grid;gap:18px;box-shadow:0 20px 50px #0001}.auth label{display:grid;gap:7px;font-weight:700}.auth input{padding:13px;border:1px solid #ccc}.auth button{padding:14px;background:#111;color:#fff;border:0;font-weight:800}',
    javascript: ''
  },
  blog: {
    name: 'Blog', title: 'Blog', description: 'Blog landing page',
    html: '<!doctype html><html><head></head><body><header class="blog-head"><p>INSIGHTS</p><h1>Latest articles</h1></header><main class="posts"><article><div class="thumb"></div><h2>Article title</h2><p>Article summary goes here.</p></article><article><div class="thumb"></div><h2>Article title</h2><p>Article summary goes here.</p></article><article><div class="thumb"></div><h2>Article title</h2><p>Article summary goes here.</p></article></main></body></html>',
    css: '*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif}.blog-head{padding:90px 7vw;border-bottom:1px solid #ddd}.blog-head h1{font-size:clamp(3rem,8vw,7rem);margin:.2em 0}.posts{padding:60px 7vw;display:grid;grid-template-columns:repeat(3,1fr);gap:30px}.thumb{aspect-ratio:16/10;background:#ddd}@media(max-width:760px){.posts{grid-template-columns:1fr}}',
    javascript: ''
  }
};

const CONTACT_HTML = `<section class="cf-contact" id="contact"><div><p class="cf-kicker">GET IN TOUCH</p><h2>Contact me</h2><p>Tell me what you are looking for and I will get back to you.</p></div><form><label>Name<input name="name" required></label><label>Email<input type="email" name="email" required></label><label>Phone<input type="tel" name="phone"></label><label>Message<textarea name="message" rows="6" required></textarea></label><input name="_cf_website" tabindex="-1" autocomplete="off" class="cf-honeypot"><button type="submit">Send message</button><p data-canvasforge-status></p></form></section>`;
const CONTACT_CSS = `.cf-contact{padding:80px 6vw;display:grid;grid-template-columns:.8fr 1.2fr;gap:56px;background:#f6f6f3;color:#111}.cf-kicker{font-size:.75rem;font-weight:800;letter-spacing:.16em}.cf-contact h2{font-size:clamp(2.5rem,6vw,5rem);margin:.2em 0}.cf-contact form{display:grid;gap:16px}.cf-contact label{display:grid;gap:7px;font-weight:700}.cf-contact input,.cf-contact textarea{width:100%;padding:13px;border:1px solid #bbb;font:inherit}.cf-contact button{justify-self:start;padding:14px 22px;border:0;background:#111;color:white;font-weight:800}.cf-honeypot{position:absolute!important;left:-10000px!important}@media(max-width:760px){.cf-contact{grid-template-columns:1fr}}`;

function uid(prefix='id'){return `${prefix}-${crypto.randomUUID().slice(0,8)}`;}
function slugify(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,63)||'page';}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
function escapeScript(value:string){return value.replace(/<\/script/gi,'<\\/script');}
function normalizePath(value:string){return decodeURIComponent(value).replace(/\\/g,'/').split('?')[0].split('#')[0].replace(/^\.\//,'').replace(/^\//,'');}
function dirname(value:string){const p=normalizePath(value);const i=p.lastIndexOf('/');return i<0?'':p.slice(0,i+1);}
function resolvePath(base:string,ref:string){if(/^(https?:|data:|blob:|#|mailto:|tel:)/i.test(ref))return ref;const stack=dirname(base).split('/').filter(Boolean);for(const part of normalizePath(ref).split('/')){if(!part||part==='.')continue;if(part==='..')stack.pop();else stack.push(part)}return stack.join('/');}
function getMimeType(name:string){const ext=name.split('.').pop()?.toLowerCase()||'';const map:Record<string,string>={html:'text/html',css:'text/css',js:'text/javascript',mjs:'text/javascript',json:'application/json',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',avif:'image/avif',svg:'image/svg+xml',ico:'image/x-icon',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',pdf:'application/pdf'};return map[ext]||'application/octet-stream';}
function replaceRefs(source:string,map:Map<string,string>){let result=source;for(const [key,url] of [...map.entries()].sort((a,b)=>b[0].length-a[0].length)){const clean=normalizePath(key);for(const variant of new Set([key,clean,`./${clean}`,`/${clean}`])){if(variant)result=result.split(variant).join(url)}}return result;}
function replaceBody(source:string,body:string){const doc=new DOMParser().parseFromString(source,'text/html');doc.body.innerHTML=body;return `<!doctype html>\n${doc.documentElement.outerHTML}`;}
function addBeforeBody(source:string,html:string){return /<\/body>/i.test(source)?source.replace(/<\/body>/i,`${html}\n</body>`):`${source}\n${html}`;}
function makeStudio(site:Site):StudioData{const raw=site.project_data as {pages?:PageData[];activePageId?:string}|null;if(raw?.pages?.length){return {version:2,pages:raw.pages,activePageId:raw.activePageId||raw.pages[0].id}}const home:PageData={id:'home',name:'Home',path:'',html:site.html||'',css:site.css||'',javascript:site.javascript||'',title:site.name,description:''};return {version:2,pages:[home],activePageId:'home'};}

function bridgeScript(mode:EditorMode,grid:number){return `<script data-cf-bridge>(()=>{const mode=${JSON.stringify(mode)},grid=${grid};let selected=null,drag=null,counter=0;const A='data-cf-id';const ensure=e=>{if(!e.getAttribute(A))e.setAttribute(A,'cf-'+(++counter));return e.getAttribute(A)};const clean=root=>root.querySelectorAll('[data-cf-selected],[data-cf-hover],[data-cf-dragging],[contenteditable],[draggable]').forEach(e=>['data-cf-selected','data-cf-hover','data-cf-dragging','contenteditable','draggable'].forEach(a=>e.removeAttribute(a)));const send=()=>{const c=document.body.cloneNode(true);clean(c);parent.postMessage({source:'cf-studio',type:'change',body:c.innerHTML},'*')};const info=e=>({id:ensure(e),tag:e.tagName.toLowerCase(),label:(e.getAttribute('alt')||e.getAttribute('aria-label')||e.textContent||e.tagName).replace(/\\s+/g,' ').trim().slice(0,60),className:e.className||'',isText:/^(P|H[1-6]|SPAN|A|BUTTON|LABEL|LI|STRONG|EM|SMALL|BLOCKQUOTE)$/.test(e.tagName),isImage:e.tagName==='IMG',isForm:e.tagName==='FORM'||!!e.closest('form'),styles:{color:getComputedStyle(e).color,backgroundColor:getComputedStyle(e).backgroundColor,fontFamily:getComputedStyle(e).fontFamily,fontSize:getComputedStyle(e).fontSize,width:getComputedStyle(e).width,height:getComputedStyle(e).height}});const select=e=>{selected?.removeAttribute('data-cf-selected');selected=e;ensure(e);e.setAttribute('data-cf-selected','true');parent.postMessage({source:'cf-studio',type:'select',element:info(e)},'*')};const byId=id=>document.querySelector('['+A+'="'+CSS.escape(id)+'"]');const style=document.createElement('style');style.textContent='[data-cf-selected=true]{outline:3px solid #635bff!important;outline-offset:2px!important}[data-cf-hover=true]{outline:2px dashed #635bffaa!important;outline-offset:2px!important}[contenteditable=true]{cursor:text!important}[data-cf-dragging=true]{opacity:.4!important}'+(mode==='canvas'?'body{background-image:linear-gradient(#635bff20 1px,transparent 1px),linear-gradient(90deg,#635bff20 1px,transparent 1px);background-size:'+grid+'px '+grid+'px}':'');document.head.appendChild(style);document.querySelectorAll('body *').forEach(e=>{if(e instanceof HTMLElement){ensure(e);e.draggable=mode!=='live'}});if(mode!=='live'){document.addEventListener('mouseover',ev=>{const e=ev.target;if(e instanceof HTMLElement&&e!==document.body)e.setAttribute('data-cf-hover','true')},true);document.addEventListener('mouseout',ev=>{const e=ev.target;if(e instanceof HTMLElement)e.removeAttribute('data-cf-hover')},true);document.addEventListener('click',ev=>{const e=ev.target;if(!(e instanceof HTMLElement)||e===document.body)return;ev.preventDefault();ev.stopPropagation();select(e)},true);document.addEventListener('dblclick',ev=>{const e=ev.target;if(!(e instanceof HTMLElement)||!/^(P|H[1-6]|SPAN|A|BUTTON|LABEL|LI|STRONG|EM|SMALL|BLOCKQUOTE)$/.test(e.tagName))return;ev.preventDefault();select(e);e.contentEditable='true';e.focus()},true);document.addEventListener('input',send,true);document.addEventListener('blur',ev=>{const e=ev.target;if(e instanceof HTMLElement&&e.isContentEditable){e.removeAttribute('contenteditable');send()}},true);document.addEventListener('submit',ev=>{ev.preventDefault();ev.stopPropagation()},true);document.addEventListener('dragstart',ev=>{const e=ev.target;if(!(e instanceof HTMLElement)||e===document.body)return;drag=e;e.setAttribute('data-cf-dragging','true')},true);document.addEventListener('dragover',ev=>{if(drag)ev.preventDefault()},true);document.addEventListener('drop',ev=>{if(!drag)return;ev.preventDefault();const t=ev.target;if(!(t instanceof HTMLElement)||t===drag||drag.contains(t))return;if(mode==='canvas'){const r=document.body.getBoundingClientRect();const x=Math.round((ev.clientX-r.left)/grid)*grid,y=Math.round((ev.clientY-r.top)/grid)*grid;drag.style.position='absolute';drag.style.left=x+'px';drag.style.top=y+'px';drag.style.margin='0';if(drag.parentElement!==document.body)document.body.appendChild(drag)}else{const r=t.getBoundingClientRect(),after=ev.clientY>r.top+r.height/2;t.parentElement?.insertBefore(drag,after?t.nextSibling:t)}drag.removeAttribute('data-cf-dragging');select(drag);drag=null;send()},true)}window.addEventListener('message',ev=>{const m=ev.data;if(!m||m.source!=='cf-parent')return;const e=m.id?byId(m.id):selected;if(m.type==='select-code'){const target=byId(m.id);if(target){target.scrollIntoView({behavior:'smooth',block:'center'});select(target)}return}if(!(e instanceof HTMLElement))return;if(m.type==='delete'){e.remove();selected=null;send()}if(m.type==='duplicate'){const c=e.cloneNode(true);clean(c);e.insertAdjacentElement('afterend',c);document.querySelectorAll('body *').forEach(n=>n instanceof HTMLElement&&ensure(n));select(c);send()}if(m.type==='move-up'&&e.previousElementSibling){e.parentElement?.insertBefore(e,e.previousElementSibling);send()}if(m.type==='move-down'&&e.nextElementSibling){e.parentElement?.insertBefore(e.nextElementSibling,e);send()}if(m.type==='edit-text'){e.contentEditable='true';e.focus()}if(m.type==='image'&&e.tagName==='IMG'){e.setAttribute('src',m.url);send()}if(m.type==='style'){Object.assign(e.style,m.styles||{});send()}if(m.type==='animate'){e.style.animation=m.animation||'';send()}if(m.type==='resize'){if(m.width)e.style.width=m.width;if(m.height)e.style.height=m.height;send()}});parent.postMessage({source:'cf-studio',type:'ready'},'*')})()</script>`;}

function renderDocument(page:PageData,mode:EditorMode,grid:number){let source=page.html.trim()||'<!doctype html><html><head></head><body><main><h1>Start editing</h1></main></body></html>';const css=`<style data-cf-css>${page.css}</style>`;const js=page.javascript.trim()&&mode==='live'?`<script data-cf-js>${escapeScript(page.javascript)}</script>`:'';const bridge=bridgeScript(mode,grid);if(/<html[\s>]/i.test(source)){source=/<\/head>/i.test(source)?source.replace(/<\/head>/i,`${css}</head>`):source.replace(/<html[^>]*>/i,m=>`${m}<head>${css}</head>`);return /<\/body>/i.test(source)?source.replace(/<\/body>/i,`${js}${bridge}</body>`):`${source}${js}${bridge}`}return `<!doctype html><html><head>${css}</head><body>${source}${js}${bridge}</body></html>`;}

export function EditorClient(){
 const params=useParams<{id:string}>();const router=useRouter();const frame=useRef<HTMLIFrameElement|null>(null);const zipInput=useRef<HTMLInputElement|null>(null);const imageInput=useRef<HTMLInputElement|null>(null);const codeRef=useRef<HTMLTextAreaElement|null>(null);const saveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const history=useRef<Snapshot[]>([]);const historyIndex=useRef(-1);
 const [site,setSite]=useState<Site|null>(null);const [studio,setStudio]=useState<StudioData|null>(null);const [loading,setLoading]=useState(true);const [saveState,setSaveState]=useState<SaveState>('saved');const [error,setError]=useState('');const [tab,setTab]=useState<CodeTab>('html');const [workspace,setWorkspace]=useState<WorkspaceMode>('split');const [mode,setMode]=useState<EditorMode>('edit');const [device,setDevice]=useState<DeviceMode>('desktop');const [tool,setTool]=useState<ToolTab>('element');const [selected,setSelected]=useState<SelectedElement|null>(null);const [grid,setGrid]=useState(20);const [showPublish,setShowPublish]=useState(false);const [publishSlug,setPublishSlug]=useState('');const [formEmail,setFormEmail]=useState('');const [publishing,setPublishing]=useState(false);const [importing,setImporting]=useState(false);const [font,setFont]=useState('Inter');const [customFontUrl,setCustomFontUrl]=useState('');const [customFontName,setCustomFontName]=useState('');const [newPageName,setNewPageName]=useState('');const [newPageTemplate,setNewPageTemplate]=useState('blank');const [color,setColor]=useState('#111111');const [background,setBackground]=useState('#ffffff');const [fontSize,setFontSize]=useState('16px');const [width,setWidth]=useState('');const [height,setHeight]=useState('');
 const active=studio?.pages.find(p=>p.id===studio.activePageId)||null;const publicBase=process.env.NEXT_PUBLIC_PUBLIC_BASE_URL||'https://canvasforge-starter.vercel.app/published';const liveUrl=site?`${publicBase.replace(/\/$/,'')}/${site.slug}`:'';const preview=useMemo(()=>active?renderDocument(active,mode,grid):'',[active,mode,grid]);
 useEffect(()=>{void load();return()=>{if(saveTimer.current)clearTimeout(saveTimer.current)}},[params.id]);
 useEffect(()=>{const handler=(event:MessageEvent)=>{const m=event.data;if(!m||m.source!=='cf-studio')return;if(m.type==='change'&&active){updatePage({...active,html:replaceBody(active.html,m.body)},true)}if(m.type==='select'){setSelected(m.element as SelectedElement);highlightCode((m.element as SelectedElement).id)}};window.addEventListener('message',handler);return()=>window.removeEventListener('message',handler)},[active?.id,active?.html]);
 async function load(){setLoading(true);try{const sb=getSupabase();const {data:auth}=await sb.auth.getUser();if(!auth.user){router.replace('/login');return}const {data,error}=await sb.from('sites').select('*').eq('id',params.id).single();if(error)throw error;const s=data as Site;const st=makeStudio(s);setSite(s);setStudio(st);setPublishSlug(s.slug);setFormEmail(s.form_email||'');pushHistory(st,true)}catch(e){setError(e instanceof Error?e.message:'Unable to load site.')}finally{setLoading(false)}}
 function pushHistory(next:StudioData,reset=false){const snap={studio:clone(next),pageId:next.activePageId};if(reset){history.current=[snap];historyIndex.current=0;return}history.current=history.current.slice(0,historyIndex.current+1);history.current.push(snap);if(history.current.length>60)history.current.shift();historyIndex.current=history.current.length-1}
 function undo(){if(historyIndex.current<=0)return;historyIndex.current--;const s=clone(history.current[historyIndex.current].studio);setStudio(s);setSaveState('unsaved')}
 function redo(){if(historyIndex.current>=history.current.length-1)return;historyIndex.current++;const s=clone(history.current[historyIndex.current].studio);setStudio(s);setSaveState('unsaved')}
 function scheduleSave(next:StudioData){setSaveState('unsaved');if(saveTimer.current)clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>void save(next),1000)}
 function updateStudio(next:StudioData,record=true){setStudio(next);if(record)pushHistory(next);scheduleSave(next)}
 function updatePage(page:PageData,record=true){if(!studio)return;const next={...studio,pages:studio.pages.map(p=>p.id===page.id?page:p)};updateStudio(next,record)}
 async function save(value=studio){if(!site||!value)return;setSaveState('saving');try{const home=value.pages.find(p=>p.path==='')||value.pages[0];const payload={html:home.html,css:home.css,javascript:home.javascript,project_data:value,updated_at:new Date().toISOString()};const {error}=await getSupabase().from('sites').update(payload).eq('id',site.id);if(error)throw error;setSite({...site,...payload});setSaveState('saved')}catch(e){setSaveState('error');setError(e instanceof Error?e.message:'Save failed')}}
 function codeValue(){if(!active)return'';return tab==='html'?active.html:tab==='css'?active.css:active.javascript}
 function changeCode(value:string){if(!active)return;updatePage({...active,[tab]:value} as PageData)}
 function highlightCode(id:string){setTab('html');setTimeout(()=>{const el=codeRef.current;if(!el||!active)return;const token=`data-cf-id="${id}"`;const i=active.html.indexOf(token);if(i>=0){const start=active.html.lastIndexOf('<',i);const end=active.html.indexOf('>',i)+1;el.focus();el.setSelectionRange(Math.max(0,start),Math.max(start,end));const line=active.html.slice(0,start).split('\n').length;el.scrollTop=Math.max(0,(line-5)*21)}},0)}
 function codeClick(){if(tab!=='html'||!active||!codeRef.current)return;const pos=codeRef.current.selectionStart;const before=active.html.slice(0,pos);const matches=[...before.matchAll(/data-cf-id="([^"]+)"/g)];const id=matches.at(-1)?.[1];if(id)frame.current?.contentWindow?.postMessage({source:'cf-parent',type:'select-code',id},'*')}
 function post(message:Record<string,unknown>){frame.current?.contentWindow?.postMessage({source:'cf-parent',...message},'*')}
 async function uploadAsset(file:File,pathHint=file.name){if(!site)throw new Error('Site not loaded');const sb=getSupabase();const {data:auth}=await sb.auth.getUser();if(!auth.user)throw new Error('Session expired');const name=normalizePath(pathHint).replace(/[^a-zA-Z0-9._/-]/g,'-').split('/').pop()||file.name;const path=`${auth.user.id}/${site.id}/${crypto.randomUUID()}-${name}`;const {error}=await sb.storage.from('site-assets').upload(path,file,{contentType:getMimeType(pathHint),cacheControl:'31536000',upsert:true});if(error)throw error;return sb.storage.from('site-assets').getPublicUrl(path).data.publicUrl}
 async function replaceImage(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file||!selected?.isImage)return;try{const url=await uploadAsset(file);post({type:'image',id:selected.id,url})}catch(e){setError(e instanceof Error?e.message:'Upload failed')}finally{event.target.value=''}}
 async function importZip(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file||!active)return;setImporting(true);try{const zip=await JSZip.loadAsync(file);const files=(Object.values(zip.files) as JSZipObject[]).filter(e=>!e.dir&&!e.name.includes('__MACOSX'));const index=files.find(e=>/(^|\/)index\.html?$/i.test(e.name))||files.find(e=>/\.html?$/i.test(e.name));if(!index)throw new Error('ZIP must contain index.html');let html=await index.async('text');const map=new Map<string,string>();for(const entry of files){if(entry===index||/\.(html?|css|js|mjs)$/i.test(entry.name))continue;const blob=await entry.async('blob');const f=new File([blob],entry.name.split('/').pop()||'asset',{type:getMimeType(entry.name)});const url=await uploadAsset(f,entry.name);map.set(normalizePath(entry.name),url);map.set(resolvePath(index.name,entry.name),url)}html=replaceRefs(html,map);const doc=new DOMParser().parseFromString(html,'text/html');const cssParts:string[]=[];const jsParts:string[]=[];for(const style of Array.from(doc.querySelectorAll('style'))){cssParts.push(replaceRefs(style.textContent||'',map));style.remove()}for(const link of Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet][href]'))){const href=link.getAttribute('href')||'';if(/^https?:/i.test(href))continue;const resolved=resolvePath(index.name,href);const entry=files.find(e=>normalizePath(e.name)===resolved);if(entry){cssParts.push(replaceRefs(await entry.async('text'),map));link.remove()}}for(const script of Array.from(doc.querySelectorAll<HTMLScriptElement>('script'))){const src=script.getAttribute('src');if(src&&!/^https?:/i.test(src)){const resolved=resolvePath(index.name,src);const entry=files.find(e=>normalizePath(e.name)===resolved);if(entry){jsParts.push(await entry.async('text'));script.remove()}}else if(!src&&script.textContent){jsParts.push(script.textContent);script.remove()}}const page={...active,html:`<!doctype html>\n${doc.documentElement.outerHTML}`,css:cssParts.join('\n\n'),javascript:jsParts.join('\n\n')};updatePage(page);setMode('live')}catch(e){setError(e instanceof Error?e.message:'Import failed')}finally{setImporting(false);event.target.value=''}}
 function addShape(kind:'rectangle'|'circle'|'line'|'arrow'){if(!active)return;const id=uid('shape');let shape='';if(kind==='rectangle')shape=`<div data-cf-id="${id}" style="width:200px;height:120px;background:#635bff"></div>`;if(kind==='circle')shape=`<div data-cf-id="${id}" style="width:140px;height:140px;border-radius:50%;background:#f59e0b"></div>`;if(kind==='line')shape=`<div data-cf-id="${id}" style="width:240px;height:4px;background:#111"></div>`;if(kind==='arrow')shape=`<div data-cf-id="${id}" style="font-size:80px;line-height:1">→</div>`;updatePage({...active,html:addBeforeBody(active.html,shape)});setMode('canvas')}
 function addContact(){if(!active)return;updatePage({...active,html:addBeforeBody(active.html,CONTACT_HTML),css:active.css.includes('.cf-contact')?active.css:`${active.css}\n${CONTACT_CSS}`})}
 function addFont(){if(!active)return;const name=font,encoded=name.replace(/ /g,'+');updatePage({...active,css:`@import url('https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700;800;900&display=swap');\n${active.css}\nbody{font-family:'${name}',sans-serif}`})}
 function addCustomFont(){if(!active||!customFontUrl.trim()||!customFontName.trim())return;updatePage({...active,css:`@import url('${customFontUrl.trim()}');\n${active.css}\nbody{font-family:'${customFontName.trim()}',sans-serif}`})}
 function applyStyle(){if(!selected)return;post({type:'style',id:selected.id,styles:{color,backgroundColor:background,fontSize,width:width||undefined,height:height||undefined}})}
 function addAnimation(name:string){if(!selected)return;const animations:Record<string,string>={spin:'cf-spin 1.5s linear infinite',fade:'cf-fade 1s ease both',slide:'cf-slide 1s ease both',bounce:'cf-bounce 1s ease infinite',pulse:'cf-pulse 1.2s ease-in-out infinite'};post({type:'animate',id:selected.id,animation:animations[name]});if(active&&!active.css.includes('@keyframes cf-spin'))updatePage({...active,css:`${active.css}\n@keyframes cf-spin{to{transform:rotate(360deg)}}@keyframes cf-fade{from{opacity:0}to{opacity:1}}@keyframes cf-slide{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}@keyframes cf-bounce{50%{transform:translateY(-14px)}}@keyframes cf-pulse{50%{transform:scale(1.08)}}`})}
 function createPage(event:FormEvent){event.preventDefault();if(!studio||!newPageName.trim())return;const template=PAGE_TEMPLATES[newPageTemplate];const page:PageData={...clone(template),id:uid('page'),name:newPageName.trim(),path:slugify(newPageName)};const next={...studio,pages:[...studio.pages,page],activePageId:page.id};updateStudio(next);setNewPageName('')}
 function deletePage(id:string){if(!studio||studio.pages.length===1)return;const pages=studio.pages.filter(p=>p.id!==id);updateStudio({...studio,pages,activePageId:studio.activePageId===id?pages[0].id:studio.activePageId})}
 async function publish(on:boolean){if(!site||!studio)return;const slug=slugify(publishSlug);if(!slug)return;setPublishing(true);try{await save(studio);const payload={slug,form_email:formEmail.trim()||null,is_published:on,published_at:on?new Date().toISOString():null};const {error}=await getSupabase().from('sites').update(payload).eq('id',site.id);if(error)throw error;setSite({...site,...payload});setPublishSlug(slug);setShowPublish(false)}catch(e){setError(e instanceof Error?e.message:'Publish failed')}finally{setPublishing(false)}}
 const status=saveState==='saving'?'Saving…':saveState==='unsaved'?'Unsaved':saveState==='error'?'Save failed':'Saved';
 if(loading)return <div className="loading-screen"><div className="spinner"/></div>;if(!site||!studio||!active)return <div className="loading-screen">{error||'Site not found'}</div>;
 return <div className="studio-shell">
  <header className="studio-header"><div><Link href="/dashboard">← Dashboard</Link><strong>{site.name}</strong><span>{status}</span></div><div><input ref={zipInput} type="file" accept=".zip" hidden onChange={importZip}/><input ref={imageInput} type="file" accept="image/*" hidden onChange={replaceImage}/><button onClick={()=>zipInput.current?.click()} disabled={importing}>{importing?'Importing…':'Import ZIP'}</button><button onClick={undo} disabled={historyIndex.current<=0}>↶ Undo</button><button onClick={redo} disabled={historyIndex.current>=history.current.length-1}>↷ Redo</button><button onClick={()=>setShowPublish(true)}>Publish</button><button className="primary" onClick={()=>void save()}>Save</button></div></header>
  <nav className="studio-modebar"><div>{(['split','code','visual'] as WorkspaceMode[]).map(w=><button key={w} className={workspace===w?'active':''} onClick={()=>setWorkspace(w)}>{w==='split'?'Code + Visual':w==='code'?'Code only':'Visual only'}</button>)}</div><div>{(['live','edit','canvas'] as EditorMode[]).map(m=><button key={m} className={mode===m?'active':''} onClick={()=>setMode(m)}>{m==='live'?'Live':m==='edit'?'Edit':'Grid canvas'}</button>)}{(['desktop','tablet','mobile'] as DeviceMode[]).map(d=><button key={d} className={device===d?'active':''} onClick={()=>setDevice(d)}>{d}</button>)}</div></nav>
  {selected&&mode!=='live'&&<div className="studio-selection"><span>Selected <b>{selected.tag}</b> — {selected.label}</span><div>{selected.isText&&<button onClick={()=>post({type:'edit-text',id:selected.id})}>Edit text</button>}{selected.isImage&&<button onClick={()=>imageInput.current?.click()}>Replace image</button>}<button onClick={()=>post({type:'move-up',id:selected.id})}>Up</button><button onClick={()=>post({type:'move-down',id:selected.id})}>Down</button><button onClick={()=>post({type:'duplicate',id:selected.id})}>Duplicate</button><button className="danger" onClick={()=>post({type:'delete',id:selected.id})}>Delete</button></div></div>}
  {error&&<div className="studio-error" onClick={()=>setError('')}>{error}</div>}
  <main className={`studio-main ${workspace}`}>
   {workspace!=='visual'&&<aside className="studio-tools"><div className="tool-tabs">{(['element','add','pages','assets'] as ToolTab[]).map(t=><button key={t} className={tool===t?'active':''} onClick={()=>setTool(t)}>{t}</button>)}</div>
    {tool==='element'&&<div className="tool-panel"><h3>Element</h3>{selected?<><label>Text color<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><label>Background<input type="color" value={background} onChange={e=>setBackground(e.target.value)}/></label><label>Font size<input value={fontSize} onChange={e=>setFontSize(e.target.value)}/></label><label>Width<input placeholder="e.g. 300px" value={width} onChange={e=>setWidth(e.target.value)}/></label><label>Height<input placeholder="e.g. 200px" value={height} onChange={e=>setHeight(e.target.value)}/></label><button onClick={applyStyle}>Apply style</button><h3>Animation</h3>{['fade','slide','spin','bounce','pulse'].map(a=><button key={a} onClick={()=>addAnimation(a)}>{a}</button>)}</>:<p>Select an element on the right.</p>}</div>}
    {tool==='add'&&<div className="tool-panel"><h3>Add</h3><button onClick={addContact}>Contact form</button><button onClick={()=>addShape('rectangle')}>Rectangle</button><button onClick={()=>addShape('circle')}>Circle</button><button onClick={()=>addShape('line')}>Line</button><button onClick={()=>addShape('arrow')}>Arrow</button><button onClick={()=>imageInput.current?.click()}>Upload/replace image</button><h3>Grid</h3><label>Grid size<input type="number" min="5" max="100" value={grid} onChange={e=>setGrid(Number(e.target.value)||20)}/></label><h3>Fonts</h3><select value={font} onChange={e=>setFont(e.target.value)}>{FONTS.map(f=><option key={f}>{f}</option>)}</select><button onClick={addFont}>Add online font</button><input placeholder="stylesheet URL" value={customFontUrl} onChange={e=>setCustomFontUrl(e.target.value)}/><input placeholder="font-family name" value={customFontName} onChange={e=>setCustomFontName(e.target.value)}/><button onClick={addCustomFont}>Add custom font</button></div>}
    {tool==='pages'&&<div className="tool-panel"><h3>Pages</h3>{studio.pages.map(p=><div className={`page-row ${p.id===active.id?'active':''}`} key={p.id}><button onClick={()=>updateStudio({...studio,activePageId:p.id},false)}>{p.name}<small>/{p.path}</small></button>{studio.pages.length>1&&<button className="danger" onClick={()=>deletePage(p.id)}>×</button>}</div>)}<form onSubmit={createPage}><input placeholder="Page name" value={newPageName} onChange={e=>setNewPageName(e.target.value)}/><select value={newPageTemplate} onChange={e=>setNewPageTemplate(e.target.value)}>{Object.entries(PAGE_TEMPLATES).map(([k,v])=><option value={k} key={k}>{v.name}</option>)}</select><button>Create page</button></form></div>}
    {tool==='assets'&&<div className="tool-panel"><h3>Assets</h3><button onClick={()=>imageInput.current?.click()}>Upload image</button><p>Choose an image element first to replace it. ZIP imports upload all images, fonts, video, and other assets automatically.</p></div>}
   </aside>}
   {workspace!=='visual'&&<section className="studio-code"><div className="code-head">{(['html','css','javascript'] as CodeTab[]).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div><textarea ref={codeRef} value={codeValue()} onChange={e=>changeCode(e.target.value)} onClick={codeClick} spellCheck={false}/></section>}
   {workspace!=='code'&&<section className="studio-visual"><div className="visual-head"><strong>{active.name}</strong><span>{mode==='live'?'Exact code and JavaScript preview':'Click to select; double-click text; drag to reorder'}</span>{site.is_published&&<a href={`${liveUrl}${active.path?`/${active.path}`:''}`} target="_blank" rel="noreferrer">View live ↗</a>}</div><div className="visual-stage"><div className={`device ${device}`}><iframe ref={frame} title="Website" srcDoc={preview} sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"/></div></div></section>}
  </main>
  {showPublish&&<div className="modal-backdrop"><div className="modal"><div className="modal-header"><h2>Publish</h2><button onClick={()=>setShowPublish(false)}>×</button></div><div className="modal-body form-stack"><label>Published URL<div className="path-input"><span>{publicBase.replace(/\/$/,'')}/</span><input value={publishSlug} onChange={e=>setPublishSlug(e.target.value)}/></div></label><label>Send forms to<input type="email" value={formEmail} onChange={e=>setFormEmail(e.target.value)} placeholder="you@example.com"/></label>{site.is_published&&<a href={liveUrl} target="_blank" rel="noreferrer">{liveUrl}</a>}</div><div className="modal-footer">{site.is_published&&<button className="button-danger" onClick={()=>void publish(false)}>Unpublish</button>}<button onClick={()=>setShowPublish(false)}>Cancel</button><button className="button-primary" disabled={publishing} onClick={()=>void publish(true)}>Save and publish</button></div></div></div>}
 </div>
}
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
