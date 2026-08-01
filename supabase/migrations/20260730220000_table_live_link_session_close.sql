-- Bridge the static Operator sheet into VeilLink Table Live-Link sessions.
--
-- operator_profiles.character_snapshot holds the raw imported Operator sheet
-- export (attributes, skills, background, ontology — none of which LiveState
-- models) for Handler reference during a session. It never flows through
-- mergeLiveState/defaultLiveState; it is a read-only reference blob, distinct
-- from persistent_state which continues to track only the live-session
-- resources (harm, stability, breach, voidMarks, conditions, unlocks).
--
-- handler_sessions.one_shot records the Handler's close-time choice of
-- whether this was a one-shot (final session for these characters) vs an
-- ongoing campaign session. Nullable until a session is actually closed.

alter table public.operator_profiles
  add column character_snapshot jsonb not null default '{}'::jsonb;

alter table public.handler_sessions
  add column one_shot boolean;
