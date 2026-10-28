# Session plan

Ten sessions, one milestone each. Start every session fresh (`/clear` or a new
session), paste its prompt, and let it end with a commit and a progress entry.
The next session picks up from `docs/progress.md`, not from chat history.

## How this saves tokens
- **Fresh context per session.** Long chats re-send everything each turn. A new session
  starts with only `CLAUDE.md` (kept short on purpose) plus the files the task touches.
- **Memory lives in files.** `docs/progress.md` carries decisions forward in a few lines,
  so nothing needs re-explaining.
- **Scoped prompts.** Each prompt names the files and the done criteria, so Claude
  doesn't explore the repo to work out what you mean.
- **Plan first on big sessions** (marked ◆): use plan mode, approve the plan, then build.
  A wrong turn caught in a plan costs far less than one caught in code.
- **Model choice.** Use the stronger model for ◆ sessions (schema, search, architecture)
  and a faster one for UI-assembly sessions.
- **Mid-session:** if a session runs long, `/compact` before switching sub-tasks.
  Don't paste large logs; paste the error line and the file path.

## Status
| # | Session | Status |
|---|---|---|
| 0 | Scaffold and deploy | ✅ |
| 1 | ◆ Database schema and seed | ✅ |
| 2 | Auth | ◐ Google sign-in works; sign-out and magic link not yet tested |
| 3 | ◆ Upload pipeline | ☐ |
| 4 | Library grid | ☐ |
| 5 | Tagging UI | ☐ |
| 6 | ◆ Search and filters | ☐ |
| 7 | Screen viewer and flows | ☐ |
| 8 | Directory and site thumbnails | ☐ |
| 9 | Accessibility, performance, launch | ☐ |

---

## 0 · Scaffold and deploy
**Before:** create a Supabase project and a Vercel account; have the project URL and
publishable key (sb_publishable_…) ready.

```
Session 0 from docs/sessions.md. Scaffold the app: Next.js App Router + TypeScript
(strict), Tailwind, shadcn/ui (init + button, input, dialog, dropdown-menu, sheet,
toast, command, toggle-group, badge, skeleton), pnpm, ESLint, a `typecheck` script.
Add the Supabase client helpers in src/lib/supabase (server and browser) and
.env.example using NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
(Supabase's current publishable key, not the legacy anon key). Light/dark theme with
a toggle. A placeholder home page with the app name. We're on Windows: use the hosted
Supabase project only (no Docker/local DB) and install the Supabase CLI as a dev
dependency. git init, commit, and push to GitHub repo ref-index. Don't build features.
Done when: dev, lint, typecheck and build pass. Then commit and update docs/progress.md.
```
After: connect the repo to Vercel and add the env vars.

## 1 · ◆ Database schema and seed
```
Session 1. Use plan mode first. Read docs/brief.md (Data model, Starter taxonomy).
Write the Supabase migrations: all tables, foreign keys, indexes, RLS policies
(owner-only for library tables; public read for sources, facets, tags), the
search_vector column with a trigger that includes tag labels and synonyms, and
pg_trgm indexes. Seed facets and tags from the taxonomy, and seed sources from
docs/sources.json. Generate TypeScript types into src/lib/db/types.ts.
Add typed query helpers in src/lib/db for each table (no UI).
Done when: `supabase db push` applies cleanly to the hosted project and an RLS test shows user A can't read
user B's screens. Commit and update progress.
```

## 2 · Auth
```
Session 2. Supabase Auth with email magic link and Google. Sign-in page, sign-out,
middleware that protects /library/*, and a minimal account menu in the header.
The directory (/) stays public. Use shadcn components.
Done when: sign in → /library shows an empty state, sign out works, protected routes
redirect. Commit and update progress.
```

## 3 · ◆ Upload pipeline
```
Session 3. Use plan mode first. Build /library/upload: drag-and-drop multiple images
(PNG/JPG/WebP, max 10 MB each), per-file progress, choose or create an app
(name + platform), optional flow. On the server: store the original in the `screens`
bucket, generate a 480px WebP thumbnail with sharp, save width/height, insert the
screens rows. Failed files show a reason and a retry; the rest still upload.
Done when: 10 images upload in one go and appear in the screens table with thumbnails.
Commit and update progress.
```

## 4 · Library grid
```
Session 4. Build /library: a masonry grid of the user's screen thumbnails (CSS
columns or a light library), fixed aspect-ratio boxes from stored width/height so
nothing shifts, lazy-loaded images, cursor-based infinite scroll (40 per page),
skeletons while loading, and an empty state with an upload button. Each card shows
the app name on hover/focus and is a link to the screen.
Done when: 200 seeded screens scroll smoothly with no layout shift. Commit and update progress.
```

## 5 · Tagging UI
```
Session 5. Tag editing: a combobox (shadcn Command) grouped by facet, with type-to-
filter and "create tag" inside a chosen facet. Use it on the upload form (apply to
all files) and in a bulk-select mode on the grid (shift-click / checkbox select, then
add or remove tags). Optimistic updates with rollback on error.
Done when: tagging 20 screens at once works by mouse and keyboard only. Commit and update progress.
```

## 6 · ◆ Search and filters
```
Session 6. Use plan mode first. Add search and faceted filters to /library. A
sidebar (sheet below md) lists facets with tag counts; selecting tags ANDs across
facets and ORs within a facet. The search box queries search_vector, with pg_trgm
fallback for typos. All state lives in searchParams. Put the query in one Postgres
function (RPC) so filters, search and pagination stay in a single round trip.
Done when: "iOS + fintech + paywall" returns correct results in under 300 ms on 1,000
seeded screens, and the URL reproduces the view. Commit and update progress.
```

## 7 · Screen viewer and flows
```
Session 7. /library/screens/[id] as an intercepting-route modal over the grid (full
page on direct visit): large image, app, tags (editable), notes, flows it belongs to.
Left/right arrows move through the current result set; Esc closes; focus returns to
the card. Flows: /library/flows/[id] shows an ordered horizontal strip with
drag-to-reorder and add/remove screens.
Done when: viewer is keyboard-complete and screen-reader labelled. Commit and update progress.
```

## 8 · Directory and site thumbnails
```
Session 8. Rebuild the public directory at / from the sources table, matching the
prototype's behavior: one search box, medium filter, "only sites that take a search
term", and per-site deep links built from url_template ({q} = encoded, {slug} =
hyphenated), with "Unconfirmed" on unconfirmed links. Then write
scripts/capture-sources.ts: Playwright visits each home_url at 1440×900, saves a WebP
homepage screenshot to storage, and sets sources.thumb_path. Run it locally.
Only homepages; never crawl or save gallery content.
Also seed showcase_items from docs/showcase.json and add a Showcase view matching the
prototype (search, medium filter, gallery filter, featured-on credits). Add
scripts/refresh-showcase.ts that re-reads each gallery's first listing page, adds new
names/links with first_seen, and never deletes.
Done when: directory matches the prototype and shows thumbnails. Commit and update progress.
```

## 9 · Accessibility, performance, launch
```
Session 9. Audit and fix: WCAG 2.2 AA contrast in both themes, keyboard paths
through every screen, focus visibility, alt text strategy for screenshots (app name +
screen type), 44px touch targets, reduced motion. Run Lighthouse on /, /library and
the viewer; fix anything under 90. Add metadata and OG images for the directory.
Deploy to production.
Done when: all fixes committed, scores recorded in progress.md, production URL works.
```
