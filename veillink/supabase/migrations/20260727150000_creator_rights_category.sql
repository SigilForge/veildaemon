alter table public.creator_rights_records
add column if not exists category text not null default 'other';
