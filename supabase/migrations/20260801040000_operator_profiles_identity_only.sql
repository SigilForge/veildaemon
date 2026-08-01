-- operator_profiles stops being a parallel, VeilLink-owned character record.
-- It never should have carried mechanical state: persistent_state/character_snapshot
-- duplicated the real static Operator sheet instead of connecting to it (the
-- "ferry" problem -- see Docs/dev-notes or the VeilDaemon Cell/Live-Link rearchitecture
-- notes). operator_profiles is now identity + ownership only: which VeilLink account
-- this seat's display name/designation belongs to. Session-scoped mechanical state
-- lives only in session_operator_state.live_state (already jsonb, already transient,
-- already reconciled through the deliberate-boundary Cell sync contract) -- it is
-- never a second copy of the character.
--
-- Pre-launch: no real Operators/Handlers have used Live-Link yet, so this drops data
-- outright rather than migrating it forward.

alter table public.operator_profiles
  drop column if exists persistent_state,
  drop column if exists character_snapshot;
