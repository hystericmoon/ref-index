-- Detail captures for showcase items (scripts/capture-details.ts): a full-page screenshot of the
-- home page and up to three inner pages, shown on the site's detail page.
-- details: {"full": "img/details/<id>/full.webp", "fullHeight": 4200,
--           "pages": [{"path": "img/details/<id>/page-1.webp", "url": "https://…", "title": "Work"}]}
alter table public.showcase_items
  add column details jsonb,
  add column details_checked_at timestamptz;
