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
-- Add SMTP columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS smtp_host text, 
ADD COLUMN IF NOT EXISTS smtp_port integer, 
ADD COLUMN IF NOT EXISTS smtp_user text, 
ADD COLUMN IF NOT EXISTS smtp_pass text;
-- Add IMAP configuration to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS imap_host text,
ADD COLUMN IF NOT EXISTS imap_port integer DEFAULT 993,
ADD COLUMN IF NOT EXISTS imap_user text,
ADD COLUMN IF NOT EXISTS imap_pass text;

-- Add personalization and approval status to leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS personalization_strategy text,
ADD COLUMN IF NOT EXISTS personalized_subject text,
ADD COLUMN IF NOT EXISTS personalized_body text,
ADD COLUMN IF NOT EXISTS approval_status text NOT null DEFAULT 'pending_review'; -- pending_review, approved, skipped

-- Add standard profile fields to leads table to make them indexable and clean
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS sub_industry text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS company_size text,
ADD COLUMN IF NOT EXISTS estimated_revenue text,
ADD COLUMN IF NOT EXISTS decision_maker_name text,
ADD COLUMN IF NOT EXISTS decision_maker_title text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS tech_stack text,
ADD COLUMN IF NOT EXISTS pain_points text,
ADD COLUMN IF NOT EXISTS solution_fit_score integer,
ADD COLUMN IF NOT EXISTS lead_source text,
ADD COLUMN IF NOT EXISTS priority text,
ADD COLUMN IF NOT EXISTS assigned_to text,
ADD COLUMN IF NOT EXISTS tags text,
ADD COLUMN IF NOT EXISTS notes text;

-- Indexing for lookup and filter speeds
CREATE INDEX IF NOT EXISTS leads_approval_status_idx ON public.leads(approval_status);
CREATE INDEX IF NOT EXISTS leads_email_lower_idx ON public.leads(lower(email));
-- Upgrade leads table for flexible imports and AI outputs
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS qc_by text,
ADD COLUMN IF NOT EXISTS outreach_channel text,
ADD COLUMN IF NOT EXISTS outreach_status text,
ADD COLUMN IF NOT EXISTS last_contacted timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_follow_up_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS sequence_step integer,
ADD COLUMN IF NOT EXISTS response_summary text,
ADD COLUMN IF NOT EXISTS demo_scheduled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS proposal_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_deal_size numeric,
ADD COLUMN IF NOT EXISTS current_step integer,
ADD COLUMN IF NOT EXISTS next_email_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_email_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
ADD COLUMN IF NOT EXISTS date_added timestamp with time zone,
ADD COLUMN IF NOT EXISTS ai_company_summary text,
ADD COLUMN IF NOT EXISTS ai_lead_analysis text,
ADD COLUMN IF NOT EXISTS ai_pain_point_summary text,
ADD COLUMN IF NOT EXISTS ai_solution_angle text,
ADD COLUMN IF NOT EXISTS ai_outreach_strategy text,
ADD COLUMN IF NOT EXISTS ai_personalized_first_line text,
ADD COLUMN IF NOT EXISTS ai_subject text,
ADD COLUMN IF NOT EXISTS ai_email_body text,
ADD COLUMN IF NOT EXISTS ai_cta text,
ADD COLUMN IF NOT EXISTS ai_confidence_score integer,
ADD COLUMN IF NOT EXISTS ai_status text DEFAULT 'pending' NOT NULL,
ADD COLUMN IF NOT EXISTS ai_generated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS ai_edited_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS ai_approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS solution text,
ADD COLUMN IF NOT EXISTS solution_score integer,
ADD COLUMN IF NOT EXISTS data_quality_score integer,
ADD COLUMN IF NOT EXISTS data_quality_label text;

-- Upgrade campaigns table with settings required by Campaign Setup Wizard
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS require_approval_before_send boolean DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS allow_template_fallback boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS auto_generate_ai_before_send boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS target_industry text,
ADD COLUMN IF NOT EXISTS offer_type text,
ADD COLUMN IF NOT EXISTS sender_name text,
ADD COLUMN IF NOT EXISTS sender_email text,
ADD COLUMN IF NOT EXISTS daily_limit integer DEFAULT 100 NOT NULL;

