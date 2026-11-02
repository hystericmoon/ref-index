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

### Session 9 · Accessibility, performance, launch (2026-10-28)
- Contrast (WCAG 2.x, computed from the oklch tokens): every text/background pair is ≥ 4.9:1 in both
  themes (lowest: destructive on card, dark, 4.94). Focus-visible outline and reduced motion were
  already global; 44px targets are on all mobile controls.
- Alt text strategy: app name plus screen-type tags ("Revolut, paywall screen") for viewer images and
  as the grid cards' accessible names (`src/lib/screen-alt.ts`). Decorative thumbnails use alt="".
- Metadata: metadataBase, Open Graph and Twitter cards, theme colours, and a generated
  /opengraph-image (1200×630) for the directory.
- Lighthouse 12.8 (mobile, local production build), performance / accessibility / best practices / SEO:
  `/` 90/100/100/100 · `/?view=galleries&q=onboarding` 92/100/100/100 · `/sign-in` 93/100/100/100.
  /library and the viewer need a signed-in session, which Lighthouse can't get, so they weren't measured.
- Home LCP is 3.6 s simulated; the HTML carries all 414 showcase entries. If it slips under 90, paginate
  the showcase on the server.

### Showcase backfill (2026-10-29)
- `scripts/backfill-showcase.ts` read every page each gallery lists (robots.txt honoured, ≥1.5 s per
  site, back-off on 429/503/403) and added 20,374 items through `add_showcase_entries`: the showcase now
  has 20,934 items and 24,199 gallery credits. Progress and SQL chunks are in `tmp/backfill/`.
- `galleries.ts` gained `parseGallery`, live-site links (Godly, CSSDA, Awwwards, LaudableApps, Apple),
  Brutalist Websites and Apple Design Awards readers, a One Page Love "Inspiration only" filter and
  better name cleaning. The weekly refresh still reads page one only, with the same small limits.
- Not backfilled: Land-book (Cloudflare challenge), SiteInspire (429 on every listing page; the feed
  has no pages). Stopped early: CSS Design Awards at page 186 (CAPTCHA), One Page Love at the
  600-page cap (~6,000 of 9,000+), Apple Design Awards before 2020 (403).
- Fixed: showcase search, medium and gallery filters, and paging now run in the database
  (`search_showcase` and `showcase_gallery_counts`, migration 20261029000200, trigram indexes). The
  home page ships 60 entries; `/showcase.json?q=&medium=&gallery=&offset=` serves the rest (edge-cached
  10 min). Checked in the browser: 20,934 total, search, gallery filter, Show more, no errors.
- `showcase-refresh` Edge Function redeployed with JWT verification on. The weekly schedule still needs
  turning on in the dashboard (Integrations → Cron → Edge Function `showcase-refresh`, `0 3 * * 1`).
  The safety check here won't create a recurring job, nor deploy with JWT verification off.
- Known gap: `add_showcase_entries` matches by name when there's no URL, so a few unrelated sites with
  the same generic name may share an item.

## Later
_(ideas and out-of-scope items noted during sessions)_
- Upload: bulk tagging at upload, HEIC, paste from clipboard, removing originals whose processing
  failed for good.


### Showcase refresh: daily instead of weekly (2026-10-29)
- The refresh schedule is now daily at 03:00 UTC (`0 3 * * *`, job `showcase-refresh-daily`) and the
  showcase copy says "refreshed daily". The function's one-run-per-12-hours limit still applies.
- Still needs turning on in the dashboard (Integrations → Cron → Edge Function `showcase-refresh`).

### Showcase screenshots (2026-10-29)
- Each showcase item with a live address gets a 640×400 WebP of the site's first screen (1280×800
  in Chromium), stored in the public `showcase` bucket (`thumb_path`, `thumb_checked_at`). Cards show
  it; items without one show their name as a tile. Items with a screenshot are listed first.
- `scripts/capture-showcase.sh` captures in batches of 400 and publishes each batch; resumable.
  Bot checks, error pages, blank screens and parked or lapsed domains are skipped, not worked around.
  First batch: 222 of 400 captured (old Awwwards entries; many domains have lapsed).
- Later: the daily refresh can't capture (no browser in Edge Functions), so new items need a rerun
  of the script; cookie banners that aren't in the hide list still show in some screenshots.

