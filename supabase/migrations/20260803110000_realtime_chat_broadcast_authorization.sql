-- Multi-Cell Handler Management, migration 3/3: Realtime Authorization (RLS on
-- realtime.messages) for the two ephemeral chat topics per Cell+Operation, confirmed
-- supported on the installed Realtime image (v2.112.6, `docker inspect
-- supabase_realtime_veildaemon`).
--
-- Topic naming uses ':' as the segment delimiter, never '-', specifically because cellId and
-- operationId are UUIDs that already contain internal hyphens ("xxxxxxxx-xxxx-xxxx-xxxx-
-- xxxxxxxxxxxx") -- a hyphen-delimited topic scheme would make parsing the id back out of
-- realtime.topic() ambiguous/fragile. ':' never appears in a UUID or in the literal prefixes
-- below, so split_part(topic, ':', 2) unambiguously recovers the cellId regardless of prefix:
--   plain topic:  cell-chat:<cellId>:<operationId|lobby>
--   resync topic: cell-chat-resync:<cellId>:<operationId|lobby>
--
-- Two topics, not one, so "only the server can claim a sender identity" and "peers can
-- freely negotiate resync" get different write permissions without needing per-broadcast-
-- event RLS granularity:
--   - cell-chat:%          -- SELECT only for seated participants. NO authenticated INSERT
--                             policy at all -- only service_role (used by send-chat's server-
--                             side relay) can publish here. This is what preserves
--                             "sender_name is resolved server-side, never trusted from the
--                             client" now that chat no longer goes through casPatchSeat/a
--                             validated table insert.
--   - cell-chat-resync:%   -- SELECT and INSERT both open to seated participants, since this
--                             is deliberately peer-to-peer (see handleSendChat's and the peer-
--                             resync protocol's own comments for the accepted trust trade-off:
--                             a compromised peer could alter text while relaying a resync
--                             response -- inherent to "elect one seated peer" as specified,
--                             not an oversight).

create or replace function public.cell_chat_topic_cell_id(p_topic text)
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  raw text;
begin
  raw := split_part(p_topic, ':', 2);
  if raw ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return raw::uuid;
  end if;
  return null;
end;
$$;

revoke all on function public.cell_chat_topic_cell_id(text) from public;
grant execute on function public.cell_chat_topic_cell_id(text) to authenticated;

create policy cell_chat_broadcast_select on "realtime"."messages"
  for select to authenticated
  using (
    realtime.topic() like 'cell-chat:%'
    and (
      public.is_session_handler(public.cell_chat_topic_cell_id(realtime.topic()))
      or public.is_session_operator(public.cell_chat_topic_cell_id(realtime.topic()))
    )
  );

create policy cell_chat_resync_select on "realtime"."messages"
  for select to authenticated
  using (
    realtime.topic() like 'cell-chat-resync:%'
    and (
      public.is_session_handler(public.cell_chat_topic_cell_id(realtime.topic()))
      or public.is_session_operator(public.cell_chat_topic_cell_id(realtime.topic()))
    )
  );

create policy cell_chat_resync_insert on "realtime"."messages"
  for insert to authenticated
  with check (
    realtime.topic() like 'cell-chat-resync:%'
    and (
      public.is_session_handler(public.cell_chat_topic_cell_id(realtime.topic()))
      or public.is_session_operator(public.cell_chat_topic_cell_id(realtime.topic()))
    )
  );
