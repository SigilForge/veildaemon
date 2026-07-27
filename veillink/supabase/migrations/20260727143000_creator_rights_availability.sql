alter table public.creator_rights_records
add column if not exists availability text not null default 'public'
check (availability in (
  'public',
  'licensed',
  'scheduled',
  'restricted',
  'internal',
  'archive_only',
  'redacted',
  'lost'
));
