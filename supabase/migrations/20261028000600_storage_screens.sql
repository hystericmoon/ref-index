-- Private bucket for library screenshots. Objects live under <owner uid>/:
--   <uid>/<screen id>.<png|jpg|webp>   original
--   <uid>/<screen id>.thumb.webp       480px-wide thumbnail

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screens', 'screens', false, 10485760, '{image/png,image/jpeg,image/webp}')
on conflict (id) do nothing;

create policy "Owners read their screen files"
  on storage.objects for select to authenticated
  using (bucket_id = 'screens' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners upload screen files to their folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'screens' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners replace their screen files"
  on storage.objects for update to authenticated
  using (bucket_id = 'screens' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'screens' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners delete their screen files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'screens' and (storage.foldername(name))[1] = (select auth.uid())::text);