-- Indexes for performance lookups on upgraded columns
CREATE INDEX IF NOT EXISTS leads_user_id_idx ON public.leads(campaign_id); -- note: leads are queried via campaigns which link to profiles(id)
CREATE INDEX IF NOT EXISTS leads_ai_status_idx ON public.leads(ai_status);
CREATE INDEX IF NOT EXISTS leads_priority_idx ON public.leads(priority);
CREATE INDEX IF NOT EXISTS leads_solution_score_idx ON public.leads(solution_score);
CREATE INDEX IF NOT EXISTS leads_solution_fit_score_idx ON public.leads(solution_fit_score);
-- Create email_accounts table
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  email_address text NOT NULL,
  sender_name text,
  config jsonb NOT NULL,
  daily_send_limit int DEFAULT 30 NOT NULL,
  daily_sent_count int DEFAULT 0 NOT NULL,
  last_sent_reset_date date DEFAULT current_date NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  warmup_enabled boolean DEFAULT false NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS for email_accounts
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email accounts" ON public.email_accounts
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for email_accounts
CREATE INDEX IF NOT EXISTS email_accounts_user_id_idx ON public.email_accounts(user_id);
CREATE INDEX IF NOT EXISTS email_accounts_provider_idx ON public.email_accounts(provider);
CREATE INDEX IF NOT EXISTS email_accounts_email_address_idx ON public.email_accounts(email_address);
CREATE INDEX IF NOT EXISTS email_accounts_is_default_idx ON public.email_accounts(is_default);
CREATE INDEX IF NOT EXISTS email_accounts_status_idx ON public.email_accounts(status);


-- Update campaigns table to link to email_accounts
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS email_account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL;


-- Update leads table with queue tracking columns
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS processing_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS processing_error text;


-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  action text NOT NULL,
  message text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit logs
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_campaign_id_idx ON public.audit_logs(campaign_id);
CREATE INDEX IF NOT EXISTS audit_logs_lead_id_idx ON public.audit_logs(lead_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at);
-- Track every outbound email that is actually sent
CREATE TABLE IF NOT EXISTS public.sent_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  email_account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL,
  provider text NOT NULL,
  message_id text,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their sent emails" ON public.sent_emails;
CREATE POLICY "Users can view their sent emails" ON public.sent_emails
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = sent_emails.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS sent_emails_campaign_id_idx ON public.sent_emails(campaign_id);
CREATE INDEX IF NOT EXISTS sent_emails_lead_id_idx ON public.sent_emails(lead_id);
CREATE INDEX IF NOT EXISTS sent_emails_email_account_id_idx ON public.sent_emails(email_account_id);
CREATE INDEX IF NOT EXISTS sent_emails_sent_at_idx ON public.sent_emails(sent_at);
-- AI efficiency controls, caches, and usage tracking

alter table public.profiles
  add column if not exists daily_ai_call_limit integer default 75,
  add column if not exists monthly_ai_call_limit integer default 1500,
  add column if not exists max_bulk_ai_batch_size integer default 5,
  add column if not exists min_data_quality_for_ai integer default 45,
  add column if not exists full_ai_min_solution_score integer default 65,
  add column if not exists stop_ai_when_limit_reached boolean default true;

alter table public.campaigns
  add column if not exists ai_mode text default 'hybrid_smart',
  add column if not exists ai_depth text default 'standard',
  add column if not exists auto_run_ai_after_import boolean default false,
  add column if not exists fetch_website_homepage boolean default true,
  add column if not exists min_data_quality_for_ai integer,
  add column if not exists full_ai_min_solution_score integer;

alter table public.leads
  add column if not exists ai_input_hash text,
  add column if not exists ai_prompt_version text,
  add column if not exists ai_model_used text,
  add column if not exists ai_cached boolean default false,
  add column if not exists ai_token_estimate integer,
  add column if not exists ai_usage_notes text,
  add column if not exists ai_depth text default 'basic';

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  company_cache_id uuid,
  operation text not null,
  ai_mode text,
  ai_depth text,
  model_used text,
  input_hash text,
  prompt_version text,
  cache_hit boolean not null default false,
  skipped boolean not null default false,
  skip_reason text,
  tokens_prompt integer,
  tokens_completion integer,
  tokens_total integer,
  estimated_cost numeric(12,6),
  usage_notes text,
  created_at timestamp with time zone default now() not null
);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "Users can view own AI usage logs" on public.ai_usage_logs;
create policy "Users can view own AI usage logs" on public.ai_usage_logs
  for select using (auth.uid() = user_id);

