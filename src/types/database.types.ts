export interface Profile {
  id: string;
  telegram_chat_id?: string | null;
  telegram_bot_token?: string | null;
  gemini_api_key?: string | null;
  daily_ai_call_limit?: number | null;
  monthly_ai_call_limit?: number | null;
  max_bulk_ai_batch_size?: number | null;
  min_data_quality_for_ai?: number | null;
  full_ai_min_solution_score?: number | null;
  stop_ai_when_limit_reached?: boolean | null;
  mailgun_api_key?: string | null;
  mailgun_domain?: string | null;
  mailgun_from_email?: string | null;
  mailgun_from_name?: string | null;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_user?: string | null;
  imap_pass?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  ai_mode?: 'template_only' | 'basic_ai' | 'standard_ai' | 'deep_ai' | 'manual_only' | 'hybrid_smart' | 'light_ai' | 'full_ai';
  ai_depth?: 'none' | 'basic' | 'standard' | 'deep';
  default_ai_depth?: 'none' | 'basic' | 'standard' | 'deep';
  auto_run_ai_after_import?: boolean;
  fetch_website_homepage?: boolean;
  min_data_quality_for_ai?: number | null;
  full_ai_min_solution_score?: number | null;
  allow_deep_ai?: boolean;
  require_manual_approval_for_deep_ai?: boolean;
  use_template_fallback?: boolean;
  require_approval_before_send: boolean;
  allow_template_fallback: boolean;
  auto_generate_ai_before_send: boolean;
  target_industry?: string | null;
  offer_type?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  daily_limit: number;
  email_account_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id?: string | null;
  campaign_id?: string | null;
  lead_list_id?: string | null;
  is_global?: boolean;
  owner_type?: 'library' | 'campaign';
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  variables: Record<string, unknown>;
  ai_personalization?: string | null;
  status:
    | 'new'
    | 'imported'
    | 'data_reviewed'
    | 'ai_generated'
    | 'manual_email_draft'
    | 'email_approved'
    | 'mail_sent'
    | 'manual_email_sent'
    | 'follow_up_1_sent'
    | 'follow_up_2_sent'
    | 'follow_up_3_sent'
    | 'replied'
    | 'interested'
    | 'not_interested'
    | 'demo_scheduled'
    | 'proposal_sent'
    | 'won'
    | 'lost'
    | 'bounced'
    | 'unsubscribed'
    | 'do_not_contact'
    | 'excluded'
    | 'enriched'
    | 'manually_edited'
    | 'approved'
    | 'manually_sent'
    | 'added_to_campaign'
    | 'sending'
    | 'personalized'
    | 'ready'
    | 'sent'
    | 'delivered'
    | 'opened'
    | 'clicked'
    | 'complained';
  approval_status?: 'pending_review' | 'approved' | 'skipped';
  manual_personalization_status?: 'not_started' | 'drafted' | 'edited' | 'approved' | 'sent';
  manual_email_subject?: string | null;
  manual_email_body?: string | null;
  manual_email_approved?: boolean;
  manual_email_sent_at?: string | null;
  last_manual_email_account_id?: string | null;
  follow_up_note?: string | null;
  lead_owner?: string | null;
  deal_size?: number | null;
  pipeline_stage?: 'New' | 'Contacted' | 'Replied' | 'Interested' | 'Demo Scheduled' | 'Proposal Sent' | 'Negotiation' | 'Won' | 'Lost' | 'Not Fit';
  personalization_strategy?: string | null;
  personalized_subject?: string | null;
  personalized_body?: string | null;
  unsubscribe_token: string;
  created_at: string;
  updated_at: string;
  
  // V2 Upgraded Standard fields
  external_id?: string | null;
  company_name?: string | null;
  website?: string | null;
  industry?: string | null;
  sub_industry?: string | null;
  country?: string | null;
  city?: string | null;
  company_size?: string | null;
  estimated_revenue?: string | null;
  decision_maker_name?: string | null;
  decision_maker_title?: string | null;
  email_verified: boolean;
  linkedin_url?: string | null;
  tech_stack?: string | null;
  pain_points?: string | null;
  solution?: string | null;
  recommended_offer?: string | null;
  solution_score?: number | null;
  solution_fit_score?: number | null;
  lead_source?: string | null;
  qc_by?: string | null;
  outreach_channel?: string | null;
  outreach_status?: string | null;
  last_contacted?: string | null;
  next_follow_up_date?: string | null;
  sequence_step?: number | null;
  response_summary?: string | null;
  demo_scheduled: boolean;
  proposal_sent: boolean;
  estimated_deal_size?: number | null;
  priority?: string | null;
  assigned_to?: string | null;
  tags?: string | null;
  notes?: string | null;
  date_added?: string | null;
  
  // Sending state tracking fields
  current_step?: number | null;
  next_email_at?: string | null;
  last_email_sent_at?: string | null;
  raw_data: Record<string, unknown>;

  // AI fields
  ai_company_summary?: string | null;
  ai_lead_analysis?: string | null;
  ai_pain_point_summary?: string | null;
  ai_solution_angle?: string | null;
  ai_outreach_strategy?: string | null;
  ai_personalized_first_line?: string | null;
  ai_subject?: string | null;
  ai_email_body?: string | null;
  ai_cta?: string | null;
  ai_confidence_score?: number | null;
  ai_input_hash?: string | null;
  ai_prompt_version?: string | null;
  ai_model_used?: string | null;
  ai_cached?: boolean | null;
  ai_token_estimate?: number | null;
  ai_usage_notes?: string | null;
  ai_depth?: 'none' | 'basic' | 'standard' | 'deep' | null;
  ai_status: 'pending' | 'processing' | 'generated' | 'failed' | 'approved' | 'edited' | 'skipped';
  ai_generated_at?: string | null;
  ai_edited_at?: string | null;
  ai_approved_at?: string | null;

  // Data Quality Metrics
  data_quality_score?: number | null;
  data_quality_label?: string | null;

  // Queue and Error logs
  processing_started_at?: string | null;
  processing_error?: string | null;
}

