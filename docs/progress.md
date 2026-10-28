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
- shadcn components added from shadcn's GitHub source (new-york-v4): button, input, dialog,
  dropdown-menu, sheet, sonner, command, toggle-group, toggle, badge, skeleton. Deps: radix-ui,
  cmdk, sonner. ThemeToggle now uses Button (44px target). Add more later with
  `pnpm dlx shadcn@latest add <name>` on a machine with normal network access.
- Deployed: https://ref-index.vercel.app (Vercel Hobby, functions in sin1 via vercel.json;
  every push to main deploys). Supabase project ref `kolzsxfgqodulzteocnd` (Singapore).
  Auth Site URL = production URL; redirect allow list = production/** and localhost:3000/**.
- Vercel env vars set (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  Config type, all environments) and production redeployed. Nothing reads them until
  Session 2, which is the first real check that they're correct.
- Commits must use the GitHub-linked email (96169814+hystericmoon@users.noreply.github.com)
  or Vercel blocks the deploy.

### Session 1 · Database schema and seed (2026-10-28)
- 5 migrations pushed to the hosted project: tables + FKs + indexes (pg_trgm on tag labels and
  app names), `screens.search_vector` kept current by triggers (app name A, tag labels B,
  synonyms C, notes D; config `english`), RLS, taxonomy seed (5 facets, 49 tags with synonyms),
  21 sources from docs/sources.json. Advisors: no issues.
- Decisions: `apps` has an `owner_id` (apps are private like screens). Reference data is seeded
  in migrations, not seed.sql. Facets/tags/sources are read-only via the API. Trigger functions
  live in a `private` schema the Data API doesn't expose.
- RLS test `supabase/tests/rls_screens.sql` (one transaction, rolled back) passes: B can't read,
  edit, delete or tag A's rows; anon can't query screens. Run with
  `.\node_modules\.bin\supabase db query --linked -f supabase/tests/rls_screens.sql`.
- Types in src/lib/db/types.ts (`supabase gen types typescript --linked --schema public`), typed
  helpers per table in src/lib/db, Supabase clients typed with `Database`.
- `listScreens({ tagIds })` matches any tag (two queries); Session 6 should replace it with an RPC
  for all-tags filtering plus search.
- Follow-ups: the Supabase project is in Tokyo (ap-northeast-1), not Singapore as Session 0 noted,
  so Vercel functions moved from sin1 to hnd1. The build allowlist moved from package.json's
  `pnpm` field (ignored by pnpm 11+) to pnpm-workspace.yaml (`allowBuilds`, plus
  `onlyBuiltDependencies` for Vercel's pnpm 10). `pnpm <script>` fails pnpm's release-age check on
  lucide-react 1.62.0 until about 2026-10-28 06:10 UTC; until then run bins from node_modules/.bin.

### Session 2 · Auth (2026-10-28)
- Email magic link + Google via Supabase Auth (PKCE): /sign-in (server actions, inline errors),
  /auth/callback exchanges the code, `next` is limited to same-site paths. `src/proxy.ts` refreshes
  the session and sends signed-out visitors on /library/* to /sign-in?next=…
- Site header in the root layout: theme toggle + account menu (email, Library, Sign out) or a
  Sign in link. /library shows an empty state with an Upload CTA (/library/upload is Session 3).
  Fixed a Session 0 hydration mismatch: the theme toggle's label no longer depends on the theme.
- Checked locally: redirects, email validation, bad-link error, open-redirect guard, Google hand-off.
  Not yet checked: a real magic-link sign-in → /library, and sign-out (needs someone to click the email).
- Open: Google returns "provider is not enabled" until a Google Cloud OAuth client is created
  (redirect URI https://kolzsxfgqodulzteocnd.supabase.co/auth/v1/callback) and the client ID/secret
  are added in Supabase → Auth → Providers → Google. Supabase's built-in email sender is
  rate-limited; add custom SMTP before inviting collaborators.

## Later
_(ideas and out-of-scope items noted during sessions)_

