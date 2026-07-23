alter table public.redirects
  add column if not exists qr_art text not null default 'emblem',
  add column if not exists qr_custom_art_url text not null default '',
  add column if not exists qr_accent text not null default '',
  add column if not exists qr_accent_rate double precision not null default 0.025,
  add column if not exists qr_eye_color text not null default '',
  add column if not exists qr_frame_style text not null default 'badge',
  add column if not exists qr_frame_title text not null default '',
  add column if not exists qr_frame_subtitle text not null default '',
  add column if not exists qr_node text not null default '',
  add column if not exists qr_clearance text not null default '',
  add column if not exists qr_footer text not null default '';
