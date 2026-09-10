-- Ephemera database schema.
create table if not exists public.entries (
 id uuid primary key,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null default '', body text not null default '', date date not null,
 mood text not null default '平静', weather text not null default '晴天',
 tags text[] not null default '{}', favorite boolean not null default false,
 cover boolean not null default false, updated_at timestamptz not null default now()
);
alter table public.entries enable row level security;
revoke all on public.entries from anon;
grant select, insert, update, delete on public.entries to authenticated;
create policy "read own entries" on public.entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own entries" on public.entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own entries" on public.entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own entries" on public.entries for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists entries_user_date on public.entries(user_id,date desc);
