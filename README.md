# CanvasForge Starter

CanvasForge is a working MVP for a multi-account visual website builder. Users can create accounts, manage their own websites, import AI-generated HTML/CSS/JavaScript, visually edit content, upload images, autosave changes, preview safely, and export a ZIP containing deployable code.

## Included features

- Email/password user accounts
- User-owned website dashboard
- PostgreSQL Row Level Security
- Visual drag-and-drop editor powered by GrapesJS
- Click-to-edit text and style controls for color, spacing, typography, and layout
- HTML/CSS/JavaScript import
- Full HTML document parsing
- Image uploads to Supabase Storage
- Autosave and manual save
- Desktop, tablet, and mobile editing support
- Sandboxed preview with custom JavaScript disabled by default
- Export to `index.html`, `styles.css`, and `script.js`

## Stack

- Next.js 16 and React 19
- TypeScript
- Supabase Auth, Postgres, Row Level Security, and Storage
- GrapesJS
- JSZip

## Local setup

### 1. Create a Supabase project

Create a project, open the SQL Editor, and run:

`supabase/schema.sql`

In **Authentication → URL Configuration**, add your local URL:

`http://localhost:3000`

For initial testing, you may disable email confirmation. For production, keep email verification enabled.

### 2. Add environment variables

Copy `.env.example` to `.env.local` and add the public project URL and public anonymous key from Supabase:

```bash
cp .env.example .env.local
```

Never put the Supabase service-role key in a `NEXT_PUBLIC_` variable or browser code.

### 3. Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploying at low or no initial cost

The simplest deployment is:

- **Application:** Vercel Hobby plan
- **Database, authentication, images:** Supabase Free plan
- **Exported customer websites:** Any static host that accepts HTML/CSS/JS, including Cloudflare Pages or similar services

Push this folder to a private GitHub repository, import it into Vercel, add both environment variables, and deploy. Run the SQL schema only once in Supabase.

Next.js can also run on a Node.js server or Docker host. Cloudflare deployment may require its current Next.js adapter or Workers deployment process.

## Important publishing boundary

This starter exports customer websites as ZIP files. It intentionally does **not** publish arbitrary customer JavaScript on the CanvasForge dashboard's own domain.

A secure hosted publishing system should deploy each website to a separate origin or isolated subdomain. That is the next major feature to build. Serving untrusted website JavaScript on the account application's origin could expose sessions, customer data, or administrative actions.

## Good next development phases

1. Custom subdomains and domains on a separate publishing origin
2. Team members and roles: owner, administrator, editor, viewer
3. Website versions, restore points, and audit history
4. Reusable templates, global colors, fonts, headers, and footers
5. Forms, submissions, email notifications, and spam protection
6. Billing and subscription limits
7. AI generation directly inside the editor
8. Accessibility, performance, SEO, and security scans before publishing

## Production notes

Read `SECURITY.md`. No website can be guaranteed to “prevent hacking.” The proper goal is defense in depth, minimized permissions, isolation, patching, monitoring, testing, and rapid recovery.
