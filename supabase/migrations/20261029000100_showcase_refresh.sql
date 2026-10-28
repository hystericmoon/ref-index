-- Weekly showcase refresh. The showcase-refresh Edge Function reads each gallery's newest
-- picks and passes them here. This function only adds: new items, and new gallery credits
-- for items already listed. It matches existing items by live URL, else by name.

create table public.showcase_refresh_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  report jsonb not null default '{}'
);
alter table public.showcase_refresh_runs enable row level security;
revoke all on public.showcase_refresh_runs from anon, authenticated;

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
    item := null;
    if nullif(e->>'url', '') is not null then
      select i.id into item from public.showcase_items i where lower(i.url) = lower(e->>'url') limit 1;
    end if;
    if item is null then
      select i.id into item from public.showcase_items i where lower(i.name) = lower(e->>'name') limit 1;
    end if;
    if item is null then
      insert into public.showcase_items (name, url, platform)
      values (e->>'name', nullif(e->>'url', ''), coalesce(e->>'platform', 'web'))
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

-- The weekly schedule is in supabase/schedule_showcase_refresh.sql, applied separately
-- once the owner approves a recurring job.
