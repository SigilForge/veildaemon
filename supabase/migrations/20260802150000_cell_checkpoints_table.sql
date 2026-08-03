-- Cradlepoint Cell Lobby Model, migration 7/10: versioned, immutable Cell/Operation
-- checkpoints -- what Save Cell / Suspend Operation / Archive Operation / Export Snapshot all
-- write to, and what Resume Cell reads to restore shared state after every browser closes.
--
-- Append-only, matching session_mutations'/cell_checkpoints' own insert-only shape: no
-- update or delete grant exists at all, which is what makes "immutable" a literal database
-- fact rather than an application convention nobody happens to violate.
--
-- The payload shape stored in `payload` mirrors the exact top-level JSON contract given for
-- exported snapshots (schemaVersion/cellId/operationId/revision/createdAt/createdBy/
-- previousSnapshotId/checksum/cell/operation/roster/eventCursor) -- this table stores that
-- same object; export-snapshot just returns one verbatim.

create table public.cell_checkpoints (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.handler_sessions(id) on delete cascade,
  operation_id uuid references public.cell_operations(id) on delete set null,
  revision integer not null check (revision >= 1),
  reason text not null check (char_length(reason) <= 40), -- 'save_cell' | 'suspend_operation' | 'archive_operation' | 'export'
  previous_snapshot_id uuid references public.cell_checkpoints(id),
  checksum text not null,
  payload jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (cell_id, revision)
);

create index cell_checkpoints_cell_idx on public.cell_checkpoints(cell_id, revision desc);

alter table public.cell_checkpoints enable row level security;

-- Lobby-wide read for audit transparency (Operators can see checkpoint metadata even though
-- only the Handler ever triggers a write) -- mirrors giving Operators lobby-wide read on
-- session_mutations today.
create policy cell_checkpoints_select on public.cell_checkpoints
  for select to authenticated using (
    public.is_session_handler(cell_id) or public.is_session_operator(cell_id)
  );
create policy cell_checkpoints_insert on public.cell_checkpoints
  for insert to authenticated with check (public.is_session_handler(cell_id));

grant select, insert on public.cell_checkpoints to authenticated;
grant select, insert, update, delete on public.cell_checkpoints to service_role;

-- Completes the forward reference deferred from migration 2 (cell_operations was created
-- before this table existed).
alter table public.cell_operations
  add constraint cell_operations_final_snapshot_id_fkey
  foreign key (final_snapshot_id) references public.cell_checkpoints(id);
