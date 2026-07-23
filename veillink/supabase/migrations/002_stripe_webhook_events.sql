create table public.stripe_webhook_events (
  id text primary key,
  type text not null,
  livemode boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create index stripe_webhook_events_received_idx
on public.stripe_webhook_events(received_at desc);

alter table public.stripe_webhook_events enable row level security;

create policy "admins read stripe webhook events"
on public.stripe_webhook_events for select
to authenticated
using (public.is_veillink_admin());

grant select on public.stripe_webhook_events to authenticated;
