-- Search check: 1,000 seeded screens, correctness against a plain query, and timing.
-- Runs in one transaction and rolls back, so nothing persists.
-- Run: .\node_modules\.bin\supabase db query --linked -f supabase/tests/search_perf.sql
-- Success returns one row of timings; any failed check raises an exception naming it.

begin;

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'search-test-c@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'search-test-d@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000003","role":"authenticated"}', true);

-- 20 apps across the three platforms; app 0 is "Revolut".
insert into public.apps (id, name, platform)
select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       case when i = 0 then 'Revolut' else 'Test app ' || i end,
       (array['ios', 'android', 'web'])[i % 3 + 1]
from generate_series(0, 19) i;

-- 1,000 screens; two screens share each timestamp so the cursor has ties to break.
insert into public.screens (id, app_id, image_path, captured_at)
select ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad((i % 20)::text, 12, '0'))::uuid,
       'seed/' || i || '.png',
       timestamptz '2026-10-01' - make_interval(mins => i / 2)
from generate_series(0, 999) i;

-- Tags: fintech on apps divisible by 4, travel on apps ≡ 1 (mod 4), paywall on every 7th
-- screen, modal on every 5th, and an explicit iOS tag on every 50th screen (some are Android).
insert into public.screen_tags (screen_id, tag_id)
select s.id, t.id
from public.screens s
join public.tags t on true
join public.facets f on f.id = t.facet_id
cross join lateral (select split_part(s.image_path, '/', 2)::text as name) n
cross join lateral (select split_part(n.name, '.', 1)::int as i) x
where (f.key = 'industry' and t.slug = 'fintech' and (x.i % 20) % 4 = 0)
   or (f.key = 'industry' and t.slug = 'travel' and (x.i % 20) % 4 = 1)
   or (f.key = 'screen_type' and t.slug = 'paywall' and x.i % 7 = 0)
   or (f.key = 'ui_element' and t.slug = 'modal' and x.i % 5 = 0)
   or (f.key = 'platform' and t.slug = 'ios' and x.i % 50 = 0);

do $$
declare
  ios uuid := (select t.id from public.tags t join public.facets f on f.id = t.facet_id where f.key = 'platform' and t.slug = 'ios');
  fintech uuid := (select t.id from public.tags t join public.facets f on f.id = t.facet_id where f.key = 'industry' and t.slug = 'fintech');
  travel uuid := (select t.id from public.tags t join public.facets f on f.id = t.facet_id where f.key = 'industry' and t.slug = 'travel');
  paywall uuid := (select t.id from public.tags t join public.facets f on f.id = t.facet_id where f.key = 'screen_type' and t.slug = 'paywall');
  expected uuid[];
  got uuid[];
  page1 uuid[];
  page2 uuid[];
  last_at timestamptz;
  last_id uuid;
  started timestamptz;
  worst interval := '0';
  took interval;
  n int;
begin
  if (select count(*) from public.screens) <> 1000 then raise exception 'FAIL: seed should give 1000 screens'; end if;

  -- iOS + fintech + paywall: all three facets must match.
  select array_agg(s.id order by s.captured_at desc, s.id desc) into expected
  from public.screens s join public.apps a on a.id = s.app_id
  where (a.platform = 'ios' or exists (select 1 from public.screen_tags st where st.screen_id = s.id and st.tag_id = ios))
    and exists (select 1 from public.screen_tags st where st.screen_id = s.id and st.tag_id = fintech)
    and exists (select 1 from public.screen_tags st where st.screen_id = s.id and st.tag_id = paywall);
  select array_agg(r.id) into got from public.search_screens(array[ios, fintech, paywall], null, null, null, 100) r;
  if expected is null or cardinality(expected) = 0 then raise exception 'FAIL: seed gives no iOS+fintech+paywall screens'; end if;
  if got is distinct from expected then
    raise exception 'FAIL: iOS+fintech+paywall: expected % screens, got %', cardinality(expected), coalesce(cardinality(got), 0);
  end if;

  -- OR within a facet: fintech or travel.
  select count(*) into n from public.search_screens(array[fintech, travel], null, null, null, 100);
  if n <> 100 then raise exception 'FAIL: fintech OR travel should fill a page of 100, got %', n; end if;
  select count(*) into n from public.screens s
  where exists (select 1 from public.screen_tags st where st.screen_id = s.id and st.tag_id in (fintech, travel));
  if n <> 500 then raise exception 'FAIL: seed should have 500 fintech-or-travel screens, got %', n; end if;

  -- Cursor: two pages of 40 with ties never overlap and follow on exactly.
  select array_agg(r.id) into page1 from public.search_screens('{}', null, null, null, 40) r;
  select r.captured_at, r.id into last_at, last_id from public.search_screens('{}', null, null, null, 40) r offset 39;
  select array_agg(r.id) into page2 from public.search_screens('{}', null, last_at, last_id, 40) r;
  select array_agg(id order by captured_at desc, id desc) into expected
  from (select id, captured_at from public.screens order by captured_at desc, id desc limit 80) x;
  if page1 || page2 is distinct from expected then raise exception 'FAIL: cursor pages skip or repeat screens'; end if;

  -- Text search: exact app name, a typo, and a tag synonym.
  select count(*) into n from public.search_screens('{}', 'revolut', null, null, 100);
  if n <> 50 then raise exception 'FAIL: "revolut" should find 50 screens, got %', n; end if;
  select count(*) into n from public.search_screens('{}', 'revolutt', null, null, 100);
  if n <> 50 then raise exception 'FAIL: typo "revolutt" should find 50 screens, got %', n; end if;
  select count(*) into n from public.search_screens('{}', 'paywal', null, null, 100);
  if n <> 100 then raise exception 'FAIL: typo "paywal" should fill a page, got %', n; end if;

  -- Counts: platform counts include app platforms.
  select screens into n from public.screen_tag_counts() where tag_id = ios;
  if n <> (select count(*) from public.screens s join public.apps a on a.id = s.app_id
           where a.platform = 'ios' or exists (select 1 from public.screen_tags st where st.screen_id = s.id and st.tag_id = ios))
    then raise exception 'FAIL: iOS count is wrong (%)', n; end if;

  -- Timing: worst of 5 runs for each query shape.
  for i in 1..5 loop
    started := clock_timestamp();
    perform * from public.search_screens(array[ios, fintech, paywall], null, null, null, 40);
    took := clock_timestamp() - started; if took > worst then worst := took; end if;
    started := clock_timestamp();
    perform * from public.search_screens(array[ios, fintech, paywall], 'paywal', null, null, 40);
    took := clock_timestamp() - started; if took > worst then worst := took; end if;
    started := clock_timestamp();
    perform * from public.search_screens('{}', null, null, null, 40);
    took := clock_timestamp() - started; if took > worst then worst := took; end if;
    started := clock_timestamp();
    perform * from public.screen_tag_counts();
    took := clock_timestamp() - started; if took > worst then worst := took; end if;
  end loop;
  if worst > interval '300 milliseconds' then raise exception 'FAIL: slowest query took %', worst; end if;
  perform set_config('test.worst_ms', round(extract(epoch from worst) * 1000, 1)::text, true);
end $$;

-- Another user sees none of it.
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.search_screens('{}', null, null, null, 40)) then raise exception 'FAIL: D can search C''s screens'; end if;
  if exists (select 1 from public.screen_tag_counts()) then raise exception 'FAIL: D sees C''s tag counts'; end if;
end $$;

reset role;
select 'SEARCH OK' as result, current_setting('test.worst_ms') || ' ms' as slowest_query;

rollback;
