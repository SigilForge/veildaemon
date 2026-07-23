-- Cradlepoint table live-link vertical slice
-- Operator profiles (account-owned) + handler sessions + session-scoped projections

create type public.table_session_status as enum ('open', 'closed');
create type public.table_actor_role as enum ('handler', 'operator');

create table public.operator_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  designation text not null default '' check (char_length(designation) <= 40),
  -- persistent Archive fields (reconciled after sessions)
  persistent_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.handler_sessions (
  id uuid primary key default gen_random_uuid(),
  handler_user_id uuid not null references public.profiles(id) on delete cascade,
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  status public.table_session_status not null default 'open',
  needlepoint text not null default '' check (char_length(needlepoint) <= 120),
  mission text not null default '' check (char_length(mission) <= 200),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.session_operator_state (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.handler_sessions(id) on delete cascade,
  operator_profile_id uuid not null references public.operator_profiles(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  -- live projection; not the canonical operator row
  live_state jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_mutated_by uuid references public.profiles(id) on delete set null,
  last_mutated_at timestamptz not null default now(),
  unique (session_id, operator_profile_id)
);

create table public.session_mutations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.handler_sessions(id) on delete cascade,
  session_operator_state_id uuid not null references public.session_operator_state(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role public.table_actor_role not null,
  field_path text not null check (char_length(field_path) between 1 and 120),
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index operator_profiles_owner_idx on public.operator_profiles(owner_user_id);
create index handler_sessions_handler_idx on public.handler_sessions(handler_user_id);
create index handler_sessions_code_idx on public.handler_sessions(join_code);
create index session_operator_state_session_idx on public.session_operator_state(session_id);
create index session_mutations_session_idx on public.session_mutations(session_id, created_at desc);

create trigger operator_profiles_set_updated_at
before update on public.operator_profiles
for each row execute function public.set_updated_at();

create trigger handler_sessions_set_updated_at
before update on public.handler_sessions
for each row execute function public.set_updated_at();

alter table public.operator_profiles enable row level security;
alter table public.handler_sessions enable row level security;
alter table public.session_operator_state enable row level security;
alter table public.session_mutations enable row level security;

-- Operator profiles: owner only
create policy operator_profiles_select_own on public.operator_profiles
  for select to authenticated using (owner_user_id = auth.uid());
create policy operator_profiles_insert_own on public.operator_profiles
  for insert to authenticated with check (owner_user_id = auth.uid());
create policy operator_profiles_update_own on public.operator_profiles
  for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy operator_profiles_delete_own on public.operator_profiles
  for delete to authenticated using (owner_user_id = auth.uid());

-- Handler sessions: handler owns; operators in session can read
create policy handler_sessions_select on public.handler_sessions
  for select to authenticated using (
    handler_user_id = auth.uid()
    or exists (
      select 1 from public.session_operator_state s
      where s.session_id = handler_sessions.id
        and s.owner_user_id = auth.uid()
        and s.left_at is null
    )
  );
create policy handler_sessions_insert on public.handler_sessions
  for insert to authenticated with check (handler_user_id = auth.uid());
create policy handler_sessions_update on public.handler_sessions
  for update to authenticated using (handler_user_id = auth.uid()) with check (handler_user_id = auth.uid());

-- Session operator state: owner or session handler
create policy session_operator_state_select on public.session_operator_state
  for select to authenticated using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.handler_sessions h
      where h.id = session_operator_state.session_id
        and h.handler_user_id = auth.uid()
    )
  );
create policy session_operator_state_insert on public.session_operator_state
  for insert to authenticated with check (owner_user_id = auth.uid());
create policy session_operator_state_update on public.session_operator_state
  for update to authenticated using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.handler_sessions h
      where h.id = session_operator_state.session_id
        and h.handler_user_id = auth.uid()
        and h.status = 'open'
    )
  );

-- Mutations: participants can insert and read
create policy session_mutations_select on public.session_mutations
  for select to authenticated using (
    exists (
      select 1 from public.handler_sessions h
      where h.id = session_mutations.session_id
        and (
          h.handler_user_id = auth.uid()
          or exists (
            select 1 from public.session_operator_state s
            where s.session_id = h.id and s.owner_user_id = auth.uid()
          )
        )
    )
  );
create policy session_mutations_insert on public.session_mutations
  for insert to authenticated with check (actor_user_id = auth.uid());

-- Realtime publication for live sync
do $$
begin
  begin
    alter publication supabase_realtime add table public.session_operator_state;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.session_mutations;
  exception when duplicate_object then null;
  end;
end $$;

grant select, insert, update, delete on public.operator_profiles to authenticated;
grant select, insert, update on public.handler_sessions to authenticated;
grant select, insert, update on public.session_operator_state to authenticated;
grant select, insert on public.session_mutations to authenticated;
