drop function if exists public.upsert_book_one_purchase_entitlement(text, text, text, integer, text, text, text, timestamptz, text, text);

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
  storage_path_input text,
  auth_user_id_input uuid default null
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

  if auth_user_id_input is not null then
    select id into matched_user_id
    from public.profiles
    where id = auth_user_id_input
    limit 1;
  end if;

  if matched_user_id is null and customer_email_input is not null and customer_email_input <> '' then
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
    auth_user_id = coalesce(excluded.auth_user_id, book_one_purchases.auth_user_id),
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

revoke execute on function public.upsert_book_one_purchase_entitlement(text, text, text, integer, text, text, text, timestamptz, text, text, uuid) from public;
grant execute on function public.upsert_book_one_purchase_entitlement(text, text, text, integer, text, text, text, timestamptz, text, text, uuid) to service_role;
