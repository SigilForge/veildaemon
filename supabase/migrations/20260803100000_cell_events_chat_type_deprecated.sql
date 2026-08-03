-- Multi-Cell Handler Management, migration 2/3: doc-comment-only, matching this repo's
-- existing 20260802180000 precedent (mark deprecated, don't perform risky destructive
-- surgery). Chat persistence model correction: Cell chat is now ephemeral to the current
-- Operation -- delivered via Supabase Realtime Broadcast on a topic scoped by
-- cell_id+operation_id (see 20260803110000_realtime_chat_broadcast_authorization.sql), never
-- written to Postgres at all. cell_events keeps the 'chat' value in its cell_event_type enum
-- (Postgres enum values are not safely dropped without a full type rebuild, and nothing here
-- justifies that risk) but no code writes or reads 'chat'-typed cell_events rows after this
-- migration. cell_events itself is unchanged and still live for the other six event kinds
-- (roll/action_declared/handler_update/acknowledged/round_advanced/operation_archived).

comment on type public.cell_event_type is
  'Deprecated value: chat. Chat moved to ephemeral Realtime Broadcast (cell-chat-<cellId>-<operationId> topics) and is never written to cell_events after 20260803100000 -- it is not durable campaign history, is excluded from checkpoints/exports/imports, and clears whenever the Operation changes. The other six values remain live.';
