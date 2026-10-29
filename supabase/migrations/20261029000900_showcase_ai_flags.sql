-- The AI pass flags screenshots that look broken (error, blank, placeholder, parked) or low quality.
-- Flags only send a site to the editor's "Flagged" queue; nothing is hidden without an editor.

alter table public.showcase_items
  add column ai_flag text check (ai_flag in ('broken', 'low_quality')),
  add column ai_checked_at timestamptz;

drop function public.showcase_review_queue(int);

-- p_queue: 'new' = unreviewed sites with a screenshot, most-featured first;
-- 'flagged' = unreviewed sites the AI flagged, broken first.
create function public.showcase_review_queue(p_limit int default 24, p_queue text default 'new')
returns table (
  id uuid, name text, url text, platform text, thumb_path text, gallery_count int,
  galleries text[], categories text[], ai_flag text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id, i.name, i.url, i.platform, i.thumb_path, i.gallery_count,
         array(select f.gallery from public.showcase_features f where f.item_id = i.id order by f.gallery),
         i.categories, i.ai_flag
  from public.showcase_items i
  where i.reviewed_at is null and i.status = 'listed' and i.thumb_path is not null
    and (case when p_queue = 'flagged' then i.ai_flag is not null else true end)
  order by case when p_queue = 'flagged' then i.ai_flag = 'broken' end desc nulls last,
           i.gallery_count desc, i.first_seen desc, i.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100);
$$;
grant execute on function public.showcase_review_queue(int, text) to authenticated;

-- How many unreviewed sites wait in each queue.
create function public.showcase_queue_counts()
returns table (new bigint, flagged bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*), count(*) filter (where ai_flag is not null)
  from public.showcase_items
  where reviewed_at is null and status = 'listed' and thumb_path is not null;
$$;
grant execute on function public.showcase_queue_counts() to authenticated;
