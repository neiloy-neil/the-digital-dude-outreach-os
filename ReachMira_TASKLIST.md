# ReachMira MVP Tasklist

## Product Goal

Build ReachMira as a low-cost, manual-first outreach CRM for startups, freelancers, agencies, and early-stage marketers who use spreadsheets, ChatGPT, and email for outreach.

Core workflow:

```text
Import leads
→ Review lead data
→ Store pain point and solution angle
→ Copy lead context for ChatGPT/Gemini
→ Paste personalized email into ReachMira
→ Save draft
→ Approve
→ Send manually
→ Track email history
→ Track follow-ups
```

---

## Priority Order

1. Fix safety/security blockers
2. Perfect Lead Detail page
3. Perfect Manual Email workflow
4. Perfect Email History and Follow-up tracking
5. Perfect Lead Import and Lead Library
6. Add Email Accounts
7. Add Dashboard Needs Action
8. Add Templates
9. Add Campaigns later
10. Add billing after beta users want to pay

---

# Phase 1: Fix Safety and Security Blockers

## Goal

Make ReachMira safe enough for internal testing and private beta.

## Tasks

### 1.1 Remove or protect seed route

- [x] Find `src/app/api/seed/route.ts`
- [x] Delete the route or restrict it to development only
- [x] Never expose demo credentials in production
- [x] Add `SEED_SECRET` if route is kept for development
- [x] Confirm `/api/seed` returns 404 in production

### 1.2 Protect email account secrets

- [x] Make sure SMTP passwords and API keys are never returned to frontend
- [x] Mask secrets in UI
- [x] Store provider config securely in `email_accounts.config`
- [x] Only use secrets server-side

### 1.3 Enforce suppression list before every send

- [x] Create helper: `src/lib/suppression/check-suppression.ts`
- [x] Check exact email suppression before sending
- [x] Check domain suppression before sending
- [x] Block manual send if email/domain is suppressed
- [x] Block cron/campaign send if email/domain is suppressed
- [x] Add audit log: `send_blocked_suppressed`

### 1.4 Fix unsubscribe flow

- [x] Make unsubscribe work for campaign leads
- [x] Make unsubscribe work for global/manual leads
- [x] Resolve `user_id` from `lead.user_id`, `campaign.user_id`, or `lead_list.user_id`
- [x] Set lead status to `unsubscribed`
- [x] Stop future follow-ups
- [x] Add email to suppression list
- [x] Create audit log: `lead_unsubscribed`
- [x] Never insert empty string as UUID

### 1.5 Fix inbound reply tracking

- [x] Make inbound webhook work for campaign leads
- [x] Make inbound webhook work for global/manual leads
- [x] Resolve `user_id` safely
- [x] Set lead status to `replied`
- [x] Set `reply_status = replied`
- [x] Clear `next_email_at`
- [x] Clear `next_follow_up_at`
- [x] Update latest `sent_emails` row as replied
- [x] Create audit log: `reply_received`

### 1.6 Fix Mailgun webhook verification

- [x] Use Mailgun webhook signing key, not API key
- [x] Fetch signing key from selected email account config
- [x] Reject invalid signatures
- [x] Never expose signing key in response

### 1.7 Fix Mailgun event matching

- [x] Update sent email by `provider_message_id` first
- [x] Fallback to `lead_id + campaign_id`
- [x] Fallback to latest sent email for lead
- [x] Update delivered/opened/clicked/bounced timestamps
- [x] Add bounced/complained/unsubscribed emails to suppression list
- [x] Stop future follow-ups after bounce/complaint/unsubscribe

## Acceptance Criteria

- [x] No public seed route in production
- [x] No secret is exposed to frontend
- [x] Suppressed leads cannot be emailed
- [x] Unsubscribe works for manual and campaign emails
- [x] Reply detection works for manual and campaign leads
- [x] Mailgun webhook verification uses signing key
- [x] Bounce/unsubscribe events stop follow-ups

---

# Phase 2: Perfect Lead Detail Page

## Goal

Make the lead detail page the main workspace where users understand the lead and take action.

