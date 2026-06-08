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
