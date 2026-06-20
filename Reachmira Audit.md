# ReachMira — Feature-by-Feature Audit Tasklist & Prompts

23 features, mapped from the actual codebase. Each section has a **checklist** (what to verify) and a **ready-to-paste audit prompt**. These prompts are for _auditing only_ — they explicitly tell the agent to read code and report findings, not to fix anything, so you get a clean findings list per feature before deciding what to act on.

Run these one feature at a time (or batch related ones) and collect the outputs before touching code — that keeps the audit pass separate from the fix pass.

---

## 1. Authentication & Session Management

**Files:** `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/auth/callback/`, `src/components/auth/AuthScreen.tsx`, `src/utils/supabase/client.ts`, `src/utils/supabase/server.ts`

**Checklist:**

- [ ] Does middleware correctly protect every route that should require auth, and correctly exclude webhooks/cron/unsubscribe/tracking?
- [ ] Is session refresh handled on every request without redundant calls?
- [ ] Are auth errors (expired session, invalid token) handled gracefully in the UI vs. silently failing?
- [ ] Password reset flow — does it exist? Is it tested?
- [ ] Is there any route that _should_ be behind auth but isn't matched by the middleware pattern?
- [ ] Email confirmation flow — what happens if a user never confirms?

**Audit prompt:**

```
Audit the authentication and session management implementation in this codebase. Do NOT
modify any code — only read and report findings.

Read: src/middleware.ts, src/app/login/page.tsx, src/app/register/page.tsx,
src/app/auth/callback/*, src/components/auth/AuthScreen.tsx, src/utils/supabase/client.ts,
src/utils/supabase/server.ts, src/utils/supabase/admin.ts, src/utils/supabase/service.ts.

Report on:
1. Whether the middleware matcher correctly protects all authenticated routes and correctly
   excludes the routes that legitimately need to bypass auth (webhooks, cron, unsubscribe,
   tracking pixels) — list any route you believe is incorrectly included or excluded.
2. Whether session refresh/expiry is handled correctly and what happens to the user
   experience when a session expires mid-action (e.g., mid-send).
3. Whether there's a password reset / forgot-password flow, and if so, whether it's complete.
4. Whether email confirmation is required, and what happens to an unconfirmed user who tries
   to use the app.
5. Any place where createServiceClient() (which bypasses RLS) is used in a context reachable
   by user input without an explicit auth check first.
6. Any inconsistency between routes that check `auth.getUser()` vs `auth.getSession()` and
   whether that inconsistency matters here.

Output a numbered findings list with file:line references and a severity (Critical/High/
Medium/Low) for each finding. Do not propose code changes — just the findings.
```

---

## 2. Waitlist & Pre-launch Signup

**Files:** `src/app/waitlist/page.tsx`, `src/app/waitlist/layout.tsx`, `src/app/api/waitlist/route.ts`, `src/app/admin/waitlist/`, `src/app/api/admin/waitlist/`, migrations `create_waitlist.sql`, `create_detailed_waitlist.sql`, `admin_waitlist_security.sql`, `waitlist_status_and_notes.sql`

**Checklist:**

- [ ] Is the public waitlist POST endpoint rate-limited or abusable for spam/enumeration?
- [ ] Is there duplicate-email handling that leaks whether an email already exists (enumeration risk)?
- [ ] Does the admin waitlist view correctly enforce admin-only access?
- [ ] Are waitlist signups ever converted into real accounts, and is that flow tested?

**Audit prompt:**

```
Audit the waitlist feature. Do NOT modify code — report only.

Read: src/app/waitlist/page.tsx, src/app/waitlist/layout.tsx, src/app/api/waitlist/route.ts,
src/app/admin/waitlist/*, src/app/api/admin/waitlist/*, and the migrations
20260610190000_create_waitlist.sql, 20260610194500_create_detailed_waitlist.sql,
20260610200000_admin_waitlist_security.sql, 20260610210000_waitlist_status_and_notes.sql.

Report on:
1. Whether POST /api/waitlist has any abuse protection (rate limiting, CAPTCHA, basic bot
   filtering) — if none exists, note it as a finding rather than assuming it's out of scope.
2. Whether the duplicate-check logic leaks information that lets an attacker enumerate which
   emails are already registered.
3. Whether the admin waitlist routes/pages are correctly gated by admin role checks, matching
   the pattern used elsewhere in the app (requireAdmin()).
4. Whether there's any path from a waitlist signup to an actual user account, or if the two
   systems are entirely disconnected (manual conversion only).
5. Data retention — is there any PII handling concern with storing waitlist signups indefinitely.

Output findings as a numbered list with severity ratings.
```

---

## 3. Lead Import (CSV & Google Sheets)

**Files:** `src/app/leads/import/page.tsx`, `src/app/leads/new/page.tsx`, `src/app/api/lead-lists/[id]/import/route.ts`, `src/app/api/lead-lists/import-sheets/route.ts`, `src/app/api/campaigns/[id]/import-leads/route.ts`, `src/app/api/campaigns/[id]/import-sheets/route.ts`, `src/app/campaigns/[id]/leads/import/page.tsx`

**Checklist:**

- [ ] CSV parsing — how are malformed rows, encoding issues, and huge files handled?
- [ ] Column auto-mapping — what happens with ambiguous or duplicate headers?
- [ ] Google Sheets import — is the public-sheet-only assumption clearly communicated, and what's the failure mode for a private sheet?
- [ ] Duplicate detection — duplicate within the same import batch vs. duplicate against existing leads — both handled?
- [ ] Is there a row/file size limit, and what happens above it (timeout vs. graceful rejection)?
- [ ] Email verification at import time — confirm it actually runs and the summary numbers are accurate.
- [ ] Is `raw_data` JSONB storage safe against extremely large or deeply nested unexpected input?
- [ ] Two separate import paths exist (lead-lists vs. campaigns) — are they consistent, or have they drifted?

**Audit prompt:**

```
Audit the lead import feature (CSV and Google Sheets), including both import entry points.
Do NOT modify code — report only.

Read: src/app/leads/import/page.tsx, src/app/leads/new/page.tsx,
src/app/api/lead-lists/[id]/import/route.ts, src/app/api/lead-lists/import-sheets/route.ts,
src/app/api/campaigns/[id]/import-leads/route.ts, src/app/api/campaigns/[id]/import-sheets/route.ts,
src/app/campaigns/[id]/leads/import/page.tsx, src/lib/email-verification/local-verify.ts,
src/lib/email-verification/persist.ts.

Report on:
1. Whether the lead-lists import path and the campaigns import path share logic or have
   diverged into two separately-maintained implementations with different behavior — if
   diverged, list the specific differences.
2. How malformed CSV rows, bad encodings, or empty files are handled — does it fail loudly
   or silently skip rows the user won't know about?
3. What the failure mode is for a private/inaccessible Google Sheet — is the error message
   actually useful to a non-technical user?
4. Whether there's any practical row-count or file-size limit, and whether large imports risk
   a serverless function timeout.
5. Whether duplicate detection covers both (a) duplicates within the same uploaded file and
   (b) duplicates against leads already in the user's library/campaign.
6. Whether local email verification (local-verify.ts) genuinely runs synchronously during
   import for every row, or whether there's a path where rows get imported without
   verification ever running.
7. Whether unmapped columns stored into raw_data JSONB have any size/depth guard, or whether
   a malicious/malformed sheet could bloat a single row.

Output a numbered findings list with file:line references and severity ratings. Flag clearly
if the two import code paths (lead-lists vs. campaigns) should be consolidated.
```

