-- Durable Creator Rights issuance entitlement.
-- Payment (or internal publish) activates entitlement; QR asset APIs authorize against it.

alter table public.creator_rights_records
  add column if not exists entitlement_status text not null default 'none'
    check (entitlement_status in ('none', 'active', 'revoked')),
  add column if not exists qr_asset_version integer not null default 0,
  add column if not exists qr_preferences jsonb not null default '{}'::jsonb;

comment on column public.creator_rights_records.entitlement_status is
  'Issuance entitlement: none until paid publish, active after payment, revoked if withdrawn by policy.';
comment on column public.creator_rights_records.qr_asset_version is
  'Monotonic version for branded QR assets regenerated under an active entitlement.';
comment on column public.creator_rights_records.qr_preferences is
  'Last controlled QR customization preferences for this record (colors, mark, frame, labels).';

-- Backfill already-published paid records so redeploys do not strand owners.
update public.creator_rights_records
set entitlement_status = 'active',
    qr_asset_version = greatest(coalesce(qr_asset_version, 0), 1)
where entitlement_status = 'none'
  and record_status in ('published', 'updated', 'transferred', 'disputed', 'under_review')
  and coalesce(payment_status, '') = 'paid';

create or replace function public.creator_rights_publish_record(
  record_id_input uuid,
  actor_user_id_input uuid,
  checkout_session_id_input text,
  payment_intent_id_input text,
  stripe_customer_id_input text,
  amount_paid_input integer,
  currency_input text,
  payment_status_input text,
  internal_publication_input boolean default false
)
returns public.creator_rights_records
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.creator_rights_records;
  published_record public.creator_rights_records;
begin
  select *
  into current_record
  from public.creator_rights_records
  where id = record_id_input
  for update;

  if current_record.id is null then
    raise exception 'creator_rights_record_not_found';
  end if;

  if current_record.user_id <> actor_user_id_input then
    raise exception 'creator_rights_record_owner_mismatch';
  end if;

  if current_record.record_status in ('published', 'updated', 'transferred', 'disputed', 'under_review', 'withdrawn', 'archived') then
    if current_record.stripe_checkout_session_id = checkout_session_id_input then
      -- Idempotent webhook redelivery: ensure entitlement stays active.
      if current_record.entitlement_status <> 'active' then
        update public.creator_rights_records
        set entitlement_status = 'active',
            qr_asset_version = greatest(coalesce(qr_asset_version, 0), 1)
        where id = current_record.id
        returning * into published_record;
        return published_record;
      end if;
      return current_record;
    end if;
    raise exception 'creator_rights_record_already_published';
  end if;

  if current_record.record_status not in ('draft', 'pending_payment', 'paid') then
    raise exception 'creator_rights_record_invalid_publication_state';
  end if;

  if not internal_publication_input and payment_status_input <> 'paid' then
    raise exception 'creator_rights_record_payment_required';
  end if;

  update public.creator_rights_records
  set
    record_status = 'published',
    entitlement_status = 'active',
    qr_asset_version = greatest(coalesce(qr_asset_version, 0), 1),
    stripe_checkout_session_id = checkout_session_id_input,
    stripe_payment_intent_id = payment_intent_id_input,
    stripe_customer_id = stripe_customer_id_input,
    amount_paid = amount_paid_input,
    currency = lower(currency_input),
    payment_status = payment_status_input,
    payment_confirmed_at = now()
  where id = current_record.id
  returning *
  into published_record;

  insert into public.creator_rights_record_versions (
    record_id,
    version_number,
    snapshot_json,
    change_summary,
    created_by
  )
  values (
    published_record.id,
    1,
    to_jsonb(published_record),
    'Initial published snapshot',
    actor_user_id_input
  )
  on conflict (record_id, version_number) do nothing;

  return published_record;
end;
$$;

revoke execute on function public.creator_rights_publish_record(uuid, uuid, text, text, text, integer, text, text, boolean) from public;
revoke execute on function public.creator_rights_publish_record(uuid, uuid, text, text, text, integer, text, text, boolean) from anon;
revoke execute on function public.creator_rights_publish_record(uuid, uuid, text, text, text, integer, text, text, boolean) from authenticated;
grant execute on function public.creator_rights_publish_record(uuid, uuid, text, text, text, integer, text, text, boolean) to service_role;
