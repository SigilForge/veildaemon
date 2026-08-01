-- 20260723120000_table_live_link.sql added max_operators to the handler_sessions
-- create table statement in a later same-day edit (commit e8c16209), after that
-- migration version had already been applied to the linked project. Supabase
-- tracks applied migrations by version, so the edit never re-ran and the live
-- table was missing the column. This migration adds it explicitly instead of
-- rewriting the already-applied file.

alter table public.handler_sessions
  add column if not exists max_operators integer check (max_operators is null or (max_operators >= 1 and max_operators <= 32));

comment on column public.handler_sessions.max_operators is 'null = no lobby cap; Handler may set when opening the session';
