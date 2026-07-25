export const defaultHtml = `
<header class="hero">
  <nav class="nav">
    <div class="brand">Your Brand</div>
    <a class="nav-link" href="#contact">Contact</a>
  </nav>
  <div class="hero-content">
    <p class="eyebrow">BUILD SOMETHING GREAT</p>
    <h1>Turn your idea into a website.</h1>
    <p class="lead">Click any text to edit it. Select elements to change colors, spacing, images, and more.</p>
    <a class="button" href="#contact">Get Started</a>
  </div>
</header>
<section class="section">
  <div class="content-grid">
    <div>
      <p class="eyebrow">WHAT YOU DO</p>
      <h2>Explain your value clearly.</h2>
    </div>
    <p>Replace this text with a compelling description of your services, classes, products, or organization.</p>
  </div>
</section>
<section class="section alt" id="contact">
  <div class="card">
    <p class="eyebrow">LET'S CONNECT</p>
    <h2>Ready to take the next step?</h2>
    <p>Add your contact details or connect this button to your preferred form service.</p>
    <a class="button dark" href="mailto:hello@example.com">Email Us</a>
  </div>
</section>`;

export const defaultCss = `
:root {
  --ink: #101114;
  --paper: #f6f3ed;
  --accent: #ff5a36;
  --muted: #6b6f76;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, Arial, sans-serif; color: var(--ink); background: var(--paper); }
a { color: inherit; }
.hero { min-height: 72vh; padding: 28px clamp(24px, 6vw, 92px) 72px; background: linear-gradient(135deg, #111318, #2a2f39); color: white; }
.nav { display: flex; justify-content: space-between; align-items: center; }
.brand { font-weight: 800; letter-spacing: -0.03em; font-size: 1.25rem; }
.nav-link { text-decoration: none; opacity: .82; }
.hero-content { max-width: 900px; margin-top: 14vh; }
.eyebrow { font-size: .78rem; font-weight: 800; letter-spacing: .16em; color: var(--accent); }
h1 { font-size: clamp(3rem, 8vw, 7rem); line-height: .92; letter-spacing: -.055em; margin: 18px 0 24px; }
h2 { font-size: clamp(2rem, 4vw, 4rem); line-height: 1; letter-spacing: -.04em; margin: 12px 0 20px; }
.lead { max-width: 720px; font-size: clamp(1.1rem, 2vw, 1.45rem); line-height: 1.6; color: #d6d9df; }
.button { display: inline-block; margin-top: 22px; padding: 15px 22px; background: var(--accent); color: white; text-decoration: none; border-radius: 999px; font-weight: 800; }
.button.dark { background: var(--ink); }
.section { padding: 92px clamp(24px, 6vw, 92px); }
.section.alt { background: #ebe6dc; }
.content-grid { max-width: 1120px; margin: auto; display: grid; grid-template-columns: 1.1fr .9fr; gap: 64px; align-items: end; }
.content-grid > p { font-size: 1.2rem; line-height: 1.8; color: var(--muted); }
.card { max-width: 920px; margin: auto; padding: clamp(28px, 6vw, 72px); background: white; border-radius: 28px; box-shadow: 0 18px 60px rgba(16,17,20,.08); }
.card p { line-height: 1.7; color: var(--muted); }
@media (max-width: 760px) {
  .content-grid { grid-template-columns: 1fr; gap: 18px; }
  .hero { min-height: 80vh; }
}`;
