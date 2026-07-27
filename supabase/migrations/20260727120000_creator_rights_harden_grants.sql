-- Harden Creator Rights publication authority after the initial registry migration.
-- Authenticated users may read their records through RLS, but server-side
-- service-role routes own draft mutation and publication.

revoke insert, update on public.creator_rights_records from authenticated;
revoke insert on public.creator_rights_record_versions from authenticated;

grant select on public.creator_rights_records to anon, authenticated;
grant select on public.creator_rights_record_versions to authenticated;
