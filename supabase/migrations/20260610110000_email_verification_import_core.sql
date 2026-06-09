alter table public.leads
  add column if not exists email_verification_status text default 'not_checked',
  add column if not exists email_verification_score integer,
  add column if not exists email_verification_provider text default 'local',
  add column if not exists email_verification_reason text,
  add column if not exists email_verified_at timestamp with time zone,
  add column if not exists email_verification_raw jsonb default '{}'::jsonb;
