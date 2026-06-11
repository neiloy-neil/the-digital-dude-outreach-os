# ReachMira

A modern outreach CRM for importing leads, writing personalized emails, sending through SMTP or Mailgun, and tracking every reply, bounce, unsubscribe, and follow-up.

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
- Gmail (OAuth)
- Outlook / Microsoft 365 (OAuth)

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

## Gmail / Outlook OAuth Setup

Users connect mailboxes in one click from `/settings/email-accounts` ("Connect Gmail" / "Connect Outlook").

Environment variables:
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` — from a Google Cloud OAuth web client.
- `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` — from a Microsoft Entra app registration (multitenant + personal accounts).
- `NEXT_PUBLIC_APP_URL` — used to build the OAuth redirect URIs.

Redirect URIs to register with the providers:
- Google: `{NEXT_PUBLIC_APP_URL}/api/email-accounts/oauth/gmail/callback`
- Microsoft: `{NEXT_PUBLIC_APP_URL}/api/email-accounts/oauth/outlook/callback`

Scopes requested:
- Google: `gmail.send`, `openid`, `email` (send-only; reply tracking stays on IMAP/webhooks).
- Microsoft: `offline_access`, `Mail.Send`, `User.Read`.

Notes:
- Sending goes through the Gmail API / Microsoft Graph `sendMail` — no SMTP app passwords needed.
- Access tokens are refreshed automatically before sending; rotated refresh tokens are persisted to `email_accounts.config`.
- Tokens are never exposed to the frontend (masked like all other provider secrets).

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

## Conditional Sequences

Follow-up steps (step 2+) can be gated on engagement with the previous email:
- **Always send** (default)
- **Only if NOT opened** — e.g. resend with a new subject line
- **Only if opened** — e.g. a value follow-up for warm leads
- **Only if link clicked** — e.g. "saw you checked the link"

Behavior:
- Conditions are evaluated against `opened_at` / `clicked_at` from self-hosted tracking (a click also counts as an open, since pixels are often blocked).
- If a step's condition is not met, the step is **skipped** and the lead advances to the next step on that step's delay — sequences never stall.
- Skips are recorded in audit logs as `sequence_step_skipped`.
- Step 1 is always sent (there is no previous email to evaluate).

---

## Open & Click Tracking

Every campaign and manual send (except test sends) is instrumented before it leaves:
- A unique `tracking_token` is stored on the `sent_emails` row.
- A 1×1 pixel (`/api/track/open/[token]`) stamps `opened_at` on first open.
- Links are rewritten through `/api/track/click/[token]?u=...&s=...` which stamps `clicked_at` (and `opened_at`, since a click implies an open) before redirecting.

Details:
- Works for **all** providers (SMTP, Gmail, Outlook, Mailgun) — no webhooks required.
- Click URLs are HMAC-signed (`TRACKING_SECRET`, falling back to `CRON_SECRET`) so the redirect cannot be abused as an open redirect.
- Unsubscribe links and `mailto:` links are never rewritten.
- The clean (un-instrumented) HTML is stored in `sent_emails.body_html`, so previewing an email inside ReachMira never records a false open.

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
