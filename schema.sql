-- Setup Database Schema for The Digital Dude Outreach OS

-- Extensions for UUID generation
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (linked to Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  telegram_chat_id text,
  telegram_bot_token text,
  gemini_api_key text,
  daily_ai_call_limit integer default 75,
  monthly_ai_call_limit integer default 1500,
  max_bulk_ai_batch_size integer default 5,
  min_data_quality_for_ai integer default 45,
  full_ai_min_solution_score integer default 65,
  stop_ai_when_limit_reached boolean default true,
  mailgun_api_key text,
  mailgun_domain text,
  mailgun_from_email text,
  mailgun_from_name text,
  imap_host text,
  imap_port integer default 993,
  imap_user text,
  imap_pass text,
  smtp_host text,
  smtp_port integer,
  smtp_user text,
  smtp_pass text,
  display_name text,
  workspace_name text,
  role_title text,
  phone text,
  timezone text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- 2. AI Settings Table
create table public.ai_settings (
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

create policy "Users can manage own ai settings" on public.ai_settings
  for all using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Email Accounts Table
create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  provider text not null,
  email_address text not null,
  sender_name text,
  config jsonb not null,
  daily_send_limit int default 30 not null,
  daily_sent_count int default 0 not null,
  last_sent_reset_date date default current_date not null,
  is_default boolean default false not null,
  warmup_enabled boolean default false not null,
  status text default 'active' not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table public.email_accounts enable row level security;

create policy "Users can manage own email accounts" on public.email_accounts
  for all using (auth.uid() = user_id);

create index if not exists email_accounts_user_id_idx on public.email_accounts(user_id);
create index if not exists email_accounts_provider_idx on public.email_accounts(provider);
create index if not exists email_accounts_email_address_idx on public.email_accounts(email_address);
create index if not exists email_accounts_is_default_idx on public.email_accounts(is_default);
create index if not exists email_accounts_status_idx on public.email_accounts(status);

-- 3. Campaigns Table
create table public.campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  status text not null default 'draft',
  ai_mode text default 'hybrid_smart',
  ai_depth text default 'standard',
  default_ai_depth text default 'standard',
  auto_run_ai_after_import boolean default false,
  fetch_website_homepage boolean default true,
  min_data_quality_for_ai integer,
  full_ai_min_solution_score integer,
  allow_deep_ai boolean default true not null,
  require_manual_approval_for_deep_ai boolean default false not null,
  require_approval_before_send boolean default true not null,
  allow_risky_emails boolean default false not null,
  allow_template_fallback boolean default false not null,
  use_template_fallback boolean default false not null,
  auto_generate_ai_before_send boolean default false not null,
  target_industry text,
  offer_type text,
  sender_name text,
  sender_email text,
  daily_limit integer default 100 not null,
  email_account_id uuid references public.email_accounts(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.campaigns enable row level security;

create policy "Users can perform CRUD on own campaigns" on public.campaigns
  for all using (auth.uid() = user_id);

-- 4. Leads Table
create table public.leads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  lead_list_id uuid,
  external_id text,
  email text not null,
  first_name text,
  last_name text,
  company text,
  company_name text,
  website text,
  industry text,
  sub_industry text,
  country text,
  city text,
  company_size text,
  estimated_revenue text,
  decision_maker_name text,
  decision_maker_title text,
  email_verified boolean default false,
  email_verification_status text default 'not_checked',
  email_verification_score integer,
  email_verification_provider text default 'local',
  email_verification_reason text,
  email_verified_at timestamp with time zone,
  email_verification_raw jsonb default '{}'::jsonb,
  linkedin_url text,
  tech_stack text,
  pain_points text,
  solution text,
  recommended_offer text,
  solution_score integer,
  solution_fit_score integer,
  lead_source text,
  qc_by text,
  outreach_channel text,
  outreach_status text,
  last_contacted timestamp with time zone,
  next_follow_up_date timestamp with time zone,
  sequence_step integer,
  response_summary text,
  demo_scheduled boolean default false,
  proposal_sent boolean default false,
  estimated_deal_size numeric,
  priority text,
  assigned_to text,
  tags text,
  notes text,
  is_global boolean default true,
  owner_type text default 'library',
  manual_personalization_status text default 'not_started',
  manual_email_subject text,
  manual_email_body text,
  manual_email_approved boolean default false,
  manual_email_sent_at timestamp with time zone,
  last_manual_email_account_id uuid references public.email_accounts(id) on delete set null,
  follow_up_note text,
  lead_owner text,
  deal_size numeric,
  pipeline_stage text default 'New',
  date_added timestamp with time zone,
  variables jsonb default '{}'::jsonb not null,
  raw_data jsonb default '{}'::jsonb not null,
  data_quality_score integer,
  data_quality_label text,
  approval_status text not null default 'pending_review',
  personalized_subject text,
  personalized_body text,
  personalization_strategy text,
  ai_company_summary text,
  ai_lead_analysis text,
  ai_pain_point_summary text,
  ai_solution_angle text,
  ai_outreach_strategy text,
  ai_personalized_first_line text,
  ai_subject text,
  ai_email_body text,
  ai_cta text,
  ai_confidence_score integer,
  ai_input_hash text,
  ai_prompt_version text,
  ai_model_used text,
  ai_cached boolean default false,
  ai_token_estimate integer,
  ai_usage_notes text,
  ai_depth text default 'basic',
  ai_status text not null default 'pending',
  ai_generated_at timestamp with time zone,
  ai_edited_at timestamp with time zone,
  ai_approved_at timestamp with time zone,
  status text not null default 'imported',
  current_step integer,
  next_email_at timestamp with time zone,
  last_email_sent_at timestamp with time zone,
  processing_started_at timestamp with time zone,
  unsubscribe_token text not null default encode(gen_random_bytes(16), 'hex') unique,
  reply_outcome text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.leads enable row level security;

-- Lead access policy is defined after lead_lists so the global library path can be checked too.

-- 5. Lead Lists Table
create table public.lead_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  source text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.lead_lists enable row level security;

create policy "Users can manage own lead lists" on public.lead_lists
  for all using (auth.uid() = user_id);

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

alter table public.leads
  add constraint leads_lead_list_id_fkey foreign key (lead_list_id) references public.lead_lists(id) on delete set null;

-- 6. Lead-Campaign Attachments Table
create table public.lead_campaigns (
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

create policy "Users can manage own lead campaign attachments" on public.lead_campaigns
  for all using (auth.uid() = user_id);

-- 5. Sequences (Email Steps) Table
create table public.sequences (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  step_number integer not null,
  delay_days integer not null default 1,
  subject text not null,
  body text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.sequences enable row level security;

create policy "Users can manage sequences of own campaigns" on public.sequences
  for all using (
    exists (
      select 1 from public.campaigns
      where campaigns.id = sequences.campaign_id
      and campaigns.user_id = auth.uid()
    )
  );

-- 6. Outbox Table
create table public.outbox (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references public.leads(id) on delete cascade not null,
  sequence_id uuid references public.sequences(id) on delete cascade not null,
  scheduled_at timestamp with time zone not null,
  status text not null default 'pending',
  error_message text,
  sent_at timestamp with time zone,
  mailgun_message_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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

-- 7. Sent Emails Table
create table public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade not null,
  email_account_id uuid references public.email_accounts(id) on delete set null,
  sequence_id uuid references public.sequences(id) on delete set null,
  provider text not null,
  recipient_email text not null,
  sender_email text not null,
  sender_name text,
  subject text not null,
  body_html text,
  body_text text,
  email_type text not null default 'custom_email',
  step_number integer,
  provider_message_id text,
  status text not null default 'sent',
  sent_by text not null default 'manual',
  sent_at timestamp with time zone default now() not null,
  delivered_at timestamp with time zone,
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone,
  bounced_at timestamp with time zone,
  replied_at timestamp with time zone,
  raw_provider_response jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

alter table public.sent_emails enable row level security;

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

create index if not exists sent_emails_campaign_id_idx on public.sent_emails(campaign_id);
create index if not exists sent_emails_user_id_idx on public.sent_emails(user_id);
create index if not exists sent_emails_lead_id_idx on public.sent_emails(lead_id);
create index if not exists sent_emails_email_account_id_idx on public.sent_emails(email_account_id);
create index if not exists sent_emails_provider_message_id_idx on public.sent_emails(provider_message_id);
create index if not exists sent_emails_sent_at_idx on public.sent_emails(sent_at);

-- 8. Audit Logs Table
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  action text not null,
  message text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

alter table public.audit_logs enable row level security;

create policy "Users can view own audit logs" on public.audit_logs
  for select using (auth.uid() = user_id);

create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists audit_logs_campaign_id_idx on public.audit_logs(campaign_id);
create index if not exists audit_logs_lead_id_idx on public.audit_logs(lead_id);
create index if not exists audit_logs_action_idx on public.audit_logs(action);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at);

-- 9. Legacy Activity Logs Table
create table if not exists public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  outbox_id uuid,
  event_type text not null,
  payload jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.activity_logs enable row level security;

create policy "Users can view activity logs of own campaigns" on public.activity_logs
  for select using (
    exists (
      select 1 from public.campaigns
      where campaigns.id = activity_logs.campaign_id
      and campaigns.user_id = auth.uid()
    )
  );

-- 10. Suppressions Table
create table public.suppressions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  email text not null,
  reason text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, email)
);

alter table public.suppressions enable row level security;

create policy "Users can manage own suppressions" on public.suppressions
  for all using (auth.uid() = user_id);

-- 13. AI Usage Logs Table
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  company_cache_id uuid,
  action text,
  model text,
  operation text not null,
  ai_mode text,
  ai_depth text,
  model_used text,
  input_hash text,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  cached boolean not null default false,
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

create policy "Users can view own AI usage logs" on public.ai_usage_logs
  for select using (auth.uid() = user_id);

create index if not exists ai_usage_logs_user_id_idx on public.ai_usage_logs(user_id);
create index if not exists ai_usage_logs_campaign_id_idx on public.ai_usage_logs(campaign_id);
create index if not exists ai_usage_logs_lead_id_idx on public.ai_usage_logs(lead_id);
create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs(created_at);
create index if not exists ai_usage_logs_cache_hit_idx on public.ai_usage_logs(cache_hit);
create index if not exists ai_usage_logs_skipped_idx on public.ai_usage_logs(skipped);

-- 14. Company Enrichment Cache Table
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

create policy "Users can manage own company enrichment cache" on public.company_enrichment_cache
  for all using (auth.uid() = user_id);

create index if not exists company_enrichment_cache_user_id_idx on public.company_enrichment_cache(user_id);
create index if not exists company_enrichment_cache_domain_key_idx on public.company_enrichment_cache(domain_key);
create index if not exists company_enrichment_cache_source_hash_idx on public.company_enrichment_cache(source_hash);

create index if not exists leads_campaign_id_idx on public.leads(campaign_id);
create index if not exists leads_lead_list_id_idx on public.leads(lead_list_id);
create index if not exists leads_email_idx on public.leads(email);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_ai_status_idx on public.leads(ai_status);
create index if not exists leads_approval_status_idx on public.leads(approval_status);
create index if not exists leads_next_email_at_idx on public.leads(next_email_at);
create index if not exists leads_processing_started_at_idx on public.leads(processing_started_at);
create index if not exists leads_email_lower_idx on public.leads(lower(email));
create index if not exists leads_ai_input_hash_idx on public.leads(ai_input_hash);
create index if not exists leads_ai_prompt_version_idx on public.leads(ai_prompt_version);
create index if not exists leads_ai_model_used_idx on public.leads(ai_model_used);
create index if not exists leads_ai_cached_idx on public.leads(ai_cached);
create index if not exists leads_ai_depth_idx on public.leads(ai_depth);
create index if not exists lead_lists_user_id_idx on public.lead_lists(user_id);
create index if not exists lead_campaigns_user_id_idx on public.lead_campaigns(user_id);
create index if not exists lead_campaigns_lead_id_idx on public.lead_campaigns(lead_id);
create index if not exists lead_campaigns_campaign_id_idx on public.lead_campaigns(campaign_id);
create index if not exists outbox_scheduled_at_status_idx on public.outbox(scheduled_at, status);
create index if not exists activity_logs_campaign_id_idx on public.activity_logs(campaign_id);
create index if not exists suppressions_user_id_email_idx on public.suppressions(user_id, email);

-- 15. Email Templates Library Table
create table public.email_templates_library (
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
create policy "Users can manage own email templates" on public.email_templates_library
  for all using (auth.uid() = user_id);

create index if not exists email_templates_library_user_id_idx on public.email_templates_library(user_id);
create index if not exists email_templates_library_category_idx on public.email_templates_library(category);

-- 16. Saved Views Table
create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  filters jsonb default '{}'::jsonb not null,
  is_default boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table public.saved_views enable row level security;
create policy "Users can manage own saved views" on public.saved_views
  for all using (auth.uid() = user_id);

create index if not exists saved_views_user_id_idx on public.saved_views(user_id);

-- 17. Offers Table
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  details text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table public.offers enable row level security;
create policy "Users can manage own offers" on public.offers
  for all using (auth.uid() = user_id);

create index if not exists offers_user_id_idx on public.offers(user_id);

-- Link email_templates_library to offers
alter table public.email_templates_library add column if not exists offer_id uuid references public.offers(id) on delete set null;

-- 18. Add Stripe Billing Columns to Profiles
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_current_period_end timestamp with time zone,
  add column if not exists subscription_status text default 'trialing',
  add column if not exists trial_ends_at timestamp with time zone;

-- 19. Inbox Messages
create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  sender_email text not null,
  recipient_email text not null,
  subject text not null,
  body_text text,
  body_html text,
  snippet text,
  status text not null default 'unread',
  received_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null
);

alter table public.inbox_messages enable row level security;
create policy "Users can manage own inbox messages" on public.inbox_messages
  for all using (auth.uid() = user_id);

create index if not exists inbox_messages_user_id_idx on public.inbox_messages(user_id);
create index if not exists inbox_messages_lead_id_idx on public.inbox_messages(lead_id);
