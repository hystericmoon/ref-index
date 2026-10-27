# Ref Index: project brief

## What it is
Two things in one web app:

1. **Library (private).** A personal or team board of UI screenshots that the owner
   captures and uploads. Screens are tagged by facet, grouped into flows, and found by
   search and filters. This is the Mobbin-style part.
2. **Directory (public).** The 21 design reference sites, with one search box that
   deep-links into each site's own search, tag page or gallery. Prototype exists as a
   single HTML page; this app replaces it.

## What it is not
- It does not scrape, mirror or rehost content from the reference sites. The directory
  links out. Homepage thumbnails of the 21 sites (link-preview style) are the only images
  taken from them.
- Library content is uploaded by its owner. Library boards are private by default.

## Users
- v1: the owner (a senior product designer) and a few collaborators.
- Later, maybe: public boards and sharing. Don't build for it yet, but don't block it.

## Data model
| Table | Key fields |
|---|---|
| apps | id, name, platform (ios/android/web), industry_tag_id, website, logo_path |
| screens | id, app_id, owner_id, image_path, thumb_path, width, height, captured_at, notes, search_vector |
| flows | id, app_id, owner_id, name (e.g. "Sign up"), description |
| flow_screens | flow_id, screen_id, position |
| facets | id, key (screen_type, ui_element, pattern, platform, industry), label |
| tags | id, facet_id, slug, label, synonyms text[] |
| screen_tags | screen_id, tag_id |
| sources | id, name, home_url, mediums text[], kind (query/tag/none), url_template, confirmed bool, pricing, description, thumb_path, active |

- RLS: library rows are visible to their owner (and later, board members). `sources`,
  `facets` and `tags` are readable by everyone.
- Search: `search_vector` built from app name, notes, tag labels and synonyms. pg_trgm
  on tag labels and app names for fuzzy matching.

## Starter taxonomy (seed; editable later)
- **screen_type:** onboarding, sign up, log in, paywall, pricing, home, dashboard,
  settings, profile, checkout, cart, search, empty state, error, notifications,
  permissions prompt, splash
- **ui_element:** bottom sheet, modal, tab bar, navigation drawer, stepper, card,
  data table, chart, form, toast, segmented control, carousel, date picker, command palette
- **pattern:** progressive disclosure, social proof, inline validation, skeleton loading,
  gamification, comparison table, upsell
- **platform:** iOS, Android, web
- **industry:** fintech, e-commerce, health, social, productivity, education, travel, SaaS

## Key screens
1. Library grid: masonry of thumbnails, facet filters in a sidebar (sheet on mobile),
   search, URL-synced state, infinite scroll, real empty state with an upload CTA.
2. Upload: drag-and-drop multiple files, pick or create the app, tag in bulk.
3. Screen viewer: large image, tags, app, flows it belongs to; arrow keys move
   between screens; Esc closes.
4. Flow view: ordered horizontal strip of screens.
5. Directory: the 21 sources, search box, medium filter, deep links.

## Showcase data
`docs/showcase.json`: 414 websites and apps featured by 13 galleries (latest picks,
October 2026). Fields: name, url (live site, null when the gallery hides it), platform
(web/3d/ios/mobile), tags, featured [{g: gallery, src: gallery page}]. Seed it into a
`showcase_items` table with a `showcase_features` join (item, gallery, source_url,
first_seen). Store names, links and labels only; never copy gallery screenshots or
descriptions.

## Source data for the directory
21 sites, with search patterns checked in October 2026: `docs/sources.json`.
`{q}` = URL-encoded query, `{slug}` = lowercase hyphenated query. `confirmed: false`
means the pattern is standard but the site blocked automated checks. UI Garage is
closed and excluded.

## Quality bar
- WCAG 2.2 AA, keyboard complete, visible focus, screen-reader labels on image buttons
- Grid stays smooth with 1,000+ thumbnails (lazy loading, fixed aspect boxes, no layout shift)
- Light and dark themes
