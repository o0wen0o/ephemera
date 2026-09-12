-- Ephemera database schema. This is the whole database: run it on a new project, run it again on
-- an older one to bring it up to date, run it twice by accident. Every statement is idempotent.
create table if not exists public.entries (
 id uuid primary key,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null default '', body text not null default '', date date not null,
 mood text not null default '平静', weather text not null default '晴天',
 tags text[] not null default '{}', favorite boolean not null default false,
 cover boolean not null default false, images text[] not null default '{}',
 created_at timestamptz,
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
-- Columns added after the first release. A database created before one of them simply gains it
-- here; a newer database skips the line. created_at stays nullable: an entry written before the
-- column existed has no honest value to backfill.
-- deleted_at is a tombstone: deleted diary content is blanked, while the id and timestamp remain
-- so another device cannot accidentally restore an old copy.
alter table public.entries add column if not exists images text[] not null default '{}';
alter table public.entries add column if not exists created_at timestamptz;
alter table public.entries add column if not exists deleted_at timestamptz;
alter table public.entries drop constraint if exists entries_images_count;
alter table public.entries add constraint entries_images_count check (cardinality(images) <= 3);

alter table public.entries enable row level security;
revoke all on public.entries from anon;
grant select, insert, update, delete on public.entries to authenticated;
drop policy if exists "read own entries" on public.entries;
create policy "read own entries" on public.entries for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "insert own entries" on public.entries;
create policy "insert own entries" on public.entries for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "update own entries" on public.entries;
create policy "update own entries" on public.entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "delete own entries" on public.entries;
create policy "delete own entries" on public.entries for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists entries_user_date on public.entries(user_id,date desc);
create index if not exists entries_user_changed on public.entries(user_id,updated_at desc);

-- Diary photos live in a private bucket, one folder per account, compressed to JPEG by the client.
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
