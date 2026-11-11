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
- Shipped 2026-11-02: merged to main and pushed (71cb9ae); migration 20261102000200 applied;
  showcase-refresh redeployed with Style UI; Style UI imported on its own (47: 38 ui-kit, 9 design-tools);
  capture-showcase.sh batch 55 took 43 of 46. Still without a picture: Uiverse, MOTION.ED, Rare UI (one 429,
  two 403s), and Design MD (marked as tried before this run). The live site wasn't checked after the deploy.
- Also still open from the "Resume here" entry above (first run of the nine new galleries on 2026-11-03).

### Five more galleries, and where the missing pictures are (2026-11-02)
- Added CSS Nectar (feed `?post_type=site`), Design Nominees (feedburner), Framer Gallery (listing page),
  Admire The Web and Curated (new `sitemap` kind: newest <lastmod> first, 30 per run, names from the entry
  page via `entryName`). A1 Gallery left out: it lists Framer templates. Dry run: all five read, live links
  on 29 of 30 sampled entries. Deployed and pushed 2026-11-02.
- Backlog: 9,038 of 19,934 listed sites have no picture (hidden). 3,726 have no live link (3,474 from One
  Page Love's backfill); 5,290 failed capture: dead DNS 1,564, 403 626, 404 488, blank 675, parked 438.
- Clean-up: One Page Love's entry pages gave a live site for only 34 of 3,474 (the rest link to archive.org);
  28 captured. Retry of 2,360 (403/blank/timeouts/5xx, 8 s wait, 45 s shot; tmp/run-retry2.sh) took 636.
  Unlisted (status hidden, not deleted): 2,952 dead (no DNS on recheck, parked, 404/410, bad certificate),
  3,692 with no live link, 1,730 still failing after two tries. Undo lists: tmp/hide-dead.sql,
  tmp/unlisted-no-url.txt, tmp/unlisted-no-picture.txt. Now 11,560 listed, every one with a picture.
- Speed: live Lighthouse with the PC idle: desktop 99/99 (/ and ?view=all), mobile 89/87, LCP 3.3-3.5 s
  (the first card, 67% load delay). Only the first card's picture is high priority now (was the first 5,
  competing on slow 4G). Runs taken while captures use the CPU read 55-76: measure with the PC idle.
- Later: daily captures still need this PC (no browser in Edge Functions; cdn-sync deploys the whole local
  cdn/ mirror), so moving them to CI means moving images to R2 first.

### Screenshots retaken: intros, loaders, video heroes and pop-ups (2026-11-03)
- Many "empty middle" cards were the capture, not the site: a fixed 2.5 s wait caught intros and
  "Loading 100%" counters, reduced motion kept video heroes paused on black, and WebGL ran on the software
  renderer. Captures now use the GPU and normal motion and wait (scripts/screen.ts) until nothing reads
  "loading", the middle isn't empty and the screen holds still (up to 12 s more). Error pages ("Unexpected
  Server Error", "Bad Gateway", host 404s) now fail; newsletter and offer pop-ups are removed with banners.
  Both capture-showcase.ts and capture-details.ts.
- Recheck of all 11,560 listed (`--recheck`, img/v3/, old kept when the new one shows less; tmp/run-recheck.sh),
  then every Top pick's details (tmp/run-details-recheck.sh, img/details/v3/). Batch 1: 379 of 400
  replaced, 20 kept, 1 parked. Open: confirm and unlist the dead sites the recheck finds.
- Resume here (2026-11-03 06:25): batches 1-7 done (2,653 of 2,800 replaced). The rest runs detached from
  any Claude session: tmp/run-all-rechecks.sh (thumbs recheck, then detail retakes; log tmp/recheck.log,
  ends with "== done"). Both runners resume after a stop and pause 11:00-11:45 for the daily job. Rerun
  with: Start-Process "C:\Program Files\Git\bin\bash.exe" /c/Projects/ref-index/tmp/run-all-rechecks.sh
  When done: collect failures in tmp/showcase-recheck/*/results.ndjson (no DNS, 404/410, error page,
  parked, bad certificate; not 403 or bot checks), retry them once, unlist what fails again (keep an undo
  list), then write the final numbers here.
- Recheck finished (2026-11-03, `== done` 15:50). Thumbnails: 10,905 of 11,560 replaced, 655 kept as they were
  (492 "looks emptier", 51 blank, 51 status 403/402/429/5xx, rest timeouts, bot checks, network blocks). Top pick
  details (img/details/v3/): 1,703 of 1,866 retaken, 163 failed.
- Dead sites: 160 candidates (no DNS, 404/410, error page, parked, bad certificate; 137 of them were detail
  "no DNS" failures from a network blip). Retried once (tmp/dead-retry/): 135 loaded, 5 failed for other
  reasons (blank, 503) and stay listed, 20 failed again. Those 20 are now status 'hidden' (none was a staff pick);
  listed 11,540, hidden 9,478. Undo: tmp/unlisted-2026-11-03-undo.sql (ids in .txt, previous state in .json).
  Not touched: 403, bot check, timeouts, "looks emptier", odd SSL errors (unrecognized name, cipher mismatch).
- Still open: the older "Later" items and the pictures still missing for sites that fail with 403 or 429.
- Resume here (2026-11-03, after the recheck and dead-site cleanup): nothing is running in the background.
  Next, in order: (1) check the live site https://ref-index.vercel.app in a browser (home, a /site/[id] page,
  /showcase.json; no "Featured on" or gallery names; the 20 unlisted sites are gone from search); not yet done
  since the 2026-11-02 Style UI deploy. (2) Fix the "about 350 Tab stops on a page of cards" accessibility issue
  (see the 2026-11-02 "Still open" note): each card should be one tab stop or a short roving set, with
  visible focus; the top row of pictures loads lazily (check LCP priority too). lint, typecheck, build must
  pass; check in pnpm dev with keyboard only. Not in scope: pictures for 403/429 sites, the "Later" list.

### Live check and one tab stop per card (2026-11-03)
- Live site checked: home, a /site/[id] page and /showcase.json show no "Featured on" or gallery names; all 20 unlisted
  ids return 404 and the counts read 11,540. One cached search page still said 11,560 (cache from before the unlist,
  10 min); fresh queries give 11,540. Unlisting by SQL doesn't clear the "showcase" cache by itself.
- Cards: the name link has tabIndex -1, so each card is one tab stop (the picture link, now with a focus ring); its panel
  has "Visit site". 60 cards = 60 stops (was 120). LCP: first 5 pictures are eager, the first high priority; no change.
- Focus returns to the card after a panel closes (detail-sheet.tsx).
- Roving grid (directory.tsx useRovingGrid): the cards are one tab stop in total; arrows, Home and End move between them.
- Cache: POST /api/revalidate clears the showcase cache; run `node --env-file=.env.local scripts/clear-cache.ts` after
  bulk unlists/imports. Needs REVALIDATE_SECRET in .env.local AND in Vercel (set 2026-11-03; live call returned 200).
- Resume here (2026-11-03, after the tab-stop work): nothing is running in the background; everything is pushed.
  The 2026-11-03 "Resume here" items (live check, tab stops) are done. Left, none started: the "Later" list (line ~178)
  and pictures for sites that fail with 403/429. Not checked: closing a panel with the x button or backdrop still
  returns focus to the card (only Escape was tried). After any bulk unlist/import, run scripts/clear-cache.ts.

### Plan: "Later" items and pictures for 403/429 sites (2026-11-04)
- Owner's choice: do everything that can be done, in this order. Nothing started yet.
- Policy kept: bot checks and 403s are not worked around (no disguised browser). Only use what the site
  publishes openly.
- Numbers (tmp/showcase-retry2/*/results.ndjson, hidden sites with no picture, list tmp/unlisted-no-picture.txt):
  595 status 403, 136 bot check page, 10 status 429. Also Uiverse, MOTION.ED, Rare UI (Style UI). The 51 listed
  sites that hit 403/402/429/5xx in the 2026-11-03 recheck kept their old picture: nothing missing there.
