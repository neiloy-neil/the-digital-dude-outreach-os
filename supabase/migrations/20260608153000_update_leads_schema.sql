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
