import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link href="/" className="logo">
          <span className="logo-mark">C</span>
          CanvasForge
        </Link>
        <div className="nav-actions">
          <Link className="button-ghost" href="/login">Sign in</Link>
          <Link className="button-primary" href="/register">Create account</Link>
        </div>
      </nav>
      <section className="hero-wrap">
        <div className="hero-copy">
          <span className="kicker">VISUAL WEBSITE BUILDER</span>
          <h1>Paste the code. Edit the website.</h1>
          <p>
            Import AI-generated HTML, CSS, and JavaScript, then edit text, colors,
            spacing, and images visually. Every account gets its own secure website dashboard.
          </p>
          <div className="hero-buttons">
            <Link className="button-primary" href="/register">Start building</Link>
            <Link className="button-secondary" href="/login">Open dashboard</Link>
          </div>
        </div>
        <div className="hero-panel" aria-hidden="true">
          <div className="browser">
            <div className="browser-bar"><span className="dot"/><span className="dot"/><span className="dot"/></div>
            <div className="browser-body">
              <aside className="browser-side">Blocks<br/><br/>Text<br/><br/>Image<br/><br/>Button</aside>
              <div className="browser-canvas">
                <small>YOUR NEW WEBSITE</small>
                <h3>Build without rebuilding.</h3>
                <p>Click, change, save, and export.</p>
                <span className="button-primary button-small">Get started</span>
              </div>
              <aside className="browser-controls">Styles<div className="control-line"/><div className="control-line"/><div className="control-line"/></aside>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
