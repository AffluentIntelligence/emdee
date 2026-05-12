-- Tracks the state of each file at last successful sync.
-- Used to detect conflicts: local changed AND cloud changed since last sync.
-- clerk_id is nullable until Clerk auth is wired into the sync route.

create table public.sync_manifest (
  id            uuid primary key default gen_random_uuid(),
  clerk_id      text references public.profiles (clerk_id) on delete cascade,
  file_path     text not null,
  synced_at     timestamptz not null default now(),
  content_hash  text not null,   -- SHA-256 of file content at last sync
  constraint uq_sync_manifest_path unique (file_path)
  -- note: uq constraint becomes (clerk_id, file_path) when multi-user lands
);

alter table public.sync_manifest enable row level security;

create policy "no direct client access"
  on public.sync_manifest for all using (false);
