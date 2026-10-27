# Progress log

Newest entry at the bottom. Each session adds 3–5 lines: what shipped, decisions
made, open issues. Keep entries short; this file is read at the start of every session.

## Decisions so far
- Stack: Next.js + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres, Auth, Storage), Vercel.
- Storage starts in Supabase Storage; move images to Cloudflare R2 if download costs grow.
- The directory links out only. The 21 sites' homepages are the only images captured from them.
- Prototype of the directory: single-page artifact "Ref Index" (October 2026).

## Log
### Session 0 · Scaffold (2026-10-27)
- Next.js 16.4 (App Router, Turbopack) + React 19 + TS strict, Tailwind 4, ESLint flat config,
  `typecheck` script. Fonts: Bricolage Grotesque (display), IBM Plex Sans/Mono via next/font.
- shadcn configured by hand (components.json, tokens in globals.css carrying the prototype's
  green palette, `cn` util); next-themes light/dark/system with a toggle.
- Supabase helpers in src/lib/supabase (browser + server, publishable key). Supabase CLI is a
  dev dependency; hosted project only. Session-refresh proxy deferred to Session 2.
- **Open:** shadcn components not added yet (registry unreachable from the build sandbox).
  First thing next session, run:
  `pnpm dlx shadcn@latest add button input dialog dropdown-menu sheet sonner command toggle-group badge skeleton`
  (sonner replaces the deprecated toast). Then swap ThemeToggle to the shadcn Button.

## Later
_(ideas and out-of-scope items noted during sessions)_