---

## 4. Lead Library (List, Filters, Bulk Actions)

**Files:** `src/app/leads/page.tsx`, `src/app/api/leads/route.ts`, `src/app/api/leads/bulk/route.ts`, `src/lib/leads/library.ts`

**Checklist:**

- [ ] Confirm current pagination/scaling behavior (this overlaps with the performance audit — capture it here from a correctness angle, not just speed).
- [ ] Do all documented filters (status, priority, AI status, email status, industry, country, tags, follow-up due, replied, bounced, unsubscribed, do-not-contact) actually work and combine correctly (AND vs OR logic)?
- [ ] Bulk actions — do they correctly handle partial failures (e.g., 40 of 50 selected leads succeed)?
- [ ] Is there any bulk action that could affect leads belonging to a different user (authorization bypass via ID manipulation)?
- [ ] Export selected — what format, and does it leak any data that shouldn't be in an export (raw secrets, internal IDs)?

**Audit prompt:**

```
Audit the Lead Library list view, filtering, and bulk actions. Do NOT modify code — report only.

Read: src/app/leads/page.tsx, src/app/api/leads/route.ts, src/app/api/leads/bulk/route.ts,
src/lib/leads/library.ts, src/lib/leads/status.ts.

Report on:
1. For every filter exposed in the UI, confirm it has a corresponding, correctly-implemented
   server-side filter — list any filter that's UI-only (cosmetic, doesn't actually filter) or
   any filter implemented in JavaScript after fetch rather than pushed to the database query.
2. Whether combining multiple filters produces correct AND semantics, or whether any
   combination silently produces wrong results.
3. For each bulk action (mark interested, mark do-not-contact, add to campaign, add tag,
   change priority, export, verify, deep-verify, assign to list): does the API route verify
   that every lead ID in the request actually belongs to the requesting user before acting on
   it, or does it trust the client-supplied ID list? This is an authorization-bypass check —
   be specific about which actions you verified vs. which you couldn't confirm.
4. What happens when a bulk action partially fails (e.g. 1 of 50 leads errors) — does the
   user get an accurate count of what succeeded/failed, or a misleading all-or-nothing result?
5. What fields are included in "Export selected" and whether any of them are
   sensitive/internal (raw_data contents, internal UUIDs, verification raw payloads).

Output a numbered findings list with file:line references and severity ratings.
```

---

## 5. Lead Detail Workspace (Overview / Intelligence / Manual Email / History / Timeline / Raw Data)

**Files:** `src/app/leads/[id]/`, `src/components/leads/LeadWorkspace.tsx`, `src/components/leads/RichTextEditor.tsx`, `src/components/leads/EmailVerificationBadge.tsx`, `src/app/api/leads/[id]/route.ts`

**Checklist:**

- [ ] Authorization — can a user reach another user's lead by guessing/incrementing the lead ID in the URL?
- [ ] Tab state — does switching tabs lose unsaved edits without warning?
- [ ] Raw Data tab — confirm it can't be used to inject something unexpected when copied/pasted elsewhere.
- [ ] Timeline — does it actually reflect every audit log type listed in the README, or are some event types silently missing from the rendered timeline?
- [ ] Edit/save on Lead Intelligence fields — optimistic UI vs. actual persisted state — any chance of silent data loss?

**Audit prompt:**

```
Audit the Lead Detail Workspace (the /leads/[id] page and its tabs: Overview, Lead
Intelligence, Manual Email, Email History, Timeline, Raw Data). Do NOT modify code —
report only.

Read: src/app/leads/[id]/* (all files), src/components/leads/LeadWorkspace.tsx,
src/components/leads/RichTextEditor.tsx, src/components/leads/EmailVerificationBadge.tsx,
src/app/api/leads/[id]/route.ts.

Report on:
1. Whether GET /api/leads/[id] and any PATCH/PUT on it verify the lead belongs to the
   requesting user (or an admin), or whether the ID alone is trusted — try to confirm this by
   reading the actual query, not just assuming RLS covers it.
2. Whether unsaved edits in any tab (especially Lead Intelligence fields and the Manual Email
   draft) can be silently lost when switching tabs or navigating away, and whether the user
   gets any warning.
3. Whether the Timeline tab actually renders every audit log action type that the codebase
   creates (cross-reference against every createAuditLog() call site across the codebase) —
   list any action type that's logged but never rendered in the UI.
4. Whether the Raw Data tab's "copy raw data" / display logic does any escaping, or whether
   raw imported data (which could contain arbitrary user-supplied strings from a CSV/sheet)
   is rendered in a way that could be visually misleading or break the page layout.
5. Whether RichTextEditor.tsx produces HTML that's stored and later rendered via
   dangerouslySetInnerHTML anywhere — confirm whether its own internal sanitization (if any)
   is sufficient, independent of any sanitization added elsewhere in the codebase.

Output a numbered findings list with file:line references and severity ratings.
```

---

## 6. Email Verification (Local + Deep/Bulk)

**Files:** `src/lib/email-verification/local-verify.ts`, `src/lib/email-verification/persist.ts`, `src/app/api/leads/verify-bulk/route.ts`

**Checklist:**

- [ ] Local verification rule completeness — role-based prefixes, disposable domains: are the lists realistically comprehensive or trivially easy to bypass?
- [ ] MX check — rate limits, timeout handling, DNS failures.
- [ ] Bulk verify — the 25-lead-per-request limit: is it enforced server-side, or only assumed by the frontend?
- [ ] Score/reason consistency — do `status`, `score`, and `reason` ever disagree with each other?

**Audit prompt:**

```
Audit the email verification feature (both local syntax/heuristic verification and the bulk
deep-verify flow with optional MX checks). Do NOT modify code — report only.

Read: src/lib/email-verification/local-verify.ts, src/lib/email-verification/persist.ts,
src/app/api/leads/verify-bulk/route.ts.

Report on:
1. Whether the disposable-domain and role-based-prefix lists are hardcoded and how easily
   bypassed they are (e.g. a disposable domain not on the list, a role prefix like "team@" or
   "office@" not covered).
2. Whether the 25-lead-per-request limit mentioned for verify-bulk is actually enforced
   server-side (reject requests over the limit) or only assumed/enforced client-side.
3. How MX lookups handle DNS timeouts, NXDOMAIN, and rate limiting from the DNS resolver —
   is there a risk of the whole bulk-verify request hanging or timing out on one slow domain?
4. Whether status/score/reason can ever end up inconsistent with each other (e.g. status=valid
   but reason describing a risk), and what would cause that.
5. Whether verification results are cached/reused appropriately, or whether re-verifying the
   same email repeatedly wastes calls unnecessarily.

Output a numbered findings list with file:line references and severity ratings.
```