## Route

```text
/leads/[id]
```

## Tabs

- Overview
- Lead Intelligence
- Manual Email
- Email History
- Timeline
- Raw Data

## Tasks

### 2.1 Lead header

- [x] Show company name
- [x] Show website link
- [x] Show contact name
- [x] Show email
- [x] Show email verification badge
- [x] Show verification reason
- [x] Show verified date
- [x] Show status badge
- [x] Show priority badge
- [x] Show data quality score
- [x] Show last contacted date
- [x] Show next follow-up date
- [x] Add actions:
  - [x] Edit Lead
  - [x] Verify Email
  - [x] Write Manual Email
  - [x] Add to Campaign
  - [x] Mark Do Not Contact

### 2.2 Overview tab

- [x] Show contact information
- [x] Show company information
- [x] Show outreach status
- [x] Show follow-up information
- [x] Show tags and notes
- [x] Show emails sent count

### 2.3 Lead Intelligence tab

- [x] Show pain point
- [x] Show solution angle
- [x] Show recommended offer
- [x] Show AI company summary
- [x] Show AI lead analysis
- [x] Show AI outreach strategy
- [x] Show personalized first line
- [x] Show data quality notes
- [x] Add edit/save capability
- [x] Add copy lead summary button
- [x] Add copy AI prompt button

### 2.4 Raw Data tab

- [x] Show `raw_data` JSON as readable key-value table
- [x] Hide empty fields
- [x] Add copy raw data button

### 2.5 Timeline tab

- [x] Show chronological audit logs
- [x] Show sent email events
- [x] Include:
  - [x] Lead imported
  - [x] Lead updated
  - [x] Email draft saved
  - [x] Email approved
  - [x] Email sent
  - [x] Reply received
  - [x] Bounced
  - [x] Unsubscribed
  - [x] Added to campaign

## Acceptance Criteria

- [x] User can understand a lead in under 30 seconds
- [x] Pain point and solution angle are visible
- [x] Lead action buttons are easy to access
- [x] Timeline clearly shows what happened
- [x] Raw data is readable and copyable

---

# Phase 3: Perfect Manual Email Workflow

## Goal

Allow users to write or paste personalized emails, save drafts, approve, send, and track everything.

## Main Route

```text
/leads/[id] → Manual Email tab
```

## Tasks

### 3.1 Manual Email tab layout

- [x] Use two-column layout
- [x] Left side: Lead Context Panel
- [x] Right side: Manual Email Editor

### 3.2 Lead Context Panel

Show:

- [x] Company
- [x] Website
- [x] Industry
- [x] Contact name
- [x] Decision maker title
- [x] Email
- [x] Pain point
- [x] Solution angle
- [x] Recommended offer
- [x] Notes
- [x] AI outreach suggestion
- [x] Raw imported data summary

Buttons:

- [x] Copy Context for ChatGPT
- [x] Copy Follow-up Prompt
- [x] Copy Lead Summary

### 3.3 Manual Email Editor

Fields:

- [x] From email account selector
- [x] To email
- [x] Email type selector
- [x] Subject input
- [x] Body textarea/rich text editor

Email types:

- [x] First Email
- [x] Follow-up 1
- [x] Follow-up 2
- [x] Follow-up 3
- [x] Custom Email
- [x] Proposal Email
- [x] Demo Follow-up
- [x] Reply Follow-up

Buttons:

- [x] Save Draft
- [x] Approve
- [x] Send Test
- [x] Send Now
- [x] Copy Email

### 3.4 Save draft

- [x] Add/update API route for saving draft
- [x] Save `manual_email_subject`
- [x] Save `manual_email_body`
- [x] Save `manual_email_type`
- [x] Save `manual_email_saved_at`
- [x] Set `manual_email_approved = false`
- [x] Set status to `manual_email_draft`

### 3.5 Approve email

- [x] Add/update API route for approval
- [x] Set `manual_email_approved = true`
- [x] Set status to `email_approved`
- [x] Log audit event: `email_approved`

### 3.6 Send email

