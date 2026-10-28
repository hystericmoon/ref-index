-- Signed-in users can add tags to a facet from the tag picker. Tags stay shared and
-- publicly readable; editing or deleting them still happens in the dashboard.

alter table public.tags
  add column created_by uuid default auth.uid() references auth.users (id) on delete set null;

create index tags_created_by_idx on public.tags (created_by);

grant insert (facet_id, slug, label, created_by) on public.tags to authenticated;

create policy "Signed-in users add tags" on public.tags
  for insert to authenticated
  with check (created_by = (select auth.uid()) and synonyms = '{}');