export interface LeadList {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  source?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadCampaign {
  id: string;
  user_id: string;
  lead_id: string;
  campaign_id: string;
  status: string;
  current_step: number;
  next_email_at?: string | null;
  last_email_sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiUsageLog {
  id: string;
  user_id: string;
  campaign_id?: string | null;
  lead_id?: string | null;
  company_cache_id?: string | null;
  action?: string | null;
  model?: string | null;
  operation: string;
  ai_mode?: string | null;
  ai_depth?: string | null;
  model_used?: string | null;
  input_hash?: string | null;
  prompt_version?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  cached?: boolean;
  cache_hit: boolean;
  skipped: boolean;
  skip_reason?: string | null;
  tokens_prompt?: number | null;
  tokens_completion?: number | null;
  tokens_total?: number | null;
  estimated_cost?: number | null;
  usage_notes?: string | null;
  created_at: string;
}

export interface CompanyEnrichmentCache {
  id: string;
  user_id: string;
  domain_key: string;
  company_name?: string | null;
  website_url?: string | null;
  website_text?: string | null;
  source_hash: string;
  enrichment_summary?: string | null;
  enrichment_json?: Record<string, unknown> | null;
  ai_model_used?: string | null;
  ai_prompt_version?: string | null;
  ai_token_estimate?: number | null;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiSettings {
  id?: string;
  user_id?: string;
  default_model?: 'gemini-3.1-flash-lite' | 'gemini-2.5-flash' | string | null;
  deep_model?: 'gemini-3.1-flash-lite' | 'gemini-2.5-flash' | string | null;
  daily_ai_limit?: number | null;
  daily_deep_ai_limit?: number | null;
  monthly_ai_limit?: number | null;
  max_bulk_ai_batch_size?: number | null;
  min_data_quality_for_ai?: number | null;
  full_ai_min_solution_score?: number | null;
  use_flash_lite_by_default?: boolean | null;
  deep_ai_only_for_high_priority?: boolean | null;
  stop_ai_when_limit_reached?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface SentEmail {
  id: string;
  user_id: string;
  campaign_id?: string | null;
  lead_id: string;
  email_account_id?: string | null;
  sequence_id?: string | null;
  provider: 'smtp' | 'mailgun' | 'resend' | 'amazon_ses' | string;
  recipient_email: string;
  sender_email: string;
  sender_name?: string | null;
  subject: string;
  body_html?: string | null;
  body_text?: string | null;
  email_type:
    | 'first_email'
    | 'follow_up_1'
    | 'follow_up_2'
    | 'follow_up_3'
    | 'custom_email'
    | 'proposal_email'
    | 'demo_follow_up'
    | 'reply_follow_up'
    | string;
  step_number?: number | null;
  provider_message_id?: string | null;
  status: string;
  sent_by?: string;
  sent_at: string;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  bounced_at?: string | null;
  replied_at?: string | null;
  raw_provider_response: Record<string, unknown>;
  created_at: string;
}

export interface Sequence {
  id: string;
  campaign_id: string;
  step_number: number;
  delay_days: number;
  subject: string;
  body: string;
  created_at: string;
}

export interface EmailAccount {
  id: string;
  user_id: string;
  provider: 'smtp' | 'mailgun' | 'resend' | 'amazon_ses';
  email_address: string;
  sender_name?: string | null;
  config: Record<string, unknown>;
  daily_send_limit: number;
  daily_sent_count: number;
  last_sent_reset_date: string;
  is_default: boolean;
  warmup_enabled: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  campaign_id?: string | null;
  lead_id?: string | null;
  action: string;
  message?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