---

## 7. AI Personalization Pipeline (Gemini)

**Files:** `src/app/api/ai/analyze-lead/route.ts`, `src/app/api/ai/bulk-analyze/route.ts`, `src/app/api/leads/personalize/route.ts`, `src/app/api/leads/[id]/personalize/route.ts`, `src/app/api/leads/[id]/auto-research/route.ts`, `src/lib/ai/runtime.ts`, `src/lib/ai/efficiency.ts`, `src/lib/leads/context-prompt.ts`, `src/utils/gemini.ts`, `src/utils/gemini-prompt-builder.ts`

**Checklist:**

- [ ] Prompt injection — scraped website/company content is fed into Gemini prompts; can a malicious lead's website content manipulate the AI into producing unwanted output (or leaking the system prompt)?
- [ ] Budget enforcement — daily/monthly caps: are they actually enforced atomically, or is there a race condition allowing overrun under concurrent requests?
- [ ] Failure handling — what happens to a lead's `ai_status` if Gemini errors mid-call, times out, or returns malformed JSON?
- [ ] Cost control — is the cheaper model (flash-lite) actually selected when it should be, per the efficiency logic?
- [ ] User-supplied Gemini API key — is it validated before use, and what's the error UX for an invalid/expired key?
- [ ] Two personalize endpoints exist (`/api/leads/personalize` and `/api/leads/[id]/personalize`) plus `analyze-lead` — are these redundant or serving genuinely different purposes?

**Audit prompt:**

```
Audit the AI personalization pipeline (Gemini-based lead analysis and email content
generation). Do NOT modify code — report only.

Read: src/app/api/ai/analyze-lead/route.ts, src/app/api/ai/bulk-analyze/route.ts,
src/app/api/leads/personalize/route.ts, src/app/api/leads/[id]/personalize/route.ts,
src/app/api/leads/[id]/auto-research/route.ts, src/lib/ai/runtime.ts, src/lib/ai/efficiency.ts,
src/lib/leads/context-prompt.ts, src/utils/gemini.ts, src/utils/gemini-prompt-builder.ts.

Report on:
1. Prompt injection risk: trace exactly what scraped/imported lead data (company description,
   website content, raw_data fields) ends up inside the Gemini prompt unescaped. Assess
   whether a malicious lead (e.g. a fake company with a website containing adversarial text
   like "ignore previous instructions and...") could manipulate the AI's output in a way that
   ends up in a real outbound email to a real prospect.
2. Whether daily/monthly AI usage budget checks (in analyze-lead and bulk-analyze) are
   enforced atomically, or whether concurrent requests (e.g. two bulk-analyze calls
   overlapping) could both pass the budget check before either increments usage, allowing
   the user to exceed their budget.
3. What happens to a lead's ai_status and processing_error fields when the Gemini call
   errors, times out, or returns output that fails JSON parsing — confirm the lead doesn't
   get stuck in a permanent "processing" state.
4. Whether the model-selection logic (flash-lite vs flash vs other models) in efficiency.ts
   actually behaves as intended, and whether there's any path where a more expensive model
   gets selected when a cheaper one should have been used.
5. What happens when a user's stored Gemini API key is invalid, revoked, or rate-limited by
   Google — is the error surfaced clearly to the user, or does it look like a generic
   server error?
6. Map out the relationship between /api/leads/personalize, /api/leads/[id]/personalize, and
   /api/ai/analyze-lead — confirm whether these are intentionally separate concerns or
   redundant/overlapping implementations that have drifted from each other.

Output a numbered findings list with file:line references and severity ratings.
```

---

## 8. Lead Enrichment (Firecrawl Multi-Agent)

**Files:** `src/app/api/enrich/route.ts`, `src/lib/enrichment/firecrawl.ts`, `src/lib/enrichment/pipeline.ts`, migration `20260612194000_add_lead_enrichment_columns.sql`

**Checklist:**

- [ ] Multi-phase pipeline (Discovery → Profile → Financial → Tech Stack → Synthesis) — does a failure in one phase abort the whole enrichment, or does it degrade gracefully and save partial results?
- [ ] Cost/rate limiting on Firecrawl calls — is there a per-user or per-lead cap?
- [ ] Data quality — does synthesized data ever overwrite user-entered manual data without confirmation?

**Audit prompt:**

```
Audit the lead enrichment feature (Firecrawl-based multi-agent pipeline: Discovery, Profile,
Financial, Tech Stack, Synthesis). Do NOT modify code — report only.

Read: src/app/api/enrich/route.ts, src/lib/enrichment/firecrawl.ts,
src/lib/enrichment/pipeline.ts, and the migration
20260612194000_add_lead_enrichment_columns.sql.

Report on:
1. Whether a failure partway through the multi-phase pipeline (e.g. Financial phase errors)
   aborts the entire enrichment and discards earlier successful phases, or whether partial
   results are saved.
2. Whether there's any rate limiting or per-user/per-day cap on Firecrawl API usage — Firecrawl
   calls cost money per request; confirm whether a user (or a bug causing a retry loop) could
   trigger unbounded Firecrawl spend.
3. Whether enrichment ever overwrites fields the user has manually edited (e.g. a manually
   corrected industry or employee count) without warning, or whether it only fills empty
   fields.
4. How the Synthesis phase (Gemini structuring raw scraped data) handles malformed or
   nonsensical scraped content — does a bad scrape produce visibly bad data, or could it
   silently produce plausible-looking but wrong data with no way for the user to tell?
5. Whether the enrichment timeout (websites can be slow) is configured appropriately relative
   to the Vercel function timeout, and what the user sees if it times out.

Output a numbered findings list with file:line references and severity ratings.
```

---

## 9. Admin Scraper & Global Lead Pool

**Files:** `src/app/admin/scraper/`, `src/app/api/admin/scrape/route.ts`, `src/app/api/admin/leads/route.ts`, `src/app/leads/discover/`, `src/app/api/leads/pull/route.ts`, `src/app/api/leads/claim/route.ts`, `src/app/discover/page.tsx`, migrations `create_admin_leads_pool.sql`, `create_scraping_queue.sql`

**Checklist:**

- [ ] Is `requireAdmin()` consistently applied to every admin scraper route?
- [ ] Global pool leads pulled into a user's personal library — can the same global lead be claimed by multiple users, and is that intended (shared lead) or a bug (should be exclusive)?
- [ ] The commented-out subscription/plan check in `leads/claim/route.ts` — confirm current behavior matches intent.
- [ ] Scraping queue — stuck/failed jobs: is there a retry mechanism or do they sit forever?

**Audit prompt:**

