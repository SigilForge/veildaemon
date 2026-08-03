-- Weave feature, migration 3/7: cell_operations.needlepoint (free text, treated as identity)
-- is retired outright -- there is no gameplay data to preserve it for (nothing is in real
-- production yet). needlepoint_id is the real identity: every Operation belongs to exactly
-- one Needlepoint (Cell 1:N Weave 1:N Needlepoint 1:N Operation, no level skipped). weave_id
-- is deliberately NEVER a column on cell_operations -- it's derived by joining
-- needlepoint_id -> needlepoints.weave_id wherever it's needed, which eliminates the "two
-- independent sources of truth" problem structurally rather than reconciling it with a
-- trigger after the fact.
--
-- on delete restrict (not set null, not cascade): needlepoint_id can't be null, and silently
-- cascading away an Operation because its Needlepoint row was deleted would be far more
-- destructive than the delete itself -- nothing in this pass deletes Needlepoint rows (only
-- status/lifecycle transitions), so this should never actually fire in practice.

alter table public.cell_operations drop column needlepoint;

alter table public.cell_operations
  add column needlepoint_id uuid not null references public.needlepoints(id) on delete restrict;

create index cell_operations_needlepoint_idx on public.cell_operations(needlepoint_id);
