create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "users read own book one purchases" on public.book_one_purchases;

create policy "users read own book one purchases"
on public.book_one_purchases for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or (
    customer_email is not null
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and lower(profiles.email) = lower(book_one_purchases.customer_email)
    )
  )
  or (select public.is_veillink_admin())
);
