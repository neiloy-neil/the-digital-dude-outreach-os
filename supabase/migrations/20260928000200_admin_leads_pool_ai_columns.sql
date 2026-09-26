-- Bring admin_leads_pool's columns in line with admin_scraping_queue so the
-- scraper approve flow can copy every enrichment field across instead of
-- silently dropping AI analysis when a lead is approved to the global pool.
alter table public.admin_leads_pool
  add column if not exists pain_points text,
  add column if not exists ai_solution_angle text,
  add column if not exists recommended_offer text,
  add column if not exists ai_company_summary text,
  add column if not exists ai_lead_analysis text,
  add column if not exists ai_outreach_strategy text,
  add column if not exists ai_personalized_first_line text,
  add column if not exists email_source text;

do $$ begin
  alter table public.admin_leads_pool
    add constraint admin_leads_pool_email_source_check
    check (email_source is null or email_source in ('found', 'guessed'));
exception when duplicate_object then null; end $$;
