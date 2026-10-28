-- Library search and filters in one round trip.
--
-- Tag filters AND across facets and OR within a facet. A platform tag (ios/android/web)
-- also matches screens whose app has that platform, so "iOS" works without tagging
-- every screen. Text search uses search_vector, plus trigram similarity on the app name
-- and the screen's tag labels so typos still find things. security invoker: RLS decides
-- whose screens are visible.

create or replace function public.search_screens(
  p_tag_ids uuid[] default '{}',
  p_query text default null,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 40
)
returns table (
  id uuid,
  app_id uuid,
  app_name text,
  app_platform text,
  image_path text,
  thumb_path text,
  width int,
  height int,
  captured_at timestamptz,
  tag_ids uuid[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with selected as (
    select t.id, t.facet_id, t.slug, f.key
    from public.tags t
    join public.facets f on f.id = t.facet_id
    where t.id = any (coalesce(p_tag_ids, '{}'))
  ),
  wanted as (
    select count(distinct facet_id) as facets from selected
  ),
  q as (
    select nullif(btrim(p_query), '') as text,
           websearch_to_tsquery('english', coalesce(nullif(btrim(p_query), ''), '')) as ts
  )
  select s.id, s.app_id, a.name, a.platform, s.image_path, s.thumb_path, s.width, s.height, s.captured_at,
         array(select st.tag_id from public.screen_tags st where st.screen_id = s.id)
  from public.screens s
  join public.apps a on a.id = s.app_id
  cross join wanted
  cross join q
  where
    (
      wanted.facets = 0
      or (
        select count(distinct sel.facet_id)
        from selected sel
        where (sel.key = 'platform' and sel.slug = a.platform)
           or exists (select 1 from public.screen_tags st where st.screen_id = s.id and st.tag_id = sel.id)
      ) = wanted.facets
    )
    and (
      q.text is null
      or s.search_vector @@ q.ts
      or extensions.word_similarity(lower(q.text), lower(a.name)) >= 0.5
      or exists (
        select 1
        from public.screen_tags st
        join public.tags t on t.id = st.tag_id
        where st.screen_id = s.id and extensions.word_similarity(lower(q.text), lower(t.label)) >= 0.5
      )
    )
    and (p_before_at is null or (s.captured_at, s.id) < (p_before_at, p_before_id))
  order by s.captured_at desc, s.id desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

-- How many of the user's screens carry each tag (platform tags also count app platforms).
create or replace function public.screen_tag_counts()
returns table (tag_id uuid, screens bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select tag_id, sum(n)::bigint
  from (
    select st.tag_id, count(*) as n from public.screen_tags st group by st.tag_id
    union all
    select t.id, count(*)
    from public.screens s
    join public.apps a on a.id = s.app_id
    join public.tags t on t.slug = a.platform
    join public.facets f on f.id = t.facet_id and f.key = 'platform'
    where not exists (select 1 from public.screen_tags st where st.screen_id = s.id and st.tag_id = t.id)
    group by t.id
  ) counts
  group by tag_id;
$$;

revoke execute on function public.search_screens(uuid[], text, timestamptz, uuid, int) from public, anon;
revoke execute on function public.screen_tag_counts() from public, anon;
grant execute on function public.search_screens(uuid[], text, timestamptz, uuid, int) to authenticated;
grant execute on function public.screen_tag_counts() to authenticated;
