alter table public.creator_rights_records
add column if not exists copyright_license_id text not null default 'proprietary'
check (copyright_license_id in (
  'proprietary',
  'mit',
  'apache-2.0',
  'bsd-3-clause',
  'mpl-2.0',
  'gpl-3.0-only',
  'lgpl-3.0-only',
  'agpl-3.0-only',
  'unlicense',
  'cc-by-4.0',
  'cc-by-sa-4.0',
  'cc-by-nc-4.0',
  'cc0-1.0',
  'custom'
));

alter table public.creator_rights_records
add column if not exists copyright_license_name text not null default 'Proprietary / all rights reserved';

alter table public.creator_rights_records
add column if not exists copyright_license_spdx_id text;

alter table public.creator_rights_records
add column if not exists copyright_license_url text;

alter table public.creator_rights_records
add column if not exists registry_framework_id text not null default 'sfr'
check (registry_framework_id in ('sfr'));

alter table public.creator_rights_records
add column if not exists registry_framework_version text not null default '1.0';

comment on column public.creator_rights_records.copyright_license_id is
  'Controlled primary copyright-license catalog id. This is separate from SFR and AI permissions.';
comment on column public.creator_rights_records.copyright_license_spdx_id is
  'Canonical SPDX identifier when the primary copyright license has one. Null for proprietary or custom terms.';
comment on column public.creator_rights_records.registry_framework_id is
  'Controlled Creator Rights registry framework id. SFR describes record semantics, provenance, verification, AI permissions, and machine-readable rights posture.';
comment on column public.creator_rights_records.registry_framework_version is
  'Creator Rights registry framework version. The framework supplements, and does not replace or modify, the primary copyright license.';
