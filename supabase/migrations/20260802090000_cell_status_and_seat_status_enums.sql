-- Cradlepoint Cell Lobby Model, migration 1/10: introduce the two new status vocabularies
-- that let Cell lifecycle, Operation lifecycle, and Seat presence stop impersonating each
-- other. `handler_sessions.status` ('open'|'closed') has been standing in for BOTH "is the
-- lobby open" and "is a game currently running" -- it cannot express POST_OPERATION (Cell
-- still open, but no Operation currently running) at all. `session_operator_state.left_at`
-- has been the only seat-presence signal that exists -- it cannot distinguish a voluntary
-- Operator departure from a Handler removal, which matters for audit/history even though
-- both currently read as "gone."
--
-- Added as a new column (status_v2) rather than altering `status` in place: the old enum
-- and column stay fully intact and readable through this migration so `cell_operations`
-- (migration 2) can still read `handler_sessions.status` to infer backfilled Operation
-- status, and so this migration can be rolled back independently without touching the
-- column every existing RLS policy and API query string currently references. The rename
-- to the final `status` name happens once `cell_operations` exists (migration 3).

create type public.cell_status as enum ('open', 'active_operation', 'post_operation', 'closed');
create type public.seat_status as enum ('joined', 'left', 'removed');

alter table public.handler_sessions
  add column status_v2 public.cell_status not null default 'open';

-- Every existing Cell today has exactly one implicit scenario running (this schema has never
-- separated "lobby" from "game" before this pass) -- so an open Cell backfills as actively
-- running an Operation, and a closed Cell backfills as closed. Neither `open` (lobby-only,
-- no Operation yet) nor `post_operation` (Operation archived, Cell still open) can be
-- correctly inferred from history that never recorded the distinction; defaulting instead to
-- `active_operation`/`closed` preserves current behavior for every live production Cell
-- rather than inventing a state that would newly block it.
update public.handler_sessions
  set status_v2 = case when status = 'closed' then 'closed'::public.cell_status else 'active_operation'::public.cell_status end;

alter table public.session_operator_state
  add column seat_status public.seat_status not null default 'joined',
  add column removed_by uuid references public.profiles(id) on delete set null,
  add column removed_reason text check (char_length(removed_reason) <= 300);

-- Conservative backfill: every previously-departed seat becomes `left`, never invented as
-- `removed`, because no Handler-removal action existed anywhere in this codebase before this
-- pass -- there is no way to know, after the fact, which departures were voluntary.
update public.session_operator_state
  set seat_status = case when left_at is not null then 'left'::public.seat_status else 'joined'::public.seat_status end;

comment on column public.handler_sessions.status_v2 is
  'Cell lifecycle (OPEN/ACTIVE_OPERATION/POST_OPERATION/CLOSED). Temporary name until migration 3 renames this over the legacy `status` column.';
comment on column public.session_operator_state.seat_status is
  'Durable seat presence (JOINED/LEFT/REMOVED). CONNECTED/DISCONNECTED are deliberately never persisted here -- see cell-sync-remote.js Presence channel.';
