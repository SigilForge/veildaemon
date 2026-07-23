grant usage on schema public to service_role;

grant select, insert, update, delete
on public.profiles,
   public.redirects,
   public.scan_events,
   public.abuse_reports,
   public.audit_logs,
   public.stripe_webhook_events
to service_role;