### Rebrand to Openrefs, restyle, curation (2026-10-29)
- Working name **Openrefs** (`src/lib/brand.ts`; one place to rename). Goal: lots of good website
  references for designers, free, no paywall. `.com` names were all taken; `openrefs.design` looked free.
- Restyle after libraries.dev: neutral charcoal and paper greys, one electric-blue accent, Geist and
  Geist Mono, pill shapes, dark by default, dotted measurement frames behind the hero (wide screens only).
- Effects from libraries.dev's MIT packages: `border-beam` (search box while focused or loading, staff
  pick cards, hero tile), `thinking-orbs` (loading states), `liquid-gooey` (switches: the selection is a
  liquid drop that slides). Beam renders after hydration because the theme is only known in the browser.
- Curation (migration 0500): Top picks (staff picks plus sites featured by 2+ galleries, the default),
  Everything, Archive (screenshot failed: dead, parked or blocking). Editors (`public.editors`, seeded
  with the one account) review at `/curate`: Feature, Keep or Hide, keys F/K/H, Z to undo.
- 13 screenshots were the capturing network's ISP block page ("Situs diblokir"); cleared, and the capture
  now leaves such sites unchecked instead of saving the block page.
- Later: real award dates per gallery (every entry's first_seen is the import day); detail captures of
  each site (full page and sections); recapture network-blocked sites from another network.

## 2026-10-29 · Showcase categories
- 18 categories beside the medium switch: 6 kinds of site (portfolio, agency & studio, SaaS & product,
  e-commerce, editorial, events) and 12 fields (AI, finance, crypto, developer tools, health, food, fashion,
  architecture, travel, music/film/games, education, nonprofit & climate). Ids in `src/lib/categories.ts`.
- Assigned by keywords: `scripts/site-meta.ts` reads each site's own title, description and headings (plain
  HTTP, kept locally only), `scripts/categorize-showcase.ts` scores them plus gallery tags and writes SQL.
  At most 1 kind + 2 fields per site; editor-reviewed sites are never overwritten.
- Chip counts follow the selected view. Later: let editors fix categories in `/curate`; non-English sites
  match less often.
- Editors set categories in `/curate` (Edit under each card; saves on each tap). Hand-set categories are
  marked `categories_set_at` and no script overwrites them.
- `scripts/ai-categorize.ts`: sorts the ~10,500 sites the keywords missed with Claude (screenshot + page
  text) through the Batches API; `submit`, then `collect` writes SQL. Needs `ANTHROPIC_API_KEY` in
  `.env.local` (added by the owner, never read by the assistant). Not run yet.
- AI pass now checks every live site (Haiku 5.5 by default), replaces keyword categories unless hand-set,
  and flags screenshots that look broken or low quality into a "Flagged by AI" queue in `/curate`.
  Flags never hide anything by themselves.
- Editors see Feature / Hide / category tools under each homepage card. The public showcase JSON is
  edge-cached 10 minutes, so a hidden site can linger that long for other visitors.
- Sorting without the API: Haiku helpers in a Claude session sorted 5,357 sites from page text
  (4,025 got categories; text shared by several names or hosts, and gambling spam, were left out).
  10,839 of 15,751 live sites are sorted. A second pass from screenshots is scheduled.
- 101 sites whose domains are parked, erroring, "coming soon", spam or a redirect to another site
  were flagged and hidden.
- Detail pages at `/site/[id]`: the card picture opens them; the name still opens the live site.
  `scripts/capture-details.sh` captures the full home page (up to 8 screens) and up to 3 inner
  pages at 960px for Top picks only (~1,800), to stay inside the free 1 GB storage. Parked or
  taken-over domains found while capturing are flagged. Later: captures for every site if storage allows.
- Fixed wrong addresses: when a One Page Love, Httpster or Minimal Gallery page had no live link
  (the site is gone), resolve-showcase-urls.ts fell back to a generic "Launch website" match and took
  the first site from the page's related list. 3,347 entries got a neighbour's address (meetmappy,
  joshpuckett, angelo.so…); they're reset to no address and sit in the Archive. Galleries with their
  own pattern no longer use the generic fallback.
- Screenshot sorting in-session: 92% of live sites with a screenshot now have a category.
- One showcase view: removed the "Search the galleries" tab and the Web / 3D / Mobile switch (the
  categories cover it); galleries are credited at the foot. Pages are 100rem wide.
