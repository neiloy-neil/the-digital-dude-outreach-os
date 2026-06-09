alter table public.campaigns
  add column if not exists allow_risky_emails boolean default false not null;
