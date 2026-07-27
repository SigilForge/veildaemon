create type public.creator_rights_record_status as enum (
  'draft',
  'published',
  'updated',
  'transferred',
  'disputed',
  'under_review',
  'withdrawn',
  'archived'
);

create type public.creator_rights_permission_value as enum (
  'allowed',
  'prohibited',
  'license_required',
  'research_only',
  'case_by_case',
  'custom_terms',
  'not_specified'
);

create sequence if not exists public.creator_rights_record_number_seq;

create table public.creator_rights_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  work_type text not null,
  description text not null,
  creator_name text not null,
  public_display_name text not null,
  rights_holder_name text not null,
  contact_email text not null,
  creation_date text,
  publication_date text,
  edition text,
  external_identifier text,
  source_url text,
  licensing_contact text,
  copyright_notice text,
  rights_statement text not null,
  ai_permissions jsonb not null default '{}'::jsonb,
  ai_permissions_summary text not null,
  human_commercial_license_available public.creator_rights_permission_value not null default 'license_required',
  record_status public.creator_rights_record_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  filename text,
  file_size bigint,
  mime_type text,
  sha256_hash text check (sha256_hash is null or sha256_hash ~* '^[a-f0-9]{64}$'),
  hash_created_at timestamptz
);

create table public.creator_rights_record_versions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.creator_rights_records(id) on delete cascade,
  version_number integer not null,
  snapshot_json jsonb not null,
  change_summary text not null default 'Initial snapshot',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (record_id, version_number)
);

create table public.creator_rights_license_inquiries (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.creator_rights_records(id) on delete cascade,
  requester_name text not null,
  company text,
  email text not null,
  intended_use text not null,
  ai_use_type text,
  use_class text,
  dataset_size text,
  expected_duration text,
  distribution_plan text,
  budget_range text,
  notes text,
  created_at timestamptz not null default now()
);

create or replace function public.creator_rights_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger creator_rights_records_touch_updated_at
before update on public.creator_rights_records
for each row execute function public.creator_rights_touch_updated_at();

create or replace function public.creator_rights_assign_record_id()
returns trigger
language plpgsql
as $$
begin
  if new.record_status <> 'draft' and new.record_id is null then
    new.record_id := 'SFR-' || to_char(coalesce(new.published_at, now()), 'YYYY') || '-' ||
      lpad(nextval('public.creator_rights_record_number_seq')::text, 6, '0');
  end if;
  if new.record_status <> 'draft' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger creator_rights_assign_record_id
before insert or update of record_status on public.creator_rights_records
for each row execute function public.creator_rights_assign_record_id();

alter table public.creator_rights_records enable row level security;
alter table public.creator_rights_record_versions enable row level security;
alter table public.creator_rights_license_inquiries enable row level security;

create policy "published creator rights records are readable"
on public.creator_rights_records for select
using (record_status <> 'draft' or auth.uid() = user_id);

create policy "users manage their creator rights drafts"
on public.creator_rights_records for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "record versions follow parent visibility"
on public.creator_rights_record_versions for select
using (
  exists (
    select 1 from public.creator_rights_records r
    where r.id = record_id
    and (r.record_status <> 'draft' or r.user_id = auth.uid())
  )
);

create policy "users can create own record versions"
on public.creator_rights_record_versions for insert
with check (
  exists (
    select 1 from public.creator_rights_records r
    where r.id = record_id
    and r.user_id = auth.uid()
  )
);

create policy "record owners read license inquiries"
on public.creator_rights_license_inquiries for select
using (
  exists (
    select 1 from public.creator_rights_records r
    where r.id = record_id
    and r.user_id = auth.uid()
  )
);

create policy "public can create license inquiries"
on public.creator_rights_license_inquiries for insert
with check (
  exists (
    select 1 from public.creator_rights_records r
    where r.id = record_id
    and r.record_status <> 'draft'
  )
);

grant select on public.creator_rights_records to anon;
grant select, insert, update on public.creator_rights_records to authenticated;
grant select, insert on public.creator_rights_record_versions to authenticated;
grant select, insert on public.creator_rights_license_inquiries to anon, authenticated;
