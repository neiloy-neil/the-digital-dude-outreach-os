-- supabase: no-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_usage_logs_user_budget_idx
  ON public.ai_usage_logs (user_id, created_at DESC, skipped, cache_hit);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_usage_logs_user_model_idx
  ON public.ai_usage_logs (user_id, model, created_at DESC) WHERE skipped = false AND cache_hit = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_campaign_queue_idx
  ON public.leads (campaign_id, status, next_email_at ASC NULLS FIRST);
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_list_sort_idx
  ON public.leads (lead_list_id, last_email_sent_at ASC NULLS FIRST);
CREATE INDEX CONCURRENTLY IF NOT EXISTS sent_emails_lead_sent_at_idx
  ON public.sent_emails (lead_id, sent_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS suppressions_user_domain_idx
  ON public.suppressions (user_id, domain) WHERE domain IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS inbox_messages_user_status_idx
  ON public.inbox_messages (user_id, status, received_at DESC);
