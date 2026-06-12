# PERFORMANCE AUDIT — The Digital Dude Outreach OS (ReachMira)

**Audited by:** Principal Software Architect  
**Date:** 2026-06-11  
**Codebase:** Next.js 16 / React 19 / Supabase / Vercel  

---

## Executive Summary

This document identifies **18 distinct performance bottlenecks** across database access, API design, background job processing, AI pipeline, caching, frontend, and infrastructure configuration. The most critical issues — sequential suppression lookups inside cron loops, an unbounded `SELECT *` on the leads endpoint, and 8 parallel Supabase queries per AI usage check — together represent the highest-ROI targets.

---

## 1. DATABASE ACCESS PATTERNS

### 🔴 [CRITICAL] `GET /api/leads` — Unbounded `SELECT *` with In-Process Filtering

**File:** `src/app/api/leads/route.ts` (lines 64–113)

**Root Cause:**  
The entire `leads` table (for a given user/list) is loaded into memory via `SELECT *` with no `LIMIT`. All filtering for `search`, `readiness`, `followUpStage`, `replied`, `missing`, `lastEmailType`, `contacted`, `doNotContact`, `bounced`, `unsubscribed` happens **in application code** after the full fetch. The `sent_emails` sub-query fetches *every* sent email for *every* lead returned (line 146–150), again without limit.

**Impact:**
- A user with 10,000 leads triggers 10,000-row fetch + another unbounded `sent_emails` scan
- Response payload can be multiple MBs
- Memory spike on every page load of the leads list
- Cold-start risk on serverless: the function may time out

**Recommended Fix:**
- Move all filters to database query predicates (`.ilike()` calls for search, `.eq()` for status/priority/aiStatus etc. — these already partially exist; search and complex filter logic must be pushed down too)
- Add `LIMIT`/`OFFSET` or cursor-based pagination (e.g., keyset on `last_email_sent_at, id`)
- Replace `sent_emails: SELECT *` sub-query with `SELECT id, lead_id, email_type, sent_at, status, replied_at, bounced_at` only
- Add a `search` full-text index on leads (`email`, `company_name`, `first_name`, `last_name`) using Postgres `tsvector` or a GIN index with `pg_trgm`

**Estimated Gain:** 60–90% reduction in response time and payload size for large datasets.

---

### 🔴 [CRITICAL] `checkSuppression` Called Per-Lead Inside Cron Loop — 2 DB Queries × N Leads

**File:** `src/lib/cron/send-due-emails.ts` (line 343)  
**File:** `src/lib/suppression/check-suppression.ts`

**Root Cause:**  
`checkSuppression()` is called inside the `for (const lead of dueLeads)` loop. Each call makes **2 sequential Supabase round-trips** — one for email match, one for domain match. With 10 leads per batch, this is 20 extra DB queries on the hot path of the email-sending cron.

**Impact:**
- +20 DB round-trips per 10-lead cron run (each ~5–15ms over the network)
- Adds 100–300ms latency to every cron invocation
- Supabase connection pool pressure

**Recommended Fix:**
- Bulk-fetch all suppressions for the user at the start of the campaign loop
- Build an in-memory `Set` of suppressed emails + suppressed domains
- Replace per-lead DB call with O(1) Set lookup

```typescript
// Before the lead loop:
const { data: suppressions } = await supabase.from('suppressions')
  .select('email, domain, reason, id').eq('user_id', campaign.user_id);
const suppressedEmails = new Map(suppressions?.map(s => [s.email, s]));
const suppressedDomains = new Map(suppressions?.map(s => [s.domain, s]));

// Inside the loop:
const suppressionMatch = suppressedEmails.get(lead.email) 
  ?? suppressedDomains.get(lead.email.split('@')[1]);
```

**Estimated Gain:** Eliminates 20 DB round-trips per cron run (~200ms savings per invocation).

---

### 🔴 [CRITICAL] `getAvailableSendCapacity` Creates a Service Client Instance Per Call

**File:** `src/lib/queue/queue.ts` (lines 158–200)

**Root Cause:**  
`createServiceClient()` is called inside `getAvailableSendCapacity()`, `checkSuppression()`, and `incrementDailySentCount()` — all called from the same cron function. Each call to `createServiceClient()` creates a new Supabase client instance, creating a new HTTP connection chain per call.

