# The Digital Dude Outreach OS

A cold outreach outreach MVP inspired by Instantly and Smartlead. It supports deep individual lead personalization via Gemini, a per-lead approval review queue, Google Sheets and CSV import with dynamic column mapping, SMTP/Mailgun dispatching, IMAP reply detection, and audit-backed campaign activity tracking.

---

## Key Workflows

### Lead Import & Column Mapping
- Import leads from CSV or a public Google Sheets link.
- Map spreadsheet headers dynamically to supported lead fields.
- Store unmapped fields in `raw_data` JSONB.
- Validate email addresses and skip duplicates per campaign.

### Gemini Personalization
- Gemini generates company summaries, pain points, outreach angles, subjects, and bodies.
- Each lead tracks AI queue state with `ai_status`, `processing_started_at`, and `processing_error`.
- Approved copy can be edited before sending.

### Email Sending
- A universal `sendEmail(provider, config, payload)` function routes mail through the active provider.
- SMTP and Mailgun are implemented now.
- Resend and Amazon SES are placeholders for later.

---

## Email Provider Flexibility

Supported now:
- SMTP
- Mailgun

Coming later:
- Resend
- Amazon SES

The provider-specific configuration lives in `email_accounts.config` as JSONB.

---

## Email Accounts

The `email_accounts` table stores sender configuration per user:
- `provider`
- `email_address`
- `sender_name`
- `config`
- `daily_send_limit`
- `daily_sent_count`
- `last_sent_reset_date`
- `is_default`
- `warmup_enabled`
- `status`

Notes:
- Config values are never exposed raw to the frontend.
- UI responses return masked secrets only.
- Each campaign can select one email account via `campaigns.email_account_id`.

---

## SMTP / cPanel Setup

For SMTP accounts, set:
- SMTP host
- SMTP port `465` or `587`
- username
- password
- secure on/off

Tips:
- Port `465` usually uses implicit SSL/TLS.
- Port `587` usually uses STARTTLS.
- SPF, DKIM, and DMARC should be configured on your domain before sending.
- cPanel SMTP is supported, including self-signed/private certificates when needed.

---

## Mailgun Setup

For Mailgun accounts, set:
- API key
- domain
- region
- optional webhook signing key

Tips:
- Verify your domain DNS records before sending.
- Use the Mailgun webhook signing key to validate inbound events.

---

## Free-Tier Queue Logic

This MVP deliberately avoids:
- Redis
- BullMQ
- n8n
- paid queue services

Instead, Supabase fields act as queue state:
- AI queue: `ai_status`, `processing_started_at`, `processing_error`
- Email queue: `status`, `next_email_at`, `current_step`, `last_email_sent_at`

The cron sender:
- claims a small batch per run
- checks campaign and email-account daily limits
- skips leads that are replied, bounced, complained, unsubscribed, or excluded
- retries AI jobs stuck in `processing` after 15 minutes

---

## Audit Logs

The `audit_logs` table records important lifecycle events:
- `lead_imported`
- `ai_generated`
- `email_approved`
- `email_sent`
- `reply_received`
- `campaign_paused`
- `campaign_started`
- `campaign_completed`
- `lead_unsubscribed`
- `email_bounced`
- `email_account_created`
- `email_account_tested`

Audit logs are visible on campaign and lead activity pages, and are also written server-side using the Supabase service role.

---

## Sending Safety

Sending is guarded by several layers:
- campaign daily limit
- email account daily limit
- approval-before-send toggle
- unsubscribe footer on outbound emails
- stop-on-reply / bounce / unsubscribe
- active email account requirement before campaign start

---

## Routes & UI

### Key Pages
- `/campaigns`
- `/campaigns/new`
- `/campaigns/[id]`
- `/campaigns/[id]/personalization`
- `/campaigns/[id]/leads/[leadId]`
- `/campaigns/[id]/activity`
- `/settings/email-accounts`

### Key API Routes
- `GET /api/email-accounts`
- `POST /api/email-accounts`
- `PATCH /api/email-accounts/[id]`
- `DELETE /api/email-accounts/[id]`
- `POST /api/email-accounts/[id]/test`
- `PATCH /api/campaigns/[id]/status`
- `POST /api/cron/send-due-emails`

---

## Updated Architecture

```text
Next.js App
   ↓
Supabase Auth
   ↓
Supabase PostgreSQL
   ↓
Campaigns
   ↓
Leads + raw_data JSONB
   ↓
Gemini AI Personalization
   ↓
Personalized Email Review
   ↓
Email Account Selector
   ↓
Universal sendEmail()
   ↓
SMTP / Mailgun / Resend later / SES later
   ↓
Audit Logs
   ↓
Dashboard + Activity Timeline context
```

---

## Setup

1. Run the Supabase SQL migrations from `/supabase/migrations`.
2. Configure `.env.local` with Supabase URLs and keys.
3. Start the dev server with `npm run dev`.
4. Add at least one email account in `/settings/email-accounts`.
5. Create a campaign, import leads, run AI analysis, review drafts, and launch.
