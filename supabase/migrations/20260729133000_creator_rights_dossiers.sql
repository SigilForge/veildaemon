create table if not exists public.creator_rights_dossiers (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.creator_rights_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dossier_version integer not null,
  purpose text not null check (purpose in (
    'publisher',
    'licensing',
    'grant',
    'archive',
    'open_source',
    'suspected_use',
    'general',
    'custom'
  )),
  snapshot_json jsonb not null,
  manifest_sha256 text not null check (manifest_sha256 ~* '^[a-f0-9]{64}$'),
  export_hashes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (record_id, dossier_version)
);

comment on table public.creator_rights_dossiers is
  'Private versioned Creator Dossier snapshots derived from canonical Creator Rights Records.';
comment on column public.creator_rights_dossiers.snapshot_json is
  'Machine-readable dossier manifest. The Creator Rights Record remains canonical.';
comment on column public.creator_rights_dossiers.manifest_sha256 is
  'SHA-256 of the generated manifest payload used to bind the dossier snapshot.';

alter table public.creator_rights_dossiers enable row level security;

drop policy if exists "owners can read creator rights dossiers" on public.creator_rights_dossiers;
create policy "owners can read creator rights dossiers"
on public.creator_rights_dossiers for select
using (auth.uid() = user_id);

drop policy if exists "owners can insert creator rights dossiers" on public.creator_rights_dossiers;
create policy "owners can insert creator rights dossiers"
on public.creator_rights_dossiers for insert
with check (auth.uid() = user_id);

grant select, insert on public.creator_rights_dossiers to authenticated;
grant select, insert, update, delete on public.creator_rights_dossiers to service_role;
