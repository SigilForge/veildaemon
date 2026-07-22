create extension if not exists pgcrypto;

create type public.veillink_plan as enum ('free', 'pro', 'business');
create type public.veillink_role as enum ('user', 'admin');
create type public.veillink_routing_mode as enum ('path', 'subdomain');
create type public.veillink_abuse_status as enum ('open', 'reviewing', 'closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan public.veillink_plan not null default 'free',
  role public.veillink_role not null default 'user',
  billing_provider text,
  billing_customer_id text,
  billing_subscription_id text,
  billing_status text not null default 'inactive',
  suspended_at timestamptz,
  suspension_reason text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 63),
  routing_mode public.veillink_routing_mode not null default 'path',
  destination_url text not null check (char_length(destination_url) between 1 and 2048),
  active boolean not null default true,
  expires_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 1000),
  qr_foreground text not null default '#111827',
  qr_background text not null default '#ffffff',
  qr_ecc text not null default 'H',
  total_scans bigint not null default 0,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routing_mode, slug)
);

create table public.scan_events (
  id uuid primary key default gen_random_uuid(),
  redirect_id uuid not null references public.redirects(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  referrer text,
  user_agent text,
  device_category text,
  browser_family text,
  operating_system text,
  country text
);

create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  redirect_id uuid references public.redirects(id) on delete set null,
  reporter_email text,
  reason text not null check (char_length(reason) between 1 and 120),
  details text not null default '' check (char_length(details) <= 2000),
  status public.veillink_abuse_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index redirects_user_id_idx on public.redirects(user_id);
create index redirects_slug_mode_idx on public.redirects(routing_mode, slug);
create index scan_events_redirect_time_idx on public.scan_events(redirect_id, scanned_at desc);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger redirects_set_updated_at
before update on public.redirects
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, terms_accepted_at)
  values (new.id, coalesce(new.email, ''), now())
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

revoke execute on function public.create_profile_for_auth_user() from public;

create or replace function public.is_veillink_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and suspended_at is null
  );
$$;

create or replace function public.increment_redirect_scans(redirect_id_input uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.redirects
  set total_scans = total_scans + 1
  where id = redirect_id_input;
$$;

revoke execute on function public.is_veillink_admin() from public;
grant execute on function public.is_veillink_admin() to authenticated;
revoke execute on function public.increment_redirect_scans(uuid) from public;
grant execute on function public.increment_redirect_scans(uuid) to service_role;

alter table public.profiles enable row level security;
alter table public.redirects enable row level security;
alter table public.scan_events enable row level security;
alter table public.abuse_reports enable row level security;
alter table public.audit_logs enable row level security;

create policy "users read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_veillink_admin());

create policy "users read own redirects"
on public.redirects for select
to authenticated
using (user_id = auth.uid() or public.is_veillink_admin());

create policy "users insert own redirects"
on public.redirects for insert
to authenticated
with check (user_id = auth.uid());

create policy "users update own redirects"
on public.redirects for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users delete own redirects"
on public.redirects for delete
to authenticated
using (user_id = auth.uid());

create policy "users read scans for own redirects"
on public.scan_events for select
to authenticated
using (
  exists (
    select 1 from public.redirects
    where redirects.id = scan_events.redirect_id
      and (redirects.user_id = auth.uid() or public.is_veillink_admin())
  )
);

create policy "anyone can file abuse reports"
on public.abuse_reports for insert
to anon, authenticated
with check (true);

create policy "admins read abuse reports"
on public.abuse_reports for select
to authenticated
using (public.is_veillink_admin());

create policy "admins read audit logs"
on public.audit_logs for select
to authenticated
using (public.is_veillink_admin());

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.redirects to authenticated;
grant select on public.scan_events to authenticated;
grant insert on public.abuse_reports to anon, authenticated;
grant select on public.abuse_reports to authenticated;
grant select on public.audit_logs to authenticated;
