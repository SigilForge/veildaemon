-- Cradlepoint Cell Lobby Model, migration 4/10: reintroduce a seat-presence filter on
-- is_session_operator(), now that it's safe to do so.
--
-- 20260802080000_operator_read_access_survives_left_at.sql dropped the `left_at is null`
-- filter entirely, because at the time handleClose set left_at on EVERY seat as a side effect
-- of closing the Cell -- in the very same action that delivered final archive projections --
-- so the Operator whose reward delivery needed reading lost read-visibility into the Cell the
-- instant Archive/Close ran. That root cause is now separately fixed: handleClose has not
-- touched any seat row since this session's earlier close-semantics fix, and this whole pass
-- makes the separation permanent -- Cell/Operation lifecycle transitions (open/active_
-- operation/post_operation/closed, preparing/active/resolving/suspended/archived) never
-- write to session_operator_state at all. The only remaining way a seat's seat_status moves
-- away from 'joined' is the Operator's own explicit `leave`, or the Handler's explicit
-- `remove-seat` -- both cases where losing read-visibility is the CORRECT behavior (they are
-- no longer part of the lobby), not an accidental side effect of an unrelated transition. It
-- is therefore safe to reintroduce a presence filter, keyed on the new seat_status column
-- rather than the legacy left_at (which stays in sync but is no longer the canonical check).

create or replace function public.is_session_operator(p_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.session_operator_state s
    where s.session_id = p_session_id
      and s.owner_user_id = auth.uid()
      and s.seat_status = 'joined'
  );
$$;
