-- Row-level security. Taxonomy and directory are public, read-only through the API.
-- Library rows belong to their owner. Later, board members get access via new policies.

alter table public.facets enable row level security;
alter table public.tags enable row level security;
alter table public.sources enable row level security;
alter table public.apps enable row level security;
alter table public.screens enable row level security;
alter table public.flows enable row level security;
alter table public.flow_screens enable row level security;
alter table public.screen_tags enable row level security;

-- Grants (RLS still applies on top) -------------------------------------------

revoke all on public.facets, public.tags, public.sources from anon, authenticated;
grant select on public.facets, public.tags, public.sources to anon, authenticated;

revoke all on public.apps, public.screens, public.flows, public.flow_screens, public.screen_tags
  from anon, authenticated;
grant select, insert, update, delete
  on public.apps, public.screens, public.flows, public.flow_screens, public.screen_tags
  to authenticated;

-- Public read -------------------------------------------------------------------

create policy "Anyone can read facets" on public.facets
  for select to anon, authenticated using (true);

create policy "Anyone can read tags" on public.tags
  for select to anon, authenticated using (true);

create policy "Anyone can read sources" on public.sources
  for select to anon, authenticated using (true);

-- apps --------------------------------------------------------------------------

create policy "Owners read their apps" on public.apps
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "Owners add apps" on public.apps
  for insert to authenticated with check (owner_id = (select auth.uid()));

create policy "Owners edit their apps" on public.apps
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners delete their apps" on public.apps
  for delete to authenticated using (owner_id = (select auth.uid()));

-- screens -----------------------------------------------------------------------

create policy "Owners read their screens" on public.screens
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "Owners add screens to their apps" on public.screens
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.apps a where a.id = app_id and a.owner_id = (select auth.uid()))
  );

create policy "Owners edit their screens" on public.screens
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.apps a where a.id = app_id and a.owner_id = (select auth.uid()))
  );

create policy "Owners delete their screens" on public.screens
  for delete to authenticated using (owner_id = (select auth.uid()));

-- flows -------------------------------------------------------------------------

create policy "Owners read their flows" on public.flows
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "Owners add flows to their apps" on public.flows
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.apps a where a.id = app_id and a.owner_id = (select auth.uid()))
  );

create policy "Owners edit their flows" on public.flows
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.apps a where a.id = app_id and a.owner_id = (select auth.uid()))
  );

create policy "Owners delete their flows" on public.flows
  for delete to authenticated using (owner_id = (select auth.uid()));

-- screen_tags: follows the screen ------------------------------------------------

create policy "Owners read tags on their screens" on public.screen_tags
  for select to authenticated using (
    exists (select 1 from public.screens s where s.id = screen_id and s.owner_id = (select auth.uid()))
  );

create policy "Owners tag their screens" on public.screen_tags
  for insert to authenticated with check (
    exists (select 1 from public.screens s where s.id = screen_id and s.owner_id = (select auth.uid()))
  );

create policy "Owners untag their screens" on public.screen_tags
  for delete to authenticated using (
    exists (select 1 from public.screens s where s.id = screen_id and s.owner_id = (select auth.uid()))
  );

-- flow_screens: follows the flow, and the screen must be the owner's too -----------

create policy "Owners read their flow steps" on public.flow_screens
  for select to authenticated using (
    exists (select 1 from public.flows f where f.id = flow_id and f.owner_id = (select auth.uid()))
  );

create policy "Owners add steps to their flows" on public.flow_screens
  for insert to authenticated with check (
    exists (select 1 from public.flows f where f.id = flow_id and f.owner_id = (select auth.uid()))
    and exists (select 1 from public.screens s where s.id = screen_id and s.owner_id = (select auth.uid()))
  );

create policy "Owners reorder their flow steps" on public.flow_screens
  for update to authenticated
  using (
    exists (select 1 from public.flows f where f.id = flow_id and f.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.flows f where f.id = flow_id and f.owner_id = (select auth.uid()))
    and exists (select 1 from public.screens s where s.id = screen_id and s.owner_id = (select auth.uid()))
  );

create policy "Owners remove steps from their flows" on public.flow_screens
  for delete to authenticated using (
    exists (select 1 from public.flows f where f.id = flow_id and f.owner_id = (select auth.uid()))
  );
