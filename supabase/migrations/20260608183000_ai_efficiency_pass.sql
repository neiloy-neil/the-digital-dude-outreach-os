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
