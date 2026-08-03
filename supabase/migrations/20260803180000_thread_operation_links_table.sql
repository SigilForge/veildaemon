-- Weave feature, migration 7/7: marks a Thread as deliberately "pulled into" a specific
-- Operation, as a private GM reference (e.g. "this session's prep pulls in the Rusted Key
-- faction-pressure Thread"). Handler-only, matching threads' own RLS -- linking a Thread to
-- an Operation is itself Thread-shaped information (which arcs are live in which session) and
-- must be just as invisible to Operators.
--
-- Pure many-to-many marker with no mutable content worth CAS-versioning -- uses a composite
-- primary key (thread_id, operation_id) instead of a surrogate id, and has no state_version/
-- set_updated_at trigger. cell_id is still denormalized per this pass's general convention,
-- trusted from the API layer's own thread/operation cell_id cross-check (fetchThread/
-- fetchOperation both verify cell_id before insert) -- the same trust boundary
-- cell_events.operation_id already relies on today.

create table public.thread_operation_links (
  thread_id uuid not null references public.threads(id) on delete cascade,
  operation_id uuid not null references public.cell_operations(id) on delete cascade,
  cell_id uuid not null references public.handler_sessions(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (thread_id, operation_id)
);

create index thread_operation_links_operation_idx on public.thread_operation_links(operation_id);

alter table public.thread_operation_links enable row level security;

create policy thread_operation_links_select on public.thread_operation_links
  for select to authenticated using (public.is_session_handler(cell_id));

create policy thread_operation_links_insert on public.thread_operation_links
  for insert to authenticated with check (public.is_session_handler(cell_id, true));

-- Permits editing `note` in place (upsert via on_conflict=thread_id,operation_id) without a
-- separate delete+insert round trip.
create policy thread_operation_links_update on public.thread_operation_links
  for update to authenticated using (public.is_session_handler(cell_id, true));

create policy thread_operation_links_delete on public.thread_operation_links
  for delete to authenticated using (public.is_session_handler(cell_id, true));

grant select, insert, update, delete on public.thread_operation_links to authenticated;
grant select, insert, update, delete on public.thread_operation_links to service_role;
