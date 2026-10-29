-- Category counts per public view, so each chip shows what it will list in the view picked.
drop function public.showcase_category_counts();

create function public.showcase_category_counts()
returns table (category text, top bigint, everything bigint, archive bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c,
         count(*) filter (where not dead and (staff_pick or gallery_count >= 2)),
         count(*) filter (where not dead),
         count(*) filter (where dead)
  from (
    select categories, staff_pick, gallery_count, (thumb_checked_at is not null and thumb_path is null) as dead
    from public.showcase_items where status = 'listed'
  ) i, unnest(i.categories) c
  group by c;
$$;
grant execute on function public.showcase_category_counts() to anon, authenticated;
