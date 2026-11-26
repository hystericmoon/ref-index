-- New sites found by the daily refresh start hidden until they are curated (notes, details, tags).
-- Unhide one with the curation action (status back to 'listed'). Existing items keep their status.

create or replace function public.add_showcase_entries(entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e jsonb;
  item uuid;
  items_added int := 0;
  credits_added int := 0;
  n int;
begin
  for e in select * from jsonb_array_elements(entries) loop
    if exists (
      select 1 from public.showcase_blocklist b
      where (b.url is not null and lower(b.url) = lower(coalesce(e->>'url', '')))
         or (b.name is not null and lower(b.name) = lower(e->>'name'))
    ) then
      continue;
    end if;
    item := null;
    if nullif(e->>'url', '') is not null then
      select i.id into item from public.showcase_items i where lower(i.url) = lower(e->>'url') limit 1;
    end if;
    if item is null then
      select i.id into item from public.showcase_items i where lower(i.name) = lower(e->>'name') limit 1;
    end if;
    if item is null then
      insert into public.showcase_items (name, url, platform, status)
      values (e->>'name', nullif(e->>'url', ''), coalesce(e->>'platform', 'web'), 'hidden')
      on conflict (name, url) do nothing
      returning id into item;
      if item is null then continue; end if;
      items_added := items_added + 1;
    end if;
    insert into public.showcase_features (item_id, gallery, source_url)
    values (item, e->>'gallery', e->>'src')
    on conflict (item_id, gallery) do nothing;
    get diagnostics n = row_count;
    credits_added := credits_added + n;
  end loop;
  return jsonb_build_object('items_added', items_added, 'credits_added', credits_added);
end;
$$;

revoke execute on function public.add_showcase_entries(jsonb) from public, anon, authenticated;
grant execute on function public.add_showcase_entries(jsonb) to service_role;

update public.showcase_items i set status = 'hidden'
where i.status = 'listed' and i.staff_pick = false and i.first_seen = date '2026-11-26'
  and not exists (select 1 from public.showcase_designs d where d.item_id = i.id);
