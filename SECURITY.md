# Security model

CanvasForge is an MVP starter, not a claim of invulnerability. Production security requires continuous patching, monitoring, testing, backups, and incident response.

## Controls included

- Supabase Auth handles passwords and sessions.
- PostgreSQL Row Level Security isolates each user's website records.
- The Supabase service-role key is never used in browser code.
- Uploaded images are restricted by type, size, bucket, and user-owned folder.
- User JavaScript is not executed inside the editor.
- Optional JavaScript preview runs inside a sandboxed iframe without `allow-same-origin`.
- The preview document has its own restrictive Content Security Policy.
- Common browser security headers are configured in `next.config.mjs`.
- Export filenames and page titles receive basic output normalization.

## Before a public commercial launch

1. Put published customer sites on a completely separate origin from the account dashboard, such as `*.sites.example.com`. Never serve arbitrary customer JavaScript on the dashboard's origin.
2. Add MFA, bot protection, email verification, breached-password protection, account recovery controls, and rate limits.
3. Add audit logs for login, site changes, exports, sharing, domains, and publication.
4. Add an allowlist-based publishing pipeline that scans HTML, CSS, URLs, and JavaScript. Consider disabling arbitrary JavaScript for lower-trust plans.
5. Add malware scanning for uploads and do not allow SVG unless it is sanitized or served with safe download/content headers.
6. Add automated dependency updates, secret scanning, SAST, DAST, penetration testing, backups, restore drills, and security monitoring.
7. Use a nonce-based Content Security Policy for the dashboard when deploying at scale.
8. Review the application against OWASP ASVS 5.0 and the current OWASP AI security guidance before adding AI execution or agents.
