-- Studio operator has no redirect cap. Signup can opt in to the email list.

update public.profiles
set role = 'admin'
where lower(email) = 'knoxmortis@gmail.com'
  and role is distinct from 'admin';

create table public.email_list_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  source text not null default 'signup',
  opted_in_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_list_subscriptions_email_key unique (email),
  constraint email_list_subscriptions_email_normalized check (email = lower(email)),
  constraint email_list_subscriptions_source_len check (char_length(source) between 1 and 40)
);

create index email_list_subscriptions_opted_in_idx
  on public.email_list_subscriptions (opted_in_at desc)
  where unsubscribed_at is null;

create trigger email_list_subscriptions_set_updated_at
before update on public.email_list_subscriptions
for each row execute function public.set_updated_at();

alter table public.email_list_subscriptions enable row level security;

create policy "readers see own email list row"
on public.email_list_subscriptions for select
to authenticated
using (user_id = auth.uid() or public.is_veillink_admin());

grant select on public.email_list_subscriptions to authenticated;
grant select, insert, update, delete on public.email_list_subscriptions to service_role;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  assigned_role public.veillink_role := 'user';
  wants_email_list boolean := coalesce(new.raw_user_meta_data ->> 'email_list_opt_in', '') in ('true', 't', '1');
begin
  if normalized_email = 'knoxmortis@gmail.com' then
    assigned_role := 'admin';
  end if;

  insert into public.profiles (id, email, terms_accepted_at, role)
  values (new.id, coalesce(new.email, ''), now(), assigned_role)
  on conflict (id) do nothing;

  if wants_email_list and normalized_email <> '' then
    insert into public.email_list_subscriptions (user_id, email, source)
    values (new.id, normalized_email, 'signup')
    on conflict (email) do update
      set user_id = excluded.user_id,
          source = excluded.source,
          unsubscribed_at = null,
          opted_in_at = now();
  end if;

  return new;
end;
$$;

revoke execute on function public.create_profile_for_auth_user() from public, anon, authenticated;

insert into public.email_list_subscriptions (user_id, email, source, opted_in_at)
select p.id,
       lower(u.email),
       'signup',
       u.created_at
from auth.users u
join public.profiles p on p.id = u.id
where lower(coalesce(u.email, '')) <> ''
  and coalesce(u.raw_user_meta_data ->> 'email_list_opt_in', '') in ('true', 't', '1')
on conflict (email) do nothing;
