-- screens.search_vector: app name (A), tag labels (B), tag synonyms (C), notes (D).
-- Text search config is 'english'; queries must use the same config.
-- Functions live in a schema the Data API doesn't expose.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.screen_search_vector(p_app_id uuid, p_screen_id uuid, p_notes text)
returns tsvector
language sql
stable
security definer
set search_path = ''
as $$
  select
    setweight(to_tsvector('english', coalesce((select a.name from public.apps a where a.id = p_app_id), '')), 'A')
    || setweight(to_tsvector('english', coalesce((
      select string_agg(t.label, ' ')
      from public.screen_tags st join public.tags t on t.id = st.tag_id
      where st.screen_id = p_screen_id
    ), '')), 'B')
    || setweight(to_tsvector('english', coalesce((
      select string_agg(array_to_string(t.synonyms, ' '), ' ')
      from public.screen_tags st join public.tags t on t.id = st.tag_id
      where st.screen_id = p_screen_id
    ), '')), 'C')
    || setweight(to_tsvector('english', coalesce(p_notes, '')), 'D');
$$;

create function private.refresh_screen_search_vectors(p_screen_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.screens s
  set search_vector = private.screen_search_vector(s.app_id, s.id, s.notes)
  where s.id = any (p_screen_ids);
$$;

-- screens: compute on insert and when app or notes change.
create function private.screens_set_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.search_vector := private.screen_search_vector(new.app_id, new.id, new.notes);
  return new;
end;
$$;

create trigger screens_set_search_vector
before insert or update of app_id, notes on public.screens
for each row execute function private.screens_set_search_vector();

-- screen_tags: a tag added or removed changes the screen's text.
create function private.screen_tags_refresh_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_screen_search_vectors(array[coalesce(new.screen_id, old.screen_id)]);
  return null;
end;
$$;

create trigger screen_tags_refresh_search_vector
after insert or delete on public.screen_tags
for each row execute function private.screen_tags_refresh_search_vector();

-- apps: renaming an app changes all of its screens.
create function private.apps_refresh_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_screen_search_vectors(
    array(select s.id from public.screens s where s.app_id = new.id)
  );
  return null;
end;
$$;

create trigger apps_refresh_search_vector
after update of name on public.apps
for each row when (old.name is distinct from new.name)
execute function private.apps_refresh_search_vector();

-- tags: editing a label or synonyms changes every screen carrying the tag.
create function private.tags_refresh_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_screen_search_vectors(
    array(select st.screen_id from public.screen_tags st where st.tag_id = new.id)
  );
  return null;
end;
$$;

create trigger tags_refresh_search_vector
after update of label, synonyms on public.tags
for each row when (old.label is distinct from new.label or old.synonyms is distinct from new.synonyms)
execute function private.tags_refresh_search_vector();

revoke all on all functions in schema private from public, anon, authenticated;
