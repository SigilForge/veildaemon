-- Weave feature, migration 6/7: WeaveClue ("Clue" in Handler-facing UI copy) -- Weave-level,
-- published, Operator-visible evidence records. Deliberately named/tabled distinctly from
-- BOTH (a) the existing per-Operation clueIntegrity.clues[] mechanical discover/secure/
-- archive state machine on cell_operations.clue_state (untouched by this feature, still
-- Needlepoint-authored, still works exactly as today) and (b) threads (Handler-only, never
-- published verbatim). A Handler PUBLISHES selected evidence FROM a Thread as one or more
-- WeaveClue rows -- publishing never reveals the Thread's title/notes/relationships; a
-- WeaveClue's title/body are independent, player-safe text the Handler writes at publish
-- time, not a filtered view of the Thread. One Thread may generate multiple WeaveClues over
-- time (thread_id is not unique here).
--
-- Provenance is captured INDEPENDENTLY per Clue, not inherited from thread_id, because one
-- Thread can publish multiple Clues from different evidence at different times -- each needs
-- its own source_operation_id/source_needlepoint_id/source_ref.
--
-- A Handler may draft a Clue (published_at null, Handler-only visible) before publishing it
-- (published_at set, Operator-visible). Operator-visible: SELECT uses the standard lobby-wide
-- "is_session_handler(cell_id) or (is_session_operator(cell_id) and published_at is not
-- null)" -- NOT the Handler-only pattern weaves/threads/cell_entities use, and specifically
-- gated on published_at so a client-side bug can never leak draft text (RLS enforces it, not
-- app code). INSERT/UPDATE remain Handler-only.

create table public.weave_clues (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.handler_sessions(id) on delete cascade,
  weave_id uuid not null references public.weaves(id) on delete cascade,
  -- Nullable so a WeaveClue can outlive its originating Thread if Threads ever gain a delete
  -- path in a later pass (on delete set null, not cascade) -- always populated at publish
  -- time by the API; not enforced not-null here purely for that future lifecycle reason.
  thread_id uuid references public.threads(id) on delete set null,
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 4000),
  source_operation_id uuid references public.cell_operations(id) on delete set null,
  source_needlepoint_id uuid references public.needlepoints(id) on delete set null,
  source_ref jsonb,
  -- Nullable: null = draft (Handler-only via RLS below), non-null = published (Operator-
  -- visible). Never backfilled implicitly -- set only by the publish action.
  published_at timestamptz,
  state_version integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index weave_clues_cell_idx on public.weave_clues(cell_id, published_at desc);
create index weave_clues_weave_idx on public.weave_clues(weave_id, published_at desc);

create trigger weave_clues_set_updated_at
before update on public.weave_clues
for each row execute function public.set_updated_at();

alter table public.weave_clues enable row level security;

create policy weave_clues_select on public.weave_clues
  for select to authenticated using (
    public.is_session_handler(cell_id)
    or (public.is_session_operator(cell_id) and published_at is not null)
  );

create policy weave_clues_insert on public.weave_clues
  for insert to authenticated with check (public.is_session_handler(cell_id, true));

create policy weave_clues_update on public.weave_clues
  for update to authenticated using (public.is_session_handler(cell_id, true));

grant select, insert, update on public.weave_clues to authenticated;
grant select, insert, update, delete on public.weave_clues to service_role;