- [x] Validate lead email
- [x] Validate selected email account
- [x] Block bounced/unsubscribed/do_not_contact/excluded leads
- [x] Check suppression list
- [x] Block invalid/disposable/suppressed emails
- [x] Warn for role_based/risky/unknown/not_checked emails
- [x] Add unsubscribe link if missing
- [x] Send using universal `sendEmail()`
- [x] Insert row into `sent_emails`
- [x] Update lead status based on email type
- [x] Update follow-up tracking fields
- [x] Create audit log: `email_sent`
- [x] Create audit log: `send_blocked_invalid_email`
- [x] Show success/error toast

### 3.7 Email quality checker

- [x] Create `src/lib/email/check-email-quality.ts`
- [x] Check subject exists
- [x] Check body exists
- [x] Check body is not too long
- [x] Check unsubscribe link exists
- [x] Check no unreplaced variables exist
- [x] Check CTA exists
- [x] Check lead is not blocked
- [x] Show warnings before send

## Acceptance Criteria

- [x] User can paste an email and send it manually
- [x] User can save draft before sending
- [x] User can approve draft before sending
- [x] Sending updates status correctly
- [x] Sending creates email history
- [x] Sending creates follow-up date
- [x] Blocked/suppressed leads cannot be emailed
### 3.8 Email Signature Designer

- [x] Add signature settings per email account
- [x] Store signature HTML safely
- [x] Add simple rich text signature editor
- [x] Support name, title, company, website, phone, logo, social links
- [x] Preview signature before saving
- [x] Append signature automatically to manual emails
- [x] Let user toggle signature on/off before sending
- [x] Avoid duplicate signature if already included
- [x] Add plain-text fallback for signatures

---

# Phase 4: Perfect Email History and Follow-up Tracking

## Goal

Make ReachMira reliable for tracking every email and every follow-up.

## Tasks

### 4.1 Add follow-up tracking fields

Create migration if missing:

- [x] `emails_sent_count int default 0`
- [x] `last_email_type text`
- [x] `last_contacted_at timestamp`
- [x] `next_follow_up_at timestamp`
- [x] `reply_status text default 'no_reply'`
- [x] `next_email_at timestamp`
- [x] `current_step int default 0`
- [x] `last_email_sent_at timestamp`

### 4.2 Update tracking after send

After first email:

- [x] Status = `mail_sent`
- [x] `emails_sent_count += 1`
- [x] `last_email_type = first_email`
- [x] `last_contacted_at = now`
- [x] `next_follow_up_at = now + 3 days`

After follow-up 1:

- [x] Status = `follow_up_1_sent`
- [x] `emails_sent_count += 1`
- [x] `last_email_type = follow_up_1`
- [x] `last_contacted_at = now`
- [x] `next_follow_up_at = now + 4 days`

After follow-up 2:

- [x] Status = `follow_up_2_sent`
- [x] `emails_sent_count += 1`
- [x] `last_email_type = follow_up_2`
- [x] `last_contacted_at = now`
- [x] `next_follow_up_at = null`

After reply:

- [x] Status = `replied`
- [x] `reply_status = replied`
- [x] `next_follow_up_at = null`
- [x] `next_email_at = null`

### 4.3 Email History tab

Show:

- [x] Sent date
- [x] Email type
- [x] Subject
- [x] From
- [x] To
- [x] Provider
- [x] Status
- [x] Opened
- [x] Clicked
- [x] Replied
- [x] Bounced
- [x] Actions

Actions:

- [x] View Email
- [x] Copy Email
- [x] Use as Follow-up Context
- [x] Resend

### 4.4 Previous email context for follow-ups

When email type is follow-up:

- [x] Show previous email subject
- [x] Show previous email body
- [x] Show previous sent date
- [x] Add Copy Previous Email Context button
- [x] Add Copy Follow-up Prompt button

### 4.5 Deep verification after import

