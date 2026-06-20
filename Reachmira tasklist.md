# ReachMira — Fix Tasklist & Prompts

Generated from a full codebase review (security, performance, hygiene). Each task has a ready-to-paste prompt for Claude Code or another coding agent. Work top to bottom — Phase 0 is security and should ship before anything else.

---

## Phase 0 — Security (do first)

### 0.1 Cron endpoints fail open when `CRON_SECRET` is unset ✅ DONE

**Files:** `src/app/api/cron/send-due-emails/route.ts`, `src/app/api/cron/send-emails/route.ts`, `src/app/api/cron/check-replies/route.ts`, `src/app/api/cron/telegram-report/route.ts`

**Problem:** `if (process.env.CRON_SECRET && authHeader !== ...)` skips the check entirely if `CRON_SECRET` isn't set, making the route public and unauthenticated.

**Prompt:**

```
Create a shared helper at src/lib/cron/auth.ts that exports verifyCronAuth(request: Request).
It must fail CLOSED: if process.env.CRON_SECRET is not set, return unauthorized (do not skip
the check). If it is set, require the Authorization header to equal `Bearer ${CRON_SECRET}`.

Then update these four routes to use it instead of their current
`if (process.env.CRON_SECRET && authHeader !== ...)` pattern:
- src/app/api/cron/send-due-emails/route.ts
- src/app/api/cron/send-emails/route.ts
- src/app/api/cron/check-replies/route.ts
- src/app/api/cron/telegram-report/route.ts

Return a 500 with a clear message if CRON_SECRET is missing, and 401 if the header doesn't match.
Do not change any other logic in these files.
```

---

### 0.2 No HTML sanitization on inbound/rendered email content (stored XSS risk) ✅ DONE

**Files:** `src/app/inbox/page.tsx`, `src/components/leads/LeadWorkspace.tsx`, `src/app/settings/email-accounts/page.tsx`

**Problem:** `dangerouslySetInnerHTML` is used in 5 places with no sanitization library anywhere in the codebase. The highest-risk spot is `src/app/inbox/page.tsx`, which renders `body_html` from inbound replies (IMAP + Mailgun webhook) — fully attacker-controlled content. A malicious reply containing `<img onerror=...>` or similar would execute in the user's session.

**Prompt:**

```
Add `isomorphic-dompurify` as a dependency (npm install isomorphic-dompurify) and create
src/lib/email/sanitize-html.ts exporting `sanitizeEmailHtml(html: string): string` that:
- Allows common email-safe formatting tags (p, br, div, span, a, b, strong, i, em, ul, ol, li,
  h1-h6, blockquote, table/thead/tbody/tr/td/th, img, hr, pre, code)
- Strips script, style, iframe, object, embed, form, link, meta, base
- Strips all event handler attributes (onerror, onclick, onload, etc.)
- Strips javascript: and data: URLs from href/src except data:image/*
- Keeps target="_blank" links safe by forcing rel="noopener noreferrer"

Then wrap every dangerouslySetInnerHTML call that renders external or user-supplied HTML with
sanitizeEmailHtml() before passing it in, in these files:
- src/app/inbox/page.tsx (line ~232, inbound reply body_html — HIGHEST PRIORITY)
- src/components/leads/LeadWorkspace.tsx (lines ~1494 and ~1849)
- src/app/settings/email-accounts/page.tsx (lines ~764 and ~856)

Do not change the surrounding layout or styling — only wrap the HTML string passed into
dangerouslySetInnerHTML.
```

---

### 0.3 Billing deferred — comment out UI ✅ DECIDED: Option B

**File:** `src/lib/billing/limits.ts`, `src/app/settings/billing/page.tsx`

**Decision:** Billing enforcement is intentionally deferred. `checkSendingLimits()` stays as a no-op. Stripe UI should be hidden/commented out so users aren't shown plans that grant nothing.

**Prompt:**

```
In src/lib/billing/limits.ts, replace the current vague comment ("Bypassing billing limit
checks per user request") with:
  // TODO: enforce after pricing is finalized — intentionally deferred
Leave the return { allowed: true } in place.

In src/app/settings/billing/page.tsx, comment out or hide the Stripe checkout/upgrade button
and any "Subscribe" / plan selection UI. Replace with a simple "Billing coming soon" message
or label. Do not remove the Stripe webhook handler or backend code — only hide the UI.
Do not change any other logic.
```

