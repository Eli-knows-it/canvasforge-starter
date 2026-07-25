# Security architecture

CanvasForge is a multi-tenant application. Drafts and account data are protected by Supabase Row Level Security. Public sites are retrieved only by a Vercel server route using the secret service-role key; the browser does not receive that key or direct anonymous table access.

## Trust boundaries

- Dashboard/editor origin: trusted application code.
- Published customer subdomains: untrusted user-supplied HTML/CSS/JavaScript.
- Supabase Storage: public image delivery, owner-restricted writes.
- Form API: server-only database and email credentials.

Never scope authentication cookies to `.canvasforge.com`. Keep CanvasForge authentication in origin-local browser storage or host the dashboard on a separate root domain for stronger isolation. A future commercial version should consider publishing customer sites on a separate domain such as `canvasforge.site` to reduce same-site and brand-domain risk.

## Production additions

Add Cloudflare Turnstile or equivalent CAPTCHA, Upstash/Vercel KV rate limiting, abuse reporting, upload malware scanning, content moderation, domain/slug reservation, audit logs, MFA, CSP strategy, automated backups, dependency scanning, and external penetration testing.
