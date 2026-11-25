-- One row per detail screenshot of a showcase item (the full home page at position 0, then the
-- inner pages), so each page can be tagged by page type and design pattern.
-- Backfilled from showcase_items.details ({"full": ..., "pages": [{path,url,title}]}), which stays.

create table public.showcase_pages (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.showcase_items(id) on delete cascade,
  position int not null,
  path text not null,
  url text,
  title text,
  page_type text check (page_type in (
    'home', 'about', 'work-index', 'case-study', 'pricing', 'features', 'services',
    'shop', 'product-detail', 'blog-index', 'article', 'team', 'careers', 'contact',
    'menu', 'event', 'gallery', 'collection', 'other')),
  patterns text[] not null default '{}',
  tagged_at timestamptz,
  unique (item_id, position)
);
create index showcase_pages_type_idx on public.showcase_pages (page_type);
create index showcase_pages_item_idx on public.showcase_pages (item_id);

alter table public.showcase_pages enable row level security;
revoke all on public.showcase_pages from anon, authenticated;
grant select on public.showcase_pages to anon, authenticated;
create policy "Anyone can read showcase pages" on public.showcase_pages
  for select to anon, authenticated using (true);

insert into public.showcase_pages (item_id, position, path, url, title, page_type, tagged_at)
select s.id, 0, s.details->>'full', s.url, null, 'home', now()
from public.showcase_items s
where s.status = 'listed' and s.details->>'full' is not null
on conflict do nothing;

insert into public.showcase_pages (item_id, position, path, url, title)
select s.id, p.ord::int, p.page->>'path', p.page->>'url', p.page->>'title'
from public.showcase_items s,
  jsonb_array_elements(s.details->'pages') with ordinality as p(page, ord)
where s.status = 'listed'
on conflict do nothing;