---

## Phase 1 — Performance: zero-risk quick wins (already scoped in PERFORMANCE_PLAN.md)

These were already designed in your own `PERFORMANCE_AUDIT.md` / `PERFORMANCE_PLAN.md` but not yet shipped. No behavior change, low/no risk.

### 1.1 Remove unnecessary `.select().single()` from audit logging ✅ DONE

**File:** `src/lib/audit/create-audit-log.ts`

**Prompt:**

```
In src/lib/audit/create-audit-log.ts, change the Supabase insert from
`.insert({...}).select().single()` to just `.insert({...})`. Confirm no caller of
createAuditLog() anywhere in the codebase uses the returned row's data field
(only success/error), then remove the unused destructuring if present.
```

### 1.2 Fix hardcoded production URL ✅ DONE

**File:** `src/lib/cron/send-due-emails.ts` (~line 296)

**Prompt:**

```
In src/lib/cron/send-due-emails.ts, replace the hardcoded fallback
'https://reachmira.vercel.app' with process.env.NEXT_PUBLIC_APP_URL. If
NEXT_PUBLIC_APP_URL is not set, throw a clear startup/runtime error instead of
silently falling back to a hardcoded domain, since wrong unsubscribe URLs are a
compliance risk.
```

### 1.3 Configure `vercel.json` (function timeouts only) ✅ DONE

**File:** `vercel.json`

**Note:** Cron scheduling is managed externally via **cron-job.org** — do NOT add a `"crons"` block to `vercel.json`. Only function timeout (`maxDuration`) settings are needed here.

**Prompt:**

```
Update vercel.json to add only maxDuration settings for long-running functions.
Do NOT add a "crons" block — scheduling is handled externally by cron-job.org.

{
  "version": 2,
  "functions": {
    "src/app/api/ai/analyze-lead/route.ts": { "maxDuration": 30 },
    "src/app/api/ai/bulk-analyze/route.ts": { "maxDuration": 60 },
    "src/app/api/cron/send-emails/route.ts": { "maxDuration": 30 },
    "src/app/api/cron/send-due-emails/route.ts": { "maxDuration": 30 },
    "src/app/api/cron/check-replies/route.ts": { "maxDuration": 60 },
    "src/app/api/inbox/[id]/draft/route.ts": { "maxDuration": 30 }
  }
}

Confirm the Vercel plan supports maxDuration above 10s (Pro or higher) before deploying —
flag this back to me if you can't verify it.
```

### 1.4 Add `optimizePackageImports` to `next.config.ts` ✅ DONE

**File:** `next.config.ts`

**Prompt:**

```
Update next.config.ts to add:
- compiler.removeConsole: true in production
- experimental.optimizePackageImports for ['lucide-react', 'recharts', 'framer-motion']

Keep it minimal and don't touch any other Next.js config.
```

### 1.5 Pre-fetch suppressions in bulk rather than per-lead ✅ DONE

**File:** `src/lib/cron/send-due-emails.ts`

**Prompt:**

```
In src/lib/cron/send-due-emails.ts, the per-lead call to checkSuppression(campaign.user_id,
lead.email) inside the lead loop (~line 434) makes 2 DB round-trips per lead. Before the loop,
fetch all suppressions for campaign.user_id once via a single Supabase query, build in-memory
Map<string, SuppressionMatch> for exact email matches and for domains, and replace the per-lead
checkSuppression() call with a synchronous Map lookup (email exact match, then domain match
via email.split('@')[1]). Preserve the existing return shape so the rest of the function doesn't
need to change.
```

---

## Phase 2 — Performance: schema changes (medium risk, test before deploy)

### 2.1 Add missing composite indexes

**File:** `schema.sql` + new migration

**Prompt:**

```
Create a new Supabase migration file in supabase/migrations/ (timestamp it after the latest
existing migration) that adds these composite indexes using CREATE INDEX CONCURRENTLY:

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

Note CONCURRENTLY cannot run inside a transaction block — make sure the migration runner
doesn't wrap it in one (Supabase migrations usually need `-- supabase: no-transaction` handling
or splitting into its own migration file).
```

