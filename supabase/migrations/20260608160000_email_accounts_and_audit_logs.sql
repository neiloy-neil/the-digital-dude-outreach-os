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
