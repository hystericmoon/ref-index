# Ref Index

A private, taggable library of UI screenshots (Mobbin-style) plus a public directory
of 21 design reference sites. Full product context: `docs/brief.md` (read only when a
task needs product decisions). Session plan and status: `docs/sessions.md`.

## Stack
- Next.js (App Router) + TypeScript, strict mode
- Tailwind CSS + shadcn/ui (components live in `src/components/ui`, edit freely)
- Supabase (hosted, Singapore; no local DB): Postgres, Auth, Storage (bucket `screens`),
  row-level security on every table. Keys: publishable key in the browser, secret key
  only in server code and `.env.local`, never committed
- sharp for thumbnails, generated on upload (WebP, 480px wide) next to the original
- Search: Postgres full-text + pg_trgm. No external search service yet
- Hosting: Vercel

## Layout
- `src/app` routes · `src/components` UI · `src/lib` data access and helpers
- `supabase/migrations` SQL migrations (never edit an applied migration; add a new one)
- `supabase/seed.sql` example data, clearly marked as sample
- `docs/` brief, sessions, progress log

## Data model (summary)
apps, screens, flows, flow_screens (ordered), facets, tags (belongs to a facet),
screen_tags, sources. Facets: screen_type, ui_element, pattern, platform, industry.
Details in `docs/brief.md`.

## Conventions
- Server Components by default; `"use client"` only for interactive pieces
- Data access through `src/lib/db/*`, never raw Supabase calls inside components
- Filter and search state lives in the URL (searchParams), so views are shareable
- Accessibility is part of done: keyboard reachable, visible focus, labelled controls,
  WCAG AA contrast, 44px touch targets on mobile
- Copy: plain, active voice, name things the way users do

## Commands
- `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` (Windows, PowerShell)
- `pnpm supabase db push` applies new migrations to the hosted project

## Working rules (to keep sessions small)
- Stay inside the current session's scope in `docs/sessions.md`. Note anything else
  under "Later" in `docs/progress.md` instead of doing it.
- Read only the files the task needs. Don't scan the whole repo.
- Before finishing: run lint, typecheck and build, commit, and append a 3–5 line entry
  to `docs/progress.md` (what shipped, decisions, open issues).
