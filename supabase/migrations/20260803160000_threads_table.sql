-- Weave feature, migration 5/7: Threads -- Handler-only campaign-continuity records scoped to
-- a Weave (promoted clues, recurring NPCs/entities, faction pressure, unresolved
-- consequences, contaminated/contradictory evidence, campaign-level discoveries, unresolved
-- questions -- one thread_kind value per category). status mirrors handler-state.js's
-- clueIntegrityStates vocabulary in NAME only -- this is a deliberately SEPARATE, parallel
-- status machine, not the same one reused, because clueIntegrity clues are tightly
-- Needlepoint-bound (reseeded from the active Needlepoint's core_clues on every
-- normalizeState() call, with positional ids like "core-clue-1" that are NOT stable across
-- different Needlepoints) while a Thread is meant to survive across many Needlepoints within
-- a Weave.
--
-- Handler-only end to end (select/insert/update), same deviation from the lobby-wide
-- cell_operations_select/cell_events_select precedent as weaves and cell_entities: Threads
-- are NEVER visible to Operators, not even via a visibility flag or a narrower projection.
-- Operator-visible content is published separately and explicitly via weave_clues.

create type public.thread_kind as enum (
  'clue', 'npc_entity', 'faction_pressure', 'consequence', 'evidence', 'discovery', 'question'
);
create type public.thread_status as enum (
  'active', 'confirmed', 'suspected', 'contaminated', 'rerouted', 'resolved'
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.handler_sessions(id) on delete cascade,
  weave_id uuid not null references public.weaves(id) on delete cascade,
  kind public.thread_kind not null default 'evidence',
  status public.thread_status not null default 'active',
  title text not null default '' check (char_length(title) <= 120),
  notes text not null default '' check (char_length(notes) <= 4000),
  -- Hidden relationships to OTHER Threads -- soft references only (jsonb, not a real FK
  -- array), matching this codebase's existing convention for structured-but-flexible
  -- Handler-authored blobs (scene_state/clue_state/npc_state on cell_operations). Shape:
  -- [{ "threadId": "<uuid>", "label": "free text relationship description" }, ...].
  relationships jsonb not null default '[]'::jsonb,
  -- When kind='npc_entity', points at the durable identity this Thread narrates involvement
  -- for -- see cell_entities' own comment for why a Thread is never the sole identity record.
  -- Null for other kinds, and null is also valid for npc_entity Threads not yet linked.
  entity_id uuid references public.cell_entities(id) on delete set null,
  -- Provenance only, never a live join: which Operation this was promoted from, snapshotted
  -- as free text since positional clue/NPC ids are not stable across Needlepoints and the
  -- source Operation may later be archived.
  source_operation_id uuid references public.cell_operations(id) on delete set null,
  source_ref text not null default '' check (char_length(source_ref) <= 120),
  state_version integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index threads_cell_idx on public.threads(cell_id, updated_at desc);
create index threads_weave_idx on public.threads(weave_id, updated_at desc);
create index threads_entity_idx on public.threads(entity_id) where entity_id is not null;

create trigger threads_set_updated_at
before update on public.threads
for each row execute function public.set_updated_at();

alter table public.threads enable row level security;

create policy threads_select on public.threads
  for select to authenticated using (public.is_session_handler(cell_id));

create policy threads_insert on public.threads
  for insert to authenticated with check (public.is_session_handler(cell_id, true));

create policy threads_update on public.threads
  for update to authenticated using (public.is_session_handler(cell_id, true));

grant select, insert, update on public.threads to authenticated;
grant select, insert, update, delete on public.threads to service_role;
