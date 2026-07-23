create table public.book_one_purchases (
  id uuid primary key default gen_random_uuid(),
  product_key text not null default 'book_one_pdf',
  auth_user_id uuid references public.profiles(id) on delete set null,
  customer_email text,
  stripe_checkout_session_id text not null unique,
  stripe_customer_id text,
  price_id text not null,
  amount_total integer,
  currency text not null default 'usd',
  payment_status text not null,
  purchased_at timestamptz,
  storage_bucket text not null,
  storage_path text not null,
  claim_count integer not null default 0,
  first_claimed_at timestamptz,
  last_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index book_one_purchases_auth_user_idx
on public.book_one_purchases(auth_user_id);

create index book_one_purchases_customer_email_idx
on public.book_one_purchases(lower(customer_email));

create index book_one_purchases_stripe_customer_idx
on public.book_one_purchases(stripe_customer_id);

create trigger book_one_purchases_set_updated_at
before update on public.book_one_purchases
for each row execute function public.set_updated_at();

create or replace function public.upsert_book_one_purchase_entitlement(
  session_id_input text,
  stripe_customer_id_input text,
  customer_email_input text,
  amount_total_input integer,
  currency_input text,
  payment_status_input text,
  price_id_input text,
  purchased_at_input timestamptz,
  storage_bucket_input text,
  storage_path_input text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_user_id uuid;
  purchase_id uuid;
begin
  if session_id_input is null or session_id_input = '' then
    raise exception 'stripe checkout session id is required';
  end if;

  if price_id_input is null or price_id_input = '' then
    raise exception 'stripe price id is required';
  end if;

  if customer_email_input is not null and customer_email_input <> '' then
    select id into matched_user_id
    from public.profiles
    where lower(email) = lower(customer_email_input)
    order by created_at asc
    limit 1;
  end if;

  insert into public.book_one_purchases (
    auth_user_id,
    customer_email,
    stripe_checkout_session_id,
    stripe_customer_id,
    price_id,
    amount_total,
    currency,
    payment_status,
    purchased_at,
    storage_bucket,
    storage_path
  )
  values (
    matched_user_id,
    nullif(customer_email_input, ''),
    session_id_input,
    nullif(stripe_customer_id_input, ''),
    price_id_input,
    amount_total_input,
    lower(coalesce(nullif(currency_input, ''), 'usd')),
    payment_status_input,
    purchased_at_input,
    storage_bucket_input,
    storage_path_input
  )
  on conflict (stripe_checkout_session_id)
  do update set
    auth_user_id = coalesce(book_one_purchases.auth_user_id, excluded.auth_user_id),
    customer_email = coalesce(book_one_purchases.customer_email, excluded.customer_email),
    stripe_customer_id = coalesce(book_one_purchases.stripe_customer_id, excluded.stripe_customer_id),
    price_id = excluded.price_id,
    amount_total = excluded.amount_total,
    currency = excluded.currency,
    payment_status = excluded.payment_status,
    purchased_at = coalesce(book_one_purchases.purchased_at, excluded.purchased_at),
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path
  returning id into purchase_id;

  return purchase_id;
end;
$$;

create or replace function public.record_book_one_purchase_claim(
  purchase_id_input uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.book_one_purchases
  set
    claim_count = claim_count + 1,
    first_claimed_at = coalesce(first_claimed_at, now()),
    last_claimed_at = now()
  where id = purchase_id_input;

  if not found then
    raise exception 'book one purchase not found';
  end if;
end;
$$;

revoke execute on function public.upsert_book_one_purchase_entitlement(text, text, text, integer, text, text, text, timestamptz, text, text) from public;
grant execute on function public.upsert_book_one_purchase_entitlement(text, text, text, integer, text, text, text, timestamptz, text, text) to service_role;
revoke execute on function public.record_book_one_purchase_claim(uuid) from public;
grant execute on function public.record_book_one_purchase_claim(uuid) to service_role;

alter table public.book_one_purchases enable row level security;

create policy "users read own book one purchases"
on public.book_one_purchases for select
to authenticated
using (
  auth_user_id = auth.uid()
  or (
    customer_email is not null
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and lower(profiles.email) = lower(book_one_purchases.customer_email)
    )
  )
  or public.is_veillink_admin()
);

grant select on public.book_one_purchases to authenticated;
grant select, insert, update, delete on public.book_one_purchases to service_role;