- [x] Create API route: `POST /api/leads/verify-bulk`
- [x] Require auth
- [x] Limit to 25 leads per request
- [x] Accept:
- [x] `lead_ids: string[]`
- [x] `checkMx: boolean`
- [x] Run local verification with MX enabled when requested
- [x] Update verification fields
- [x] Return summary:
- [x] total
- [x] valid
- [x] risky
- [x] invalid
- [x] role_based
- [x] disposable
- [x] suppressed
- [x] unknown
- [x] failed
- [x] Add audit log: `email_verified`
- [x] Add audit log: `email_verification_failed`

## Acceptance Criteria

- [x] Every sent email is visible in history
- [x] Every manual send updates follow-up tracking
- [x] Follow-ups due can be calculated reliably
- [x] Reply stops future follow-ups
- [x] User can write follow-ups using previous email context

---

# Phase 5: Perfect Lead Import and Lead Library

## Goal

Make importing and managing leads simple and reliable.

## Routes

```text
/leads
/leads/import
/leads/new
/lead-lists
/lead-lists/[id]
```

## Tasks

### 5.1 CSV import

- [x] Upload CSV
- [x] Parse headers
- [x] Preview first 5 rows
- [x] Auto-map columns
- [x] Allow manual mapping
- [x] Store unmapped fields in `raw_data`
- [x] Validate emails
- [x] Skip duplicates
- [x] Show import summary

### 5.2 Google Sheets import

- [x] Add Google Sheet URL field
- [x] Parse spreadsheet ID
- [x] Parse `gid`
- [x] Convert to public CSV export URL
- [x] Fetch sheet data
- [x] Show private sheet error clearly
- [x] Reuse column mapping flow

### 5.2A Email verification during import

- [x] Add lead fields:
- [x] `email_verification_status text default 'not_checked'`
- [x] `email_verification_score int`
- [x] `email_verification_provider text default 'local'`
- [x] `email_verification_reason text`
- [x] `email_verified_at timestamp with time zone`
- [x] `email_verification_raw jsonb`
- [x] Create `src/lib/email-verification/local-verify.ts`
- [x] Normalize email to lowercase
- [x] Validate syntax
- [x] Extract domain
- [x] Check empty email
- [x] Check suppression list
- [x] Check role-based prefixes:
- [x] `info`
- [x] `support`
- [x] `admin`
- [x] `sales`
- [x] `contact`
- [x] `hello`
- [x] `noreply`
- [x] `no-reply`
- [x] Check disposable domains:
- [x] `mailinator.com`
- [x] `tempmail.com`
- [x] `10minutemail.com`
- [x] `guerrillamail.com`
- [x] Support optional MX check
- [x] Return:
- [x] `status`
- [x] `score`
- [x] `reason`
- [x] `provider`
- [x] `checks`
- [x] Run local verification during CSV import
- [x] Run local verification during Google Sheets import
- [x] Save verification result into lead row
- [x] Skip invalid emails by default
- [x] Allow user to import invalid rows explicitly
- [x] Show import summary:
- [x] total rows
- [x] imported
- [x] invalid emails
- [x] role-based emails
- [x] disposable emails
- [x] suppressed emails
- [x] duplicates skipped
- [x] Keep verification free-tier friendly
- [x] Do not run MX checks during imports by default
- [x] Let user trigger deep verification manually

### 5.3 Lead Library table

Columns:

- [x] Checkbox
- [x] Company
- [x] Contact
- [x] Email
- [x] Industry
- [x] Pain Point
- [x] Priority
- [x] Data Quality
- [x] Status
- [x] AI Status
- [x] Email Status
- [x] Last Contacted
- [x] Next Follow-up
- [x] Actions

### 5.4 Filters

Add filters:

- [x] Status
- [x] Priority
- [x] AI Status
- [x] Lead List
- [x] Industry
- [x] Country
- [x] Data Quality
- [x] Last Contacted
- [x] Follow-up Due
- [x] Tags
- [x] Replied / Not Replied
- [x] Bounced
- [x] Unsubscribed
- [x] Do Not Contact
- [x] Email Status
- [x] Valid emails
- [x] Risky emails
- [x] Invalid emails
- [x] Not checked emails
- [x] Ready to Send
- [x] Missing Solution Angle
- [x] Needs Personalization
- [x] Valid emails only
- [x] Interested

