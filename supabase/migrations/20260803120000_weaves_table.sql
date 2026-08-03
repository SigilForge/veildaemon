-- Weave feature, migration 1/7: the Weave itself -- a Handler-created story arc. Cell 1:N
-- Weave 1:N Needlepoint 1:N Operation (Needlepoint added in migration 2, cell_operations'
-- needlepoint_id in migration 3). A Weave is the continuity/completion boundary this pass
-- wires up as a future Void-award hook point: weaves.status = 'completed' is deliberately
-- left as a clean trigger for a later pass, not built here.
--
-- Deliberately NOT auto-created when a Cell is created -- creating a player group does not
-- automatically define its story arc. Multiple Weaves may be 'active' on the same Cell
-- simultaneously (overlapping arcs are allowed) -- there is no unique-active-per-cell index
-- here, unlike cell_operations_single_active_idx.
--
-- Handler-only end to end (select/insert/update) -- not lobby-wide like cell_operations/
-- cell_events. Weave title/summary are Handler planning material; Operator-visible content is
-- published separately and explicitly via weave_clues.

create type public.weave_status as enum ('planned', 'active', 'completed', 'archived');

create table public.weaves (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.handler_sessions(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  summary text not null default '' check (char_length(summary) <= 2000),
  status public.weave_status not null default 'planned',
  state_version integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz
);

create index weaves_cell_idx on public.weaves(cell_id, updated_at desc);

create trigger weaves_set_updated_at
before update on public.weaves
for each row execute function public.set_updated_at();

alter table public.weaves enable row level security;

-- Handler-only select -- deliberate deviation from cell_operations_select/cell_events_select's
-- lobby-wide "is_session_handler or is_session_operator" precedent. Weave planning material is
-- Handler continuity bookkeeping, not something an Operator token reads at all; Operator-
-- visible Weave-scoped content is published separately as weave_clues.
create policy weaves_select on public.weaves
  for select to authenticated using (public.is_session_handler(cell_id));

create policy weaves_insert on public.weaves
  for insert to authenticated with check (public.is_session_handler(cell_id, true));

create policy weaves_update on public.weaves
  for update to authenticated using (public.is_session_handler(cell_id, true));

grant select, insert, update on public.weaves to authenticated;
grant select, insert, update, delete on public.weaves to service_role;