**Impact:**
- Unnecessary object allocation per DB helper call
- Not sharing a connection pool across calls in the same request
- Multiple round-trips that could be combined

**Recommended Fix:**
- Accept and thread a `supabase` client as a parameter to all queue helper functions instead of creating one internally
- Combine `getCampaignDailySendCount` + `getAvailableSendCapacity` into a single DB call where possible

---

### 🟠 [HIGH] `incrementDailySentCount` — Read-Modify-Write Race Condition

**File:** `src/lib/queue/queue.ts` (lines 205–231)

**Root Cause:**  
The function reads `daily_sent_count`, then writes `daily_sent_count + count`. This is a non-atomic read-modify-write that is vulnerable to a race condition when multiple cron invocations run concurrently (e.g., two Vercel function instances). Two simultaneous sends could both read `count=5`, both write `count=6`, and only count 1 send instead of 2.

**Impact:**
- Data integrity issue: daily send limits may be circumvented under concurrent load
- Potential over-sending of emails

**Recommended Fix:**  
Use a Postgres RPC function or raw SQL with `daily_sent_count = daily_sent_count + $1` (atomic increment). Supabase supports this via `.rpc()` or by using `.update({ daily_sent_count: serviceSupabase.rpc('increment_sent_count', ...) })` pattern:

```sql
-- Create a DB function:
create or replace function increment_email_account_sent_count(account_id uuid, increment_by int)
returns void as $$
  update email_accounts
  set daily_sent_count = daily_sent_count + increment_by,
      updated_at = now()
  where id = account_id;
$$ language sql;
```

**Estimated Gain:** Eliminates race condition; saves 1 DB round-trip per sent email.

---

### 🟠 [HIGH] `getAiUsageCounts` & `getAiCreditSummary` — 8 Parallel Supabase Queries

**File:** `src/lib/ai/runtime.ts` (lines 136–223)

**Root Cause:**  
`getAiUsageCounts` fires **8 parallel queries** against `ai_usage_logs` in a `Promise.all`. `getAiCreditSummary` fires **5 more parallel queries** against the same table. Both functions are separate but serve related purposes. The dashboard calls these on every render.

**Impact:**
- 8–13 concurrent Supabase connections per dashboard page load
- All queries hit `ai_usage_logs` which can grow unbounded
- High Supabase connection pool pressure at scale

**Recommended Fix:**
- Consolidate into a **single aggregated SQL query** using conditional `COUNT` / `SUM` with `CASE` expressions:

```sql
SELECT
  COUNT(*) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= $daily_from) AS daily_calls,
  COUNT(*) FILTER (WHERE skipped = false AND cache_hit = false AND model = 'gemini-3.1-flash-lite' AND created_at >= $daily_from) AS flash_lite_today,
  COUNT(*) FILTER (WHERE skipped = false AND cache_hit = false AND model = 'gemini-2.5-flash' AND created_at >= $daily_from) AS flash25_today,
  SUM(tokens_total) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= $daily_from) AS tokens_today,
  COUNT(*) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= $monthly_from) AS monthly_calls,
  ...
FROM ai_usage_logs WHERE user_id = $user_id AND created_at >= $monthly_from;
```

- Expose as a Postgres RPC: `supabase.rpc('get_ai_usage_summary', { user_id, daily_from, monthly_from })`
- Cache result for 60 seconds (Next.js `revalidate` or in-memory LRU)

**Estimated Gain:** Reduces 8–13 DB round-trips to 1; ~200–500ms page load improvement.

---

### 🟠 [HIGH] `analyze-lead` — 3 Budget Queries Per AI Request on the Hot Path

**File:** `src/app/api/ai/analyze-lead/route.ts` (lines 350–373)

**Root Cause:**  
Every call to `POST /api/ai/analyze-lead` makes **3 parallel count queries** against `ai_usage_logs` (daily, monthly, daily deep) — in addition to the main lead/campaign/profile fetch (already 3 queries). Total: **6 DB round-trips before AI generation begins**.

**Impact:**
- For bulk analysis of 5 leads, this is 30 DB queries just for budget checking
- `ai_usage_logs` is a write-heavy table; counting it per-request is expensive

