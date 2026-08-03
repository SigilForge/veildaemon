-- Cradlepoint Cell Lobby Model, migration 2/10: the Operation table. A Cell must be able to
-- host more than one Operation over its lifetime (the whole point of "start another Operation
-- in the same Cell" for a recurring table) -- a one-to-many relationship `handler_sessions`
-- cannot represent as plain columns, which is why this is a new table rather than more columns
-- bolted onto the Cell row. `needlepoint`/`mission`/`one_shot` move here from
-- `handler_sessions`, which keeps those columns only as deprecated legacy fields (see
-- migration 10) -- new Operations own scenario identity going forward.

create type public.operation_status as enum ('preparing', 'active', 'resolving', 'suspended', 'archived');

create table public.cell_operations (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.handler_sessions(id) on delete cascade,
  sequence integer not null check (sequence >= 1),
  needlepoint text not null default '' check (char_length(needlepoint) <= 120),
  mission text not null default '' check (char_length(mission) <= 200),
  status public.operation_status not null default 'preparing',
  round integer not null default 0 check (round >= 0),
  -- Shared, Handler-authored state that has never had a server-side authoritative home
  -- before this pass -- it lived only in the Handler's own browser localStorage
  -- (handler-state.js's sceneState/clocks/npcs/clueIntegrity/sessionRewardDecisions), which
  -- is exactly why a Cell could never be "reopened" from a fresh browser session.
  scene_state jsonb not null default '{}'::jsonb,
  clue_state jsonb not null default '{}'::jsonb,
  npc_state jsonb not null default '{}'::jsonb,
  reward_state jsonb not null default '{}'::jsonb,
  one_shot boolean,
  final_snapshot_id uuid, -- FK to cell_checkpoints added in migration 7, once that table exists
  started_at timestamptz,
  resolving_at timestamptz,
  suspended_at timestamptz,
  archived_at timestamptz,
  state_version integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cell_id, sequence)
);

create index cell_operations_cell_idx on public.cell_operations(cell_id, sequence desc);

-- Only one non-archived Operation per Cell at a time -- the mechanism that makes "start a
-- second Operation" only possible once the first is archived, enforced at the database level
-- rather than trusted to client/API discipline alone.
create unique index cell_operations_single_active_idx
  on public.cell_operations(cell_id) where status <> 'archived';

create trigger cell_operations_set_updated_at
before update on public.cell_operations
for each row execute function public.set_updated_at();

alter table public.cell_operations enable row level security;

create policy cell_operations_select on public.cell_operations
  for select to authenticated using (
    public.is_session_handler(cell_id) or public.is_session_operator(cell_id)
  );
create policy cell_operations_insert on public.cell_operations
  for insert to authenticated with check (public.is_session_handler(cell_id, true));
create policy cell_operations_update on public.cell_operations
  for update to authenticated using (public.is_session_handler(cell_id, true));

grant select, insert, update on public.cell_operations to authenticated;
grant select, insert, update, delete on public.cell_operations to service_role;

-- Backfill: every existing handler_sessions row implicitly represents exactly one scenario
-- instance today (this schema has never separated "lobby" from "game" before this pass), so
-- each gets exactly one sequence=1 Operation row carrying its needlepoint/mission/one_shot,
-- with status inferred from the Cell's own current status: a closed Cell's implicit
-- Operation is treated as archived (closing today already meant "the game is over"); an open
-- Cell's implicit Operation is treated as active (preserves current behavior -- rolls/
-- declarations keep flowing under the new status guards exactly as they do today, rather
-- than silently defaulting into a `preparing` state that would newly block them).
insert into public.cell_operations (
  cell_id, sequence, needlepoint, mission, status, one_shot, created_by, created_at,
  started_at, archived_at
)
select
  id,
  1,
  needlepoint,
  mission,
  case when status = 'closed' then 'archived'::public.operation_status else 'active'::public.operation_status end,
  one_shot,
  handler_user_id,
  created_at,
  case when status = 'closed' then null else created_at end,
  case when status = 'closed' then closed_at else null end
from public.handler_sessions;
