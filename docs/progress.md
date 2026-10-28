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
  Checked on production: Google sign-in → /library, and sign-out. Not yet checked: a real
  magic-link sign-in (same callback as Google).
- Google OAuth client (Google Cloud) is in Testing mode: only listed test users can sign in with
  Google. Publishing needs a home page, /privacy and /terms (not built). Supabase's built-in email
  sender is rate-limited; add custom SMTP before inviting collaborators.

### Session 3 · Upload pipeline (2026-10-28)
- Private `screens` bucket (10 MB, PNG/JPG/WebP) with owner-only policies on `<uid>/…` folders;
  the RLS test also checks B can't list or upload into A's folder.
- /library/upload: pick or create an app (name + platform), optional flow (existing or new), drag
  and drop or pick files, per-file progress, Retry resumes at the failed step, Remove.
- Decisions: the browser uploads originals straight to Storage by XHR (progress events; Vercel caps
  request bodies at 4.5 MB). The `processScreen` server action then reads the original back,
  gets size with sharp (EXIF-rotated), writes `<id>.thumb.webp` (480px wide) and inserts the row
  with the browser-made id, so retries are idempotent. Native selects instead of shadcn Select.
- Checked: build, RLS test, sharp processing in a script (PNG/JPG/WebP, rotation, no enlarging,
  fake image rejected), signed-out redirect, one real upload on production (row, original, thumbnail).
  Not yet checked: 10 images in one go. /library shows an Upload button and a note until Session 4.

### Session 4 · Library grid (2026-10-28)
- /library: masonry of thumbnails (signed URLs from the private bucket, 1 h), boxes sized from the
  stored width/height, lazy images, infinite scroll (40 per page, server action, sentinel 1200px
  ahead), skeletons (route loading.tsx and while fetching), empty state with Upload. Cards link to
  /library/screens/[id] (viewer is Session 7) and show the app name on hover/focus.
- Decisions: shortest-column placement computed for 2, 3 and 4 columns, with CSS picking one by
  breakpoint, so appending a page never moves cards and there's no JS measuring. Cursor is
  captured_at|id, so screens with the same timestamp aren't skipped (checked against PostgREST).
- Checked: build, lint, typecheck, cursor filter. Not yet checked: 200 seeded screens scrolling, and
  how the grid looks with real screens (needs a signed-in browser).

### Session 5 · Tagging UI (2026-10-28)
- TagPicker (src/components/tag-picker.tsx): shadcn Command in a Popover, grouped by facet, filters
  on label and synonyms, tri-state checks for bulk edits, "Create “x” in <facet>" when nothing matches.
  Used on the upload form (tags applied to every file, saved by processScreen) and in a Select mode on
  the grid (click/Space toggles, Shift-click selects a range, Select all, sticky toolbar with chips).
- Bulk add/remove is optimistic; on error only that tag is rolled back, with an inline reason.
- Migration 0700: tags.created_by; signed-in users may insert tags (in their own name, no synonyms)
  but not edit or delete them. New tags are shared with everyone. RLS test covers this.
- Checked: build, lint, typecheck, RLS test. Not yet checked: tagging 20 screens by mouse and
  keyboard in a signed-in browser.

### Session 6 · Search and filters (2026-10-28)
- RPC `search_screens` (security invoker, migration 0800): tag filters AND across facets and OR within
  a facet, websearch on search_vector plus trigram word_similarity ≥ 0.5 on app names and tag labels
  for typos, `(captured_at, id)` cursor, tag ids per screen, all in one round trip.
  `screen_tag_counts` feeds the sidebar counts.
- Decision: a platform tag also matches the app's platform, so iOS works without tagging every screen.
- /library: search box, facet sidebar with counts (a sheet below md; zero-count tags hidden), removable
  filter chips, Clear all, a "No screens match" state. The URL holds it all: ?platform=ios&industry=fintech&q=…
- Checked: `supabase/tests/search_perf.sql` on 1,000 seeded screens (rolled back): iOS+fintech+paywall
  matches an independent query, OR within a facet, cursor with ties, typos; slowest query 17.7 ms.
  RLS test still passes. Not yet checked in a signed-in browser. Counts refresh only on reload after tagging.

### Session 7 · Screen viewer and flows (2026-10-28)
- /library/screens/[id]: an intercepting-route modal (`@modal/(.)screens/[id]`) over the grid, a full page on
  direct visits. It has the original image (signed URL), app and platform, editable tags (TagPicker,
  optimistic), notes saved on blur, flows with add and remove. ←/→ walk the grid's current result set
  (an in-memory sequence the grid publishes), or library order on a direct visit; Esc closes; focus
  goes back to the card (`data-screen-id`). The dialog is titled and described for screen readers;
  alt text is app name plus screen types.
- /library/flows lists flows. /library/flows/[id] is a horizontal strip with drag to reorder, plus
  Move earlier and Move later buttons for the keyboard, remove, and add from the app's screens.
  Saves are optimistic (`setFlowScreens`). Opening a step walks the flow's order.
- Checked: build, lint, typecheck. Not yet checked in a signed-in browser (modal behaviour, focus return).

### Session 8 · Directory and site thumbnails (2026-10-28)
- `/` rebuilt from the database, matching the prototype: Showcase tab (search, medium, gallery filter
  with counts, featured-on credits, galleries interleaved, Show more) and a "Search the galleries" tab
  (one search box, suggestions, medium, "Only sites that take a search term", deep links from
  url_template with {q} encoded and {slug} hyphenated, query sites ranked first, "Unconfirmed link").
  View and term are kept in the URL (?view=galleries&q=…). Tabs follow the WAI-ARIA pattern.
- Showcase: migrations 0900/1000 add `showcase_items` and `showcase_features` (public read) and seed 414
  items and 421 credits from docs/showcase.json via `scripts/showcase-sql.mjs`.
- `scripts/capture-sources.ts` (Playwright, 1440×900, saved as 960px WebP) writes to `public/sources/`,
  not Storage, because writing to Storage would need the secret key. It prints SQL; migration 1100
  records 18 thumbnails. Codrops and Land-book served bot checks and Behance rendered blank, so they
  have no thumbnail; the script now skips such pages.
- `scripts/refresh-showcase.ts` prints add-only SQL for review. Dry run: Godly, CSS Design Awards and
  Awwwards readable; Land-book (403), SiteInspire (429) and sometimes Httpster block it. Not applied yet.
- Checked in the browser: both tabs, the deep links for "onboarding" (8 search / 6 tag / 7 browse),
  thumbnails, no console errors. Build, lint and typecheck pass.

## Later
_(ideas and out-of-scope items noted during sessions)_
- Upload: bulk tagging at upload, HEIC, paste from clipboard, removing originals whose processing
  failed for good.

