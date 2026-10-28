-- Showcase search for the directory now that it holds ~21k items: filtering and paging
-- happen in the database instead of shipping the whole list to the browser.

create index showcase_items_name_trgm_idx on public.showcase_items using gin (name extensions.gin_trgm_ops);
create index showcase_items_url_trgm_idx on public.showcase_items using gin (url extensions.gin_trgm_ops);
create index showcase_items_platform_idx on public.showcase_items (platform);
create index showcase_items_order_idx on public.showcase_items (first_seen desc, created_at desc, id);

-- One page of items. Every word must appear in the name, address, a tag or a gallery
-- name. p_medium: all | web | 3d | mobile (ios, android, mobile). `total` is the match count.
create or replace function public.search_showcase(
  p_query text default null,
  p_medium text default 'all',
  p_gallery text default null,
  p_offset int default 0,
  p_limit int default 60
)
returns table (id uuid, name text, url text, platform text, tags text[], featured jsonb, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    select w from unnest(regexp_split_to_array(lower(btrim(coalesce(p_query, ''))), '\s+')) w where w <> ''
  ),
  matches as (
    select i.*
    from public.showcase_items i
    where (coalesce(p_medium, 'all') = 'all'
           or (p_medium = 'mobile' and i.platform in ('ios', 'android', 'mobile'))
           or i.platform = p_medium)
      and (nullif(p_gallery, '') is null
           or exists (select 1 from public.showcase_features f where f.item_id = i.id and f.gallery = p_gallery))
      and not exists (
        select 1 from words
        where not (
          lower(i.name) like '%' || w || '%'
          or lower(coalesce(i.url, '')) like '%' || w || '%'
          or exists (select 1 from unnest(i.tags) t where lower(t) like '%' || w || '%')
          or exists (select 1 from public.showcase_features f where f.item_id = i.id and lower(f.gallery) like '%' || w || '%')
        )
      )
  )
  select m.id, m.name, m.url, m.platform, m.tags,
         coalesce((select jsonb_agg(jsonb_build_object('gallery', f.gallery, 'sourceUrl', f.source_url) order by f.first_seen, f.gallery)
                   from public.showcase_features f where f.item_id = m.id), '[]'::jsonb),
         count(*) over ()
  from matches m
  order by m.first_seen desc, m.created_at desc, m.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 60), 1), 120);
$$;

-- Items per gallery, for the "Featured on" filter.
create or replace function public.showcase_gallery_counts()
returns table (gallery text, items bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.gallery, count(*) from public.showcase_features f group by f.gallery order by f.gallery;
$$;

grant execute on function public.search_showcase(text, text, text, int, int) to anon, authenticated;
grant execute on function public.showcase_gallery_counts() to anon, authenticated;
