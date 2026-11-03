-- redirects.total_scans drifted from scan_events because resolvers wrote the
-- scan row and the counter increment as two independent requests; when the
-- increment failed, the scan was logged but never counted. The counter is now
-- maintained by a trigger in the same transaction as the scan insert.

create or replace function public.count_redirect_scan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.redirects
  set total_scans = total_scans + 1
  where id = new.redirect_id;
  return new;
end;
$$;

revoke execute on function public.count_redirect_scan() from public;

create trigger scan_events_count_redirect_scan
after insert on public.scan_events
for each row execute function public.count_redirect_scan();

-- Kept as a no-op so resolvers still deployed with the old two-write path
-- cannot double count while they are redeployed.
create or replace function public.increment_redirect_scans(redirect_id_input uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select;
$$;

-- Re-derive every counter from the scan log it summarizes.
update public.redirects r
set total_scans = coalesce(
  (select count(*) from public.scan_events e where e.redirect_id = r.id), 0)
where r.total_scans is distinct from coalesce(
  (select count(*) from public.scan_events e where e.redirect_id = r.id), 0);