create index if not exists ai_usage_logs_user_id_idx on public.ai_usage_logs(user_id);
create index if not exists ai_usage_logs_campaign_id_idx on public.ai_usage_logs(campaign_id);
create index if not exists ai_usage_logs_lead_id_idx on public.ai_usage_logs(lead_id);
create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs(created_at);
create index if not exists ai_usage_logs_cache_hit_idx on public.ai_usage_logs(cache_hit);
create index if not exists ai_usage_logs_skipped_idx on public.ai_usage_logs(skipped);

create table if not exists public.company_enrichment_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  domain_key text not null,
  company_name text,
  website_url text,
  website_text text,
  source_hash text not null,
  enrichment_summary text,
  enrichment_json jsonb default '{}'::jsonb not null,
  ai_model_used text,
  ai_prompt_version text,
  ai_token_estimate integer,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  unique (user_id, domain_key)
);

alter table public.company_enrichment_cache enable row level security;

drop policy if exists "Users can manage own company enrichment cache" on public.company_enrichment_cache;
create policy "Users can manage own company enrichment cache" on public.company_enrichment_cache
  for all using (auth.uid() = user_id);

create index if not exists company_enrichment_cache_user_id_idx on public.company_enrichment_cache(user_id);
create index if not exists company_enrichment_cache_domain_key_idx on public.company_enrichment_cache(domain_key);
create index if not exists company_enrichment_cache_source_hash_idx on public.company_enrichment_cache(source_hash);

create index if not exists leads_ai_input_hash_idx on public.leads(ai_input_hash);
create index if not exists leads_ai_prompt_version_idx on public.leads(ai_prompt_version);
create index if not exists leads_ai_model_used_idx on public.leads(ai_model_used);
create index if not exists leads_ai_cached_idx on public.leads(ai_cached);
create index if not exists leads_ai_depth_idx on public.leads(ai_depth);
-- Global lead library and manual send support

create table if not exists public.lead_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  source text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.lead_lists enable row level security;

drop policy if exists "Users can manage own lead lists" on public.lead_lists;
create policy "Users can manage own lead lists" on public.lead_lists
  for all using (auth.uid() = user_id);

alter table public.leads
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists lead_list_id uuid references public.lead_lists(id) on delete set null,
  add column if not exists is_global boolean default true,
  add column if not exists owner_type text default 'library',
  add column if not exists manual_personalization_status text default 'not_started',
  add column if not exists manual_email_subject text,
  add column if not exists manual_email_body text,
  add column if not exists manual_email_approved boolean default false,
  add column if not exists manual_email_sent_at timestamp with time zone,
  add column if not exists last_manual_email_account_id uuid references public.email_accounts(id) on delete set null,
  add column if not exists follow_up_note text,
  add column if not exists lead_owner text,
  add column if not exists deal_size numeric,
  add column if not exists pipeline_stage text default 'New';

alter table public.leads drop constraint if exists leads_campaign_id_fkey;
alter table public.leads alter column campaign_id drop not null;
alter table public.leads
  add constraint leads_campaign_id_fkey foreign key (campaign_id) references public.campaigns(id) on delete cascade;

drop policy if exists "Users can manage leads of own campaigns" on public.leads;
drop policy if exists "Users can manage library leads" on public.leads;
create policy "Users can manage library leads" on public.leads
  for all using (
    auth.uid() = user_id
    or exists (
      select 1 from public.campaigns
      where campaigns.id = leads.campaign_id
      and campaigns.user_id = auth.uid()
    )
    or exists (
      select 1 from public.lead_lists
      where lead_lists.id = leads.lead_list_id
      and lead_lists.user_id = auth.uid()
    )
  );

