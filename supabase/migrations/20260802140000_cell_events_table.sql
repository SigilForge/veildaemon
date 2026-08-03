-- Cradlepoint Cell Lobby Model, migration 6/10: the Cell-scoped typed event feed (chat plus
-- the 6 other event kinds: ROLL, ACTION_DECLARED, HANDLER_UPDATE, ACKNOWLEDGED,
-- ROUND_ADVANCED, OPERATION_ARCHIVED). session_rolls stays exactly as it is -- it's a live,
-- tested, Realtime-enabled table with production data; migrating it into this table would add
-- real risk for no functional gain. ROLL is listed in cell_event_type for the client-side
-- unified timeline vocabulary, but rolls themselves keep being written to session_rolls;
-- nothing here inserts a 'roll'-typed row.
--
-- suspend/resume (needed for the persistence half of this pass, not in the literal 7-type
-- list given) ride as event_type='handler_update' with a structured body.kind discriminator
-- ('operation_suspended'/'operation_resumed') rather than growing an 8th/9th enum value --
-- same pattern the publish action's opaque patch.kind already uses today.

create type public.cell_event_type as enum (
  'chat', 'roll', 'action_declared', 'handler_update', 'acknowledged', 'round_advanced', 'operation_archived'
);

create table public.cell_events (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.handler_sessions(id) on delete cascade,
  -- null: lobby chat can happen with no active Operation (OPEN/POST_OPERATION).
  operation_id uuid references public.cell_operations(id) on delete set null,
  event_type public.cell_event_type not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role public.table_actor_role not null,
  -- Snapshotted at insert time, matching session_rolls.operator_name's established pattern --
  -- never a live join, never profiles.email. See api/cell/[action].js's send-chat handler.
  sender_name text not null default '' check (char_length(sender_name) <= 80),
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index cell_events_cell_idx on public.cell_events(cell_id, created_at desc);

alter table public.cell_events enable row level security;

-- SECURITY DEFINER helper (matching is_session_handler/is_session_operator's recursion-safety
-- precedent) rather than inlining a second handler_sessions lookup directly in the insert
-- policy.
create or replace function public.cell_accepts_events(p_cell_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.handler_sessions h
    where h.id = p_cell_id and h.status <> 'closed'
  );
$$;

revoke all on function public.cell_accepts_events(uuid) from public;
grant execute on function public.cell_accepts_events(uuid) to authenticated;

-- Lobby-wide read, matching the existing session_rolls_select precedent.
create policy cell_events_select on public.cell_events
  for select to authenticated using (
    public.is_session_handler(cell_id) or public.is_session_operator(cell_id)
  );

-- Any seated participant (Handler or Operator) can post, as themselves, while the Cell isn't
-- closed. Read-only-when-CLOSED (message 1's requirement) is enforced by this same check --
-- there is no separate "closed" carve-out because there is nothing else that should still
-- accept writes once CLOSED.
create policy cell_events_insert on public.cell_events
  for insert to authenticated with check (
    actor_user_id = auth.uid()
    and (public.is_session_handler(cell_id) or public.is_session_operator(cell_id))
    and public.cell_accepts_events(cell_id)
  );

grant select, insert on public.cell_events to authenticated;
grant select, insert, update, delete on public.cell_events to service_role;

alter publication supabase_realtime add table public.cell_events;