### 5.5 Bulk actions

- [x] Mark interested
- [x] Mark not interested
- [x] Mark do not contact
- [x] Mark excluded
- [x] Add to campaign
- [x] Add tag
- [x] Change priority
- [x] Export selected
- [x] Verify selected emails
- [x] Deep verify selected emails
- [x] Mark as contacted
- [x] Assign to list

## Acceptance Criteria

- [x] User can import leads from CSV
- [x] User can import leads from public Google Sheet
- [x] All extra columns are stored in `raw_data`
- [x] User can filter and search leads
- [x] User can take bulk actions
- [x] Lead Library feels like a usable mini CRM
- [x] Imported leads show email verification status
- [x] User can filter leads by email status
- [x] User can bulk verify selected leads
- [x] Invalid/suppressed/disposable emails are visible before outreach

---

# Phase 6: Add Email Accounts

## Goal

Allow users to connect and manage sending accounts safely.

## Route

```text
/settings/email-accounts
```

## Tasks

### 6.1 Email account table

Ensure fields exist:

- [x] Provider
- [x] Email address
- [x] Sender name
- [x] Config JSON
- [x] Daily send limit
- [x] Daily sent count
- [x] Last sent reset date
- [x] Is default
- [x] Warmup enabled
- [x] Status

### 6.2 Provider support

Implement now:

- [x] SMTP
- [x] Mailgun

Add placeholders:

- [x] Resend later
- [x] Amazon SES later

### 6.3 SMTP form

Fields:

- [x] Email address
- [x] Sender name
- [x] SMTP host
- [x] Port
- [x] Secure true/false
- [x] Username
- [x] Password
- [x] Daily limit

### 6.4 Mailgun form

Fields:

- [x] Email address
- [x] Sender name
- [x] API key
- [x] Domain
- [x] Region
- [x] Webhook signing key
- [x] Daily limit

### 6.5 Email account actions

- [x] Add account
- [x] Edit account
- [x] Delete account
- [x] Test send
- [x] Set default
- [x] Disable account

### 6.6 Daily limit logic

- [x] Reset daily count when date changes
- [x] Block sending if daily limit reached
- [x] Increment count after successful send
- [x] Show sent today in UI

## Acceptance Criteria

- [x] User can connect SMTP account
- [x] User can connect Mailgun account
- [x] User can test email account
- [x] Email secrets are masked
- [x] Daily limit is enforced
- [x] Default account works in manual send

---

# Phase 7: Add Dashboard Needs Action

## Goal

Make the dashboard show what users need to do next.

## Route

```text
/dashboard
```

## Tasks

### 7.1 Dashboard metrics

Show:

- [x] Total Leads
- [x] Ready to Send
- [x] Emails Sent
- [x] Replies
- [x] Follow-ups Due
- [x] Bounce Rate

### 7.2 Needs Action cards

Show real counts:

- [x] Follow-ups due today
- [x] Drafts waiting approval
- [x] High-priority leads not contacted
- [x] Leads missing pain point
- [x] Replies waiting response
- [x] Bounced leads to review
- [x] Leads needing email verification
- [x] Leads ready to send
- [x] Leads missing solution angle

### 7.3 CTA links

Each card should link to filtered leads page:

- [x] Follow-ups Due → `/leads?filter=followups_due`
- [x] Drafts → `/leads?status=manual_email_draft`
- [x] High Priority → `/leads?priority=high&contacted=false`
- [x] Missing Pain Point → `/leads?missing=pain_points`
- [x] Replies → `/leads?status=replied`
- [x] Bounced → `/leads?status=bounced`

### 7.4 Recent Activity

Show:

- [x] Lead imported
- [x] Email draft saved
- [x] Email approved
- [x] Email sent
- [x] Reply received
- [x] Lead unsubscribed
- [x] Email bounced
- [x] Email verified
- [x] Follow-up reminder due
- [x] Reply outcome updated

## Acceptance Criteria