create table if not exists public.lead_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  status text default 'added',
  current_step integer default 0,
  next_email_at timestamp with time zone,
  last_email_sent_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (lead_id, campaign_id)
);

alter table public.lead_campaigns enable row level security;

drop policy if exists "Users can manage own lead campaign attachments" on public.lead_campaigns;
create policy "Users can manage own lead campaign attachments" on public.lead_campaigns
  for all using (auth.uid() = user_id);

alter table public.sent_emails
  alter column campaign_id drop not null;

drop policy if exists "Users can view their sent emails" on public.sent_emails;
create policy "Users can view their sent emails" on public.sent_emails
  for select using (
    (
      sent_emails.campaign_id is not null and exists (
        select 1 from public.campaigns
        where campaigns.id = sent_emails.campaign_id
        and campaigns.user_id = auth.uid()
      )
    )
    or
    (
      sent_emails.campaign_id is null and exists (
        select 1
        from public.leads
        left join public.lead_lists on lead_lists.id = leads.lead_list_id
        where leads.id = sent_emails.lead_id
        and (
          leads.user_id = auth.uid()
          or lead_lists.user_id = auth.uid()
        )
      )
    )
  );

create index if not exists leads_lead_list_id_idx on public.leads(lead_list_id);
create index if not exists leads_is_global_idx on public.leads(is_global);
create index if not exists leads_owner_type_idx on public.leads(owner_type);
create index if not exists leads_manual_personalization_status_idx on public.leads(manual_personalization_status);
create index if not exists lead_lists_user_id_idx on public.lead_lists(user_id);
create index if not exists lead_campaigns_user_id_idx on public.lead_campaigns(user_id);
create index if not exists lead_campaigns_lead_id_idx on public.lead_campaigns(lead_id);
create index if not exists lead_campaigns_campaign_id_idx on public.lead_campaigns(campaign_id);
-- AI Credit Saver settings and usage tracking

create table if not exists public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  default_model text default 'gemini-3.1-flash-lite' not null,
  deep_model text default 'gemini-2.5-flash' not null,
  daily_ai_limit integer default 75,
  daily_deep_ai_limit integer default 20,
  monthly_ai_limit integer default 1500,
  max_bulk_ai_batch_size integer default 5,
  min_data_quality_for_ai integer default 45,
  full_ai_min_solution_score integer default 65,
  use_flash_lite_by_default boolean default true not null,
  deep_ai_only_for_high_priority boolean default true not null,
  stop_ai_when_limit_reached boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ai_settings enable row level security;

drop policy if exists "Users can manage own ai settings" on public.ai_settings;
create policy "Users can manage own ai settings" on public.ai_settings
  for all using (auth.uid() = user_id);

alter table public.campaigns
  add column if not exists default_ai_depth text default 'standard',
  add column if not exists allow_deep_ai boolean default true not null,
  add column if not exists require_manual_approval_for_deep_ai boolean default false not null,
  add column if not exists use_template_fallback boolean default false not null;

alter table public.ai_usage_logs
  add column if not exists action text,
  add column if not exists model text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists total_tokens integer,
  add column if not exists cached boolean default false;

create index if not exists ai_usage_logs_model_idx on public.ai_usage_logs(model);
create index if not exists ai_usage_logs_action_idx on public.ai_usage_logs(action);
create index if not exists ai_settings_user_id_idx on public.ai_settings(user_id);
-- Allow library/imported leads to exist without a campaign.
-- The app already supports global lead lists with campaign_id = null.

alter table public.leads
  alter column campaign_id drop not null;
alter table public.leads
  add column if not exists recommended_offer text;

alter table public.sent_emails
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists recipient_email text,
  add column if not exists sender_email text,
  add column if not exists sender_name text,
  add column if not exists body_html text,
  add column if not exists body_text text,
  add column if not exists email_type text default 'custom_email',
  add column if not exists step_number integer,
  add column if not exists provider_message_id text,
  add column if not exists sent_by text default 'manual',
  add column if not exists delivered_at timestamp with time zone,
  add column if not exists opened_at timestamp with time zone,
  add column if not exists clicked_at timestamp with time zone,
  add column if not exists bounced_at timestamp with time zone,
  add column if not exists replied_at timestamp with time zone,
  add column if not exists raw_provider_response jsonb default '{}'::jsonb not null;

