-- service_role was never granted DML privileges on the Table Live-Link / Cell tables --
-- only REFERENCES/TRIGGER/TRUNCATE came through, presumably from a schema-level default
-- that didn't cover SELECT/INSERT/UPDATE/DELETE. This has been latent since the tables
-- were created (20260723120000_table_live_link.sql): the service-role admin lookups the
-- old VeilLink code used (getSupabaseAdminClient() in joinSession/closeSession) and the
-- new api/cell/[action].js's join-code resolution both need it and would have failed the
-- same way -- never caught because nothing had actually exercised the live join path
-- before now (pre-launch). service_role already bypasses RLS by design; it still needs
-- the underlying table grant to be reachable at all.

grant select, insert, update, delete on public.handler_sessions to service_role;
grant select, insert, update, delete on public.session_operator_state to service_role;
grant select, insert, update, delete on public.operator_profiles to service_role;
grant select, insert, update, delete on public.session_mutations to service_role;
