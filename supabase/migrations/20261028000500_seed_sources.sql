-- The 21 directory sources from docs/sources.json (October 2026). Reruns skip existing rows.

insert into public.sources (name, home_url, mediums, kind, url_template, confirmed, pricing, description, sort_order) values
  ('Dribbble', 'https://dribbble.com/tags/website', array['web']::text[], 'query', 'https://dribbble.com/search/{slug}', false, 'Free, Pro tier', 'Community UI shots, web themes and templates.', 0),
  ('Behance', 'https://www.behance.net/', array['web']::text[], 'query', 'https://www.behance.net/search/projects?search={q}', false, 'Free', 'Full creative portfolios and web design case studies.', 1),
  ('Land-book', 'https://land-book.com/', array['web']::text[], 'tag', 'https://land-book.com/design/{slug}', true, 'Free, Pro from $6/mo', 'Curated landing pages, portfolios and blog designs.', 2),
  ('Godly', 'https://godly.design/websites/', array['web', 'motion']::text[], 'none', null, true, 'Free', 'Daily picks of agency, portfolio and e-commerce sites, with hero, CTA and footer sections.', 3),
  ('SiteInspire', 'https://www.siteinspire.com/', array['web']::text[], 'tag', 'https://www.siteinspire.com/websites/category/{slug}', true, 'Free', 'Clean, minimal, refined web design showcase.', 4),
  ('Minimal Gallery', 'https://minimal.gallery/websites/', array['web']::text[], 'tag', 'https://minimal.gallery/tag/{slug}/', true, 'Free', 'Hand-picked minimalist websites.', 5),
  ('Httpster', 'https://httpster.net/', array['web']::text[], 'none', null, true, 'Free', 'Typographic, minimal and brutalist web projects.', 6),
  ('One Page Love', 'https://onepagelove.com/', array['web']::text[], 'query', 'https://onepagelove.com/?s={q}', false, 'Free, paid templates', 'Single-page sites and landing layouts, browsable by section like pricing or FAQ.', 7),
  ('CSS Design Awards', 'https://www.cssdesignawards.com/wotd-award-winners', array['web']::text[], 'query', 'https://www.cssdesignawards.com/search?search_term={q}', true, 'Free to browse', 'Award-winning sites judged on UI, UX and innovation.', 8),
  ('Brutalist Websites', 'https://brutalistwebsites.com/', array['web']::text[], 'none', null, true, 'Free', 'Bold, unconventional web designs. No longer updated.', 9),
  ('Awwwards', 'https://www.awwwards.com/websites/sites_of_the_day/', array['motion', 'web']::text[], 'query', 'https://www.awwwards.com/inspiration_search/?text={q}', false, 'Free, Pro tier', 'WebGL projects, interactive animation and Site of the Day winners.', 10),
  ('Codrops', 'https://tympanus.net/codrops/', array['motion']::text[], 'query', 'https://tympanus.net/codrops/?s={q}', false, 'Free', 'Interactive UI experiments, front-end tutorials and creative coding demos.', 11),
  ('Three.js examples', 'https://threejs.org/examples/', array['motion']::text[], 'query', 'https://threejs.org/examples/?q={q}', true, 'Free', 'Interactive 3D and WebGL examples. Filters by example name, so technical terms work best.', 12),
  ('Appshots', 'https://appshots.design/', array['mobile']::text[], 'none', null, false, 'Free', 'Real iOS and Android screenshots from the App Store.', 13),
  ('Banani References', 'https://www.banani.co/references', array['mobile']::text[], 'tag', 'https://www.banani.co/references/screens/{slug}', false, 'Free library', 'Screens and flows from apps like Duolingo, Airbnb and Pinterest.', 14),
  ('Page Flows', 'https://pageflows.com/mobile-app-design/', array['mobile', 'web']::text[], 'none', null, false, 'Paid, 5-day trial', 'Recorded user flows and onboarding on iOS, Android and web. Search is inside the app.', 15),
  ('LaudableApps', 'https://laudableapps.com/', array['mobile']::text[], 'none', null, true, 'Free', 'Clean, independent iOS app interfaces.', 16),
  ('Collect UI', 'https://collectui.com/', array['mobile', 'web']::text[], 'tag', 'https://collectui.com/challenges/{slug}', true, 'Free', 'Daily UI shots sorted by feature, like checkout, profile or sign up.', 17),
  ('AppShot Gallery', 'https://www.appshot.gallery/', array['mobile']::text[], 'tag', 'https://www.appshot.gallery/keyword/{slug}', true, 'Free', 'App Store screenshot designs, filterable by keyword, tone, color and font.', 18),
  ('Apple Design Awards', 'https://developer.apple.com/design/awards/', array['mobile']::text[], 'none', null, true, 'Free', 'Apple''s yearly picks for app design, visuals and delight.', 19),
  ('Dribbble Mobile', 'https://dribbble.com/search/mobile-app', array['mobile']::text[], 'query', 'https://dribbble.com/search/shots/popular/mobile?q={q}', false, 'Free, Pro tier', 'Polished mobile app concepts and motion previews.', 20)
on conflict (name) do nothing;