update public.sent_emails
set
  user_id = coalesce(
    user_id,
    (
      select campaigns.user_id
      from public.campaigns
      where campaigns.id = sent_emails.campaign_id
    ),
    (
      select coalesce(leads.user_id, lead_lists.user_id)
      from public.leads
      left join public.lead_lists on lead_lists.id = leads.lead_list_id
      where leads.id = sent_emails.lead_id
    )
  ),
  recipient_email = coalesce(recipient_email, (select leads.email from public.leads where leads.id = sent_emails.lead_id)),
  provider_message_id = coalesce(provider_message_id, message_id),
  raw_provider_response = case
    when coalesce(raw_provider_response, '{}'::jsonb) = '{}'::jsonb then coalesce(metadata, '{}'::jsonb)
    else raw_provider_response
  end
where
  user_id is null
  or recipient_email is null
  or provider_message_id is null
  or coalesce(raw_provider_response, '{}'::jsonb) = '{}'::jsonb;

delete from public.sent_emails
where user_id is null
   or recipient_email is null;

alter table public.sent_emails
  alter column user_id set not null,
  alter column recipient_email set not null,
  alter column sender_email drop not null,
  alter column email_type set default 'custom_email',
  alter column sent_by set default 'manual';

drop policy if exists "Users can view their sent emails" on public.sent_emails;
create policy "Users can view their sent emails" on public.sent_emails
  for select using (
    auth.uid() = user_id
    or (
      campaign_id is not null and exists (
        select 1 from public.campaigns
        where campaigns.id = sent_emails.campaign_id
        and campaigns.user_id = auth.uid()
      )
    )
    or (
      campaign_id is null and exists (
        select 1
        from public.leads
        left join public.lead_lists on lead_lists.id = leads.lead_list_id
        where leads.id = sent_emails.lead_id
        and (leads.user_id = auth.uid() or lead_lists.user_id = auth.uid())
      )
    )
  );

drop policy if exists "Users can insert their sent emails" on public.sent_emails;
create policy "Users can insert their sent emails" on public.sent_emails
  for insert with check (
    auth.uid() = user_id
    and (
      (campaign_id is not null and exists (
        select 1 from public.campaigns
        where campaigns.id = sent_emails.campaign_id
        and campaigns.user_id = auth.uid()
      ))
      or
      (campaign_id is null and exists (
        select 1
        from public.leads
        left join public.lead_lists on lead_lists.id = leads.lead_list_id
        where leads.id = sent_emails.lead_id
        and (leads.user_id = auth.uid() or lead_lists.user_id = auth.uid())
      ))
    )
  );

drop policy if exists "Users can update their sent emails" on public.sent_emails;
create policy "Users can update their sent emails" on public.sent_emails
  for update using (
    auth.uid() = user_id
  )
  with check (
    auth.uid() = user_id
  );

create index if not exists sent_emails_user_id_idx on public.sent_emails(user_id);
create index if not exists sent_emails_provider_message_id_idx on public.sent_emails(provider_message_id);
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

-- Add and normalize lead follow-up tracking fields for ReachMira

alter table public.leads
  add column if not exists emails_sent_count integer default 0,
  add column if not exists last_email_type text,
  add column if not exists last_contacted_at timestamp with time zone,
  add column if not exists next_follow_up_at timestamp with time zone,
  add column if not exists reply_status text default 'no_reply',
  add column if not exists next_email_at timestamp with time zone,
  add column if not exists current_step integer default 0,
  add column if not exists last_email_sent_at timestamp with time zone,
  add column if not exists manual_email_subject text,
  add column if not exists manual_email_body text,
  add column if not exists manual_email_type text,
  add column if not exists manual_email_saved_at timestamp with time zone,
  add column if not exists manual_email_approved boolean default false;

update public.leads
set
  emails_sent_count = coalesce(emails_sent_count, 0),
  current_step = coalesce(current_step, 0),
  reply_status = coalesce(reply_status, 'no_reply'),
  manual_email_approved = coalesce(manual_email_approved, false)