### 2.2 Atomic daily-sent-count increment

**File:** `src/lib/queue/queue.ts` + new migration

**Prompt:**

```
Create a migration adding this Postgres function:

CREATE OR REPLACE FUNCTION increment_email_account_sent_count(p_account_id UUID, p_increment INT DEFAULT 1)
RETURNS void AS $$
  UPDATE email_accounts SET daily_sent_count = daily_sent_count + p_increment, updated_at = NOW()
  WHERE id = p_account_id;
$$ LANGUAGE sql SECURITY DEFINER;

Then update incrementDailySentCount in src/lib/queue/queue.ts to call
supabase.rpc('increment_email_account_sent_count', { p_account_id: accountId, p_increment: count })
instead of the current read-then-write pattern, eliminating the race condition.
```

### 2.3 Consolidate AI usage queries into one RPC

**File:** `src/lib/ai/runtime.ts` + new migration

**Prompt:**

```
Create a migration adding a get_ai_usage_summary(p_user_id UUID, p_daily_from TIMESTAMPTZ,
p_monthly_from TIMESTAMPTZ) Postgres function returning a JSON object with daily_calls,
monthly_calls, flash_lite_today, flash25_today, tokens_today, monthly_tokens, cache_hits,
and skipped — all derived from a single SELECT with FILTER (WHERE ...) clauses against
ai_usage_logs, scoped to p_user_id and p_monthly_from.

Then refactor getAiUsageCounts and getAiCreditSummary in src/lib/ai/runtime.ts to call this
RPC once instead of their current combined ~13 parallel Supabase queries, mapping the JSON
result back into the existing return shape so calling code doesn't need to change.
```

### 2.4 Add pagination to `GET /api/leads`

**File:** `src/app/api/leads/route.ts` + frontend caller(s)

**Prompt:**

```
Refactor src/app/api/leads/route.ts to:
1. Accept `page` and `limit` query params (default limit 50, max 200).
2. Push the `search` filter into the DB query using .ilike() across email, first_name,
   last_name, company_name, company, website, industry, city, country, tags instead of
   filtering in JavaScript after fetching everything.
3. Apply .range(offset, offset + limit - 1) for pagination.
4. Return { leads, total, page, limit } instead of a bare array.
5. Reduce the sent_emails sub-query to only the columns actually used by the UI
   (id, lead_id, email_type, sent_at, status, replied_at, bounced_at) instead of SELECT *.

Then find every frontend caller of GET /api/leads (search the codebase for fetch calls to
/api/leads) and update them to handle the new paginated response shape and pass page/limit,
adding pagination controls to the leads list UI if none exist yet. Show me the list of callers
you find before changing the UI, in case any need a different pagination UX.
```

### 2.5 Parallelize bulk AI analysis

**File:** `src/app/api/ai/bulk-analyze/route.ts`, `src/app/api/ai/analyze-lead/route.ts`

**Prompt:**

```
Extract the core lead-analysis logic currently inside src/app/api/ai/analyze-lead/route.ts
into a new shared module src/lib/ai/analyze-lead.ts (a plain async function, not an HTTP
handler). Update src/app/api/ai/analyze-lead/route.ts to be a thin wrapper that calls it.
Update src/app/api/ai/bulk-analyze/route.ts to fetch shared context (campaign, profile,
budget) once, then call the extracted function via Promise.all() across the batch of leads
instead of making sequential self-referencing HTTP calls to /api/ai/analyze-lead. Preserve
existing budget-check behavior — don't let parallelization bypass the daily/monthly AI usage
limits.
```

---

## Phase 3 — Performance: low-risk caching

### 3.1 Cache AI settings per user (5-min TTL) ✅ DONE

**Prompt:**

```
In src/lib/ai/runtime.ts, wrap getAiSettingsForUser with a module-level
Map<userId, { settings, expiresAt }> cache with a 5-minute TTL, falling back to a fresh
DB query on cache miss or expiry.
```

### 3.2 Cache AI budget status (30-sec TTL) ✅ DONE

