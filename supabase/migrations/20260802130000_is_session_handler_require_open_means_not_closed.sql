-- Cradlepoint Cell Lobby Model, migration 5/10: is_session_handler's p_require_open now means
-- "Cell is not CLOSED" rather than "Cell status = 'open'" literally.
--
-- Under the old two-value status, those were the same check. Under the new four-value Cell
-- status, they are not: the Handler must still be able to write seat handlerProjection data
-- (final archive rewards, chat sender resolution, etc.) while the Cell is in POST_OPERATION --
-- only CLOSED should block Handler writes. The function signature and parameter name
-- (p_require_open) are left unchanged so no call site (session_operator_state_update,
-- cell_operations' own insert/update policies) needs editing -- only its meaning shifts,
-- documented here and in the function's own comment.

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
      and (not p_require_open or h.status <> 'closed')
  );
$$;

comment on function public.is_session_handler(uuid, boolean) is
  'p_require_open=true means the Cell is not CLOSED (i.e. OPEN/ACTIVE_OPERATION/POST_OPERATION all pass) -- not literally status=''open''. Only Cell closure blocks Handler writes; Operation-level lifecycle (archived, suspended, etc.) is guarded separately at the API layer.';