- Merged 616 duplicate entries (same address) into 575, carrying their gallery features over; Top
  picks grew to ~3,200. 73 One Page Love entries whose address was an ad link are archived.
- Looks pass (in-session, Haiku on plan usage): every live screenshot scored 0-4. Score-0 captures
  (loaders, cookie walls, app store pages) are retaken with `capture-showcase.ts --ids … --wait 8000`
  under img/r/ (new paths, since screenshots are cached for a year). Weak ones get a stricter second look
  before anything is hidden.
- `scripts/daily-captures.sh` runs the screenshot and detail captures after the daily refresh; the
  owner registers it in Windows Task Scheduler. Award dates: gallery sitemaps only give edit dates,
  so items keep their import date; new items get the day the refresh first saw them.
- Looks pass done: 364 weak or taken-over sites hidden (both looks agreed; 41 Top picks checked
  by hand, 4 kept), 2,577 bad captures retaken, and 229 retakes that show a gone site (parked, for
  sale, error, closed) moved to the Archive. ~680 sites still show a loader, cookie or age wall even
  with an 8 s wait; they stay live. 10,849 live sites have a screenshot.
- Sharper screenshots: cards are ~290-560 CSS px wide, so on retina laptops and 3x phones the old
  640px, 1x captures were stretched and soft. `capture-showcase.ts` now renders at 2x and saves
  1280px WebP (q72, smartSubsample, ~30 KB vs ~13 KB); `--prefix v2` puts the recapture under
  img/v2/ (new paths, old ones are cached for a year). 10,156 of 10,849 live sites recaptured; the
  693 that failed (mostly the 15 s screenshot timeout at 2x) keep their old screenshot. The 12,256 old
  files of recaptured sites were deleted (owner approved); storage is 684 MB of 1 GB. Later: detail
  captures (960px, q60) are still 1x; recapturing them would cost ~250 MB more.
- Free image hosting prepared: `scripts/cdn-sync.ts` mirrors every image the site uses into cdn/
  (not committed; back it up) and uploads it to two Cloudflare Pages projects, openrefs-thumbs and
  openrefs-details (.pages.dev; free, unlimited traffic, 20,000 files per project, 1-year immutable
  cache). First upload: 11,764 thumbnails, 5,410 detail captures. The site switches when
  NEXT_PUBLIC_THUMBS_URL / NEXT_PUBLIC_DETAILS_URL are set (set locally; production after the v2
  retake ends and a final sync). The daily job now runs the sync. wrangler runs from outside the
  repo (inside it, it fails looking for pnpm); projects were made with classic Pages (`--force`).
- Live site switched to Cloudflare Pages (0c6d424): `.env.production` holds the two public image
  addresses. Final sync after the v2 retake: 11,764 thumbnails, 5,410 detail captures; live cards and
  detail pages checked (all 200). Supabase still stores every image (684 MB); later, captures could
  save straight into cdn/ so the bucket can be emptied.
- v2 retry (`--wait 6000 --shot 45000`, new `--shot` flag; the give-up limit grows with both): 607
  of the 693 failed sites retaken and synced to Cloudflare after each batch. 10,763 live sites are
  sharp now; 86 keep an old 1x screenshot (blank, 403, or too slow even at 45 s). 773 replaced old
  files deleted; storage 696 MB.
- Images no longer stored in Supabase: capture batches go into cdn/ and up to Cloudflare Pages with
  `cdn-sync.ts --add <batch>` before they're recorded (no broken-image gap); a failed upload skips
  recording. The site's fallback is the Pages address. All 17,174 used images checked on Pages. The
  bucket copies (21,761 files, 696 MB) are ready to delete with `bash tmp/empty-showcase-bucket.sh`
  (the owner runs it). cdn/ is now the only copy besides Pages: back it up.
- Homepage audit fixes (impeccable audit, 15/20): the collection switch and gallery filter share
  one row on desktop; the gallery dropdown has its own chevron. Dark-mode buttons use a darker blue
  (white text 4.9:1, was 3.6:1), and blue text links use a new `--link` token. Card name and gallery
  links are 44px tall on phones. The search placeholder is shorter and 16px on phones, and the hero gap is smaller.
  Still open: about 350 Tab stops on a page of cards, the top row of pictures loads lazily, and the
  global reduced-motion rule kills all motion.