1. Quick checks (small): closing a panel with the x button and the backdrop returns focus to the card (only
   Escape tried); latest `showcase_refresh_runs` report shows the nine 2026-11-02 galleries read; drop Lapa Ninja
   if it reads "skipped (HTTP 403)"; confirm the 187 unused detail images were pruned (sync said "0 removed").
2. og:image pictures (high value, medium): for the 403/bot-check/429 hidden sites, fetch the home page once with
   a plain request (generic client name, no contact details), read og:image / twitter:image; skip if that is 403
   too or the image is a logo/tiny (< 600 px wide). Resize to 640x400 WebP cover, save as thumb with a flag that it
   is the site's share image, not a screenshot (new column via a new migration). List again only sites that get
   one; keep an undo list. Then `node --env-file=.env.local scripts/clear-cache.ts` and cdn-sync.
3. Slow 429 retry (small): one capture per site, honour Retry-After, one try. About 13 sites.
4. Captures straight to cdn/, empty the Supabase `showcase` bucket (684 MB of 1 GB; medium-large). Unblocks 2x
   detail images (~250 MB) and details for every site.
5. Real award dates per gallery (`first_seen` is the import day; medium).
6. More galleries by HTML scraping: Webflow, Landingfolio, CSS Light (medium).
7. Captures in CI instead of this PC (large; needs 4 and images on R2).
8. Small gaps: non-English category matching; `add_showcase_entries` name-only match; recapture the 5
   "blocked on this network" sites from another network (needs the owner's network).
9. Upload (private library): bulk tagging, HEIC, paste from clipboard, remove failed originals.
- Resume here (2026-11-04): nothing running in the background. Start at step 1, then 2. Each step: lint,
  typecheck, build pass; commit with the GitHub-linked email; short entry here. Steps 4 and 7 need design
  choices: stop and ask the owner before starting them.

### Quick checks, share pictures for 403/bot-check sites, 429 retry (2026-11-04)
- Step 1: panel focus returns to the card with the x button and with a backdrop click (live site, real clicks).
  Detail images: cdn-sync now prunes 150 unused files from the mirror (earlier runs said 0; uploaded to Pages).
  BLOCKER: the daily `showcase-refresh` function dies with WORKER_RESOURCE_LIMIT now that it reads 22+ galleries
  (run 6 on 2026-11-03 and a manual run 2026-11-04 left an empty report, run 7). The nine 2026-11-02 galleries
  have never been read; Lapa Ninja's feed answers 200 to curl, its status from the function is unknown. Fix
  (not done): read galleries in slices per call (several cron jobs or a `?from=` parameter). Daily run is
  skipped until 12 h after run 7.
- Step 2: scripts/og-images.ts read the home page once per site (741 sites: 403 / bot check / 429 / Style UI):
  448 home pages answered 403 and 5 answered 429 (skipped), 184 had no og:image, 22 were too small or not landscape,
  the rest failed. 47 pictures, 10 dropped because several sites shared one picture, so 37 sites are listed again
  (listed now 11,577) with `thumb_is_share_image = true` (migration 20261104000100). Undo: tmp/og/batch-1-undo.sql.
  Images uploaded with cdn-sync, cache cleared. Not done: showing "share image" on the card.
- Step 3: 11 sites with 429 retried once (no 429 header read; the script reports only the status): all 11 still
  blocked (10 x 429, 1 x 403). Nothing changed.
- Resume here (2026-11-04): nothing running; everything pushed. Next is step 4 or 7 (need the owner's
  choice), or first fix the refresh function (slices) since it blocks new galleries.

### Refresh in slices, GradientDeck UI imported (2026-11-04)
- Refresh fix deployed: `showcase-refresh?slice=0..5` reads about 5 galleries per call; cron jobs
  showcase-refresh-slice-0..5 at 03:00-03:25 UTC replace showcase-refresh-daily (supabase/schedule_showcase_refresh.sql).
  Manual test of slice 0: 132 read, 71 items added, no error. Slices 1-5 first run 2026-11-05 03:05-03:25 UTC:
  NOT yet checked (look at showcase_refresh_runs; an empty report means the slice died). Land-book still 403.
- GradientDeck UI (ui.gradientdeck.com, DESIGN.md files made from real sites; robots allows /styles/) added as a
  `sitemap` gallery (30 newest per refresh) and imported in full with scripts/import-sitemap-gallery.ts: 1,275
  entries read, 1,272 with name and live link, 752 new items and 1,249 gallery credits. Listed now 12,400.
  Two crawlers ran at once by mistake (restart); results deduped. New items have no picture until the daily captures.
- Idea (not started): our own DESIGN.md per site (measured styles + written summary), prototype on ~20 sites first.

### Step 4 done: Supabase `showcase` bucket emptied; refresh slices checked (2026-11-05)
- Refresh slices: all six ran 2026-11-05 03:00-03:25 UTC with no error (read 182/123/81/154/247/175, items added
  18/38/33/88/43/75). The slice fix works.
- Before deleting, checked every image the DB points to on Pages: 13,263 thumbnails (full and 720px copies) and
  5,983 detail images, 32,509 requests, all 200 (one network error that was 200 on retry). Captures already went
  straight into cdn/ and Pages (`cdn-sync --add`), so only the old copies were left. Ran tmp/empty-showcase-bucket.sh:
  `storage.objects` for bucket showcase is now 0 objects, 0 MB (was 21,761 files, ~696 MB); the live site loads.
  cdn/ (682 MB details, 556 MB thumbs) plus Pages are now the only copies: back up cdn/. cdn-sync's old-bucket
  fallback no longer finds anything (harmless).
- Step 7 (captures in CI) NOT started: needs the owner's choices (CI service, where the images live: R2 or keep
  Pages and download the mirror each run, where the Cloudflare and Supabase tokens go).

