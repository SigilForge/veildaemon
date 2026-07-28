create type creator_rights_verification_method as enum ('domain', 'github', 'isbn');
create type creator_rights_verification_status as enum ('pending', 'passed', 'failed', 'expired', 'revoked', 'attached');
create type creator_rights_verification_claim as enum ('surface_control', 'linked_publication_evidence', 'artifact_fingerprint');

alter table public.creator_rights_records
  add constraint creator_rights_records_id_user_id_unique unique (id, user_id);

create table creator_rights_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references creator_rights_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  method creator_rights_verification_method not null check (method in ('domain', 'github')),
  target text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  status creator_rights_verification_status not null default 'pending' check (status in ('pending', 'passed', 'failed', 'expired', 'revoked')),
  result jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  evidence_snapshot jsonb,
  constraint creator_rights_verification_challenges_owner_fk foreign key (record_id, user_id)
    references creator_rights_records(id, user_id) on delete cascade
);

create table creator_rights_verification_evidence (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references creator_rights_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid references creator_rights_verification_challenges(id) on delete set null,
  method creator_rights_verification_method not null,
  status creator_rights_verification_status not null,
  claim creator_rights_verification_claim not null,
  target text,
  verified_at timestamptz,
  revoked_at timestamptz,
  proof jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint creator_rights_verification_evidence_owner_fk foreign key (record_id, user_id)
    references creator_rights_records(id, user_id) on delete cascade,
  constraint creator_rights_verification_evidence_status_check check (
    (method in ('domain', 'github') and status in ('passed', 'revoked') and claim = 'surface_control')
    or
    (method = 'isbn' and status in ('attached', 'revoked') and claim = 'linked_publication_evidence')
  )
);

create table creator_rights_verification_events (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references creator_rights_records(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  challenge_id uuid references creator_rights_verification_challenges(id) on delete set null,
  evidence_id uuid references creator_rights_verification_evidence(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index creator_rights_verification_challenges_record_idx on creator_rights_verification_challenges(record_id, created_at desc);
create index creator_rights_verification_challenges_owner_idx on creator_rights_verification_challenges(user_id, record_id);
create index creator_rights_verification_evidence_record_idx on creator_rights_verification_evidence(record_id, status, created_at desc);
create index creator_rights_verification_evidence_owner_idx on creator_rights_verification_evidence(user_id, record_id);
create index creator_rights_verification_events_record_idx on creator_rights_verification_events(record_id, created_at desc);

alter table creator_rights_verification_challenges enable row level security;
alter table creator_rights_verification_evidence enable row level security;
alter table creator_rights_verification_events enable row level security;

create policy "owners read own verification challenges"
  on creator_rights_verification_challenges
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "owners read own verification evidence"
  on creator_rights_verification_evidence
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "owners read own verification events"
  on creator_rights_verification_events
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on creator_rights_verification_challenges from anon, authenticated;
revoke all on creator_rights_verification_evidence from anon, authenticated;
revoke all on creator_rights_verification_events from anon, authenticated;
grant select on creator_rights_verification_challenges to authenticated;
grant select on creator_rights_verification_evidence to authenticated;
grant select on creator_rights_verification_events to authenticated;
grant all on creator_rights_verification_challenges to service_role;
grant all on creator_rights_verification_evidence to service_role;
grant all on creator_rights_verification_events to service_role;
