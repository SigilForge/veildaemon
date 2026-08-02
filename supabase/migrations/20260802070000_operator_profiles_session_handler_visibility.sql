-- operator_profiles was owner-select-only, so a session's Handler had no way to see a
-- seated Operator's display_name/designation at all -- only the raw operator_profile_id
-- foreign key. That made "who has joined" invisible to the Handler independent of whether
-- the Operator had ever sent real sheet state (live_state.operatorSend), contributing to
-- the silent "0 seats matched" failure mode: nothing distinguished "nobody's here" from
-- "someone's here but I can't see them yet."
--
-- SECURITY DEFINER (matching is_session_handler/is_session_operator from
-- 20260801022500_fix_handler_sessions_rls_recursion.sql) rather than an inline EXISTS, for
-- the same reason: keeps this policy from becoming a second cross-table recursion path if
-- session_operator_state's or handler_sessions' own policies ever reference operator_profiles.

create or replace function public.operator_profile_visible_to_session_handler(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.session_operator_state s
    join public.handler_sessions h on h.id = s.session_id
    where s.operator_profile_id = p_profile_id
      and h.handler_user_id = auth.uid()
  );
$$;

revoke all on function public.operator_profile_visible_to_session_handler(uuid) from public;
grant execute on function public.operator_profile_visible_to_session_handler(uuid) to authenticated;

create policy operator_profiles_select_by_session_handler on public.operator_profiles
  for select to authenticated using (
    public.operator_profile_visible_to_session_handler(id)
  );