**Recommended Fix:**
- Cache the budget status in memory or Vercel Edge Config for 30 seconds (acceptable staleness for a rate-limit check)
- Or consolidate into the single RPC above and cache on the middleware layer
- Pass pre-fetched budget data into the analyze function instead of re-querying

---

### 🟠 [HIGH] Missing Composite Indexes for Common Query Patterns

**File:** `schema.sql`

**Root Cause:**  
Several hot query patterns lack composite indexes:

| Table | Query Pattern | Missing Index |
|---|---|---|
| `ai_usage_logs` | `WHERE user_id = X AND created_at >= Y AND skipped = false AND cache_hit = false` | `(user_id, created_at, skipped, cache_hit)` |
| `leads` | `WHERE campaign_id = X AND status NOT IN (...) AND next_email_at <= NOW()` | `(campaign_id, status, next_email_at)` |
| `leads` | `WHERE lead_list_id = X ORDER BY last_email_sent_at ASC` | `(lead_list_id, last_email_sent_at)` |
| `sent_emails` | `WHERE lead_id IN (...) ORDER BY sent_at DESC` | Already has `lead_id` index; add `(lead_id, sent_at DESC)` for sorted access |
| `suppressions` | `WHERE user_id = X AND email = Y` | Already has composite unique, but `domain` column has no index |

**Estimated Gain:** 2–10× speedup on filtered queries as data grows.

---

### 🟡 [MEDIUM] `claimLeadsForAIProcessing` — Triple DB Round-Trip with Race Potential

**File:** `src/lib/queue/queue.ts` (lines 10–62)

**Root Cause:**  
The function: (1) SELECTs pending leads, (2) UPDATEs them to `processing`, (3) SELECTs them again to return fresh data. This is 3 round-trips. Additionally, the SELECT + UPDATE pattern has a TOCTOU (time-of-check-time-of-use) window where two cron invocations could claim the same leads.

**Impact:**
- Leads processed twice under concurrent cron execution
- 3 DB queries where 1 would suffice

**Recommended Fix:**  
Use a PostgreSQL `UPDATE ... RETURNING` to atomically claim leads:

