-- Ephemera sync migration. Safe to run more than once.
-- deleted_at is a tombstone: deleted diary content is blanked, while the id and
-- timestamp remain so another device cannot accidentally restore an old copy.
alter table public.entries add column if not exists deleted_at timestamptz;
create index if not exists entries_user_changed on public.entries(user_id, updated_at desc);
