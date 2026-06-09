alter table public.profiles
  add column if not exists outreach_company_name text,
  add column if not exists outreach_company_website text,
  add column if not exists outreach_company_description text,
  add column if not exists outreach_offers_services text,
  add column if not exists outreach_value_proposition text,
  add column if not exists outreach_target_customers text,
  add column if not exists outreach_proof_points text;
