-- handler_sessions_select queries session_operator_state, and
-- session_operator_state_select / session_operator_state_update query
-- handler_sessions right back (session_mutations_select nests both). Postgres
-- detects that cycle while building the query and raises "infinite recursion
-- detected in policy for relation handler_sessions" for any query that
-- actually needs the cross-table branch — most visibly when the same user is
-- both the session's Handler and one of its Operators.
--
-- SECURITY DEFINER functions run as the function owner (the migration role,
-- which owns these tables and therefore bypasses RLS on them), so moving the
-- cross-table checks into functions breaks the cycle instead of re-entering
-- the other table's policy.

create or replace function public.is_session_handler(p_session_id uuid, p_require_open boolean default false)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.handler_sessions h
    where h.id = p_session_id
      and h.handler_user_id = auth.uid()
      and (not p_require_open or h.status = 'open')
  );
$$;

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
      and s.left_at is null
  );
$$;

revoke all on function public.is_session_handler(uuid, boolean) from public;
revoke all on function public.is_session_operator(uuid) from public;
grant execute on function public.is_session_handler(uuid, boolean) to authenticated;
grant execute on function public.is_session_operator(uuid) to authenticated;

drop policy if exists handler_sessions_select on public.handler_sessions;
create policy handler_sessions_select on public.handler_sessions
  for select to authenticated using (
    handler_user_id = auth.uid()
    or public.is_session_operator(id)
  );

drop policy if exists session_operator_state_select on public.session_operator_state;
create policy session_operator_state_select on public.session_operator_state
  for select to authenticated using (
    owner_user_id = auth.uid()
    or public.is_session_handler(session_id)
  );

drop policy if exists session_operator_state_update on public.session_operator_state;
create policy session_operator_state_update on public.session_operator_state
  for update to authenticated using (
    owner_user_id = auth.uid()
    or public.is_session_handler(session_id, true)
  );

drop policy if exists session_mutations_select on public.session_mutations;
create policy session_mutations_select on public.session_mutations
  for select to authenticated using (
    public.is_session_handler(session_id) or public.is_session_operator(session_id)
  );
