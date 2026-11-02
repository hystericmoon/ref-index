-- Entries can carry tags and a category from galleries whose sections already say what a site is
-- (Style UI: "ui library" → ui-kit, "design tool" → design-tools). New items get them on insert;
-- existing ones gain any that are missing, unless an editor set the categories by hand.
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
  e_tags text[];
  e_categories text[];
begin
  for e in select * from jsonb_array_elements(entries) loop
    item := null;
    e_tags := coalesce(array(select jsonb_array_elements_text(e->'tags')), '{}');
    e_categories := case when nullif(e->>'category', '') is null then '{}' else array[e->>'category'] end;
    if nullif(e->>'url', '') is not null then
      select i.id into item from public.showcase_items i where lower(i.url) = lower(e->>'url') limit 1;
    end if;
    if item is null then
      select i.id into item from public.showcase_items i where lower(i.name) = lower(e->>'name') limit 1;
    end if;
    if item is null then
      insert into public.showcase_items (name, url, platform, tags, categories)
      values (e->>'name', nullif(e->>'url', ''), coalesce(e->>'platform', 'web'), e_tags, e_categories)
      on conflict (name, url) do nothing
      returning id into item;
      if item is null then continue; end if;
      items_added := items_added + 1;
    elsif cardinality(e_tags) > 0 or cardinality(e_categories) > 0 then
      update public.showcase_items i
      set tags = array(select distinct unnest(i.tags || e_tags)),
          categories = case when i.categories_set_at is null
                            then array(select distinct unnest(i.categories || e_categories))
                            else i.categories end
      where i.id = item
        and (not i.tags @> e_tags or (i.categories_set_at is null and not i.categories @> e_categories));
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
