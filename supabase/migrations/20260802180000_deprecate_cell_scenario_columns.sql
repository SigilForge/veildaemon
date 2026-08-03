-- Cradlepoint Cell Lobby Model, migration 10/10: doc-comment-only. No destructive drop --
-- matches this repo's existing practice of a rationale comment over a silent behavior change
-- (see e.g. operator_profiles_identity_only's predecessor columns). handler_sessions.
-- needlepoint/mission/one_shot were the pre-this-pass "one Cell == one scenario instance"
-- fields; cell_operations.needlepoint/mission/one_shot are authoritative for every Operation
-- created from this migration forward. These legacy columns are left populated only by the
-- migration 2 backfill and are not written to by any new code.

comment on column public.handler_sessions.needlepoint is
  'Deprecated: legacy pre-Operation-table field, populated only by this pass''s backfill. Use cell_operations.needlepoint for anything created after this migration.';
comment on column public.handler_sessions.mission is
  'Deprecated: legacy pre-Operation-table field, populated only by this pass''s backfill. Use cell_operations.mission for anything created after this migration.';
comment on column public.handler_sessions.one_shot is
  'Deprecated: legacy pre-Operation-table field, populated only by this pass''s backfill. Use cell_operations.one_shot for anything created after this migration.';
