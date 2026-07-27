# CanvasForge Publisher

A multi-account website builder that imports HTML/CSS/JS, visually edits it, uploads local images, publishes each site to a CanvasForge subdomain, and sends website forms to the owner's chosen email address.

## Important: replace the old repository files

Upload this project with its folders intact. The root of GitHub must show folders such as `app`, `components`, `lib`, and `supabase`. Do not upload files one at a time or GitHub may flatten duplicate `page.tsx` files.

## What changed

- Fixes the editor blank/loading bug by waiting for the editor container to exist before starting GrapesJS.
- Adds **Import ZIP**. Upload a normal static website ZIP containing `index.html`, CSS, JavaScript, and image folders. Images are uploaded to Supabase Storage and local image paths are rewritten automatically.
- Adds public publishing at `https://SITE.canvasforge.com`.
- Adds publish/unpublish controls and globally unique subdomain slugs.
- Adds a form recipient email setting per website.
- Any normal HTML `<form>` on a published site is submitted to CanvasForge and delivered through Resend.
- Keeps unpublished website code private through Supabase Row Level Security.

## 1. Update Supabase

For an existing CanvasForge database:

1. Open Supabase.
2. Open **SQL Editor**.
3. Create a new query.
4. Paste the full contents of `supabase/upgrade-publishing.sql`.
5. Click **Run** once.

For a completely new Supabase project, run `supabase/schema.sql` instead.

Then open **Project Settings → API Keys** and copy:

- Project URL
- Publishable/anon key
- `service_role` key

The service-role key is secret. It belongs only in Vercel Environment Variables and must never be placed in GitHub or in a variable beginning with `NEXT_PUBLIC_`.

## 2. Configure form email delivery with Resend

1. Create a Resend account.
2. Add and verify `canvasforge.com` in Resend.
3. Create a Resend API key.
4. Choose a sender address such as `forms@canvasforge.com`.

The application sends each website form to the email selected in that website's Publish settings. A form should contain named fields, for example:

```html
<form>
  <input name="name" required>
  <input name="email" type="email" required>
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
  <p data-canvasforge-status></p>
</form>
```

The included contact-form block already has spam-honeypot and status fields.

## 3. Replace the GitHub project

Recommended safe approach:

1. Extract this ZIP on your computer.
2. Open the extracted `canvasforge-publisher` folder.
3. Use GitHub Desktop to publish it as a new repository, or replace the contents of the existing repository while preserving all folders.
4. Commit and push to the `main` branch.

## 4. Set Vercel environment variables

In **Vercel → CanvasForge project → Settings → Environment Variables**, add these to Production, Preview, and Development:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_ROOT_DOMAIN=canvasforge.com
SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_SERVICE_ROLE_KEY
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=CanvasForge Forms <forms@canvasforge.com>
```

Redeploy after adding or changing variables.

## 5. Configure `canvasforge.com` and wildcard subdomains in Vercel

In the Vercel project:

1. Open **Settings → Domains**.
2. Add `canvasforge.com`.
3. Add `www.canvasforge.com` if desired.
4. Add `*.canvasforge.com` as a wildcard domain.
5. Follow Vercel's nameserver instructions at your domain registrar.

Vercel requires its nameserver method for wildcard domains so it can issue wildcard SSL certificates. After DNS propagation, a published slug such as `demo` will resolve automatically at `https://demo.canvasforge.com`.

Reserve dashboard subdomains such as `www`, `app`, and `admin`; the editor currently blocks `www` in routing, and you should avoid assigning those slugs to customer sites.

## 6. Configure Supabase authentication URLs

In **Supabase → Authentication → URL Configuration**:

- Site URL: your main CanvasForge Vercel URL or `https://canvasforge.com`
- Redirect URL: add the same URL, and your Vercel preview URL if needed

Do not use wildcard customer subdomains as authentication callback URLs. Customer websites do not need CanvasForge login access.

## 7. Test in this order

1. Register and sign in.
2. Create a website.
3. Confirm the visual editor is visible immediately.
4. Double-click text and edit it.
5. Import a static-site ZIP with `index.html` and image folders.
6. Confirm images display in the editor and preview.
7. Open **Publish**.
8. Choose a subdomain and form-recipient email.
9. Click **Save and publish**.
10. Open `https://your-slug.canvasforge.com`.
11. Submit a form and verify the recipient gets the email.

## Import limitations

Import ZIP is intended for plain static sites. It handles HTML, CSS, JavaScript, and common image files. Projects that require React/Vite/Webpack compilation must first be exported or built into static browser files. Server-side PHP, WordPress themes, databases, and Node backends cannot be pasted into the visual editor as static HTML.

## Security notes

- Supabase RLS restricts draft ownership to the authenticated account.
- The Supabase service-role key is used only in server routes.
- Published website JavaScript executes on the customer website origin, not in the CanvasForge dashboard.
- The form endpoint validates content type, limits field count and length, uses a honeypot, and does not expose the recipient email publicly.
- Before charging customers, add CAPTCHA/Turnstile, durable rate limiting, malware scanning, audit logs, backups, dependency monitoring, and a professional penetration test.
 