- [x] Dashboard clearly shows what needs action
- [x] Counts are real
- [x] User can click into filtered lead views
- [x] Recent activity is useful

---

# Phase 8: Add Templates

## Goal

Help users write faster and reduce AI usage.

## Routes

```text
/templates
/templates/new
/templates/[id]
```

## Tasks

### 8.1 Template table

Create if missing:

- [x] `email_templates_library`
- [x] `id`
- [x] `user_id`
- [x] `name`
- [x] `category`
- [x] `subject`
- [x] `body`
- [x] `offer_type`
- [x] `is_default`
- [x] `created_at`
- [x] `updated_at`

### 8.2 Template CRUD

- [x] List templates
- [x] Create template
- [x] Edit template
- [x] Delete template
- [x] Duplicate template

### 8.3 Template categories

Add categories:

- [x] First Cold Email
- [x] Follow-up 1
- [x] Follow-up 2
- [x] Breakup Email
- [x] Proposal Follow-up
- [x] Demo Follow-up
- [x] CRM Offer
- [x] ERP Offer
- [x] Website Redesign
- [x] SaaS Development
- [x] AI Automation

### 8.4 Variables panel

Variables:

- [x] `{{first_name}}`
- [x] `{{company_name}}`
- [x] `{{website}}`
- [x] `{{industry}}`
- [x] `{{pain_points}}`
- [x] `{{solution_angle}}`
- [x] `{{recommended_offer}}`
- [x] `{{personalized_first_line}}`
- [x] `{{unsubscribe_url}}`

### 8.5 Use templates

- [x] Insert template into manual email
- [x] Use template in campaign sequence later
- [x] Link templates to offers

## Acceptance Criteria

- [x] User can create reusable templates
- [x] User can insert template into manual email
- [x] Variables are visible and easy to copy
- [x] Templates reduce need for AI calls

---

# Phase 9: Add Campaigns Later

## Goal

Add campaign automation after manual outreach is stable.

## Do not prioritize before Phase 1-8 are usable.

## Future Tasks

### 9.1 Campaign setup wizard

- [x] Campaign basics
- [x] Select email account
- [x] Select leads from Lead Library
- [x] Import new leads
- [x] Personalization mode
- [x] Sequence builder
- [x] Review and start

### 9.2 Sequence builder

- [x] First email
- [x] Follow-up 1
- [x] Follow-up 2
- [x] Delay settings
- [x] Stop on reply
- [x] Stop on bounce
- [x] Stop on unsubscribe

### 9.3 Campaign sending

- [x] Fix `next_email_at` null handling
- [x] Respect campaign daily limit
- [x] Respect email account daily limit
- [x] Send small batches only
- [x] Use suppression checks
- [x] Use sent email history
- [x] Use audit logs
- [x] Add launch readiness checklist before activating automation
- [x] Add `allow_risky_emails` campaign setting
- [x] Block invalid/disposable/suppressed emails
- [x] Skip not_checked/unknown/risky unless `allow_risky_emails = true`
- [x] Add audit log: `send_skipped_email_verification`

### 9.4 Campaign analytics

- [x] Leads
- [x] Sent
- [x] Delivered
- [x] Opened
- [x] Clicked
- [x] Replied
- [x] Bounced
- [x] Unsubscribed

## Acceptance Criteria

- [x] Campaigns can send safely
- [x] Follow-ups stop on reply/bounce/unsubscribe
- [x] Campaign status is trackable
- [x] Campaign analytics are useful

---

# Phase 9B: Strengthen Manual-First Advantage

## Goal

Make ReachMira more useful than a spreadsheet without becoming a heavy cold email automation tool.

## Tasks

### 9B.1 Outreach Readiness Status

- [x] Add computed outreach readiness status per lead
- [x] Add readiness states:
- [x] `ready_to_send`
- [x] `needs_email_verification`
- [x] `missing_pain_point`
- [x] `missing_solution_angle`
- [x] `needs_personalization`
- [x] `follow_up_due`
- [x] `already_contacted`
- [x] `do_not_contact`
- [x] Show readiness status in Lead Library
- [x] Show readiness status in Lead Detail page
- [x] Add readiness filters
- [x] Add readiness counts to dashboard