- Directory filters (Top picks/Everything/Archive, category, gallery, search) now live in the URL
  and are rendered on the server, so Back, reload and shared links keep them. The detail page's
  "All sites" link steps back when you came from the directory, so the scroll position comes back too.
  Pages loaded with "Load more" are not restored (only the first 60).
- Site detail opens as a panel that slides up over the list (after Awwwards): an intercepting route
  `@modal/(.)site/[id]` with a Radix dialog (`detail-sheet.tsx`). ×, Esc, the backdrop and Back close
  it and leave the list exactly as it was. A direct link or reload still shows the full page;
  the panel's expand button opens that full page. Shared content lives in `site/[id]/site-detail.tsx`.
- Sharp detail re-take done: 1,776 of 1,862 Top picks have 2x detail captures (full page 2048px,
  inner pages 1280px) under img/details/v2/, uploaded to Cloudflare before being recorded. 86 keep
  their old captures (timeouts, blank screens, 402/403). Old detail files pruned from the mirror and
  Pages; cdn/ is 1.1 GB (details 585 MB, thumbs 440 MB) and Supabase storage stays empty. Back up cdn/.
- Audit leftovers fixed: the first 5 cards load their pictures right away (eager, high priority); card
  gallery links are out of the Tab order (the detail panel lists them), so a page of cards is ~160 Tab
  stops instead of ~350; reduced motion now turns slides, zooms and spins into fades (the detail
  panel fades in) instead of stopping all motion. 4 Everything sites now on suspended or parked
  domains (N.E.R.D, Think Blink, Create Pilates, I AM SACHA) moved to the Archive.
- Cookie banners: `scripts/consent.ts` blocks the common consent platforms (OneTrust, Cookiebot,
  Usercentrics, Didomi, CookieYes, WordPress plugins…) and removes leftover fixed boxes that ask
  about cookies, with their backdrop and scroll lock; nothing is clicked or accepted. Both capture
  scripts use it. `capture-showcase.ts --banners <ids>` retakes only sites showing a banner now
  (img/c2/, after a 6 s wait); a 60-site sample found 8 (~13%). A retake that shows much less
  than the old screenshot outside the banner's area (an intro or loader) is set aside under
  <batch>/rejected/ and the old one kept. Full clean-up of all 10,849 live sites running.
