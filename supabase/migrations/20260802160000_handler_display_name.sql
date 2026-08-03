-- Cradlepoint Cell Lobby Model, migration 8/10: closes a gap discovered while designing chat
-- sender names. operator_profiles.display_name exists so an Operator's chat/roll/roster
-- identity is never their account email -- nothing analogous has ever existed for the
-- Handler side. Chat requires "character/designation names, never account emails" for BOTH
-- roles, so this column is required before send-chat can resolve a Handler's sender_name.

alter table public.handler_sessions
  add column handler_display_name text not null default 'Handler'
  check (char_length(handler_display_name) <= 80);

comment on column public.handler_sessions.handler_display_name is
  'Non-email display name shown as the sender of Handler chat messages and events. Settable at create-session time; editable later.';
