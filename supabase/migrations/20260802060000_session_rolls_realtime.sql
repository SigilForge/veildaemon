-- Session-wide, live roll feed: every seated Operator and the session's Handler share one
-- broadcast feed (community-vibe visibility), distinct from the private, per-seat
-- Harm/Stability/Load state in session_operator_state.live_state. Uses Supabase Realtime --
-- the first table in this schema to do so; 20260723120000_table_live_link.sql's own note
-- ("No Realtime required: session pages poll...") reflects that everything else here
-- deliberately stays poll/pull-based. This table is the one deliberate exception, so a roll
-- appears to the whole lobby instantly rather than waiting on the next sync action.

create table public.session_rolls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.handler_sessions(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  operator_key text not null check (char_length(operator_key) between 1 and 120),
  operator_name text not null default 'Operator' check (char_length(operator_name) <= 80),
  roll jsonb not null,
  created_at timestamptz not null default now()
);

create index session_rolls_session_idx on public.session_rolls(session_id, created_at desc);

alter table public.session_rolls enable row level security;

-- Anyone seated in the session (Operator or Handler) can read every roll for that session --
-- the one deliberately lobby-wide table in this schema; everything else scopes to the
-- caller's own seat. Reuses is_session_handler/is_session_operator (SECURITY DEFINER, see
-- 20260801022500_fix_handler_sessions_rls_recursion.sql) rather than inlining the same
-- cross-table lookups here, to avoid re-triggering the recursion that migration fixed.
create policy session_rolls_select on public.session_rolls
  for select to authenticated using (
    public.is_session_handler(session_id)
    or public.is_session_operator(session_id)
  );

-- Only a seated Operator can post a roll, and only as themselves.
create policy session_rolls_insert on public.session_rolls
  for insert to authenticated with check (
    owner_user_id = auth.uid()
    and public.is_session_operator(session_id)
  );

grant select, insert on public.session_rolls to authenticated;

alter publication supabase_realtime add table public.session_rolls;