where emails_sent_count is null
   or current_step is null
   or reply_status is null
   or manual_email_approved is null;
-- Manual/global lead emails do not always belong to a campaign.
alter table public.sent_emails
  alter column campaign_id drop not null;
alter table public.profiles
  add column if not exists outreach_company_name text,
  add column if not exists outreach_company_website text,
  add column if not exists outreach_company_description text,
  add column if not exists outreach_offers_services text,
  add column if not exists outreach_value_proposition text,
  add column if not exists outreach_target_customers text,
  add column if not exists outreach_proof_points text;
-- Repair profile schema drift for settings pages.
-- Safe to run on projects that already have these columns.

alter table public.profiles
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_bot_token text,
  add column if not exists gemini_api_key text,
  add column if not exists mailgun_api_key text,
  add column if not exists mailgun_domain text,
  add column if not exists mailgun_from_email text,
  add column if not exists mailgun_from_name text,
  add column if not exists smtp_host text,
  add column if not exists smtp_port integer,
  add column if not exists smtp_user text,
  add column if not exists smtp_pass text,
  add column if not exists imap_host text,
  add column if not exists imap_port integer default 993,
  add column if not exists imap_user text,
  add column if not exists imap_pass text,
  add column if not exists daily_ai_call_limit integer default 75,
  add column if not exists monthly_ai_call_limit integer default 1500,
  add column if not exists max_bulk_ai_batch_size integer default 5,
  add column if not exists min_data_quality_for_ai integer default 45,
  add column if not exists full_ai_min_solution_score integer default 65,
  add column if not exists stop_ai_when_limit_reached boolean default true,
  add column if not exists outreach_company_name text,
  add column if not exists outreach_company_website text,
  add column if not exists outreach_company_description text,
  add column if not exists outreach_offers_services text,
  add column if not exists outreach_value_proposition text,
  add column if not exists outreach_target_customers text,
  add column if not exists outreach_proof_points text;
alter table public.leads
  add column if not exists email_verification_status text default 'not_checked',
  add column if not exists email_verification_score integer,
  add column if not exists email_verification_provider text default 'local',
  add column if not exists email_verification_reason text,
  add column if not exists email_verified_at timestamp with time zone,
  add column if not exists email_verification_raw jsonb default '{}'::jsonb;
alter table public.campaigns
  add column if not exists allow_risky_emails boolean default false not null;
-- Migration: Add profile fields, saved views, and offer library

-- 1. Add fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workspace_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Create Saved Views table
CREATE TABLE IF NOT EXISTS public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved views" ON public.saved_views
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS saved_views_user_id_idx ON public.saved_views(user_id);

-- 3. Create Offers table
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  details text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own offers" ON public.offers
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS offers_user_id_idx ON public.offers(user_id);

-- 4. Add offer_id to email_templates_library
ALTER TABLE public.email_templates_library ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;

-- 5. Add reply_outcome to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reply_outcome text;
CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  sender_email text not null,
  recipient_email text not null,
  subject text not null,
  snippet text,
  body_text text,
  body_html text,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived', 'replied')),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.inbox_messages enable row level security;