```
Audit the admin scraper and global lead pool feature. Do NOT modify code — report only.

Read: src/app/admin/scraper/* (all files), src/app/api/admin/scrape/route.ts,
src/app/api/admin/leads/route.ts, src/app/leads/discover/*, src/app/api/leads/pull/route.ts,
src/app/api/leads/claim/route.ts, src/app/discover/page.tsx, and the migrations
20260612175000_create_admin_leads_pool.sql, 20260612200100_create_scraping_queue.sql.

Report on:
1. Confirm every route under src/app/api/admin/ that touches the scraper or lead pool uses
   requireAdmin() (or equivalent) — list any that don't.
2. Whether a lead in admin_leads_pool, once claimed/pulled by one user into their personal
   library, becomes unavailable to other users, or whether multiple users can independently
   claim the same global lead — state which behavior the code actually implements and whether
   that looks intentional given the surrounding UI/copy.
3. The exact current behavior of src/app/api/leads/claim/route.ts regarding subscription/plan
   checks — there's a comment in this file suggesting tier enforcement was intentionally
   left out; confirm there's no other enforcement happening elsewhere that I'm missing.
4. What happens to a scraping_queue job that fails or hangs (e.g. Firecrawl errors, Gemini
   errors during extraction) — is there a retry policy, a max-attempts cutoff, or does it sit
   in a stuck state indefinitely with no visibility for the admin?
5. Whether scraped/extracted data (company name, decision maker, email, website) goes through
   any validation before being inserted into admin_leads_pool — could the scraper insert
   garbage or duplicate entries unchecked?

Output a numbered findings list with file:line references and severity ratings.
```

---

## 10. Email Accounts & Provider Setup (SMTP / Mailgun / Gmail OAuth / Outlook OAuth)

**Files:** `src/app/settings/email-accounts/page.tsx`, `src/app/api/email-accounts/route.ts`, `src/app/api/email-accounts/[id]/route.ts`, `src/app/api/email-accounts/[id]/test/route.ts`, `src/app/api/email-accounts/oauth/[provider]/start/route.ts`, `src/app/api/email-accounts/oauth/[provider]/callback/route.ts`, `src/lib/oauth/google.ts`, `src/lib/oauth/microsoft.ts`, `src/lib/oauth/shared.ts`, `src/lib/oauth/token-manager.ts`, `src/utils/smtp.ts`, `src/utils/mailgun.ts`

**Checklist:**

- [ ] Secret masking — confirm every GET/list endpoint actually masks SMTP passwords, Mailgun API keys, and OAuth tokens before returning JSON (don't just trust the README's claim — verify in code).
- [ ] OAuth state parameter — is CSRF protection (state param validated on callback) actually implemented?
- [ ] Token refresh — race condition if two concurrent sends both try to refresh an expiring token at once?
- [ ] SMTP — self-signed cert support mentioned in README: does it weaken TLS verification in a way that could be exploited, or is it properly scoped to user-opt-in only?
- [ ] Daily limit reset logic — timezone handling for `last_sent_reset_date`.

**Audit prompt:**

```
Audit the email accounts and provider connection feature (SMTP, Mailgun, Gmail OAuth, Outlook
OAuth). Do NOT modify code — report only.

Read: src/app/settings/email-accounts/page.tsx, src/app/api/email-accounts/route.ts,
src/app/api/email-accounts/[id]/route.ts, src/app/api/email-accounts/[id]/test/route.ts,
src/app/api/email-accounts/oauth/[provider]/start/route.ts,
src/app/api/email-accounts/oauth/[provider]/callback/route.ts, src/lib/oauth/google.ts,
src/lib/oauth/microsoft.ts, src/lib/oauth/shared.ts, src/lib/oauth/token-manager.ts,
src/utils/smtp.ts, src/utils/mailgun.ts.

Report on:
1. Verify, by reading the actual GET/list handler code (not just trusting README claims),
   that SMTP passwords, Mailgun API keys, OAuth access/refresh tokens, and webhook signing
   keys are genuinely masked or omitted before any JSON response reaches the frontend. List
   the exact masking logic you find, or flag if any field is returned unmasked.
2. Whether the OAuth `start` route generates a CSRF state parameter and whether the `callback`
   route actually validates it against what was issued, or whether the OAuth flow is
   vulnerable to a CSRF/session-fixation style attack.
3. In src/lib/oauth/token-manager.ts: whether concurrent requests that both need to refresh
   the same near-expired token could both fire a refresh call (wasting a refresh token
   rotation, or worse, racing on which one updates email_accounts.config last).
4. Whether the "self-signed/private certificate" SMTP support mentioned in the README
   disables TLS certificate verification (e.g. rejectUnauthorized: false), and if so, whether
   that's scoped strictly to an explicit per-account opt-in or could be a blanket weakening.
5. How daily_sent_count and last_sent_reset_date are reset — confirm the reset logic handles
   timezones sensibly (UTC midnight vs. user-local) and doesn't double-reset or skip a reset
   under DST or timezone edge cases.
6. What happens when an OAuth account's refresh token is revoked by the user from Google/
   Microsoft's side (outside the app) — does the app detect this and surface a clear
   reconnect prompt, or does sending silently fail repeatedly?

Output a numbered findings list with file:line references and severity ratings.
```

---

## 11. Manual Email Workflow (Draft / Approve / Send)

**Files:** `src/app/api/leads/[id]/manual-send/route.ts`, relevant section of `src/components/leads/LeadWorkspace.tsx`, `src/lib/email/check-email-quality.ts`, `src/lib/email/signature.ts`, `src/lib/email/html.ts`

**Checklist:**