### Resume here: step 7, captures in CI (2026-11-05)
- State: everything pushed; nothing running in the background. Steps 1-4 of the plan are done (see the entries above).
  The refresh runs as six slices; Supabase `showcase` bucket is empty; images live only in cdn/ and on Cloudflare Pages.
- Backup made 2026-11-05: C:\Projects\ref-index-backup-2026-11-05 (cdn/ 33,687 files, .env.local, .env.production,
  tmp undo/import lists). Same disk as the project: the owner should copy it to an external drive or cloud.
- Facts: repo hystericmoon/ref-index is PRIVATE (GitHub Actions: 2,000 free min/month; estimate 20-40 min/day, not
  measured). gh is installed (C:\Program Files\GitHub CLI\gh.exe, not on the Git Bash PATH) and logged in.
  The owner has NO domain on Cloudflare. Daily job today: scripts/daily-captures.sh on the PC (Task Scheduler,
  11:30 local): capture-showcase.sh, capture-details.sh, cdn-sync.ts (which deploys the whole cdn/ mirror to the three
  Pages projects openrefs-thumbs, openrefs-thumbs-sm, openrefs-details; wrangler needs CLOUDFLARE_API_TOKEN).
  DB writes use `supabase db query --linked` (needs an access token in CI).
- Agreed plan (owner's go-ahead pending their R2 setup): keep Pages serving (site code and .env.production unchanged);
  use a Cloudflare R2 bucket `openrefs-images` (free: 10 GB, free downloads; the mirror is ~1.2 GB) as the MASTER copy.
  CI job: download the mirror from R2, capture new items (capture-showcase, capture-details, og images if wanted),
  upload new files to R2, run cdn-sync (deploy to Pages). Rejected: Worker on workers.dev (100k requests/day),
  Actions cache as master (evicts after 7 days), r2.dev address (testing only, rate-limited).
- Owner must first: create the R2 bucket and an Object Read & Write token (bucket-scoped) and put R2_ACCESS_KEY_ID and
  R2_SECRET_ACCESS_KEY in .env.local (do not read or print the values). Later `gh secret set` for CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID, R2 keys, SUPABASE_ACCESS_TOKEN, and the Supabase project ref/DB password as needed (ask first).
- To build: (1) one-off upload of cdn/ to R2 (S3 API via @aws-sdk/client-s3 or rclone; verify counts match 33,687 files);
  (2) cdn-sync: option to pull the mirror from R2 and push new files; (3) .github/workflows/daily-captures.yml (cron
  after the 03:00-03:25 UTC refresh, e.g. 05:00 UTC; install Chromium with Playwright; GPU/WebGL differs from the PC:
  compare a few captures); (4) keep the PC job as fallback until three CI runs are checked, then disable it;
  (5) measure minutes used in the first week. Stop and ask before storing secrets in GitHub or disabling the PC job.
- Other open items: Land-book 403 in the refresh (skipped); "DESIGN.md per site" idea is ON HOLD (owner said wait).

### Step 7, captures in CI: R2 in place, CI blocked by GitHub billing (2026-11-05)
- R2 bucket openrefs-images is the master copy: one-off upload of cdn/ matched exactly (33,687 files: thumbs
  13,264, thumbs-sm 13,264, details 7,159, incl. one _headers each; 1.62 GB). cdn-sync.ts now fills the mirror
  from R2, uploads new files to R2 and drops unused ones (skips removal if over 10% / 200 files) before each Pages
  deploy; the empty Supabase bucket fallback is gone. The PC job runs the same script, so it keeps R2 current too.
- .github/workflows/daily-captures.yml: 07:00 UTC (after the PC job at 04:30 UTC) and on demand (inputs
  max_batches, limit); cdn/ cached between runs. Capture scripts take CAPTURE_LIMIT, CAPTURE_WORKERS, MAX_BATCHES.
  Seven repo secrets set (Supabase URL/publishable key, Cloudflare token/account, R2 keys, SUPABASE_ACCESS_TOKEN =
  scoped token "openrefs-ci": ref-index project, Database read-write, Project Settings read, never expires).
- Blocked: the first manual run (42035641935) didn't start: "recent account payments have failed or your spending
  limit needs to be increased" (GitHub Billing & plans). Owner to fix, then rerun: gh workflow run
  daily-captures.yml -f max_batches=1 -f limit=8. Not yet checked: CI captures vs PC (no GPU), minutes used,
  `supabase db query --linked` with the scoped token. PC job unchanged and still the daily job.
- Open: 269 items with no thumb_checked_at (today's PC batch 58 "recording failed"); the next run retries them.

### Step 7 done: captures run in GitHub Actions (2026-11-05)
- Repo made PUBLIC by the owner (no Actions budget; public repos run free). History checked first: no secrets
  ever committed (only empty placeholders in .env.example). The "Blocked" note above is resolved.
- Manual run 42040354919 (max_batches=1, limit=8): mirror restored from cache + R2 (33,684 images, 0 failed),
  6 of 8 sites captured, recorded, uploaded to R2 and deployed to all three Pages projects (all 6 return 200 on
  thumbs and thumbs-sm). 5 min 13 s wall time. Two fixes on the way: capture-showcase.sh now creates its batch
  folder (fresh runner had none), and CI writes supabase/.temp/pooler-url (direct DB host is IPv6-only, runners
  aren't). Recording errors are now printed instead of only "recording failed".
- Screenshot quality: wisprflow.ai looks like a PC capture; wovenwhisky.com shows a loader over its hero
  (likely a video Chromium can't play without the GPU/codecs). Compare a few more in the next runs.
- Next: the 07:00 UTC schedule runs from 2026-11-06. Keep the PC job (11:30 local) until three CI runs are
  checked; ask the owner before disabling it. 263 items still wait for screenshots (PC batch 58's SQL is valid;
  its failure looks transient). Later: bump actions to Node 24 versions (deprecation warning); measure minutes.

### Site audit, dead sites hidden, Archive removed (2026-11-05 night)
- Audit (scripts in tmp/site-audit/): live site crawl 213 pages all 200, 716 images OK; all 33,696 image paths
  load from Pages; liveness of all 12,695 listed sites (live-check.mjs, retry.mjs, browser-check.mjs).
- Hidden 66 (status 'hidden'): 21 confirmed dead in a real browser (no DNS, 404/site-not-found, persistent 5xx,
  dead campaign pages) + the 51 former Archive items (capture failed). List: tmp/site-audit/hidden-2026-11-05.json,
  undo: tmp/site-audit/hide-2026-11-05-undo.sql. Listed now 12,629. NOT hidden: 12 that only timed out from this
  PC (tmp/site-audit/unsure-timeouts.json; may be the ISP), and false alarms (ISP cert interception on
  vimeo/kraken/aave/questrade, header-size errors on webflow/maersk, uber's bot 404, 92 bot-blocked 403s).
- Archive view removed from the site (99137fc): views are top/all; ?view=archive falls back to top; footer says dead
  sites are removed. Owner's rule: dead sites are hidden, no archive. Cache cleared.
- REVALIDATE_SECRET had vanished from .env.local (lost when the R2 keys were added); restored that one line from
  the 2026-11-05 backup. Other names match the backup.
- Screenshot scores for all 12,314 listed (tmp/site-audit/shots.json, shot-scores.mjs). 829 suspects (empty middle
  flatMid>=0.95, entropy<0.5, plus 20 seen by eye: ferrari bot check, classroom.google sign-in, swimclub.co shows
  Google, loaders on valkai/thirdway/gang.tv/pixelismo/..., gates on daikifujita/lorenzolottici, age checks on
  drinkyodo/talkencore) in tmp/site-audit/retake-ids.txt.

### Resume here (2026-11-05 23:15 local): finish the screenshot retakes and flag what's left
- RUNNING detached: tmp/site-audit/run-retakes.sh (retakes the 829 with --recheck --prefix v4 --wait 8000
  --settle-max 20000, 10 workers, 300 per batch, folders tmp/showcase-retake-1105/batch-N; each batch is added to
  R2 + Pages, then recorded; old shot kept when the retake looks emptier, rejects in batch-N/rejected/).
  Log: tmp/site-audit/retakes.log, ends with "== done HH:MM" (expected ~00:30). Check it's alive:
  Get-CimInstance Win32_Process | ? CommandLine -like '*run-retakes*'. If it died, rerun (resumes, skips tried ids):
  Start-Process "C:\Program Files\Git\bin\bash.exe" -ArgumentList "-c","'bash /c/Projects/ref-index/tmp/site-audit/run-retakes.sh > /c/Projects/ref-index/tmp/site-audit/retakes.log 2>&1'" -WindowStyle Hidden
  (A first attempt was killed; its stray img/v4 files were removed from cdn/ and R2; DB had no v4 paths.)
- Then: (1) per batch, check "replaced of N" and that no "recording failed"; (2) re-score the 829 with their current
  thumb_path (adapt shot-scores.mjs to the id list), make numbered sheets (node tmp/site-audit/sheets.mjs <list.json>
  tmp/site-audit/after) and look at every still-suspect one; (3) flag the ones a retake can't fix in the /curate
  Flagged queue: update showcase_items set ai_flag='broken' (bot check, sign-in, error, blank, loader/intro still on,
  enter/age/sound gates) or 'low_quality' (cropped, banner-covered, mostly empty), reviewed_at stays null; the owner
  decides Keep/Hide there. Save the flagged ids + reasons to tmp/site-audit/flagged-2026-11-06.json; (4) clear the
  cache (node --env-file=.env.local scripts/clear-cache.ts) and spot-check a few retaken cards on the live site;
  (5) short progress entry, commit, push.
- Owner decides in the morning: the Flagged queue in /curate; the 12 unsure timeouts (hide or keep).
- Also running daily: PC job 11:30 local, CI 07:00 UTC (both run cdn-sync; the retake job should be done long before).

### Screenshot retakes finished, unfixable ones flagged (2026-11-06)
- Retake job done 23:49: batch 1 283/300, batch 2 273/300, batch 3 223/229 replaced, all recorded (779 of 829 now on
  img/v4; 50 kept their old shot, 18 rejects). Re-scored the 829 (tmp/site-audit/rescore.mjs → after.json): 693 still
  scored suspect, all looked at on 18 numbered sheets (tmp/site-audit/after/); most are just minimal designs.
- Flagged 419 in /curate (250 broken: loaders, enter/sound/age/password gates, bot check, sign-in, errors, private,
  coming soon; 169 low_quality: mostly empty, hero/video not loaded, popups). Nothing hidden, reviewed_at untouched.
  Ids + reasons: tmp/site-audit/flagged-2026-11-06.json; undo: flag-2026-11-06-undo.sql. Cache cleared; live cards
  checked (rickardsund, yinger.dev, eleven-eleven serve v4). No code changes.
- Owner decides: Flagged queue (420 incl. 1 older); the 12 unsure timeouts (tmp/site-audit/unsure-timeouts.json).

### Fix list: FWA and Lapa Ninja off, share-image label, Actions on Node 24 (2026-11-06)
- Refresh: The FWA's /rss is gone (404); its new feed links /w/<slug> pages whose live link only comes from /api, which
  robots.txt disallows, so it's `off` (the old code read /api too). Lapa Ninja `off` (still 403 from the function).
  New `off` field keeps every other gallery in its slice. Land-book reads again (50 on 2026-11-05).
  NOT DEPLOYED: the PC's Supabase login is a limited token (no edge_functions permission); until the owner signs in
  with full access, runs keep reporting both as skipped (harmless).
- Share image: migration 20261106000100 (search_showcase returns thumb_is_share_image), applied. Cards show a
  "Share image" chip, the site page says so (checked live on Spicy NoSpicy). Cache cleared.
- Actions moved to the first Node 24 majors (checkout/setup-node/pnpm/cache v5, upload-artifact v6); manual run
  42139693939 (2 sites) passed in 4.5 min, no Node 20 notice. Repo-local git identity set (GitHub-linked email).
- The 3 sources without thumbnails no longer show anywhere (gallery-search tab is gone).

### Resume here (2026-11-10): deploy the refresh function with The FWA and Lapa Ninja off
- Everything else from the 2026-11-06 fix list is live (share-image label, Actions on Node 24). Only the
  `showcase-refresh` Edge Function is NOT redeployed: the 2026-11-10 run still says The FWA "skipped (HTTP 404)".
  The code on main already has `off:` for The FWA and Lapa Ninja (supabase/functions/showcase-refresh/galleries.ts).
- Blocker: the PC's Supabase CLI login is the scoped token `openrefs-ci` (no edge_functions permission).
  Likely cause: `supabase login` run inside C:\Projects\ref-index picks up SUPABASE_ACCESS_TOKEN from .env.local
  (the CI token) and stores it, so it "logs in" instantly with no browser. The account also has an older full
  token "cli_Hosni@HAHO-ROG" (LEGACY). Owner fix, from a folder WITHOUT .env.local:
    cd C:\Projects ; .\ref-index\node_modules\.bin\supabase logout --yes ; .\ref-index\node_modules\.bin\supabase login --agent no
  then approve in the browser; a new cli_ token should appear at supabase.com/dashboard/account/tokens.
  Check: `supabase functions list` lists showcase-refresh. Deploy (JWT check off, as cron calls it that way):
    .\node_modules\.bin\supabase functions deploy showcase-refresh --no-verify-jwt
  Verify with the next 03:00 UTC run: The FWA and Lapa Ninja report "off (...)". The daily PC job uses the same
  CLI login for DB writes, so a full token keeps it working.
- Owner decisions still open: Flagged queue in /curate (420), 12 unsure timeouts (tmp/site-audit/unsure-timeouts.json),
  disable the PC job after 3 good CI runs (ask first), copy C:\Projects\ref-index-backup-2026-11-05 off this disk.
- docs/oracle/ is untracked and not from this work; left alone.

### showcase-refresh redeployed, The FWA and Lapa Ninja now "off" (2026-11-10)
- Owner logged in again from C:\Projects (outside ref-index). Inside ref-index the CLI still uses the CI token from
  .env.local (functions list gave 403 there), so run CLI commands from C:\Projects with
  `--workdir C:/Projects/ref-index --project-ref kolzsxfgqodulzteocnd`.
- Deployed with `--no-verify-jwt` (version 7; cron sends no Authorization header, so JWT on would reject it).
  The older "JWT verification on" note near line 172 is outdated.
- Manual call of all 6 slices (16:25 UTC): The FWA "off (feed moved...)", Lapa Ninja "off (answers 403...)".
  Not caused by the deploy, but worth watching in the 2026-11-11 03:00 run:
  slice 3 returned WORKER_RESOURCE_LIMIT (see the older blocker note; it ran fine at 03:15 today);
  Land-book "skipped (HTTP 403)" (49 read at 03:00, Cloudflare flaps); Admire The Web "0 read" (30 at 03:00).
- Slice 3 now has a run row from 16:25, so it can't be re-called until 04:25 UTC (12 h limit).

### Job 2 step 1: Oracle A1 VM blocked, out of host capacity (2026-11-10)
- Signed in by the owner (Free Trial tenancy, Batam / ap-batam-1, one AD). Create-instance form filled and accepted:
  openrefs-capture, Ubuntu 24.04, VM.Standard.A1.Flex (shown "Always Free-eligible") 2 OCPU / 12 GB, 50 GB boot
  (10 VPU), public IPv4, own SSH key (C:\Users\Hosni\.ssh\id_ed25519_openrefs, no passphrase), cloud-init pasted.
  Create failed: "Out of capacity for shape VM.Standard.A1.Flex in availability domain AD-1". STOPPED as planned;
  no instance exists, nothing paid for or upgraded. Steps 2-4 not started.
- Created in the tenancy (no cost, no price shown): VCN openrefs-vcn (10.0.0.0/16), internet gateway openrefs-igw,
  default route 0.0.0.0/0 -> openrefs-igw, public subnet openrefs-public (10.0.0.0/24), default security list
  (still allows SSH 22 from anywhere: restrict to the owner's IP once a VM exists, then delete it after Tailscale).
  No NAT or service gateway on purpose (not marked Always Free). The console's "create new VCN" option would not
  enable a public IP, so the VCN was made by hand first.
- Retry later: Create instance, pick the existing openrefs-vcn / openrefs-public, same values.

### Job 2 step 1 retry: still out of host capacity (2026-11-10, evening)
- Console was still signed in. Pressed Create twice on the existing review page (openrefs-capture, A1.Flex 2 OCPU / 12 GB,
  50 GB boot, openrefs-vcn / openrefs-public, public IPv4, cloud-init, id_ed25519_openrefs key). Both gave the same
  "Out of capacity for shape VM.Standard.A1.Flex in availability domain AD-1". No instance created, nothing paid or upgraded.
- STOPPED per plan. Pilot gate, mirror/backup gate and systemd timer not started (they need the VM). PC job untouched.
- Next: retry Create later (the form is still open in the browser pane, tab on cloud.oracle.com/compute/instances/create).

### Job 2 step 1: smaller shape also out of capacity (2026-11-10, night)
- Owner ruled out pay-as-you-go. Changed the form shape to VM.Standard.A1.Flex 1 OCPU / 6 GB (review page confirmed; rest unchanged,
  still Always Free-eligible). Create gave the same "Out of capacity ... AD-1". No instance, nothing paid or upgraded.
- Hourly retry job (:17) keeps pressing Create on this 1 OCPU / 6 GB form. If it succeeds, resource-heavy gates (pilot) must
  size for 6 GB RAM. PC job untouched, docs/oracle/ untouched.

### Job 2 step 1: Oracle session expired, hourly retry stopped (2026-11-11)
- Earlier retries (2 on 2026-11-11) still "Out of capacity" for the 1 OCPU / 6 GB form. The latest retry found the console signed out
  (login.ap-batam-1.oraclecloud.com, HTTP 400 page). Needs the owner to sign in again; the hourly retry job was cancelled.
- No instance exists, nothing paid or upgraded. PC job and docs/oracle/ untouched.

### Job 2 step 1: re-signed in, form rebuilt, still out of capacity (2026-11-11)
- Owner signed in again. Rebuilt the Create form from scratch: openrefs-capture, Ubuntu 24.04, A1.Flex 1 OCPU / 6 GB (Always Free-eligible),
  openrefs-vcn / openrefs-public, public IPv4, own public key (pasted, public half only), 50 GB boot, cloud-init pasted (unchanged from docs/oracle).
- Create: same "Out of capacity ... AD-1". No instance, nothing paid or upgraded. Hourly retry (:17) re-enabled; stops if the session expires again.

### Job 2 (Oracle VM) dropped by owner (2026-11-11)
- Owner said to forget about it. Hourly retry cancelled. No VM was ever created; nothing paid or upgraded.
- Left in the Oracle tenancy (free, unused): VCN openrefs-vcn, internet gateway openrefs-igw, subnet openrefs-public, default security list (SSH 22 open to anywhere, but no VM to reach).
- Pilot gate, mirror/backup gate and systemd timer not done. PC job untouched, docs/oracle/ untouched.

### 12 unsure timeouts re-checked, 1 hidden (2026-11-10)
- Plain request from the PC: 200 tvaq.ru, massimobonini.com; 403 nationaltraveller.com, dailyfx.com (block bots; kept);
  404 maxkorzh.live/en/ -> hidden (undo: tmp/hide-maxkorzh-undo.sql); still timing out/failing: gate108.cc, ny.paraweb.me,
  aaugh.it, cv.okfoc.us, brainstormgame.ru, a-way-to-go.com, zzdo.ru (left listed; may be this PC's ISP).
- Cache not cleared (public JSON can show the hidden site up to 10 min).
- Next for those 7: re-check from GitHub Actions (different network). Owner decides.
- DNS check of the 7 still-failing sites via dns.google: all resolve (gate108.cc, ny.paraweb.me, aaugh.it, cv.okfoc.us, brainstormgame.ru,
  a-way-to-go.com, zzdo.ru), so none is provably dead; left listed. A real check needs a non-PC network (GitHub Actions) and a pushed workflow: not done, owner's call.

### Flagged queue reviewed by Claude at the owner's request; 7 unreachable sites hidden (2026-11-10)
- One-off CI workflow (run 42908090270, GitHub network) got the same timeouts/failure for the 7 sites (gate108.cc, ny.paraweb.me,
  aaugh.it, cv.okfoc.us, brainstormgame.ru, a-way-to-go.com, zzdo.ru): unreachable from two networks, so hidden. Workflow file removed again.
- Flagged queue (251 broken: loaders/gates/errors/private/coming soon; 169 low_quality: mostly empty) hidden, same rule as the 364 weak sites
  hidden on 2026-11-05 (a card whose picture is a loader, gate or empty page is not a useful reference). No staff picks were affected.
  425 sites hidden in total (queue + the 7), reviewed_at set. Undo: tmp/site-audit/hide-2026-11-10-undo.sql (ids in hide-2026-11-10-ids.txt).
  Caveat: some are fine sites whose screenshot just failed (loaders/gates); relist by id if the owner wants them back.
- Cache cleared. No code changes.

### Resume here (2026-11-10, end of session)
- Oracle A1 VM job (job 2) is dropped by the owner; no VM exists, nothing paid. Pilot/mirror/timer not done. Unused Oracle network
  pieces remain (openrefs-vcn, openrefs-igw, openrefs-public, default security list); delete only if the owner asks. PC job still the daily job.
- Next, after 03:00 UTC on 2026-11-11 (10:00 Batam): read the latest `showcase_refresh_runs` report (run CLI from C:\Projects with
  `--workdir C:/Projects/ref-index`, see the redeploy entry). Expect The FWA and Lapa Ninja "off". Look at: slice 3 WORKER_RESOURCE_LIMIT,
  Land-book 403, Admire The Web 0 read. Report only; change nothing unless asked.
- Owner decisions still open: copy C:\Projects\ref-index-backup-2026-11-05 off this disk; disable the PC job after 3 good CI runs (ask first).
  Flagged queue and 12 timeouts are done (425 hidden; undo tmp/site-audit/hide-2026-11-10-undo.sql).
- No background jobs or scheduled retries are running.

### Checked for the 2026-11-11 03:00 UTC showcase-refresh run: not run yet (2026-11-10, 23:12 UTC)
- Too early: the PC clock reads 2026-11-10 23:12 UTC, and the latest `showcase_refresh_runs` rows (ids 45-50) are still the manual call of 2026-11-10 16:24-16:27 UTC. No 03:00 run exists. Report only, nothing changed.
- What those 16:2x rows show (not the 03:00 run): The FWA "off", Lapa Ninja "off"; slice 3 (id 48) has a bare `{"slice": 3}` report, so it hit WORKER_RESOURCE_LIMIT; Land-book "skipped (HTTP 403)"; Admire The Web "0 read".
- Next: re-read after 03:00 UTC (10:00 Batam), same query: `select id, ran_at, report from showcase_refresh_runs order by ran_at desc limit 8`.

### Re-check 2026-11-11 14:14 UTC: no 03:00 UTC showcase-refresh run was recorded
- `showcase_refresh_runs` still ends at id 50 (2026-11-10 16:27 UTC, the manual call). Nothing from 2026-11-11 03:00 UTC, so the cron did not fire or did not log a row. Report only, nothing changed.
- Open: check the cron job (pg_cron / cron.job_run_details) and the Edge Function logs for 03:00 UTC. The FWA / Lapa Ninja "off" and the other three items cannot be confirmed from a scheduled run yet.

### Why no 03:00 UTC run was logged on 2026-11-11 (found 14:30 UTC, read-only)
- Cron fired on time: jobs 2-7 (`showcase-refresh-slice-0..5`) all "succeeded" at 03:00-03:25 UTC. But every call got HTTP 429 `{"skipped":"last run ..."}` (net._http_response ids 46-51): the function's 12 h limit, because the manual 6-slice call ran at 16:24-16:27 UTC on 2026-11-10 (only ~10.6 h before). Nothing was refreshed and no report row was written.
- So the four checks (The FWA/Lapa Ninja off, slice 3 WORKER_RESOURCE_LIMIT, Land-book 403, Admire The Web 0) still can't be confirmed from a scheduled run. Next chance: 2026-11-12 03:00 UTC (the 12 h window is long past). Avoid manual slice calls before then.
- No changes made (read-only queries on cron.job, cron.job_run_details, net._http_response).

### Plan: curate to the best, expand search and tags (2026-11-11, plan only, nothing changed)
- Facts: 12,308 shown on the homepage (listed, not dead; hidden are never counted). 12,319 listed, 0 staff picks, 2,473 in 2+ galleries ("top" view).
  9,933 hidden: 8,389 never reviewed with no picture (backlog), ~1,500 hidden by review (low_quality 533, broken 355, other 622). Do NOT delete hidden rows:
  the refresh does `insert ... on conflict (name, url) do nothing` (migration 20261029000100), so a deleted row comes back as a new listed site.
- Search today (search_showcase, migration 20261106000100): substring `like` on name, url, tags and gallery name; no typo tolerance, no synonyms, no relevance rank.
  Order is staff_pick, has picture, gallery_count, first_seen. Categories: 20 topic-only ids (agency 2,431 ... design-tools 8, ui-kit 36, web3 100); `tags` text[] is free text.
  Facet/tag tables (5 facets, 49 tags) belong to the private screens library (1 screen), not to the directory.
- Steps (each ships alone, in this order):
  1. Best-of tier: score listed sites (staff pick, gallery_count, award galleries, ai_flag clean, has screenshot), write a ranked shortlist to tmp/, owner approves in /curate,
     then set staff_pick on the approved set (reversible, nothing hidden or deleted). Open: target size (500 / 1,500 / 3,000) and criteria.
  2. Search: pg_trgm similarity + synonyms, rank by relevance first, then the current order; keep the URL-state rule (searchParams).
  3. Tags: add style, layout, colour, tech and mood dimensions beside the 20 categories (new migration, then ai-categorize.ts backfill; hand edits in categories_set_at stay).
  4. Refresh fixes: blocklist table checked by the refresh (lets hidden rows be deleted safely), cron overrides the 12 h limit, split slice 3 (WORKER_RESOURCE_LIMIT),
     drop or replace Land-book (403) and Admire The Web (0 read).
- Owner decisions open: target size, how "best" is judged, whether the 8,389 backlog gets a capture retry.

### Step 1 shortlist built, NOT applied (2026-11-11)
- Owner chose ~1,500. Pool: 12,193 listed sites with a picture, a link and no AI flag. Score = sum of gallery weights (Awwwards, CSS Design Awards, Apple Design Awards 3;
  Godly, Httpster, Minimal Gallery, One Page Love, Land-book, SiteInspire, Curated, CSS Winner 2; Brutalist 1.5; others 1) + 2 if in 3+ galleries + 1 if reviewed.
  Taken best first, max 375 per first category. Script: scratchpad rank.mjs; output in tmp/best-of/ (shortlist.json, shortlist-ids.txt, apply-staff-pick.sql, undo-staff-pick.sql).
- Result: 1,500 picked, cutoff score 5, where 435 sites tie (cut by newest first_seen, so the last ~300 are arbitrary). agency hits the 375 cap; dev (6), education (14), web3 (12) are thin because the pool is thin.
- Nothing written to the database. Next: owner reviews the shortlist, then run apply-staff-pick.sql (undo file ready), clear cache.

### Step 1 applied: 1,500 staff picks set (2026-11-11)
- Ran tmp/best-of/apply-staff-pick.sql: staff_pick = true on 1,500 listed sites (verified: 1,500 picks, 0 not listed, 12,319 still listed, nothing hidden or deleted). Undo: tmp/best-of/undo-staff-pick.sql.
- Homepage "top" view is still 2,473 (it is staff_pick OR 2+ galleries, and all 1,500 picks are already in 2+ galleries). Picks now sort first in search. To make "top" show only the 1,500, change the view rule in search_showcase / showcase_view_counts (new migration): not done.
- Public JSON is edge-cached up to 10 min, so the order may take that long to change.

### Step 1 finished: 6 un-picked, "top" view = staff picks only (2026-11-11)
- Un-picked 6 dated/one-off pages (Atlassian infographic, Clique: Defiantones, Veley / Ross Wedding, Design Week Portland, Not-Another-Bill, Temporary Measures): 1,494 picks.
  Kept the 5 Apple Design Award apps. Undo for all picks: tmp/best-of/undo-staff-pick.sql (the 6 were also in apply-staff-pick.sql; unpick-6.sql is the 6 alone).
- Migration 20261111000100_showcase_top_is_staff_picks.sql pushed (search_showcase, showcase_view_counts, showcase_category_counts: top = staff_pick). Live: top 1,494, all 12,308, archive 11.
  To revert the rule: re-create the three functions from 20261106000100 / 20261029000500 / 20261029000700. Public JSON edge-cached up to 10 min. Not code-built or linted (comment-only change in src/lib/db/showcase.ts).
- Next: step 2 (search), step 3 (tags), step 4 (refresh fixes). Optional: spot-check more of the score-5/6 picks in /curate.

### Step 2 shipped: search v2 (2026-11-11)
- Migration 20261111000200_showcase_search_relevance.sql pushed. search_showcase keeps its signature, so no app code changed. New: relevance ranking (exact name > prefix > word > substring > category > tag > gallery > url, +30 for staff picks);
  accent-insensitive (unaccent via new `name_norm`/`url_norm` columns kept by trigger showcase_items_set_norm, backfilled); category and synonym matching
  (table showcase_search_synonyms, ~150 terms, RLS public read: "restaurant"/"cafe" -> food, "store" -> shop, "crypto" -> web3 ...; edit rows to add more);
  typo tolerance ("resturant" -> Restaurant sites, "crypo" -> Cryptogram) that only runs when the normal match finds nothing. Every word must still match (AND).
- Tested in a rolled-back transaction, then live: restaurant 472, store 828, portfolio 1,774, minimal 2,146, resturant 5. Timing live (60 rows): 150-290 ms for searches, 99 ms for the empty query (was ~24 ms),
  vs ~90 ms before; public JSON is edge-cached 10 min. Possible later speed-up: skip the match step when the query is empty.
- Known gaps: transposition typos ("crpyto") miss (trigram only); tags are almost empty (201 of 12,308 sites), so tag search adds little until step 3. Not committed; lint/typecheck/build not run (no TS change). Rollback: re-create search_showcase from 20261111000100.

### Resume here (2026-11-11, end of session)
- Shipped and committed (14bc4c3 + this entry, pushed to main): 1,494 staff picks (the "top" view = staff picks only), search v2 (relevance, accents, synonyms, typo tolerance), both migrations live.
  Hidden rows stay hidden, not deleted: the refresh's `on conflict (name, url) do nothing` would re-add deleted ones (a blocklist table, step 4, is needed before any delete).
- Open, in order:
  1. 2026-11-12 03:00 UTC showcase-refresh check (Sonnet, read-only). The 11-11 run was skipped (HTTP 429, 12 h limit after the manual call on 11-10). Query:
     `select id, ran_at, report from showcase_refresh_runs order by ran_at desc limit 8` via the CLI from C:\Projects with `--workdir C:/Projects/ref-index --project-ref kolzsxfgqodulzteocnd`.
     Answer: The FWA / Lapa Ninja "off"? slice 3 WORKER_RESOURCE_LIMIT (a bare `{"slice": 3}` report)? Land-book 403? Admire The Web 0 read? Do NOT call slices manually before then.
  2. Step 3 tags (Opus: taxonomy and quality judgment). Plan: new `styles text[]` column (style, layout, colour) next to `categories`; extend scripts/ai-categorize.ts (Message Batches, ANTHROPIC_API_KEY in .env.local);
     run on the 1,494 picks first (a few dollars), review 50, then decide on the other ~10,800; add style words to showcase_search_synonyms; filter chips in the UI. Spend only after the owner says go.
  3. Step 4 refresh fixes: blocklist table, cron overrides the 12 h limit, split slice 3, replace Land-book / Admire The Web. Optional: speed up the empty query (99 ms, was 24 ms).
- Undo files (gitignored, on this disk): tmp/best-of/undo-staff-pick.sql, unpick-6.sql, shortlist.json. Rollback of the top rule / search: re-create the functions from migrations 20261106000100 / 20261029000500 / 20261029000700.
- Owner decisions still open: copy C:\Projects\ref-index-backup-2026-11-05 off this disk; disable the PC job after 3 good CI runs (ask first). docs/oracle/ and .claude/ are untracked and not from this work.
- No background jobs or scheduled retries are running. Not run this session: `pnpm build`, browser check of the live site.
