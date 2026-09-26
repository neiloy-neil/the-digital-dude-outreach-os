ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS warmup_started_at timestamptz;

-- Defensive backfill: any pre-existing row with warmup_enabled = true but no
-- anchor gets one set to "now" (in practice there likely are none, since every
-- insert path today hardcodes warmup_enabled: false).
UPDATE public.email_accounts
SET warmup_started_at = now()
WHERE warmup_enabled = true
  AND warmup_started_at IS NULL;
