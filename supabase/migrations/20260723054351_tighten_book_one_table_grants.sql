revoke all on table public.book_one_purchases from anon;
revoke all on table public.book_one_purchases from authenticated;

grant select on public.book_one_purchases to authenticated;
grant select, insert, update, delete on public.book_one_purchases to service_role;
