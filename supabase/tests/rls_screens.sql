-- RLS check: user A's library is invisible to user B and to anonymous visitors.
-- Runs in one transaction and rolls back, so nothing persists.
-- Run: .\node_modules\.bin\supabase db query --linked -f supabase/tests/rls_screens.sql
-- Success prints "RLS OK"; any failed check raises an exception naming it.

begin;

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-test-a@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-test-b@example.com');

-- User A builds a small library ---------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into public.apps (id, name, platform) values ('aaaaaaaa-0000-4000-8000-0000000000a1', 'Revolut', 'ios');
insert into public.screens (id, app_id, image_path, notes)
  values ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000a1', 'a/1.png', 'Balance after top-up');
insert into public.flows (id, app_id, name) values ('aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-0000000000a1', 'Log in');
insert into public.flow_screens (flow_id, screen_id, position)
  values ('aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-0000000000c1', 0);
insert into public.screen_tags (screen_id, tag_id)
  select 'aaaaaaaa-0000-4000-8000-0000000000c1', t.id from public.tags t where t.slug = 'log-in';
insert into storage.objects (bucket_id, name)
  values ('screens', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-0000000000c1.png');

do $$
declare v tsvector;
begin
  if (select count(*) from public.screens) <> 1 then raise exception 'FAIL: A should see their own screen'; end if;
  select search_vector into v from public.screens where id = 'aaaaaaaa-0000-4000-8000-0000000000c1';
  if not v @@ websearch_to_tsquery('english', 'revolut') then raise exception 'FAIL: search_vector missing app name'; end if;
  if not v @@ websearch_to_tsquery('english', 'balance') then raise exception 'FAIL: search_vector missing notes'; end if;
  if not v @@ websearch_to_tsquery('english', 'log') then raise exception 'FAIL: search_vector missing tag label'; end if;
  if not v @@ websearch_to_tsquery('english', 'signin') then raise exception 'FAIL: search_vector missing tag synonym'; end if;
end $$;

-- User B ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);

insert into public.apps (id, name, platform) values ('bbbbbbbb-0000-4000-8000-0000000000a2', 'Monzo', 'android');
insert into public.screens (app_id, image_path) values ('bbbbbbbb-0000-4000-8000-0000000000a2', 'b/1.png');

do $$
declare n int;
begin
  if (select count(*) from public.screens) <> 1 then raise exception 'FAIL: B should see only their own screen'; end if;
  if exists (select 1 from public.screens where id = 'aaaaaaaa-0000-4000-8000-0000000000c1') then raise exception 'FAIL: B can read A''s screen'; end if;
  if exists (select 1 from public.apps where id = 'aaaaaaaa-0000-4000-8000-0000000000a1') then raise exception 'FAIL: B can read A''s app'; end if;
  if exists (select 1 from public.flows) then raise exception 'FAIL: B can read A''s flow'; end if;
  if exists (select 1 from public.flow_screens) then raise exception 'FAIL: B can read A''s flow steps'; end if;
  if exists (select 1 from public.screen_tags) then raise exception 'FAIL: B can read A''s screen tags'; end if;

  update public.screens set notes = 'hijacked' where id = 'aaaaaaaa-0000-4000-8000-0000000000c1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B updated A''s screen'; end if;

  delete from public.screens where id = 'aaaaaaaa-0000-4000-8000-0000000000c1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted A''s screen'; end if;

  begin
    insert into public.screens (app_id, image_path) values ('aaaaaaaa-0000-4000-8000-0000000000a1', 'b/2.png');
    raise exception 'FAIL: B added a screen to A''s app';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.screen_tags (screen_id, tag_id)
      select 'aaaaaaaa-0000-4000-8000-0000000000c1', t.id from public.tags t where t.slug = 'paywall';
    raise exception 'FAIL: B tagged A''s screen';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.screens (app_id, owner_id, image_path)
      values ('bbbbbbbb-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000001', 'b/3.png');
    raise exception 'FAIL: B created a screen owned by A';
  exception when insufficient_privilege then null;
  end;

  if exists (select 1 from storage.objects where bucket_id = 'screens') then raise exception 'FAIL: B can list A''s screen files'; end if;

  insert into public.tags (facet_id, slug, label)
    select id, 'rls-test-tag', 'RLS test tag' from public.facets where key = 'pattern';
  if not exists (select 1 from public.tags where slug = 'rls-test-tag' and created_by = 'bbbbbbbb-0000-4000-8000-000000000002')
    then raise exception 'FAIL: B''s new tag should record B as creator'; end if;

  begin
    insert into public.tags (facet_id, slug, label, created_by)
      select id, 'rls-forged-tag', 'Forged', 'aaaaaaaa-0000-4000-8000-000000000001' from public.facets where key = 'pattern';
    raise exception 'FAIL: B created a tag in A''s name';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.tags set label = 'Renamed' where slug = 'log-in';
    raise exception 'FAIL: B renamed a shared tag';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
      values ('screens', 'aaaaaaaa-0000-4000-8000-000000000001/planted.png');
    raise exception 'FAIL: B uploaded into A''s folder';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Anonymous visitor -----------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  if (select count(*) from public.facets) <> 5 then raise exception 'FAIL: anon should read 5 facets'; end if;
  if (select count(*) from public.tags) = 0 then raise exception 'FAIL: anon should read tags'; end if;
  if (select count(*) from public.sources) <> 21 then raise exception 'FAIL: anon should read 21 sources'; end if;
  begin
    perform 1 from public.screens;
    raise exception 'FAIL: anon can query screens';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from storage.objects where bucket_id = 'screens') then raise exception 'FAIL: anon can list screen files'; end if;
  begin
    insert into public.tags (facet_id, slug, label) select id, 'anon-tag', 'Anon' from public.facets where key = 'pattern';
    raise exception 'FAIL: anon created a tag';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'RLS OK' as result;

rollback;
