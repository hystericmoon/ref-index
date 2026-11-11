-- The "top" view now lists staff picks only (was: staff picks or sites in 2+ galleries).
-- Search, the view counts and the category counts all use the same rule.
-- search_showcase body is otherwise unchanged from 20261106000100.

create or replace function public.search_showcase(
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
  staff_pick boolean, gallery_count int, categories text[], featured jsonb, total bigint,
  thumb_is_share_image boolean
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
            else not (i.thumb_checked_at is not null and i.thumb_path is null) and i.staff_pick
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
         count(*) over (),
         m.thumb_is_share_image
  from matches m
  order by m.staff_pick desc, (m.thumb_path is null), m.gallery_count desc, m.first_seen desc, m.created_at desc, m.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 60), 1), 120);
$$;
grant execute on function public.search_showcase(text, text, text, int, int, text, text) to anon, authenticated;

create or replace function public.showcase_view_counts()
returns table (top bigint, everything bigint, archive bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where not dead and staff_pick),
    count(*) filter (where not dead),
    count(*) filter (where dead)
  from (
    select staff_pick, (thumb_checked_at is not null and thumb_path is null) as dead
    from public.showcase_items where status = 'listed'
  ) i;
$$;
grant execute on function public.showcase_view_counts() to anon, authenticated;

create or replace function public.showcase_category_counts()
returns table (category text, top bigint, everything bigint, archive bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c,
         count(*) filter (where not dead and staff_pick),
         count(*) filter (where not dead),
         count(*) filter (where dead)
  from (
    select categories, staff_pick, (thumb_checked_at is not null and thumb_path is null) as dead
    from public.showcase_items where status = 'listed'
  ) i, unnest(i.categories) c
  group by c;
$$;
grant execute on function public.showcase_category_counts() to anon, authenticated;
