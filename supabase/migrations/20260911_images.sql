-- Run after schema.sql for both existing and new installations.
alter table public.entries add column if not exists images text[] not null default '{}';
alter table public.entries drop constraint if exists entries_images_count;
alter table public.entries add constraint entries_images_count check (cardinality(images) <= 3);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-images', 'journal-images', false, 409600, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "read own journal images" on storage.objects;
create policy "read own journal images" on storage.objects for select to authenticated
using (bucket_id = 'journal-images' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "upload own journal images" on storage.objects;
create policy "upload own journal images" on storage.objects for insert to authenticated
with check (bucket_id = 'journal-images' and (storage.foldername(name))[1] = (select auth.uid()::text));
-- No UPDATE or DELETE policy: removing a reference or diary must not erase image files.
