-- Portal routes use the service role for ownership queries and issuance writes.
-- Table creation defaulted only REFERENCES/TRIGGER/TRUNCATE for service_role,
-- so listOwnedRightsRecords failed closed and the account page rendered empty.

grant select, insert, update, delete on public.creator_rights_records to service_role;
grant select, insert, update, delete on public.creator_rights_record_versions to service_role;
grant select, insert, update, delete on public.creator_rights_payment_attempts to service_role;
grant select, insert, update, delete on public.creator_rights_license_inquiries to service_role;

grant usage, select on sequence public.creator_rights_record_number_seq to service_role;

grant execute on function public.creator_rights_publish_record(uuid, uuid, text, text, text, integer, text, text, boolean) to service_role;
