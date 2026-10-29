-- Categories for showcase items: the kind of site (portfolio, agency, product…) and its field
-- (AI, finance, food…). Ids match src/lib/categories.ts; scripts/categorize-showcase.ts fills them.

alter table public.showcase_items add column categories text[] not null default '{}';
create index showcase_items_categories_idx on public.showcase_items using gin (categories);

drop function public.search_showcase(text, text, text, int, int, text);

create function public.search_showcase(
  p_query text default null,
  p_medium text default 'all',
  p_gallery text default null,
  p_offset int default 0,
  p_limit int default 60,
  p_view text default 'top',
  p_category text default null
)
returns table (
  id uuid, name text, url text, platform text, tags text[], thumb_path text,
  staff_pick boolean, gallery_count int, categories text[], featured jsonb, total bigint
)
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
    where i.status = 'listed'
      and case coalesce(p_view, 'top')
            when 'archive' then i.thumb_checked_at is not null and i.thumb_path is null
            when 'all' then not (i.thumb_checked_at is not null and i.thumb_path is null)
            else not (i.thumb_checked_at is not null and i.thumb_path is null) and (i.staff_pick or i.gallery_count >= 2)
          end
      and (coalesce(p_medium, 'all') = 'all'
           or (p_medium = 'mobile' and i.platform in ('ios', 'android', 'mobile'))
           or i.platform = p_medium)
      and (nullif(p_category, '') is null or i.categories @> array[p_category])
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
  select m.id, m.name, m.url, m.platform, m.tags, m.thumb_path, m.staff_pick, m.gallery_count, m.categories,
         coalesce((select jsonb_agg(jsonb_build_object('gallery', f.gallery, 'sourceUrl', f.source_url) order by f.first_seen, f.gallery)
                   from public.showcase_features f where f.item_id = m.id), '[]'::jsonb),
         count(*) over ()
  from matches m
  order by m.staff_pick desc, (m.thumb_path is null), m.gallery_count desc, m.first_seen desc, m.created_at desc, m.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 60), 1), 120);
$$;
grant execute on function public.search_showcase(text, text, text, int, int, text, text) to anon, authenticated;

-- How many live items each category holds, for the category chips.
create function public.showcase_category_counts()
returns table (category text, items bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c, count(*)
  from public.showcase_items i, unnest(i.categories) c
  where i.status = 'listed' and not (i.thumb_checked_at is not null and i.thumb_path is null)
  group by c;
$$;
grant execute on function public.showcase_category_counts() to anon, authenticated;
