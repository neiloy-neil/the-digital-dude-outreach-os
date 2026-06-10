-- Add administrative columns to waitlist_signups
alter table public.waitlist_signups 
  add column if not exists invited_at timestamp with time zone,
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists admin_notes text;
