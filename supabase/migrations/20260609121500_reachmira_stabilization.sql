-- ReachMira stabilization: follow-up tracking, templates, and suppression controls

alter table public.leads
  add column if not exists emails_sent_count integer default 0 not null,
  add column if not exists last_email_type text,
  add column if not exists last_contacted_at timestamp with time zone,
  add column if not exists next_follow_up_at timestamp with time zone,
  add column if not exists reply_status text default 'no_reply' not null;

update public.leads
set
  emails_sent_count = coalesce(emails_sent_count, 0),
  reply_status = coalesce(reply_status, 'no_reply')
where emails_sent_count is null
   or reply_status is null;

alter table public.suppressions
  add column if not exists domain text,
  add column if not exists source text default 'manual';

create index if not exists suppressions_domain_idx on public.suppressions(domain);
create index if not exists suppressions_source_idx on public.suppressions(source);

create table if not exists public.email_templates_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  category text,
  subject text not null,
  body text not null,
  offer_type text,
  is_default boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table public.email_templates_library enable row level security;

drop policy if exists "Users can manage own email templates" on public.email_templates_library;
create policy "Users can manage own email templates" on public.email_templates_library
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists email_templates_library_user_id_idx on public.email_templates_library(user_id);
create index if not exists email_templates_library_category_idx on public.email_templates_library(category);

