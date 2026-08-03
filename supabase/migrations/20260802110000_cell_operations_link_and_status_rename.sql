-- Cradlepoint Cell Lobby Model, migration 3/10: point every Cell at its backfilled Operation
-- and finalize the status_v2 -> status rename now that cell_operations exists to validate
-- against. Split from migration 1 so the rename happens only after the backfill in migration
-- 2 has something to point active_operation_id at.

alter table public.handler_sessions
  add column active_operation_id uuid references public.cell_operations(id);

update public.handler_sessions h
  set active_operation_id = o.id
  from public.cell_operations o
  where o.cell_id = h.id and o.sequence = 1;

alter table public.handler_sessions drop column status;
alter table public.handler_sessions rename column status_v2 to status;
drop type public.table_session_status;

comment on column public.handler_sessions.status is
  'Cell lifecycle: OPEN (no Operation ever started) / ACTIVE_OPERATION / POST_OPERATION (latest Operation archived, Cell still open) / CLOSED (terminal). See cell_operations.status for the separate Operation lifecycle -- these must never impersonate each other.';
comment on column public.handler_sessions.active_operation_id is
  'The Cell''s current Operation (any non-archived status), or null in OPEN before any Operation has ever started.';