- [ ] Confirm every guard listed in the README (suppression, bounced, unsubscribed, do_not_contact, excluded) is actually checked in this exact route, in the right order, and fails closed.
- [ ] Email quality checker — is it actually blocking, or just a warning the user can dismiss and send anyway?
- [ ] Signature injection — duplicate-signature avoidance logic: how robust is the duplicate detection?
- [ ] Send Test — does a test send accidentally update lead status/tracking the same way a real send would (it shouldn't)?

**Audit prompt:**

```
Audit the manual email workflow (draft, approve, send, send-test) for a single lead. Do NOT
modify code — report only.

Read: src/app/api/leads/[id]/manual-send/route.ts, src/components/leads/LeadWorkspace.tsx
(the Manual Email tab and editor logic), src/lib/email/check-email-quality.ts,
src/lib/email/signature.ts, src/lib/email/html.ts.

Report on:
1. Trace the exact order of guard checks in manual-send/route.ts (suppression list check,
   bounced/unsubscribed/do_not_contact/excluded status check, email validity check). Confirm
   every guard fails CLOSED (blocks the send) on error, rather than failing open (allowing
   the send) if a check itself errors out (e.g. a DB error during the suppression lookup).
2. Whether check-email-quality.ts warnings (missing unsubscribe link, unreplaced template
   variables, missing CTA, body too long) are actually enforced as blocking errors before
   send, or whether they're advisory-only and a user can click through and send anyway —
   state which, since this affects compliance risk (e.g. missing unsubscribe link).
3. Whether "Send Test" goes through a genuinely separate code path that skips: incrementing
   emails_sent_count, updating lead status, creating a sent_emails row used for follow-up
   sequencing, and instrumenting tracking pixels/links. Confirm a test send can't accidentally
   advance a lead's follow-up state.
4. How signature duplicate-avoidance works (src/lib/email/signature.ts) — what happens if a
   user pastes an email that already contains a signature-like block but with slightly
   different formatting than their saved signature (could result in duplicate signatures, or
   over-aggressive duplicate detection stripping content that wasn't actually a signature).
5. Whether the "unsubscribe link added if missing" logic could ever produce a broken or
   unstyled unsubscribe link, and whether it's added to both HTML and plain-text versions of
   the email.

Output a numbered findings list with file:line references and severity ratings.
```

---

## 12. Campaigns (Creation, Sequences, Conditional Steps, Status)

**Files:** `src/app/campaigns/page.tsx`, `src/app/campaigns/new/page.tsx`, `src/app/campaigns/[id]/page.tsx`, `src/app/campaigns/[id]/personalization/page.tsx`, `src/app/campaigns/[id]/activity/page.tsx`, `src/app/campaigns/[id]/leads/[leadId]/page.tsx`, `src/app/api/campaigns/[id]/status/route.ts`, `src/app/api/campaigns/[id]/approve-lead/route.ts`, `src/app/api/lead-campaigns/route.ts`

**Checklist:**

- [ ] Conditional sequence logic (always / only-if-not-opened / only-if-opened / only-if-clicked) — confirm step-skip behavior matches the README exactly, including the "click implies open" rule.
- [ ] Campaign status transitions (draft → active → paused → completed) — are invalid transitions possible (e.g. resuming a completed campaign)?
- [ ] Per-lead approval-before-send toggle — does it correctly gate every step, or only step 1?
- [ ] What happens to in-flight leads (already mid-sequence) when a campaign is paused, then resumed days later — do delays recalculate sensibly or could it cause an immediate burst-send?

**Audit prompt:**

```
Audit the Campaigns feature (creation, conditional follow-up sequences, status management).
Do NOT modify code — report only.

Read: src/app/campaigns/page.tsx, src/app/campaigns/new/page.tsx, src/app/campaigns/[id]/page.tsx,
src/app/campaigns/[id]/personalization/page.tsx, src/app/campaigns/[id]/activity/page.tsx,
src/app/campaigns/[id]/leads/[leadId]/page.tsx, src/app/api/campaigns/[id]/status/route.ts,
src/app/api/campaigns/[id]/approve-lead/route.ts, src/app/api/lead-campaigns/route.ts, and
src/lib/cron/send-due-emails.ts for the sequence evaluation logic.

Report on:
1. Trace the conditional sequence evaluation (always-send / only-if-not-opened / only-if-opened
   / only-if-clicked) against opened_at/clicked_at, confirm the "a click implies an open" rule
   is actually applied consistently, and confirm a skipped step correctly advances current_step
   and next_email_at to the following step's schedule rather than stalling the lead.
2. Map every valid and currently-reachable campaign status transition (draft/active/paused/
   completed or whatever the actual status enum is) — flag any transition that looks like it
   shouldn't be allowed but isn't blocked in code (e.g. reactivating a completed campaign,
   or starting a campaign with zero leads or no email account).
3. Whether the per-lead "approval before send" toggle gates every sequence step or only the
   first email — if a user approves step 1 manually but the campaign auto-sends follow-ups,
   confirm whether that's the intended/documented behavior.
4. What happens to leads with a stale next_email_at (e.g. a campaign paused for two weeks then
   resumed) — does the cron sender immediately fire all the now-overdue emails the moment the
   campaign resumes (a burst-send risk), or is there any smoothing/backoff?
5. Whether deleting or archiving a campaign cleans up associated leads' next_email_at /
   current_step state, or leaves them in limbo pointing at a campaign that no longer exists/
   is inactive.

Output a numbered findings list with file:line references and severity ratings.
```

---

## 13. Email Sending Engine (Universal Send, Cron, Queue)

**Files:** `src/lib/mailers/send-email.ts`, `src/lib/mailers/types.ts`, `src/lib/mailers/providers/`, `src/lib/cron/send-due-emails.ts`, `src/lib/queue/queue.ts`, `src/app/api/cron/send-due-emails/route.ts`, `src/app/api/cron/send-emails/route.ts`

**Checklist:**

- [ ] Confirm `sendEmail()` correctly routes to the right provider implementation for all 4 supported providers, with consistent error shape across all of them.
- [ ] Daily send limit enforcement — campaign-level and account-level — confirmed atomic (ties to the race condition already flagged in the performance audit, but verify the _correctness_ impact, not just the perf impact).
- [ ] What happens when two crons overlap (e.g. a slow run still executing when the next scheduled trigger fires)? Is there any locking?
- [ ] Bounced/failed sends — is the failure reason captured and surfaced anywhere a user would see it, or does it disappear into server logs only?

**Audit prompt:**

```
Audit the email-sending engine: the universal sendEmail() router, the provider implementations,
the cron-based queue/sender, and daily limit enforcement. Do NOT modify code — report only.

Read: src/lib/mailers/send-email.ts, src/lib/mailers/types.ts, src/lib/mailers/providers/*
(all provider files), src/lib/cron/send-due-emails.ts, src/lib/queue/queue.ts,
src/app/api/cron/send-due-emails/route.ts, src/app/api/cron/send-emails/route.ts.

Report on:
1. Confirm sendEmail() produces a consistent success/failure result shape across all four
   providers (SMTP, Mailgun, Gmail, Outlook) — list any provider whose error handling differs
   meaningfully from the others (e.g. one throws while others return a typed error object).
2. Whether two overlapping cron executions (e.g. Vercel re-triggers before the previous run
   finished, or send-emails and send-due-emails both run near-simultaneously and could
   process overlapping leads) have any locking/guard against double-claiming the same lead or
   double-sending the same email — this is a correctness question, distinct from the
   already-known performance issue with per-helper service client creation.
3. Whether a provider-level send failure (e.g. SMTP auth failure, Mailgun API error, OAuth
   token expired) results in any user-visible signal — surfaced on the campaign page, the
   lead's timeline, a dashboard alert — or whether it's only visible in server logs that the
   end user can never see.
4. Whether the campaign-level daily limit and the email-account-level daily limit are both
   actually enforced together correctly, or whether one could be bypassed while the other is
   respected (e.g. multiple campaigns sharing one email account each individually under their
   own campaign limit but collectively exceeding the account's daily limit).
5. Whether a permanently failing lead (e.g. an email account that's been disconnected) could
   get retried indefinitely by the cron on every run, consuming send-capacity budget without
   ever succeeding or being flagged for the user to fix.

Output a numbered findings list with file:line references and severity ratings.
```

---

## 14. Open & Click Tracking

**Files:** `src/app/api/track/open/[token]/route.ts`, `src/app/api/track/click/[token]/route.ts`, `src/lib/email/tracking.ts`

**Checklist:**

- [ ] HMAC signature verification on click URLs — confirm it's actually checked, not just generated.
- [ ] Pixel endpoint — does it correctly return a real 1x1 image with the right content-type even on error, so email clients don't show a broken-image icon that looks suspicious?
- [ ] Token collision/guessability — are tracking tokens unguessable (proper randomness/length)?
- [ ] Tracking endpoints' DB writes — could a flood of fake requests to a guessed/leaked token spam-update timestamps in a way that misleads analytics?

**Audit prompt:**

```
Audit the open/click email tracking feature. Do NOT modify code — report only.

Read: src/app/api/track/open/[token]/route.ts, src/app/api/track/click/[token]/route.ts,
src/lib/email/tracking.ts.

Report on:
1. Confirm verifyClickSignature is actually called and its result actually gates the redirect
   (not just computed and ignored) — re-read the click route logic carefully.
2. Confirm how tracking_token values are generated — assess whether they have sufficient
   entropy/length to be unguessable (a guessable token would let an attacker forge fake
   opens/clicks for any sent email, polluting analytics or falsely triggering "only if
   opened" conditional sequence steps).
3. Confirm the open-pixel route always returns a valid 1x1 transparent image with correct
   content-type even when the token is invalid/unknown, so it doesn't render as a broken
   image (which would tip off the recipient that tracking is in use, or look suspicious in
   some email clients).
4. Whether repeated requests to the same tracking token (e.g. an email client prefetching
   links, or a malicious actor hitting a leaked URL repeatedly) could cause any issue beyond
   redundant timestamp writes — e.g. could it incorrectly re-trigger a conditional sequence
   evaluation if that logic isn't idempotent.
5. Whether tracking_token values, once associated with a sent_emails row, could be enumerated
   or guessed in sequence (check whether they're UUIDs/random vs. any predictable pattern
   like an incrementing ID or timestamp-derived value).

Output a numbered findings list with file:line references and severity ratings.
```

---

## 15. Suppression List & Unsubscribe

**Files:** `src/app/suppression-list/page.tsx`, `src/app/api/suppressions/route.ts`, `src/app/api/suppressions/[id]/route.ts`, `src/lib/suppression/check-suppression.ts`, `src/lib/suppressions.ts`, `src/app/unsubscribe/page.tsx`, `src/app/unsubscribe/UnsubscribeClient.tsx`, `src/app/unsubscribe/actions.ts`

**Checklist:**

- [ ] Unsubscribe link — does it work without requiring login (it must, per CAN-SPAM/GDPR practice)?
- [ ] Unsubscribe token — signed/unguessable, or could someone unsubscribe an email they don't own by guessing a URL pattern?
- [ ] Does unsubscribing actually stop _all_ future campaigns for that email, or only the specific campaign the email was sent from?
- [ ] Manual suppression-list entry by the user — domain-level suppression: confirm it actually blocks subdomains/variations correctly or only exact matches.

**Audit prompt:**

```
Audit the suppression list and unsubscribe feature end to end. Do NOT modify code —
report only.

Read: src/app/suppression-list/page.tsx, src/app/api/suppressions/route.ts,
src/app/api/suppressions/[id]/route.ts, src/lib/suppression/check-suppression.ts,
src/lib/suppressions.ts, src/app/unsubscribe/page.tsx, src/app/unsubscribe/UnsubscribeClient.tsx,
src/app/unsubscribe/actions.ts.

Report on:
1. Confirm the unsubscribe flow works without requiring the recipient to log in (this is a
   legal/compliance requirement, not just UX) and confirm middleware.ts genuinely excludes
   /unsubscribe from auth requirements as intended.
2. How the unsubscribe link identifies which lead/email to unsubscribe — confirm it can't be
   abused to unsubscribe an arbitrary email address the requester doesn't own/control by
   manipulating the URL (e.g. is there a signed token, or just a raw lead ID / email in the
   query string?).
3. Confirm that unsubscribing stops ALL future sends to that email across every campaign and
   every manual-send path for that user, not just the one campaign the unsubscribe link came
   from — trace the resolve_lead_owner logic the README mentions
   (src/lib/leads/resolve-lead-owner.ts) to confirm this.
4. For domain-level suppression entries, confirm the matching logic (exact domain match vs.
   subdomain handling) — e.g. does suppressing "example.com" also block "mail.example.com"
   or "Example.com" with different casing?
5. Whether there's any way for a suppressed lead to be re-added and re-contacted accidentally
   (e.g. re-importing the same email in a new CSV) — does suppression checking happen at
   import time too, or only at send time?

Output a numbered findings list with file:line references and severity ratings.
```

---

## 16. Inbound Reply Handling & Unified Inbox

**Files:** `src/app/api/webhooks/inbound/route.ts`, `src/app/api/webhooks/mailgun/route.ts`, `src/app/api/cron/check-replies/route.ts`, `src/app/inbox/page.tsx`, `src/app/api/inbox/route.ts`, `src/app/api/inbox/[id]/route.ts`, `src/app/api/inbox/[id]/reply/route.ts`, `src/app/api/inbox/[id]/draft/route.ts`, `src/app/api/settings/test-imap/route.ts`

**Checklist:**

- [ ] Reply detection — IMAP polling vs. Mailgun webhook: do both paths produce consistent lead-status updates, or could one path mark "replied" and the other miss it?
- [ ] Threading — are replies correctly matched to the right lead/sent_email even with subject-line variations (Re:, Fwd:, forwarded threads)?
- [ ] IMAP credentials storage — same masking standard as SMTP/email account secrets?
- [ ] Auto-draft reply feature — does it ever auto-send, or always require explicit user approval before sending?

**Audit prompt:**

```
Audit inbound reply detection and the unified inbox feature, covering both the IMAP polling
path and the Mailgun inbound webhook path. Do NOT modify code — report only.

Read: src/app/api/webhooks/inbound/route.ts, src/app/api/webhooks/mailgun/route.ts,
src/app/api/cron/check-replies/route.ts, src/app/inbox/page.tsx, src/app/api/inbox/route.ts,
src/app/api/inbox/[id]/route.ts, src/app/api/inbox/[id]/reply/route.ts,
src/app/api/inbox/[id]/draft/route.ts, src/app/api/settings/test-imap/route.ts.

Report on:
1. Whether the IMAP-polling reply detection (check-replies) and the webhook-based reply
   detection (webhooks/inbound, webhooks/mailgun) apply the SAME logic for updating lead
   status, reply_status, clearing next_email_at/next_follow_up_at, and creating the
   reply_received audit log — list any divergence between the two paths.
2. How replies are matched to the correct lead/sent_emails row — confirm the matching
   strategy (In-Reply-To/References headers vs. subject-line matching vs. sender-email
   matching) and identify scenarios where a reply could be matched to the wrong lead or fail
   to match at all (e.g. recipient replies from a different email address than the one
   contacted, or strips/changes the subject line).
3. Confirm IMAP credentials (host, username, password) stored for inbound polling go through
   the same masking-before-frontend-response treatment as SMTP/email account secrets
   elsewhere in the codebase — check src/app/api/settings/test-imap/route.ts specifically.
4. Whether the "draft" feature in inbox/[id]/draft/route.ts ever auto-sends a generated reply
   without explicit user action, or whether it strictly produces a draft requiring the user to
   review and click send.
5. What happens if check-replies (IMAP) and the Mailgun webhook BOTH detect the same reply
   (e.g. a Mailgun-routed domain that's also IMAP-polled) — could the same reply get processed
   twice, double-logging audit events or sending duplicate auto-drafts?

Output a numbered findings list with file:line references and severity ratings.
```

---

## 17. Audit Logs & Activity Timeline

**Files:** `src/lib/audit/create-audit-log.ts`, `src/app/activity/page.tsx`, all `createAuditLog()` call sites across the codebase

**Checklist:**

- [ ] Completeness — does every meaningful state change actually get logged, or are there silent gaps?
- [ ] Are audit logs ever exposed to the wrong user (cross-tenant leak) via the activity page?
- [ ] Is there any unbounded growth concern (no retention policy) — same table is also flagged in the performance audit for query load.

**Audit prompt:**

```
Audit the audit-logging and activity-timeline feature for completeness and correctness
(not performance — performance issues with this table are already documented separately).
Do NOT modify code — report only.

First, grep the entire codebase for every call site of createAuditLog() to build a complete
inventory of which actions are actually logged. Then read src/lib/audit/create-audit-log.ts
and src/app/activity/page.tsx.

Report on:
1. The complete list of action types actually logged (from your grep), compared against the
   action list documented in the README ("Audit Logs" section: lead_imported, ai_generated,
   email_approved, email_sent, reply_received, campaign_paused, campaign_started,
   campaign_completed, lead_unsubscribed, email_bounced, email_account_created,
   email_account_tested). List any documented action that's never actually logged anywhere
   in the code, and any action that IS logged but isn't in the documented list.
2. Whether there are meaningful state changes that arguably SHOULD be audit-logged but aren't
   — e.g. lead deletion, email account deletion, campaign deletion, manual lead edits,
   bulk action execution.
3. Whether src/app/activity/page.tsx (and the underlying query) correctly scopes audit logs
   to only the requesting user's own data — confirm there's no way to see another user's
   activity feed.
4. Whether failed actions (e.g. a blocked send due to suppression, a failed AI call) are
   logged with enough detail to actually be useful for debugging, or whether the message/
   metadata fields are often empty/generic.

Output a numbered findings list with file:line references and severity ratings.
```

---

## 18. Dashboard ("Needs Action")

**Files:** `src/app/dashboard/page.tsx`

**Checklist:**

- [ ] Are the "needs action" counts (follow-ups due, replies pending, etc.) computed efficiently and correctly — any chance of stale/wrong counts?
- [ ] Does the dashboard reflect real-time state, or could it show counts that don't match what the user finds when they click through?

**Audit prompt:**

```
Audit the Dashboard / "Needs Action" feature. Do NOT modify code — report only.

Read: src/app/dashboard/page.tsx in full, and trace every data-fetching call it makes back to
its API route or direct Supabase query.

Report on:
1. For each "needs action" metric shown (follow-ups due, replies pending, leads ready to
   send, etc.), confirm the underlying query logic matches what a user would expect — flag
   any metric whose filter criteria look subtly wrong (e.g. "follow-ups due" that doesn't
   exclude already-replied or already-unsubscribed leads).
2. Whether clicking through from a dashboard count to the filtered list view actually shows
   the same number of items the dashboard claimed — i.e. whether the dashboard count and the
   list view use the same filter logic or two independently-maintained implementations that
   could drift apart.
3. Whether the dashboard makes an excessive number of separate queries that could be
   consolidated (note: this overlaps with the existing performance audit — only flag NEW
   findings not already covered by PERFORMANCE_AUDIT.md's AI usage query consolidation
   section).
4. Whether dashboard data is cached/stale in any way that could mislead a user mid-session
   (e.g. they handle a follow-up but the dashboard count doesn't decrement until a full
   page reload).

Output a numbered findings list with file:line references and severity ratings.
```

---

## 19. Templates

**Files:** `src/app/templates/page.tsx`, `src/app/templates/new/page.tsx`, `src/app/templates/[id]/page.tsx`, `src/app/api/templates/route.ts`, `src/app/api/templates/[id]/route.ts`, `src/app/api/templates/[id]/duplicate/route.ts`, `src/lib/templates/template-helpers.ts`

**Checklist:**

- [ ] Variable substitution — what happens with an unreplaced `{{variable}}` left in a sent email (overlaps with check-email-quality.ts — confirm the two are actually connected)?
- [ ] Duplicate endpoint — does it correctly copy all fields, or silently drop something (e.g. associated offer/tags)?
- [ ] Template ownership — can a user access/edit another user's template by ID?

**Audit prompt:**

```
Audit the Templates feature. Do NOT modify code — report only.

Read: src/app/templates/page.tsx, src/app/templates/new/page.tsx, src/app/templates/[id]/page.tsx,
src/app/api/templates/route.ts, src/app/api/templates/[id]/route.ts,
src/app/api/templates/[id]/duplicate/route.ts, src/lib/templates/template-helpers.ts.

Report on:
1. Confirm GET/PATCH/DELETE on /api/templates/[id] verify the template belongs to the
   requesting user before acting on it (authorization check on the ID, not just trusting RLS
   — read the actual query).
2. Confirm the variable-substitution logic in template-helpers.ts and how it connects (or
   doesn't) to check-email-quality.ts's "no unreplaced variables" check — trace whether a
   template with a typo'd variable name (e.g. {{frist_name}}) would actually get caught
   before send, or silently sent with the literal placeholder text intact.
3. Confirm the duplicate endpoint copies every relevant field (subject, body, associated
   offer, tags, variables) and doesn't silently drop something an exact copy should include.
4. Whether template usage stats (referenced in the README's "best used template" workspace
   analytics) are tracked accurately, or whether that metric could be stale/wrong.

Output a numbered findings list with file:line references and severity ratings.
```

---

## 20. Saved Views

**Files:** `src/app/api/saved-views/route.ts` (and any frontend integration inside `src/app/leads/page.tsx`)

**Checklist:**

- [ ] Are saved views correctly scoped to the user (no cross-user leakage)?
- [ ] What happens if a saved view references a filter value that no longer exists (e.g. a deleted lead list or tag)?

**Audit prompt:**

```
Audit the Saved Views feature for the Lead Library. Do NOT modify code — report only.

Read: src/app/api/saved-views/route.ts, and find/read every place src/app/leads/page.tsx
integrates with saved views (loading, applying, saving a new one).

Report on:
1. Confirm saved views are correctly scoped per-user (no way to read or apply another user's
   saved view).
2. What happens when a saved view's stored filter criteria reference something that no longer
   exists (a deleted lead list ID, a tag nobody uses anymore, a leadListId that's since been
   removed) — does applying it error, silently show zero results with no explanation, or
   degrade gracefully?
3. Whether there's any limit on the number of saved views a user can create, and whether the
   UI for managing/deleting them is complete (vs. only creation being implemented).

Output a numbered findings list with file:line references and severity ratings.
```

---

## 21. Settings & Profile (incl. AI Usage)

**Files:** `src/app/settings/page.tsx`, `src/app/settings/ai-usage/page.tsx`, `src/app/api/settings/test-email/route.ts`

**Checklist:**

- [ ] Profile field validation (phone, timezone, avatar URL) — any unvalidated input that could break rendering elsewhere?
- [ ] AI usage page — confirm the numbers shown match what's actually enforced server-side (ties to the AI budget audit above — cross-check here for UI-vs-enforcement consistency specifically).
- [ ] Settings save — partial-save risk if one field fails validation, does the whole save fail or silently save other fields only?

**Audit prompt:**

```
Audit the Settings page (profile, workspace settings) and the AI Usage page. Do NOT modify
code — report only.

Read: src/app/settings/page.tsx (full file, it's 903 lines so read it in sections if needed),
src/app/settings/ai-usage/page.tsx, src/app/api/settings/test-email/route.ts.

Report on:
1. Whether profile fields (avatar URL, phone/WhatsApp, timezone, display name, workspace
   name) have any validation before save — specifically whether avatar_url is validated as a
   real URL/image before being used in an <img> tag elsewhere in the app (a malformed or
   malicious value here could affect the Sidebar component too — check
   src/components/Sidebar.tsx for how avatar_url is consumed).
2. Whether the numbers shown on the AI Usage page (daily calls, monthly calls, tokens used)
   are computed via the exact same logic that getAiUsageCounts/getAiCreditSummary use to
   actually enforce the budget in src/lib/ai/runtime.ts, or whether the display logic and the
   enforcement logic could show the user one number while enforcing a different one.
3. Whether the main Settings save action is all-or-nothing (one invalid field blocks the
   entire save) or partial (some fields save even if others fail validation), and whether
   that behavior is communicated clearly to the user via the UI.
4. Whether /api/settings/test-email correctly uses the account's actual configured
   credentials for the test send (not some cached/stale version), and whether it could be
   abused to send arbitrary test emails to arbitrary addresses without rate limiting.

Output a numbered findings list with file:line references and severity ratings.
```

---

## 22. Billing (Stripe)

**Files:** `src/lib/stripe.ts`, `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/portal/route.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/app/settings/billing/page.tsx`, `src/lib/billing/limits.ts`

**Checklist:**

- [ ] Already flagged: `checkSendingLimits` is a stubbed no-op — this audit should produce a complete map of every place plan/subscription status is supposed to matter but currently doesn't.
- [ ] Webhook idempotency — could a replayed/duplicate Stripe webhook event double-process a subscription change?
- [ ] Portal session — confirm it's scoped to the requesting user's own Stripe customer ID only.

**Audit prompt:**

```
Audit the Stripe billing integration completely, with specific focus on the gap between what's
built (checkout/webhook/portal) and what's actually enforced. Do NOT modify code — report only.

Read: src/lib/stripe.ts, src/app/api/stripe/checkout/route.ts, src/app/api/stripe/portal/route.ts,
src/app/api/webhooks/stripe/route.ts, src/app/settings/billing/page.tsx, src/lib/billing/limits.ts,
and grep the whole codebase for every usage of profiles.subscription_status, profiles.plan_id,
and profiles.stripe_customer_id to find every place plan/subscription state is read.

Report on:
1. A complete list of every place in the codebase that reads subscription_status, plan_id, or
   similar billing-tier fields, and for each one, state plainly whether it actually gates any
   behavior or just reads the value without acting on it (this builds directly on the known
   finding that checkSendingLimits() is a stubbed no-op).
2. Whether the Stripe webhook handler is idempotent — if Stripe redelivers the same event
   (which it does on any non-2xx response, and can also occasionally double-deliver), would
   reprocessing customer.subscription.updated twice cause any incorrect state or duplicate
   side effects?
3. Confirm /api/stripe/portal only ever creates a portal session for the requesting user's own
   stripe_customer_id, with no way to pass/influence a different customer ID.
4. Whether checkout success/cancel redirect URLs use NEXT_PUBLIC_BASE_URL while other parts of
   the app use NEXT_PUBLIC_APP_URL (cross-reference with the known env var duplication issue)
   — confirm whether this could cause a broken redirect in any deployment environment where
   only one of the two is set.
5. What currently happens to a user whose subscription is canceled or payment fails (Stripe
   sends customer.subscription.deleted or invoice.payment_failed) — is that event handled at
   all in the webhook switch statement, and if not, does the user's access silently continue
   unaffected indefinitely?

Output a numbered findings list with file:line references and severity ratings.
```

---

## 23. Admin Panel (Users, Stats)

**Files:** `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/users/`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/stats/route.ts`, `src/utils/supabase/admin.ts`

**Checklist:**

- [ ] `requireAdmin()` — read its actual implementation, confirm it can't be bypassed (e.g. trusting a client-supplied header/flag instead of a server-verified DB role).
- [ ] Admin user-promotion (`PATCH /api/admin/users` setting `is_admin`) — can an admin demote themselves and lock everyone out, or promote arbitrary users without any additional confirmation?
- [ ] Admin stats — any query here that could be a performance risk at scale (full table scans)?

**Audit prompt:**

```
Audit the Admin Panel (user management and stats). Do NOT modify code — report only.

Read: src/utils/supabase/admin.ts (the requireAdmin implementation specifically — read it
carefully, this is the security boundary for the entire admin surface), src/app/admin/layout.tsx,
src/app/admin/page.tsx, src/app/admin/users/*, src/app/api/admin/users/route.ts,
src/app/api/admin/stats/route.ts.

Report on:
1. Read requireAdmin() line by line and confirm exactly how it determines admin status —
   state explicitly whether it re-verifies the role against the database on every call
   (correct) or trusts something cacheable/client-influenced (incorrect). This function gates
   every admin route in the app, so be precise here.
2. Whether PATCH /api/admin/users (which sets is_admin) has any safeguard against an admin
   accidentally revoking their own admin status and locking out all admin access, or against
   promoting an arbitrary user ID without any secondary confirmation/audit trail.
3. Whether admin actions (promoting a user, approving/rejecting a scraped lead, etc.) are
   captured in the audit log system, or whether admin activity is entirely untracked.
4. Whether /api/admin/stats runs any unbounded aggregate query (e.g. COUNT(*) across the full
   leads or sent_emails table) that could become slow at scale — flag this only if it's a NEW
   finding not already covered by the existing PERFORMANCE_AUDIT.md.
5. Whether src/app/admin/layout.tsx's access check happens server-side (so a non-admin can't
   even see the admin UI shell flash before redirect) or client-side only (briefly exposing
   admin UI/data before redirecting).

Output a numbered findings list with file:line references and severity ratings.
```

---

## How to use this

1. Run each audit prompt independently (fresh context per feature is fine — they're self-contained).
2. Collect every "Critical" and "High" finding across all 23 into one consolidated list before doing anything else — that becomes your next fix-priority pass, in the same prompt-per-task format as `REACHMIRA_FIX_TASKLIST.md`.
3. Re-run the relevant feature's audit prompt after fixing it, as a regression check, before moving to the next feature.
4. Features 7, 9, 22 (AI pipeline, admin/global pool, billing) are the ones most likely to surface new Critical findings beyond what's already documented — prioritize those three if you can only run a few right now.