**Prompt:**

```
In src/app/api/ai/analyze-lead/route.ts, cache the daily/monthly usage count result
(currently 3 parallel queries) with a 30-second TTL keyed by `${userId}:${date}`, using
a simple module-level Map. This is acceptable staleness for a rate-limit check and
significantly reduces load during bulk operations.
```

### 3.3 Lazy-load `AnalyticsCharts` with `next/dynamic` ✅ DONE

**Prompt:**

```
Find the parent page that renders src/components/reachmira/AnalyticsCharts.tsx and switch
the import to next/dynamic with ssr: false and a lightweight skeleton loading state, so
recharts (~300KB) isn't in the initial bundle for users who don't immediately view analytics.
```

---

## Phase 4 — Structural refactors (do after Phases 0–3 are stable)

### 4.1 Thread one Supabase service client through the cron call chain

**Prompt:**

```
Refactor src/lib/cron/send-due-emails.ts, src/lib/queue/queue.ts,
src/lib/suppression/check-suppression.ts, and src/lib/audit/create-audit-log.ts so that
every helper function accepts an optional `supabase` client parameter instead of calling
createServiceClient() internally. Create one client at the top of the cron entry point
(sendDueEmails) and pass it through the whole call chain, defaulting to a fresh
createServiceClient() only when no client is passed (so other callers don't break).
```

### 4.2 Atomic lead claiming

**Prompt:**

```
Replace the SELECT → UPDATE → SELECT lead-claiming pattern in src/lib/queue/queue.ts with a
single Postgres RPC using `FOR UPDATE SKIP LOCKED` to eliminate the TOCTOU race condition
where two concurrent cron runs could claim the same lead. Write the migration and update the
TypeScript caller to use .rpc().
```

### 4.3 Bulk tag updates as a single query

**Prompt:**

```
In src/app/api/leads/bulk/route.ts, find the add_tag bulk action and replace the per-lead
individual UPDATE loop with a single Postgres UPDATE using an array of lead IDs (or a
Supabase .in('id', leadIds) update), reducing N queries to 1-2.
```

---

## Phase 5 — Maintenance & hygiene

### 5.1 Regenerate `schema.sql` from current migrations

**Problem:** `schema.sql` is missing `admin_leads_pool` and `scraping_queue`, both added by later migrations and actively used by the admin scraper and `/leads/discover` flow. Anyone bootstrapping a fresh environment from `schema.sql` alone gets a broken app.

**Prompt:**

```
Generate an up-to-date schema.sql by applying every migration in supabase/migrations/ in
order against a clean database (or via `supabase db dump` if you have the Supabase CLI
connected), then replace the current root schema.sql with the result. Confirm the new file
includes admin_leads_pool and admin_scraping_queue tables, which are missing from the
current schema.sql. Do not delete or modify the migrations themselves — schema.sql is a
convenience snapshot, the migrations remain the source of truth.
```

### 5.2 Delete the 0-byte empty migration ✅ DONE

**Prompt:**

```
supabase/migrations/20260608082741_init_schema.sql is a 0-byte file. Confirm it's not
referenced anywhere (it shouldn't be — Supabase migrations apply by filename existing, not
by content), then delete it.
```

### 5.3 Move `test-scrape.ts` to `src/scripts/` ✅ DONE

**Prompt:**

```
test-scrape.ts at the project root is an ad-hoc manual test script for Firecrawl, not part
of any test suite. Either delete it or move it into a /scripts directory and add /scripts to
.gitignore if it's meant to stay local-only and not ship in the deployed app.
```

### 5.4 Add `.env.example` ✅ DONE

**Prompt:**

```
Create a .env.example at the project root documenting every environment variable actually
referenced in the codebase (grep for process.env. across src/ to get the full list — it
currently includes at minimum: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, TRACKING_SECRET, NEXT_PUBLIC_APP_URL,
GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, MICROSOFT_OAUTH_CLIENT_ID,
MICROSOFT_OAUTH_CLIENT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FIRECRAWL_API_KEY).
Use placeholder values, not real secrets. Group them by category (Supabase, Auth/OAuth,
Email sending, AI, Billing, Tracking/Cron) with a one-line comment per variable explaining
what it's for and where to get it.
```

