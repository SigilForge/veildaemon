-- is_session_operator() required left_at IS NULL, meaning an Operator's read visibility into
-- handler_sessions (and, via session_mutations_select/session_rolls_select, related history)
-- disappeared the moment their seat was marked left -- including the left_at Archive
-- Session's handleClose sets on EVERY seat as part of closing the Cell, in the very same
-- action that delivers the final archive projection (session-end rewards among them). An
-- Operator's next Pull Handler -- the one meant to retrieve exactly that delivery -- got a
-- 404 ("Cell not found or not visible") instead, since the session row itself had become
-- invisible to them under RLS.
--
-- This function is read-only-visibility (handler_sessions_select, session_mutations_select,
-- session_rolls_select) -- never used to gate INSERT/UPDATE, so dropping the left_at
-- requirement only affects what a former seat-holder can still SEE, not what they can still
-- do. session_operator_state_update (and the API's own session.status = 'open' checks)
-- already separately block any write to a closed session regardless of this.

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
  );
$$;
