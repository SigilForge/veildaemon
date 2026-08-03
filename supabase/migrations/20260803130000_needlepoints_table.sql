-- Weave feature, migration 2/7: Needlepoint becomes durable identity beneath a Weave (was: a
-- free string on cell_operations, treated as identity -- retired outright in migration 3).
-- Cell 1:N Weave 1:N Needlepoint 1:N Operation. template_id/title are Handler-facing metadata
-- pointing at the existing static JSON scaffold (handler/templates.json,
-- handler/needlepoints/*.json) -- there is still no DB row for scaffold CONTENT, only for the
-- Weave-scoped case instance that content is being run as. template_id is nullable with no
-- sentinel: a genuinely custom Needlepoint with no backing static template is a real, valid
-- case. No status column: "is this Needlepoint still open" is derived from its Operations'
-- own statuses, not tracked redundantly here.
--
-- Handler-only by default, with an explicit published_at gate mirroring weave_clues' own
-- draft/publish pattern -- NOT lobby-wide. A lobby-wide read would let an Operator browse
-- every planned Needlepoint in the Cell, including future scenario titles never yet run, a
-- real spoiler leak the old free-text field never had (that field only ever surfaced via the
-- ACTIVE Operation's own row, never as a browsable list of every case ever authored).
-- handleStartOperation auto-publishes a Needlepoint the moment play actually begins -- the
-- natural reveal point -- while an explicit publish-needlepoint action still allows an
-- earlier reveal (e.g. hyping a case title before session night).

create table public.needlepoints (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.handler_sessions(id) on delete cascade,
  weave_id uuid not null references public.weaves(id) on delete cascade,
  template_id text check (char_length(template_id) <= 120),
  title text not null check (char_length(title) between 1 and 160),
  -- Nullable: null = draft (Handler-only), non-null = published (Operator-visible once this
  -- row's own published_at is set -- never derived from "has an Operation started," to keep
  -- this the same explicit-reveal shape as weave_clues rather than an implicit inference).
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index needlepoints_weave_idx on public.needlepoints(weave_id, updated_at desc);

create trigger needlepoints_set_updated_at
before update on public.needlepoints
for each row execute function public.set_updated_at();

alter table public.needlepoints enable row level security;

create policy needlepoints_select on public.needlepoints
  for select to authenticated using (
    public.is_session_handler(cell_id)
    or (public.is_session_operator(cell_id) and published_at is not null)
  );

create policy needlepoints_insert on public.needlepoints
  for insert to authenticated with check (public.is_session_handler(cell_id, true));

create policy needlepoints_update on public.needlepoints
  for update to authenticated using (public.is_session_handler(cell_id, true));

grant select, insert, update on public.needlepoints to authenticated;
grant select, insert, update, delete on public.needlepoints to service_role;