### 9B.2 Saved Views

- [x] Add saved views for Lead Library
- [x] Save current filters as reusable views
- [x] Let user name a saved view
- [x] Add default saved views:
- [x] Valid Emails Only
- [x] Ready to Send
- [x] Follow-ups Due Today
- [x] High Priority Leads
- [x] Missing Pain Point
- [x] Not Contacted Yet
- [x] Allow deleting saved views
- [x] Allow setting a default saved view

### 9B.3 Import Cleanup Assistant

- [x] Show import cleanup summary before final import
- [x] Show duplicate emails found
- [x] Show invalid emails found
- [x] Show role-based emails found
- [x] Show disposable emails found
- [x] Show missing company names
- [x] Show leads missing pain points
- [x] Add import options:
- [x] Import all
- [x] Skip duplicates
- [x] Skip invalid emails
- [x] Import only valid leads

### 9B.4 Follow-up Reminder Layer

- [x] Add follow-up reminder views
- [x] Show due today
- [x] Show due tomorrow
- [x] Show overdue
- [x] Add reminder actions:
- [x] Snooze 1 day
- [x] Snooze 3 days
- [x] Mark done
- [x] Add dashboard reminder counts
- [x] Keep reminders manual-first, not auto-send

### 9B.5 Offer Library and Offer Matching

- [x] Add offer library
- [x] Store reusable offer/service records
- [x] Add example offers:
- [x] Website redesign
- [x] Custom CRM
- [x] AI automation
- [x] SaaS MVP development
- [x] Landing page
- [x] Let user assign recommended offer to a lead
- [x] Use offer in templates and AI prompts later

### 9B.6 Workspace Analytics Lite

- [x] Add simple workspace analytics
- [x] Show valid email rate
- [x] Show outreach readiness distribution
- [x] Show follow-ups due
- [x] Show interested leads
- [x] Show most used offer
- [x] Show best used template

### 9B.7 Reply Outcome Classification

- [x] Add reply outcome labels
- [x] Add statuses:
- [x] Interested
- [x] Not interested
- [x] Asked for details
- [x] Demo requested
- [x] Proposal requested
- [x] Let user set reply outcome manually
- [x] Show reply outcome in lead timeline and filters

### 9B.8 Workspace Safety Checklist

- [x] Add pre-send workspace safety checklist
- [x] Confirm email account connected
- [x] Confirm unsubscribe link enabled
- [x] Confirm daily limit set
- [x] Confirm lead not suppressed
- [x] Add DNS/authentication guidance note for SPF/DKIM/DMARC

## Acceptance Criteria

- [x] ReachMira helps users know what to do next
- [x] Lead Library becomes easier to operate daily
- [x] Follow-ups are less likely to be forgotten
- [x] Saved views reduce repeated filtering work
- [x] Product stays manual-first and affordable

---

# Phase 10: Add Billing After Beta Users Want to Pay

## Goal

Only add billing after people validate the product.

## Do not build billing before beta validation.

## Validation First

Before billing:

- [ ] Get 5-10 beta users
- [ ] Watch them use the product
- [ ] Ask if they would pay
- [ ] Ask what price feels fair
- [ ] Confirm they use it weekly

## Possible plans

| Plan | Price | Target User |
|---|---:|---|
| Free Beta | $0 | Testers |
| Starter | $9/month | Freelancers |
| Growth | $19/month | Small agencies |
| Agency | $39/month | Agencies with more senders |

## Future billing tasks

- [ ] Add Stripe
- [ ] Add subscription plans
- [ ] Add usage limits
- [ ] Add trial
- [ ] Add billing page
- [ ] Add invoice link
- [ ] Add plan upgrade/downgrade

## Acceptance Criteria

- [ ] Billing is added only after demand is validated
- [ ] Pricing supports early-stage users
- [ ] Product remains affordable

---

# Global UI/UX Requirements

## Brand

