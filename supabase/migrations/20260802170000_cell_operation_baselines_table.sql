-- Cradlepoint Cell Lobby Model, migration 9/10: the Operator's complete, immutable,
-- checksummed legal character-sheet snapshot at the moment an Operation starts.
--
-- This is NOT the "ferry problem" (a second, mutable, server-authoritative character
-- record) that this codebase has explicitly rejected before -- it is write-once per
-- (operation_id, seat_id), has no update or delete policy at all, and is never a play
-- surface: the Operator's own local sheet remains the only place anything here is ever
-- edited or acted from. It exists solely so a Handler can answer "what did they actually
-- have when this Operation started" -- including while that Operator is fully offline, since
-- this is a plain authenticated database row, not a live projection tied to a connection.
--
-- `sheet` stores the Operator's real operatorStatus + equipment/anomalies/relationships/
-- residue, serialized whole -- "complete legal character sheet" means actually complete,
-- not another narrow projection like handlerProjection/operatorSend.
--
-- Deliberate, confirmed decision: this is NOT gated by handler-state.js's
-- playerLoadPresentation/player.ontologyPresentationKey classification (the mechanism that
-- normally decides whether the Handler's LIVE projection computes/shows a given Operator's
-- Presentation Load or Drift at all, fictionally "has VeilCorp actually filed this Operator as
-- X yet"). That gate governs the ongoing table-facing projection. This record is a legal/
-- dispute-prevention snapshot, and full disclosure is the entire point of it existing --
-- an Operator's ontologyPresentation, current Load, and Drift/Scars are all visible here the
-- moment a baseline is published, regardless of whatever the Handler's own roster happens to
-- have classified that seat as. Do not "fix" this into matching the live-projection gate;
-- the two are intentionally different scopes (audit record vs. table-facing reveal).

create table public.cell_operation_baselines (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.cell_operations(id) on delete cascade,
  seat_id uuid not null references public.session_operator_state(id) on delete cascade,
  operator_profile_id uuid not null references public.operator_profiles(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  schema_version integer not null default 1,
  sheet jsonb not null,
  checksum text not null,
  published_at timestamptz not null default now(),
  unique (operation_id, seat_id)
);

create index cell_operation_baselines_operation_idx on public.cell_operation_baselines(operation_id);

alter table public.cell_operation_baselines enable row level security;

-- Visible only to the owning Operator and the Cell's Handler -- NOT other seated Operators,
-- matching the existing norm that operator_profiles exposes only display_name/designation
-- cross-table, never stats/sheet data.
create policy cell_operation_baselines_select on public.cell_operation_baselines
  for select to authenticated using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.cell_operations o
      where o.id = cell_operation_baselines.operation_id
        and public.is_session_handler(o.cell_id)
    )
  );

-- Only the owning Operator publishes their own baseline -- the one place in this whole pass
-- where the Operator, not the Handler, is the writer of something the Handler reads.
-- Exactly-once-per-(operation_id, seat_id) is enforced by the unique constraint above; there
-- is no update/delete policy at all, which is what makes this immutable in the literal sense.
create policy cell_operation_baselines_insert on public.cell_operation_baselines
  for insert to authenticated with check (owner_user_id = auth.uid());

grant select, insert on public.cell_operation_baselines to authenticated;
grant select, insert, update, delete on public.cell_operation_baselines to service_role;
