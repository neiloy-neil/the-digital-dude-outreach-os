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