DROP POLICY IF EXISTS "Users can view their own inbox messages" ON public.inbox_messages;
create policy "Users can view their own inbox messages"
  on public.inbox_messages for select
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own inbox messages" ON public.inbox_messages;
create policy "Users can insert their own inbox messages"
  on public.inbox_messages for insert
  with check (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own inbox messages" ON public.inbox_messages;
create policy "Users can update their own inbox messages"
  on public.inbox_messages for update
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own inbox messages" ON public.inbox_messages;
create policy "Users can delete their own inbox messages"
  on public.inbox_messages for delete
  using (auth.uid() = user_id);
-- Create waitlist table
create table public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.waitlist enable row level security;

-- Allow anyone to insert into the waitlist
create policy "Allow public inserts" on public.waitlist
  for insert
  with check (true);

-- Allow authenticated users (or nobody) to read the waitlist (for admin purposes, let's allow authenticated)
create policy "Allow authenticated read access" on public.waitlist
  for select
  to authenticated
  using (true);
create table if not exists public.waitlist_signups (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    email text not null,
    company_name text,
    role text,
    current_outreach_method text,
    use_case text,
    monthly_outreach_volume text,
    website_url text,
    agreed_to_updates boolean default false,
    source text default 'waitlist_page',
    status text default 'new',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create unique index if not exists waitlist_signups_email_unique on public.waitlist_signups (lower(email));

-- RLS Setup
alter table public.waitlist_signups enable row level security;

create policy "Public can insert waitlist signup" on public.waitlist_signups
  for insert with check (true);

create policy "Authenticated users can read waitlist signups" on public.waitlist_signups
  for select using (auth.role() = 'authenticated');
-- Add is_admin column to profiles
alter table public.profiles add column if not exists is_admin boolean default false;

-- Update the waitlist_signups policy to enforce is_admin checks
drop policy if exists "Authenticated users can read waitlist signups" on public.waitlist_signups;

create policy "Admins can read waitlist signups" on public.waitlist_signups
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );
-- Add administrative columns to waitlist_signups
alter table public.waitlist_signups 
  add column if not exists invited_at timestamp with time zone,
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists admin_notes text;
-- Self-hosted open/click tracking: each outbound email gets a unique token
-- embedded in its tracking pixel and rewritten links.
alter table public.sent_emails
  add column if not exists tracking_token text;

create unique index if not exists sent_emails_tracking_token_idx
  on public.sent_emails(tracking_token)
  where tracking_token is not null;
-- Conditional sequences: follow-up steps can require engagement with the
-- previous email (powered by self-hosted open/click tracking).
alter table public.sequences
  add column if not exists condition text not null default 'always';

do $$ begin
  alter table public.sequences
    add constraint sequences_condition_check
    check (condition in ('always', 'opened', 'not_opened', 'clicked'));
exception
  when duplicate_object then null;
end $$;

create index if not exists sequences_campaign_step_idx
  on public.sequences(campaign_id, step_number);
create table if not exists public.admin_leads_pool (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  website text,
  industry text,
  location text,
  contact_name text,
  contact_title text,
  contact_email text,
  contact_linkedin text,
  company_linkedin text,
  employee_count text,
  revenue text,
  tech_stack text[],
  description text,
  tags text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.admin_leads_pool enable row level security;

-- Only admins can manage this table.
-- Assuming admins are checked via some claim or we allow read to subscribed users.
-- For now, allow read for authenticated users, we'll restrict UI to subscribed users.
create policy "Authenticated users can read admin leads pool" on public.admin_leads_pool
  for select using (auth.role() = 'authenticated');

-- We can add a policy for admin inserts if needed, or rely on service role key for API routes.
create policy "Admins can manage admin leads pool" on public.admin_leads_pool
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

create index if not exists admin_leads_pool_industry_idx on public.admin_leads_pool(industry);
create index if not exists admin_leads_pool_location_idx on public.admin_leads_pool(location);
-- Add enrichment columns to admin_leads_pool
ALTER TABLE admin_leads_pool
ADD COLUMN IF NOT EXISTS funding_stage text,
ADD COLUMN IF NOT EXISTS total_raised text,
ADD COLUMN IF NOT EXISTS employee_count text,
ADD COLUMN IF NOT EXISTS year_founded integer,
ADD COLUMN IF NOT EXISTS tech_stack jsonb,
ADD COLUMN IF NOT EXISTS ceo_name text;

-- Add enrichment columns to leads
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS funding_stage text,
ADD COLUMN IF NOT EXISTS total_raised text,
ADD COLUMN IF NOT EXISTS employee_count text,
ADD COLUMN IF NOT EXISTS year_founded integer,
ADD COLUMN IF NOT EXISTS tech_stack jsonb,
ADD COLUMN IF NOT EXISTS ceo_name text;
create table if not exists public.admin_scraping_queue (
  id uuid primary key default gen_random_uuid(),
  search_query text,
  company_name text,
  website text,
  description text,
  contact_name text,
  contact_email text,
  status text default 'pending',
  
  -- AI / Enrichment Fields
  pain_points text,
  ai_solution_angle text,
  recommended_offer text,
  ai_company_summary text,
  ai_lead_analysis text,
  ai_outreach_strategy text,
  ai_personalized_first_line text,
  tech_stack jsonb,
  funding_stage text,
  total_raised text,
  employee_count text,
  year_founded text,
  ceo_name text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.admin_scraping_queue enable row level security;

-- Only admins can manage the scraping queue
create policy "Admins can manage scraping queue" on public.admin_scraping_queue
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

create index if not exists admin_scraping_queue_status_idx on public.admin_scraping_queue(status);
create index if not exists admin_scraping_queue_search_query_idx on public.admin_scraping_queue(search_query);
-- supabase: no-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_usage_logs_user_budget_idx
  ON public.ai_usage_logs (user_id, created_at DESC, skipped, cache_hit);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_usage_logs_user_model_idx
  ON public.ai_usage_logs (user_id, model, created_at DESC) WHERE skipped = false AND cache_hit = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_campaign_queue_idx
  ON public.leads (campaign_id, status, next_email_at ASC NULLS FIRST);
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_list_sort_idx
  ON public.leads (lead_list_id, last_email_sent_at ASC NULLS FIRST);
CREATE INDEX CONCURRENTLY IF NOT EXISTS sent_emails_lead_sent_at_idx
  ON public.sent_emails (lead_id, sent_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS suppressions_user_domain_idx
  ON public.suppressions (user_id, domain) WHERE domain IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS inbox_messages_user_status_idx
  ON public.inbox_messages (user_id, status, received_at DESC);
CREATE OR REPLACE FUNCTION increment_email_account_sent_count(p_account_id UUID, p_increment INT DEFAULT 1)
RETURNS void AS $$
  UPDATE email_accounts SET daily_sent_count = COALESCE(daily_sent_count, 0) + p_increment, updated_at = NOW()
  WHERE id = p_account_id;
$$ LANGUAGE sql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION get_ai_usage_summary(p_user_id UUID, p_daily_from TIMESTAMPTZ, p_monthly_from TIMESTAMPTZ)
RETURNS JSON AS $$
DECLARE
  summary JSON;
BEGIN
  SELECT json_build_object(
    'calls', COUNT(id) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_daily_from),
    'flashLiteCallsToday', COUNT(id) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_daily_from AND model = 'gemini-3.1-flash-lite'),
    'flash25CallsToday', COUNT(id) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_daily_from AND model = 'gemini-2.5-flash'),
    'monthlyCalls', COUNT(id) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_monthly_from),
    'tokens', COALESCE(SUM(tokens_total) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_daily_from), 0),
    'monthlyTokens', COALESCE(SUM(tokens_total) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_monthly_from), 0),
    'dailyCacheHits', COUNT(id) FILTER (WHERE cache_hit = true AND created_at >= p_daily_from),
    'monthlyCacheHits', COUNT(id) FILTER (WHERE cache_hit = true AND created_at >= p_monthly_from),
    'dailySkipped', COUNT(id) FILTER (WHERE skipped = true AND created_at >= p_daily_from),
    'monthlySkipped', COUNT(id) FILTER (WHERE skipped = true AND created_at >= p_monthly_from)
  )
  INTO summary
  FROM ai_usage_logs
  WHERE user_id = p_user_id AND created_at >= LEAST(p_monthly_from, p_daily_from);

  RETURN summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION claim_leads_for_ai(p_limit INT)
RETURNS SETOF leads AS $$
  UPDATE leads
  SET ai_status = 'processing', processing_started_at = NOW(), processing_error = NULL
  WHERE id IN (
    SELECT id FROM leads
    WHERE (ai_status = 'pending')
       OR (ai_status = 'processing' AND processing_started_at < NOW() - INTERVAL '15 minutes')
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION bulk_add_tag_to_leads(p_lead_ids UUID[], p_new_tag TEXT)
RETURNS void AS $$
  UPDATE leads
  SET tags = (
    SELECT array_to_string(array_agg(DISTINCT trim(t)), ', ')
    FROM unnest(string_to_array(COALESCE(tags, ''), ',') || p_new_tag) t
    WHERE trim(t) != ''
  ),
  updated_at = NOW()
  WHERE id = ANY(p_lead_ids);
$$ LANGUAGE sql SECURITY DEFINER;
