-- Editors can set an item's categories in /curate. Their choice is kept: the sorting scripts
-- only touch items whose categories_set_at is null.

alter table public.showcase_items add column categories_set_at timestamptz;

create function public.set_showcase_categories(p_id uuid, p_categories text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_editor() then
    raise exception 'Only editors can categorize the showcase' using errcode = '42501';
  end if;
  if cardinality(p_categories) > 6 or exists (select 1 from unnest(p_categories) c where c !~ '^[a-z0-9]{1,20}$') then
    raise exception 'Invalid categories' using errcode = '22023';
  end if;
  update public.showcase_items
  set categories = p_categories, categories_set_at = now()
  where id = p_id;
end;
$$;
revoke execute on function public.set_showcase_categories(uuid, text[]) from public, anon;
grant execute on function public.set_showcase_categories(uuid, text[]) to authenticated;

drop function public.showcase_review_queue(int);

create function public.showcase_review_queue(p_limit int default 24)
returns table (id uuid, name text, url text, platform text, thumb_path text, gallery_count int, galleries text[], categories text[])
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id, i.name, i.url, i.platform, i.thumb_path, i.gallery_count,
         array(select f.gallery from public.showcase_features f where f.item_id = i.id order by f.gallery),
         i.categories
  from public.showcase_items i
  where i.reviewed_at is null and i.status = 'listed' and i.thumb_path is not null
  order by i.gallery_count desc, i.first_seen desc, i.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100);
$$;
grant execute on function public.showcase_review_queue(int) to authenticated;