### 5.5 Resolve duplicate base-URL env vars

**Prompt:**

```
The codebase uses both NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_BASE_URL for what appears to be
the same purpose (building absolute URLs for redirects/links). Search every usage of both
across src/, confirm they're redundant, standardize on NEXT_PUBLIC_APP_URL everywhere, and
remove NEXT_PUBLIC_BASE_URL. Show me the list of files you change before committing, since
this touches Stripe redirect URLs and could affect checkout flow if done incorrectly.
```

### 5.6 Add error monitoring

**Prompt:**

```
Add Sentry (@sentry/nextjs) to the project: run the Sentry Next.js wizard or manually add
sentry.client.config.ts, sentry.server.config.ts, and sentry.edge.config.ts, wire
SENTRY_DSN into environment variables, and confirm errors thrown in API routes (especially
src/lib/cron/send-due-emails.ts and the AI analyze routes) are captured. Don't change any
existing error-handling logic — just add capture alongside the existing console.error calls.
```

### 5.7 Add a basic test suite + typecheck script

**Prompt:**

```
Add Vitest to the project (npm install -D vitest @vitejs/plugin-react) and a vitest.config.ts.
Add a "test" script and a "typecheck": "tsc --noEmit" script to package.json. Write initial
unit tests for the highest-value pure-logic modules first: src/lib/email-verification/local-verify.ts,
src/lib/suppression/check-suppression.ts, and src/lib/leads/status.ts (follow-up stage
calculation). Don't attempt full route/integration test coverage yet — just establish the
test infrastructure and cover the modules with the clearest input/output contracts.
```

---

## Phase 6 — Code quality / componentization (lower urgency, do incrementally)

### 6.1 Break up `LeadWorkspace.tsx` (1,863 lines)

**Prompt:**

```
src/components/leads/LeadWorkspace.tsx is 1,863 lines and handles lead overview, AI
intelligence, manual email composition, email history, timeline, and raw data in one
component. Without changing any behavior, extract each tab's content into its own component
file under src/components/leads/ (e.g. LeadOverviewTab.tsx, LeadIntelligenceTab.tsx,
ManualEmailTab.tsx, EmailHistoryTab.tsx, LeadTimelineTab.tsx, RawDataTab.tsx), keeping
LeadWorkspace.tsx as the orchestrating shell that manages shared state and passes props
down. Do this one tab at a time and confirm the app still builds after each extraction.
```

### 6.2 Break up oversized pages

**Prompt:**

```
The following pages are 1,200+ lines and would benefit from the same extraction pattern as
LeadWorkspace.tsx — pull distinct sections into child components without changing behavior:
- src/app/campaigns/[id]/page.tsx (1,655 lines)
- src/app/campaigns/new/page.tsx (1,332 lines)
- src/app/leads/page.tsx (1,220 lines)

Start with src/app/campaigns/[id]/page.tsx since it's the largest. Identify the natural
sections (header/stats, lead table, activity feed, settings panel, etc.) and propose a
component breakdown before making changes.
```

---

## Suggested execution order

1. **Phase 0** (security) — today
2. **Phase 1** (zero-risk perf) — this week, can ship same day as Phase 0
3. **Phase 5.1–5.4** (schema.sql, dangling migration, dev script, `.env.example`) — cheap, do alongside Phase 1
4. **Phase 2** (schema-changing perf) — next, test indexes/RPCs in a staging Supabase project first
5. **Phase 3** (caching) — opportunistic, low risk
6. **Phase 4** (structural refactors) — once Phase 0–2 are stable in production
7. **Phase 6** (componentization) — ongoing background work, not blocking
8. **Phase 5.5–5.7** (env var cleanup, monitoring, tests) — important but not urgent; schedule before the next major feature push

---

## Notes

- Every prompt above assumes a Claude Code–style agent with file read/write/run access to this repo.
- Run `npm run lint` and `npm run build` after every task before moving to the next.
- None of the Phase 2+ database changes should be applied directly to production — test against a staging Supabase project first.
- Phase 0.3 (billing) needs your decision before any prompt should be run.
