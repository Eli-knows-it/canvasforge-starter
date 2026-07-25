:root {
  --bg: #f5f7fb;
  --panel: #ffffff;
  --ink: #111827;
  --muted: #667085;
  --line: #e5e7eb;
  --brand: #5b5cf0;
  --brand-dark: #4748cf;
  --danger: #b42318;
  --success: #067647;
  --shadow: 0 18px 48px rgba(17, 24, 39, .10);
}

* { box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  margin: 0;
  color: var(--ink);
  background: var(--bg);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
a { color: inherit; }
button, input, textarea { font: inherit; }
button { cursor: pointer; }

.shell { min-height: 100vh; }
.topbar {
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 28px;
  border-bottom: 1px solid var(--line);
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(18px);
  position: sticky;
  top: 0;
  z-index: 20;
}
.logo { display: inline-flex; align-items: center; gap: 10px; font-weight: 850; text-decoration: none; letter-spacing: -.035em; }
.logo-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 11px; background: var(--brand); color: white; box-shadow: 0 8px 18px rgba(91,92,240,.28); }
.nav-actions { display: flex; gap: 10px; align-items: center; }

.button-primary, .button-secondary, .button-danger, .button-ghost {
  border-radius: 11px;
  padding: 10px 15px;
  border: 1px solid transparent;
  font-weight: 750;
  transition: .18s ease;
  text-decoration: none;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.button-primary { background: var(--brand); color: white; }
.button-primary:hover { background: var(--brand-dark); transform: translateY(-1px); }
.button-secondary { background: white; color: var(--ink); border-color: var(--line); }
.button-secondary:hover { background: #f8fafc; border-color: #d0d5dd; }
.button-danger { background: #fff4f2; color: var(--danger); border-color: #fecdca; }
.button-ghost { background: transparent; color: var(--muted); }
.button-ghost:hover { background: #f2f4f7; color: var(--ink); }
.button-small { padding: 8px 11px; font-size: .88rem; }
button:disabled { opacity: .55; cursor: not-allowed; transform: none !important; }

.landing {
  min-height: 100vh;
  background:
    radial-gradient(circle at 20% 15%, rgba(91,92,240,.20), transparent 34%),
    radial-gradient(circle at 80% 30%, rgba(52,211,153,.18), transparent 30%),
    #0d1220;
  color: white;
}
.landing-nav { max-width: 1180px; margin: auto; padding: 24px 28px; display: flex; justify-content: space-between; align-items: center; }
.hero-wrap { max-width: 1180px; margin: auto; padding: 84px 28px 120px; display: grid; grid-template-columns: 1.04fr .96fr; gap: 70px; align-items: center; }
.hero-copy h1 { font-size: clamp(3.4rem, 7vw, 6.8rem); line-height: .91; letter-spacing: -.065em; margin: 18px 0 28px; }
.hero-copy p { max-width: 680px; color: #c7cfdd; font-size: 1.18rem; line-height: 1.7; }
.kicker { display: inline-flex; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.08); padding: 8px 12px; border-radius: 999px; font-size: .82rem; font-weight: 800; letter-spacing: .08em; }
.hero-buttons { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
.hero-panel { border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.08); backdrop-filter: blur(22px); border-radius: 26px; padding: 18px; box-shadow: 0 40px 100px rgba(0,0,0,.28); }
.browser { border-radius: 18px; overflow: hidden; background: white; color: #111827; }
.browser-bar { height: 42px; background: #f3f4f6; display: flex; align-items: center; gap: 7px; padding: 0 14px; border-bottom: 1px solid #e5e7eb; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: #d0d5dd; }
.browser-body { min-height: 390px; display: grid; grid-template-columns: 88px 1fr 105px; }
.browser-side { background: #111827; color: white; padding: 14px 9px; font-size: .72rem; }
.browser-canvas { padding: 32px 24px; background: linear-gradient(135deg,#fff7ed,#eff6ff); }
.browser-canvas h3 { font-size: 2.2rem; letter-spacing: -.05em; margin: 15px 0 10px; }
.browser-canvas p { font-size: .9rem; color: #667085; }
.browser-controls { border-left: 1px solid #e5e7eb; padding: 14px 10px; font-size: .72rem; }
.control-line { height: 9px; background: #e5e7eb; border-radius: 8px; margin: 9px 0; }

.auth-page { min-height: 100vh; display: grid; place-items: center; padding: 28px; background: radial-gradient(circle at top, #eef2ff, #f8fafc 45%); }
.auth-card { width: min(100%, 440px); background: white; border: 1px solid var(--line); border-radius: 22px; padding: 30px; box-shadow: var(--shadow); }
.auth-card h1 { margin: 20px 0 8px; font-size: 2rem; letter-spacing: -.04em; }
.auth-card p { color: var(--muted); line-height: 1.6; }
.form-stack { display: grid; gap: 16px; margin-top: 24px; }
.field { display: grid; gap: 7px; }
.field label { font-size: .9rem; font-weight: 750; }
.input, .textarea { width: 100%; border: 1px solid #d0d5dd; background: white; border-radius: 11px; padding: 11px 12px; outline: none; }
.input:focus, .textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 4px rgba(91,92,240,.11); }
.textarea { min-height: 130px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .86rem; }
.message-error { color: var(--danger); background: #fff4f2; border: 1px solid #fecdca; padding: 10px 12px; border-radius: 10px; font-size: .9rem; }
.message-success { color: var(--success); background: #ecfdf3; border: 1px solid #abefc6; padding: 10px 12px; border-radius: 10px; font-size: .9rem; }
.auth-footer { text-align: center; margin-top: 18px; color: var(--muted); }

.page { max-width: 1180px; margin: auto; padding: 42px 28px 80px; }
.page-heading { display: flex; justify-content: space-between; gap: 22px; align-items: end; margin-bottom: 28px; }
.page-heading h1 { margin: 0; font-size: 2.4rem; letter-spacing: -.045em; }
.page-heading p { color: var(--muted); margin: 8px 0 0; }
.site-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 20px; }
.site-card { border: 1px solid var(--line); background: white; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 26px rgba(17,24,39,.05); transition: .18s ease; }
.site-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.site-preview { height: 180px; padding: 22px; background: linear-gradient(135deg,#eef2ff,#fff7ed); display: flex; align-items: end; }
.site-preview-inner { width: 100%; height: 110px; background: white; border-radius: 10px; padding: 16px; box-shadow: 0 10px 28px rgba(17,24,39,.11); overflow: hidden; }
.mini-line { height: 8px; border-radius: 10px; background: #d0d5dd; margin: 8px 0; }
.mini-line.bold { width: 72%; height: 16px; background: #111827; }
.site-card-body { padding: 18px; }
.site-title-row { display: flex; justify-content: space-between; gap: 10px; }
.site-title { font-size: 1.08rem; font-weight: 820; margin: 0; }
.site-meta { color: var(--muted); font-size: .85rem; margin: 6px 0 16px; }
.site-actions { display: flex; gap: 8px; }
.empty-state { border: 1px dashed #c7cdd7; border-radius: 20px; padding: 70px 24px; background: rgba(255,255,255,.55); text-align: center; grid-column: 1/-1; }
.empty-state h2 { margin: 12px 0 8px; }
.empty-state p { color: var(--muted); }

.modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.62); display: grid; place-items: center; padding: 24px; z-index: 100; }
.modal { width: min(100%, 740px); max-height: 90vh; overflow: auto; background: white; border-radius: 20px; box-shadow: 0 28px 90px rgba(0,0,0,.32); }
.modal.large { width: min(100%, 1120px); }
.modal-header { padding: 20px 22px; display: flex; justify-content: space-between; gap: 18px; align-items: center; border-bottom: 1px solid var(--line); }
.modal-header h2 { margin: 0; font-size: 1.2rem; }
.modal-body { padding: 22px; }
.modal-footer { padding: 16px 22px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--line); }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab { border: 1px solid var(--line); padding: 8px 12px; border-radius: 9px; background: white; }
.tab.active { background: #eef2ff; color: var(--brand-dark); border-color: #c7d2fe; }

.editor-shell { height: 100vh; display: grid; grid-template-rows: 64px 1fr; overflow: hidden; background: #111827; }
.editor-bar { background: #111827; color: white; display: flex; align-items: center; gap: 12px; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid rgba(255,255,255,.11); }
.editor-left, .editor-right { display: flex; align-items: center; gap: 8px; min-width: 0; }
.editor-name { border: 1px solid transparent; background: transparent; color: white; font-weight: 750; padding: 8px 10px; border-radius: 8px; min-width: 180px; }
.editor-name:focus { border-color: rgba(255,255,255,.25); background: rgba(255,255,255,.08); outline: none; }
.save-status { font-size: .78rem; color: #aeb7c6; white-space: nowrap; }
.editor-main { min-height: 0; background: #f1f5f9; }
#gjs { height: 100%; }

/* GrapesJS visual customization */
.gjs-one-bg { background-color: #171b26 !important; }
.gjs-two-color { color: #eef2f7 !important; }
.gjs-three-bg { background-color: #5b5cf0 !important; color: white !important; }
.gjs-four-color, .gjs-four-color-h:hover { color: #8b8cf8 !important; }
.gjs-pn-panel { box-shadow: none !important; }
.gjs-cv-canvas { width: calc(100% - 290px) !important; }
.gjs-pn-views-container { width: 290px !important; }
.gjs-pn-views { width: 290px !important; }
.gjs-block { width: calc(50% - 10px) !important; min-height: 76px !important; border-radius: 8px !important; }

.preview-frame { width: 100%; height: 70vh; border: 0; background: white; border-radius: 12px; }
.preview-note { margin: 0 0 12px; color: var(--muted); font-size: .88rem; }
.checkbox-row { display: flex; gap: 10px; align-items: center; margin: 12px 0; color: var(--muted); font-size: .9rem; }
.code-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.code-grid .full { grid-column: 1/-1; }

.loading-screen { min-height: 100vh; display: grid; place-items: center; color: var(--muted); }
.spinner { width: 34px; height: 34px; border: 3px solid #dbe1ea; border-top-color: var(--brand); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 920px) {
  .hero-wrap { grid-template-columns: 1fr; }
  .hero-panel { max-width: 680px; }
  .site-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .editor-right .hide-mobile { display: none; }
}
@media (max-width: 640px) {
  .topbar { padding: 0 16px; }
  .page { padding: 28px 16px 60px; }
  .page-heading { align-items: stretch; flex-direction: column; }
  .site-grid { grid-template-columns: 1fr; }
  .hero-wrap { padding-top: 50px; }
  .browser-body { grid-template-columns: 62px 1fr; }
  .browser-controls { display: none; }
  .code-grid { grid-template-columns: 1fr; }
  .code-grid .full { grid-column: auto; }
  .editor-bar { padding: 0 8px; }
  .editor-name { min-width: 100px; width: 130px; }
}

.floating-error { position: fixed; right: 18px; bottom: 18px; z-index: 150; max-width: 460px; cursor: pointer; }
.tall { min-height: 330px; }
.publish-modal { max-width: 620px; }
.domain-field { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; }
.domain-field span { color: var(--muted); font-weight: 700; }
.site-actions { flex-wrap: wrap; }
.gjs-frame { background: white !important; }