```sql
UPDATE leads SET ai_status = 'processing', processing_started_at = NOW()
WHERE id IN (
  SELECT id FROM leads
  WHERE ai_status = 'pending' OR (ai_status = 'processing' AND processing_started_at < NOW() - INTERVAL '15 minutes')
  ORDER BY created_at ASC LIMIT $limit
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

The `FOR UPDATE SKIP LOCKED` eliminates the race condition entirely.

---

### 🟡 [MEDIUM] `getAiSettingsForUser` — Sequential Fallback Queries

**File:** `src/lib/ai/runtime.ts` (lines 25–64)

**Root Cause:**  
If `ai_settings` row is missing, the function makes a **second sequential query** to `profiles`. These two tables always co-exist; the fallback path adds a serial round-trip on every call for users without explicit AI settings.

**Recommended Fix:**
- Either `LEFT JOIN` the profile data in a single query
- Or ensure an `ai_settings` row is always created via trigger when a profile is created (alongside the existing `handle_new_user` trigger)

---

## 2. APPLICATION LAYER

### 🔴 [CRITICAL] `bulk-analyze` Route — Sequential HTTP Self-Calls Per Lead

**File:** `src/app/api/ai/bulk-analyze/route.ts` (lines 52–76)

**Root Cause:**  
The bulk-analyze route uses a `for` loop to call `fetch('/api/ai/analyze-lead')` **sequentially** for each lead. Each call:
1. Creates a new Supabase client, re-authenticates
2. Fetches campaign, lead, and profile again from DB
3. Makes AI budget queries (3 more DB queries)
4. Calls Gemini API

This means for a batch of 5 leads, there are **5 separate auth checks, 15 DB queries for data fetching, 15 budget queries** — all sequential.

**Impact:**
- A 5-lead batch takes 5× the time of a single analysis (no parallelism)
- Self-referencing HTTP calls add HTTP overhead (DNS, TCP handshake within the same process)
- Cookie forwarding for auth is fragile

**Recommended Fix:**
- Inline the analysis logic: extract `analyzeOneLead(params)` as a shared function
- Call it with `Promise.all(batchLeads.map(id => analyzeOneLead(id, ...sharedContext)))`
- Share the pre-fetched campaign context, AI settings, and budget data across the batch
- This alone would reduce batch time by ~70% (5 serial → 5 parallel + shared overhead)

**Estimated Gain:** 5× throughput improvement on bulk AI analysis.

---

### 🟠 [HIGH] `createAuditLog` — Creates a Service Client on Every Call + Unnecessary `.select()`

**File:** `src/lib/audit/create-audit-log.ts`

**Root Cause:**  
- Creates a new `createServiceClient()` on every call (expensive object allocation)
- Uses `.insert(...).select().single()` — the `SELECT` after insert fetches the created row back from DB when the caller never uses the returned data in the hot path

**Impact:**
- Audit logs are inserted after every email send, AI generation, lead import — high-frequency path
- The `SELECT` after insert doubles the DB work for audit entries
- New service client creation on every call

**Recommended Fix:**
- Accept optional `supabase` client as parameter to avoid re-creation
- Change to `.insert(...)` without `.select()` unless the return value is actually needed by the caller (it never is based on all call sites)

```typescript
// Remove .select().single() - saves one DB round-trip per audit log
const { error } = await supabase.from('audit_logs').insert({ ... });
```

**Estimated Gain:** Halves DB load on every audit-logged operation.

---

### 🟠 [HIGH] `add_tag` Bulk Action — N Individual Updates Instead of One

**File:** `src/app/api/leads/bulk/route.ts` (lines 37–67)

**Root Cause:**  
The `add_tag` action fetches all leads, then calls `.update()` individually for each lead in a `Promise.all`. For 100 leads, this is 101 DB queries (1 fetch + 100 updates).

**Impact:**
- High DB load and latency for large tag operations
- Supabase connection pressure

**Recommended Fix:**  
Use a Postgres function that appends a tag atomically:

```sql
UPDATE leads SET tags = 
  CASE 
    WHEN tags IS NULL OR tags = '' THEN $tag
    WHEN tags ~ ('(^|,\s*)' || $tag || '(\s*,|$)') THEN tags  -- already exists
    ELSE tags || ', ' || $tag
  END,
  updated_at = NOW()
