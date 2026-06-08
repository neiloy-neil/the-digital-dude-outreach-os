-- Track every outbound email that is actually sent
CREATE TABLE IF NOT EXISTS public.sent_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  email_account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL,
  provider text NOT NULL,
  message_id text,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their sent emails" ON public.sent_emails
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = sent_emails.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS sent_emails_campaign_id_idx ON public.sent_emails(campaign_id);
CREATE INDEX IF NOT EXISTS sent_emails_lead_id_idx ON public.sent_emails(lead_id);
CREATE INDEX IF NOT EXISTS sent_emails_email_account_id_idx ON public.sent_emails(email_account_id);
CREATE INDEX IF NOT EXISTS sent_emails_sent_at_idx ON public.sent_emails(sent_at);