- [x] Use product name: ReachMira
- [x] Remove old “The Digital Dude Outreach OS” branding
- [x] Use modern light UI
- [x] Use violet + teal accents
- [x] Do not use navy blue
- [x] Do not use old dark CRM style

## Navigation

MVP sidebar should show:

- [x] Dashboard
- [x] Leads
- [x] Campaigns
- [x] Manual Emails
- [x] Email Accounts
- [x] Activity
- [x] Settings

Move under Settings or hide until ready:

- [x] Templates
- [x] Suppression List
- [x] AI Usage
- [x] Sending Rules

## User Profile Settings

- [x] Add Profile tab to `/settings`
- [x] Add profile quick card in Settings
- [x] Add profile fields:
  - [x] Display name
  - [x] Workspace name
  - [x] Role/title
  - [x] Phone/WhatsApp
  - [x] Timezone
  - [x] Avatar URL
  - [x] Read-only account email
- [x] Add Supabase migration for nullable profile fields
- [x] Update profile type definitions
- [x] Save profile fields through existing Save Settings action
- [x] Update sidebar to use display/workspace name
- [x] Keep account email read-only for this pass
- [x] Defer password/email change flows to later

## User Profile Settings Acceptance Criteria

- [x] User can edit personal/workspace profile settings
- [x] Profile values persist after reload
- [x] Sidebar reflects saved profile identity
- [x] Account email is visible but not editable
- [x] Existing settings tabs still work

## Empty states

Add friendly empty states for:

- [x] No leads
- [x] No campaigns
- [x] No email accounts
- [x] No manual drafts
- [x] No templates
- [x] No activity logs

## Confirmation modals

Add confirmation before:

- [x] Sending one email
- [x] Bulk sending
- [x] Deleting lead
- [x] Deleting template
- [x] Deleting email account
- [x] Marking lead do not contact

---

# Testing Checklist

Run after each major phase:

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run typecheck` if available
- [x] `npm run build`

## Manual test flow

- [x] Register/login
- [x] Add SMTP email account
- [x] Test email account
- [x] Import CSV leads
- [x] Import Google Sheet leads
- [x] Import leads with valid and invalid emails
- [x] Confirm verification status appears in Lead Library
- [x] Filter by email status
- [x] Open lead detail page
- [x] Confirm verification badge/reason/date
- [x] Add pain point and solution angle
- [x] Copy context for ChatGPT
- [x] Paste email into manual editor
- [x] Save draft
- [x] Approve email
- [x] Send email
- [x] Verify selected emails
- [x] Deep verify selected emails
- [x] Check email history
- [x] Check lead status is `mail_sent`
- [x] Check next follow-up date
- [x] Send follow-up 1
- [x] Check status is `follow_up_1_sent`
- [x] Add lead to suppression list
- [x] Confirm send is blocked
- [x] Confirm invalid/disposable/suppressed emails are blocked from manual send
- [x] Confirm unknown/not_checked/risky emails warn before manual send
- [x] Test unsubscribe link
- [x] Test reply webhook if configured
- [x] Confirm campaign send skips risky/not_checked/unknown when risky emails are not allowed
- [x] Confirm dashboard needs-action counts update

---

# Definition of MVP Done

ReachMira MVP is done when:

- [x] A user can import leads
- [x] A user can manage leads in Lead Library
- [x] A user can open lead detail page
- [x] A user can see pain point and solution angle
- [x] A user can copy context for ChatGPT
- [x] A user can paste and save manual email draft
- [x] A user can approve and send email
- [x] Email history is saved
- [x] Lead status updates correctly
- [x] Follow-up date is created
- [x] Suppressed/unsubscribed leads cannot be emailed
- [x] Dashboard shows what needs action
- [x] Email account setup works
- [x] UI is fully ReachMira branded
- [x] No critical security blockers remain

---

# Notes

Do not overbuild.

Do not prioritize:

- Inbox warmup
- LinkedIn automation
- AI reply agent
- Built-in lead database
- Full automation engine
- White-label SaaS
- Team permissions
- Advanced analytics
- Chrome extension
- Billing system

Build the simple, useful workflow first.
