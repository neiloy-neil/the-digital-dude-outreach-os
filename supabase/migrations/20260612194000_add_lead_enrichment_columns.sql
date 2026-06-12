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