WHERE id = ANY($lead_ids) AND user_id = $user_id;
```

This reduces 100 updates to 1.

---

### 🟡 [MEDIUM] Website Scraping — No Timeout Coordination, No Parallelism Control

**File:** `src/app/api/ai/analyze-lead/route.ts` (lines 37–60)

**Root Cause:**  
`scrapeWebsite()` has a 5-second `AbortController` timeout. During bulk analysis, up to 5 leads can trigger 5 concurrent website fetches. There's no rate limiting, no robot.txt compliance check, and if the remote server is slow, the entire Vercel function can be held open for 5 seconds on the website fetch alone.

**Impact:**
- Vercel function duration cost (billed per second)
- Bulk analysis can be blocked by 5 × 5s = 25s of website fetches
- No deduplication: if two leads share the same domain, the site is fetched twice

**Recommended Fix:**
- The company enrichment cache partially addresses deduplication — ensure it's always checked before scraping (it is, for single lead analysis)
- For bulk: pre-batch deduplicate domains; fetch each domain only once; share across leads
- Reduce timeout to 3s for bulk, 5s for single
- Consider offloading scraping to a background task (Vercel background function or queue)

---

## 3. CACHING

### 🟠 [HIGH] AI Budget Checks Not Cached — Queried on Every Single AI Request

**Root Cause:**  
The `ai_usage_logs` count queries in `analyze-lead/route.ts` run on every request with no caching layer. For a bulk job of 5 leads, the budget is checked 5 times. The data only changes when AI actually runs, so a 30–60 second cache window would be acceptable.

**Recommended Fix:**
- Use Next.js `unstable_cache` or a module-level in-memory LRU cache (keyed by `userId + day`) with a 30s TTL
- Only invalidate on successful AI generation

---

### 🟡 [MEDIUM] `getAiSettingsForUser` Called on Every `analyze-lead` Request — No Caching

**Root Cause:**  
AI settings almost never change. Yet they're fetched from Supabase on every single lead analysis call. For a 5-lead bulk job, this is 5 identical reads.

**Recommended Fix:**
- Cache per user with a 5-minute TTL (in-memory or Vercel Edge Config)
- Or pass pre-fetched settings from the bulk controller into the single-lead function

---

### 🟡 [MEDIUM] Company Enrichment Cache `last_used_at` Update on Every Cache Hit

**File:** `src/app/api/ai/analyze-lead/route.ts` (lines 318–324)

**Root Cause:**  
Every time a company is found in cache, a `UPDATE company_enrichment_cache SET last_used_at = NOW()` is executed. This is a write on a cache-read path.

**Recommended Fix:**
- Batch these updates (update in bulk after processing, or skip if `last_used_at` was already within the last 24h)
- Or use a background task to asynchronously update `last_used_at`

---

## 4. QUEUE & BACKGROUND PROCESSING

### 🟡 [MEDIUM] `claimLeadsForEmailSending` — Over-Fetches then JavaScript-Filters

**File:** `src/lib/queue/queue.ts` (lines 93–133)

**Root Cause:**  
The query fetches `limit × 5` leads (line 106: `.limit(Math.max(limit * 5, limit))`), then filters them in JavaScript to find the actually-due ones. For a `limit=5`, this fetches up to 25 leads.

**Impact:**
- Over-fetching leads table data
- JavaScript-side filtering duplicates work that Postgres can do with `WHERE next_email_at <= NOW() OR (emails_sent_count = 0 AND current_step <= 1)`

**Recommended Fix:**
- Push the full filter logic into the query; eliminate the JavaScript `.filter()` and the 5× over-fetch

---

### 🔴 [CRITICAL] `sendDueEmails` — `checkSuppression`, `getCampaignDailySendCount`, `getAvailableSendCapacity`, `createAuditLog` All Create New Service Clients

**File:** `src/lib/cron/send-due-emails.ts`

**Root Cause:**  
Each helper called in the cron creates its own `createServiceClient()`. In one cron run for one campaign with 5 leads, this means approximately:
- 1 in `sendDueEmails` itself
- 5 in `checkSuppression` (×2 queries each)
- 1 in `getCampaignDailySendCount`
- 1 in `getAvailableSendCapacity`
- 5 in `incrementDailySentCount`
- 5–15 in `createAuditLog`

Total: **~18–24 distinct service client instantiations** per 5-lead cron run.

**Recommended Fix:**
- Pass a single shared `supabase` service client instance through the call chain as a parameter

---

## 5. INFRASTRUCTURE & DEPLOYMENT

### 🟠 [HIGH] `vercel.json` Is Essentially Empty — No Function Configuration

**File:** `vercel.json`

**Root Cause:**  
The file only contains `{ "version": 2 }`. No `maxDuration`, no function-specific memory settings, no cron schedule definitions, no region configuration.

**Impact:**
- Cron routes (`/api/cron/*`) use the default Vercel function timeout (likely 10s on Hobby, configurable up to 60s on Pro)
- AI analysis routes that call Gemini + scrape websites can easily take 10–15s; they may timeout without explicit `maxDuration`
- No cron schedule for email sending — the cron must be configured externally or manually

**Recommended Fix:**
```json
{
  "version": 2,
  "functions": {
    "src/app/api/ai/analyze-lead/route.ts": {
      "maxDuration": 30
    },
    "src/app/api/ai/bulk-analyze/route.ts": {
      "maxDuration": 60
    },
    "src/app/api/cron/send-emails/route.ts": {
      "maxDuration": 30
    },
    "src/app/api/cron/send-due-emails/route.ts": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/cron/send-emails",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/check-replies",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/telegram-report",
      "schedule": "0 9 * * *"
    }
  ]
}
```

---

### 🟡 [MEDIUM] `next.config.ts` Has No Configuration

**File:** `next.config.ts`

**Root Cause:**  
Empty Next.js configuration. Missing:
- `images.remotePatterns` (if avatar URLs come from external hosts)
- `experimental.serverComponentsHmrCache` for faster dev reloads
- `compiler.removeConsole` for production (removes `console.*` calls from production bundles, saving bytes and preventing log pollution)

**Recommended Fix:**
```typescript
const nextConfig: NextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },
};
```

The `optimizePackageImports` setting is critical for `lucide-react` (1000+ icons) and `recharts` — it enables tree-shaking at the import level, significantly reducing bundle size.

---

### 🟡 [MEDIUM] Hardcoded Production URL in Cron Module

**File:** `src/lib/cron/send-due-emails.ts` (line 296)

```typescript
const appBaseUrl = process.env.NODE_ENV === 'production'
  ? 'https://reachmira.vercel.app'  // ← HARDCODED!
  : ...
```

**Root Cause:**  
The production URL is hardcoded. If the app is renamed, moved to a custom domain, or deployed to a staging environment, unsubscribe links will point to the wrong URL.

**Recommended Fix:**  
Use `process.env.NEXT_PUBLIC_APP_URL` exclusively, set it in Vercel environment variables per deployment environment.

---

## 6. FRONTEND

### 🟡 [MEDIUM] `framer-motion` Imported at App Level — No Lazy Loading

**File:** `package.json`, `src/components/`

**Root Cause:**  
`framer-motion` at v12 is a large library (~100KB gzipped). If imported in components that render on initial page load, it blocks the critical rendering path.

**Recommended Fix:**
- Use `next/dynamic` with `{ ssr: false }` for components that use framer-motion animations
- Or use CSS `@keyframes` for simple animations and reserve framer-motion for complex gesture-based interactions only

---

### 🟡 [MEDIUM] `recharts` — No Lazy Loading on Analytics Charts

**File:** `src/components/reachmira/AnalyticsCharts.tsx`

**Root Cause:**  
Recharts (~300KB gzipped) is loaded as a regular import. The analytics charts are not always visible on first load.

**Recommended Fix:**
```typescript
const AnalyticsCharts = dynamic(() => import('@/components/reachmira/AnalyticsCharts'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});
```

---

## Summary Table

| # | Issue | Severity | File(s) | Est. Gain |
|---|---|---|---|---|
| 1 | Unbounded SELECT * on leads endpoint | 🔴 Critical | `api/leads/route.ts` | 60–90% response time |
| 2 | Per-lead suppression check in cron loop | 🔴 Critical | `cron/send-due-emails.ts` | ~200ms/run |
| 3 | Service client created per helper call | 🔴 Critical | `queue/queue.ts`, multiple | Connection pool |
| 4 | Bulk analyze uses sequential self-HTTP calls | 🔴 Critical | `api/ai/bulk-analyze/route.ts` | 5× throughput |
| 5 | Read-modify-write race on daily sent count | 🟠 High | `queue/queue.ts` | Data integrity |
| 6 | 8–13 parallel queries for AI usage stats | 🟠 High | `lib/ai/runtime.ts` | ~200–500ms |
| 7 | 3 budget queries per AI request | 🟠 High | `api/ai/analyze-lead/route.ts` | ~100ms/request |
| 8 | Missing composite indexes | 🟠 High | `schema.sql` | 2–10× query speed |
| 9 | `add_tag` N individual updates | 🟠 High | `api/leads/bulk/route.ts` | N→1 queries |
| 10 | Audit log does unnecessary SELECT after INSERT | 🟠 High | `lib/audit/create-audit-log.ts` | 50% audit DB load |
| 11 | AI budget not cached | 🟠 High | `api/ai/analyze-lead/route.ts` | Repeated queries |
| 12 | `claimLeadsForAIProcessing` TOCTOU race | 🟡 Medium | `queue/queue.ts` | Data integrity |
| 13 | `getAiSettingsForUser` sequential fallback | 🟡 Medium | `lib/ai/runtime.ts` | 1 extra query |
| 14 | AI settings not cached | 🟡 Medium | `lib/ai/runtime.ts` | 5× per batch |
| 15 | Company cache touch on every hit | 🟡 Medium | `api/ai/analyze-lead/route.ts` | Write on read |
| 16 | `claimLeadsForEmailSending` over-fetches 5× | 🟡 Medium | `queue/queue.ts` | 5× lead fetch |
| 17 | `vercel.json` empty — no timeouts or crons | 🟠 High | `vercel.json` | Timeout risk |
| 18 | No lazy loading for recharts/framer-motion | 🟡 Medium | `AnalyticsCharts.tsx` | Bundle size |