- Cookie-banner clean-up done: all 10,845 live sites scanned; 1,450 screenshots retaken without the
  banner (img/c2/), 38 kept their old one (retake showed less; set aside in tmp/banners-run2/*/rejected),
  204 couldn't load and keep theirs. 259 Top picks' detail pages retaken banner-free (img/details/v3/),
  and 39 of the 86 old 1x detail captures now sharp (46 remain). Random checks all load from Pages and
  show no banner. Later: newsletter and promo pop-ups (not cookie ones) still appear on a few sites.
- Speed pass: directory data, /showcase.json and site details sit in Next's data cache for 10 min
  (tag `showcase`, cleared by editors' actions), so most visits skip Supabase (local TTFB ~400 ms → ~25 ms).
  border-beam, liquid-gooey, thinking-orbs, the editor tools, toaster and account menu load after the
  page; signed-out visitors skip the editor check. Home JS 250 → 168 KB gz. Cards are memoized; the
  panel prefetches on hover/touch and slides up with a skeleton (layout + loading.tsx).
  Live Lighthouse before → after (score, TBT): mobile / 73→91 (607→119 ms), all 77→86, portfolio
  78→86, site 89→96; desktop / 92→100, all 86→100, portfolio 95→100, site 85→98 (TBT now 0). Mobile LCP
  still 2.7-4.0 s (simulated; scripts before first paint). Live TTFB 0.4-1.8 s → 0.25-0.57 s.
- Card thumbnails at 720px: copies of all 11,760 thumbnails (~16 KB vs ~38 KB) on a third Pages project,
  openrefs-thumbs-sm; cards pick them with srcset/sizes, 2x+ screens still get 1280px. small-thumbs.json
  lists which paths have a copy, so newer captures fall back to the full picture. Live images per page:
  mobile 199 → 78-98 KB, desktop 1.3 MB → 0.5-0.57 MB; mobile scores / 93, all 88, portfolio 88.
- cdn-sync.ts now makes the 720px copy of every card screenshot (from the mirror, cdn/openrefs-thumbs-sm)
  and uploads openrefs-thumbs-sm before a batch is recorded, so every recorded screenshot has one;
  small-thumbs.json is gone and the site always offers the small copy. Tested with a dummy --add batch
  (no upload). The next daily run also drops 187 detail captures no row uses from openrefs-details.

### Daily captures scheduled (2026-11-01)
- "Openrefs daily captures" is now registered in Windows Task Scheduler (daily 11:30, catches up if the PC was off).
- First run failed: Playwright needed a new Chromium build (installed), and the expired `wrangler login`
  can't renew unattended. `cdn-sync.ts` now passes CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID from
  .env.local to wrangler; the owner adds a token with "Cloudflare Pages: Edit".
- The 03:00 UTC refresh cron was on, but every save since 2026-10-30 hit the 8 s statement timeout:
  `add_showcase_entries` matched on lower(url)/lower(name) with no index (2 full scans of ~21k rows per
  entry). Added both expression indexes; a manual run then saved 38 new items and 45 credits.

### Nine more galleries in the daily refresh (2026-11-02)
- Added The FWA, Lapa Ninja, CSS Winner, Best Website Gallery, Dark Mode Design, Siiimple, Webdesign
  Inspiration, SaaS Landing Page and Ecomm.design (29 checked; these are free, active, no paywall on entries
  or live links). New entries only, no backfill.
- Galleries that show the live link only on the entry page get `entryLive`; the refresh reads at most 30
  new entry pages per gallery per run (known `source_url`s are skipped first). `?ref=` tags are stripped.
- Dry run: 8 of 9 read, live links found on every sampled entry. Lapa Ninja answers 403 to scripts (curl
  passes); kept in the list, not worked around. Later: CSS Nectar, Design Nominees, Framer Gallery, Admire
  The Web, Curated.design, A1 Gallery (sitemap diffs); Webflow, Landingfolio, CSS Light (HTML scraping).

### Resume here (paused 2026-11-02, 00:35 UTC)
- Today's 03:00 UTC refresh will be skipped (12 h limit after the 2026-11-01 19:22 manual run), so the
  nine new galleries first run 2026-11-03 03:00 UTC. Owner was asked whether to backdate the manual run's
  `ran_at` instead; not done. Check: `select ran_at, report from showcase_refresh_runs order by ran_at desc limit 1`
  (look for the new galleries' "N read" and `added`), then `tmp/daily-captures.log` after 11:30 local.
- Daily chain on the PC: Task Scheduler "Openrefs daily captures" (11:30, Git Bash) installs the
  Playwright browser, captures, then `cdn-sync.ts` uploads with CLOUDFLARE_API_TOKEN from .env.local.
- Unconfirmed: the 187 unused detail images expected to be pruned; every sync so far printed "0 removed".
- Lapa Ninja 403s scripts; if the first real run also shows "skipped (HTTP 403)", drop it.
- Next candidates (owner's call): the six sitemap-diff galleries in the entry above.

### Paused 2026-11-02: Style UI source and hidden gallery credits (branch wip/style-ui-hide-credits)
- Not on main and not live. Two commits plus one work-in-progress commit on this branch:
  - Style UI (style.ai.id) as a `cards` gallery over its 3 pages, free tools only: 47 (38 UI libraries →
    category `ui-kit` "UI libraries & components", 9 background/design.md tools → `design-tools`). Tags
    "ui library"/"design tool" keep them through categorize-showcase.ts.
  - Migration 20261102000200 (add_showcase_entries stores tags/category) is NOT applied; the function with
    Style UI is NOT deployed; the 47 tools are NOT imported or screenshotted.
  - Owner chose to hide all gallery credits on the public site, keeping showcase_features internally
    (refresh dedupe, Top picks, curate page). Done in code, typecheck/lint pass, NOT checked in a browser.
- Checked in pnpm dev (2026-11-02): home, a site page and /showcase.json show no "Featured on", gallery
  filter, "The galleries" footer or gallery names. /showcase.json still sent every item's gallery page
  (`sourceUrl`, mostly awwwards.com); it is now sent only for sites with no live link, as its comment said.
  lint, typecheck, build pass.
- To resume: merge to main, push; then with the owner's OK: `supabase db push`, deploy showcase-refresh,
  import Style UI (or wait for the 03:00 UTC run), run capture-showcase.sh.
- Also still open from the "Resume here" entry above (first run of the nine new galleries on 2026-11-03).
