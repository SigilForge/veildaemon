-- Fix lost-update race on session_operator_state.live_state.
--
-- patchSessionState previously did a plain read -> merge -> write with no
-- concurrency check. Two near-simultaneous PATCHes (e.g. Handler adjusting
-- Stability while Operator adjusts Harm) could each read the same stale row,
-- merge only their own field, and write back a full live_state snapshot that
-- silently reverted the other party's already-committed field to the stale
-- value — a lost update, not just a same-field overwrite.
--
-- state_version gives the application layer a compare-and-swap target:
-- UPDATE ... WHERE id = ? AND state_version = ?. A 0-row update means someone
-- else committed first; the caller re-reads and reapplies only its own
-- filtered patch on the fresh row, so fields it never touched keep the
-- concurrent writer's value instead of being clobbered.

alter table public.session_operator_state
  add column state_version integer not null default 1;
