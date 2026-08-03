-- Weave feature, migration 4/7: durable Cell-level identity for a recurring NPC/Entity/Zone --
-- separate from (a) the Operation-local mutable npcs[]/entityLibrary[] arrays in
-- cell_operations.npc_state/scene_state (unchanged, still per-Operation, still the "current
-- mood/location right now" representation) and (b) a Thread's narrative-involvement record
-- (a Thread REFERENCES a cell_entities row via threads.entity_id, added in migration 5,
-- rather than being the entity's sole identity source). One durable entity can be referenced
-- by Threads across MULTIPLE different Weaves -- a recurring NPC's identity outlives any
-- single story arc.
--
-- Handler-only end to end (select/insert/update): canonical identity/description can carry
-- unrevealed information (a description may bake in secret backstory even before any Thread
-- narrates hidden involvement around it). Operators seeing the full mechanical npcs[]/
-- entityLibrary[] arrays today is a SEPARATE, pre-existing, per-Operation "current mood/
-- location" surface that this table does not change. Operator-facing NPC/entity knowledge is
-- published explicitly, the same way any other Weave-derived fact is: through weave_clues
-- (migration 6) -- a Handler publishes a Clue describing what's known about an entity,
-- optionally pointing back at it via weave_clues.source_ref (e.g.
-- {"kind":"entity","entityId":"<uuid>"}), never by exposing the cell_entities row itself.

create type public.cell_entity_kind as enum ('npc', 'entity', 'zone');

create table public.cell_entities (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.handler_sessions(id) on delete cascade,
  kind public.cell_entity_kind not null default 'npc',
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cell_entities_cell_idx on public.cell_entities(cell_id, name);

create trigger cell_entities_set_updated_at
before update on public.cell_entities
for each row execute function public.set_updated_at();

alter table public.cell_entities enable row level security;

create policy cell_entities_select on public.cell_entities
  for select to authenticated using (public.is_session_handler(cell_id));

create policy cell_entities_insert on public.cell_entities
  for insert to authenticated with check (public.is_session_handler(cell_id, true));

create policy cell_entities_update on public.cell_entities
  for update to authenticated using (public.is_session_handler(cell_id, true));

grant select, insert, update on public.cell_entities to authenticated;
grant select, insert, update, delete on public.cell_entities to service_role;
