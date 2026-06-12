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
