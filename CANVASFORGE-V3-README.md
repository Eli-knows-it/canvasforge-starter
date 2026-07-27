# CanvasForge V3 update

This package was rebuilt from the exact GitHub repository ZIP supplied by the user.

## Main improvements

- Code and visual selection synchronization
  - Clicking an element on the right selects its HTML tag on the left.
  - Clicking/cursoring inside an HTML element on the left selects it on the right when it has a CanvasForge editor ID.
- Undo and redo history (up to 60 snapshots per page)
- Optional 20 px snap-to-grid mode
- Photo upload and selected-image replacement
- Rectangle, circle, and line creation
- Width, height, rotation, foreground color, background color, font size, font family, and animation controls
- Animation presets: fade, slide up, slide left, spin, pulse, and bounce
- Multiple pages saved in `project_data.pages`
- Page templates: blank, services, product/payment-link page, customer login layout, and blog layout
- Improved ZIP asset rewriting, including CSS `url(...)` paths resolved relative to each CSS file
- Original external stylesheet/font links remain in the imported HTML document
- JavaScript interactions enabled by default in the visual renderer; navigation and form submission remain intercepted in editing mode
- Full-height editor workspace; removes the large unused black area
- Published multipage route
- Corrected dashboard View live URLs
- Corrected JSON and normal HTML form email API route

## Important limitations

- The customer login template is a page layout, not a complete authentication backend.
- The product page links to an external checkout URL. A full product/order system needs Stripe or another commerce backend.
- Freeform grid mode is optional because converting a code-authored responsive design to absolute positioning can change that design.
- “All online fonts” are supported through the custom stylesheet URL + font-family fields. No application can safely preload every font hosted across the internet.

## Install

Replace the contents of the GitHub repository with this package while preserving folders, or copy the edited files listed below.

Edited files:

- `components/editor-client.tsx`
- `components/dashboard-client.tsx`
- `app/globals.css`
- `app/api/forms/[slug]/route.ts`
- `app/published/[slug]/[[...path]]/route.ts`

Delete the old route if it remains:

- `app/published/[slug]/route.ts`

## Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_PUBLIC_BASE_URL=https://canvasforge-starter.vercel.app/published`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

`RESEND_FROM_EMAIL` must be an authorized sender in Resend.

## Database

No new columns are required beyond the current `sites.project_data` JSONB column. Page data is stored there.
