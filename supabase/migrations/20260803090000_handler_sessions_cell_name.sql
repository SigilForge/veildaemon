-- Multi-Cell Handler Management, migration 1/3: a Handler-facing display name for the Cell
-- itself ("Monday Group", "Tuesday One-Shot") -- distinct from handler_display_name (the
-- HANDLER's own chat sender name, see 20260802160000) and from the deprecated needlepoint
-- (a scenario id, see 20260802180000). Nothing today lets a Handler label a Cell as a lobby/
-- table identity in its own right; a dashboard listing multiple owned Cells needs one.

alter table public.handler_sessions
  add column cell_name text not null default '' check (char_length(cell_name) <= 120);

-- Backfill: reuse the legacy needlepoint text where a Cell already has one recorded (better
-- than a blank card on the very first dashboard render), otherwise fall back to a generic
-- label keyed by join code so no card is ever silently unlabeled.
update public.handler_sessions
  set cell_name = case when char_length(trim(needlepoint)) > 0
                       then left(trim(needlepoint), 120)
                       else 'Untitled Cell — ' || join_code end
  where char_length(trim(cell_name)) = 0;

comment on column public.handler_sessions.cell_name is
  'Handler-facing Cell label ("Monday Group"). Distinct from handler_display_name (Handler''s own chat sender name) and the deprecated needlepoint (scenario id). Settable at create-session time; renamed via rename-cell.';
