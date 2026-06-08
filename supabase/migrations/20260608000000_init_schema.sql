-- Setup Database Schema for ReachMira

-- Enable extension for uuid generation
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (linked to Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  telegram_chat_id text,
  telegram_bot_token text,
  gemini_api_key text,
  mailgun_api_key text,
  mailgun_domain text,
  mailgun_from_email text,
  mailgun_from_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Trigger to automatically create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Campaigns Table
create table public.campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  status text not null default 'draft', -- draft, active, paused, completed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Campaigns
alter table public.campaigns enable row level security;

create policy "Users can perform CRUD on own campaigns" on public.campaigns
  for all using (auth.uid() = user_id);


-- 3. Leads Table
create table public.leads (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  email text not null,
  first_name text,
  last_name text,
  company text,
  variables jsonb default '{}'::jsonb not null,
  ai_personalization text,
  status text not null default 'imported', -- imported, sending, sent, replied, bounced, complained, unsubscribed
  unsubscribe_token text not null default encode(gen_random_bytes(16), 'hex') unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Leads
alter table public.leads enable row level security;

create policy "Users can manage leads of own campaigns" on public.leads
  for all using (
    exists (
      select 1 from public.campaigns
      where campaigns.id = leads.campaign_id
      and campaigns.user_id = auth.uid()
    )
  );


-- 4. Sequences (Email Steps) Table
create table public.sequences (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  step_number integer not null,
  delay_days integer not null default 1,
  subject text not null,
  body text not null, -- Contains sequence content, supports {{first_name}}, {{company}}, {{ai_personalization}}
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Sequences
alter table public.sequences enable row level security;

create policy "Users can manage sequences of own campaigns" on public.sequences
  for all using (
    exists (
      select 1 from public.campaigns
      where campaigns.id = sequences.campaign_id
      and campaigns.user_id = auth.uid()
    )
  );


-- 5. Outbox Table (Send queue)
create table public.outbox (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references public.leads(id) on delete cascade not null,
  sequence_id uuid references public.sequences(id) on delete cascade not null,
  scheduled_at timestamp with time zone not null,
  status text not null default 'pending', -- pending, sent, failed, cancelled
  error_message text,
  sent_at timestamp with time zone,
  mailgun_message_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Outbox
alter table public.outbox enable row level security;

create policy "Users can manage outbox items of own campaigns" on public.outbox
  for all using (
    exists (
      select 1 from public.leads
      join public.campaigns on campaigns.id = leads.campaign_id
      where leads.id = outbox.lead_id
      and campaigns.user_id = auth.uid()
    )
  );


-- 6. Activity Logs Table (For stats and events)
create table public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  outbox_id uuid references public.outbox(id) on delete set null,
  event_type text not null, -- sent, delivered, opened, clicked, replied, bounced, complained, unsubscribed
  payload jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Activity Logs
alter table public.activity_logs enable row level security;

create policy "Users can view activity logs of own campaigns" on public.activity_logs
  for select using (
    exists (
      select 1 from public.campaigns
      where campaigns.id = activity_logs.campaign_id
      and campaigns.user_id = auth.uid()
    )
  );


-- 7. Suppressions Table (Bounces, unsubscribes, spam reports)
create table public.suppressions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  email text not null,
  reason text not null, -- bounce, complaint, unsubscribe
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, email)
);

-- Enable RLS for Suppressions
alter table public.suppressions enable row level security;

create policy "Users can manage own suppressions" on public.suppressions
  for all using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists leads_campaign_id_idx on public.leads(campaign_id);
create index if not exists leads_email_idx on public.leads(email);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists outbox_scheduled_at_status_idx on public.outbox(scheduled_at, status);
create index if not exists activity_logs_campaign_id_idx on public.activity_logs(campaign_id);
create index if not exists suppressions_user_id_email_idx on public.suppressions(user_id, email);
