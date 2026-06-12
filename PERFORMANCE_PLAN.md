# PERFORMANCE PLAN — The Digital Dude Outreach OS (ReachMira)

**Status:** Awaiting Approval  
**Prepared by:** Principal Software Architect  
**Date:** 2026-06-11  

---

## Prioritization Philosophy

Fixes are ordered by **ROI** (impact ÷ risk ÷ effort):
1. **High impact / Low risk** — pure refactors with no behavior change
2. **High impact / Medium risk** — DB schema additions, query consolidation
3. **Medium impact / Low risk** — config changes, caching improvements
4. **Medium impact / Medium risk** — structural refactors

---

## PHASE 1 — High Impact / Low Risk (1–2 days)
*No behavior changes. Pure performance wins. Zero risk of regression.*

---

### P1-A: Remove `.select().single()` from `createAuditLog`

**File:** `src/lib/audit/create-audit-log.ts`  
**Change:** Replace `.insert(...).select().single()` with `.insert(...)`  
**Why:** The returned row is never used by any caller. This halves the DB work for every audit log entry.  
**Risk:** None — all call sites discard the return value.  
**Expected Impact:**
- 50% reduction in DB load per audit log write
- ~5–10ms saved per logged action (email send, AI generation, lead import)

---

### P1-B: Fix Hardcoded Production URL

**File:** `src/lib/cron/send-due-emails.ts` (line 296)  
**Change:** Replace `'https://reachmira.vercel.app'` with `process.env.NEXT_PUBLIC_APP_URL`  
**Why:** Prevents incorrect unsubscribe URLs in staging/preview environments and future domain changes.  
**Risk:** None — requires `NEXT_PUBLIC_APP_URL` to be set in Vercel env vars.

---

### P1-C: Configure `vercel.json` with Function Timeouts and Cron Schedules

**File:** `vercel.json`  
**Change:** Add `maxDuration` for AI and cron routes; add Vercel Cron entries  
**Why:** Prevents serverless timeout on AI routes (currently at default ~10s which Gemini + scraping can exceed). Centralizes cron schedule management.  
**Risk:** Low — additive only; doesn't change logic.

```json
{
  "version": 2,
  "functions": {
    "src/app/api/ai/analyze-lead/route.ts": { "maxDuration": 30 },
    "src/app/api/ai/bulk-analyze/route.ts": { "maxDuration": 60 },
    "src/app/api/cron/send-emails/route.ts": { "maxDuration": 30 },
    "src/app/api/cron/send-due-emails/route.ts": { "maxDuration": 30 },
    "src/app/api/cron/check-replies/route.ts": { "maxDuration": 60 },
    "src/app/api/inbox/[id]/draft/route.ts": { "maxDuration": 30 }
  },
  "crons": [
    { "path": "/api/cron/send-emails", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/check-replies", "schedule": "0 * * * *" },
    { "path": "/api/cron/telegram-report", "schedule": "0 9 * * *" }
  ]
}
```

---

### P1-D: Add `optimizePackageImports` to `next.config.ts`

**File:** `next.config.ts`  
**Change:** Add experimental `optimizePackageImports` for `lucide-react`, `recharts`, `framer-motion`  
**Why:** These libraries are large. Without this flag, importing even one icon from `lucide-react` can pull in the entire icon library into the client bundle.  
**Risk:** None — Next.js feature, tree-shaking only.  
**Expected Impact:** Potential 50–200KB bundle size reduction depending on usage patterns.

---

### P1-E: Bulk Suppression Prefetch in Cron Loop

**File:** `src/lib/cron/send-due-emails.ts`  
**Change:** Load all suppressions for the campaign's user before the lead loop; replace per-lead `checkSuppression()` DB calls with in-memory Map lookups  
**Why:** Eliminates 2 DB round-trips × N leads = up to 20 queries per cron run.  
**Risk:** Low — suppressions for a user are small; entire list can fit in memory.  
**Expected Impact:**
- Eliminates ~10–20 DB queries per cron run
- ~150–300ms faster per cron invocation

---

## PHASE 2 — High Impact / Medium Risk (3–5 days)
*Requires DB schema changes or significant refactoring. Careful testing needed.*

---

### P2-A: Add Missing Composite Indexes to `schema.sql`

**Migration SQL:**
```sql
-- For AI budget queries (eliminates sequential scans on ai_usage_logs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_usage_logs_user_budget_idx 
  ON public.ai_usage_logs (user_id, created_at DESC, skipped, cache_hit);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_usage_logs_user_model_idx 
  ON public.ai_usage_logs (user_id, model, created_at DESC) 
  WHERE skipped = false AND cache_hit = false;

-- For lead queue queries (eliminates full campaign_id scan)
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_campaign_queue_idx 
  ON public.leads (campaign_id, status, next_email_at ASC NULLS FIRST);

-- For lead library queries (list view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_list_sort_idx 
  ON public.leads (lead_list_id, last_email_sent_at ASC NULLS FIRST);

-- For sorted sent email lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS sent_emails_lead_sent_at_idx 
  ON public.sent_emails (lead_id, sent_at DESC);

-- For suppression domain lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS suppressions_user_domain_idx 
  ON public.suppressions (user_id, domain) WHERE domain IS NOT NULL;

-- For inbox
CREATE INDEX CONCURRENTLY IF NOT EXISTS inbox_messages_user_status_idx 
  ON public.inbox_messages (user_id, status, received_at DESC);
```

**Risk:** Medium — `CREATE INDEX CONCURRENTLY` is non-blocking on Supabase (Postgres ≥12). Should be applied during low-traffic window.

---

### P2-B: Atomic `incrementDailySentCount` via Postgres Function

**File:** `src/lib/queue/queue.ts`, Supabase Dashboard  
**Change:** Create a DB function; update the TypeScript caller to use `.rpc()`  
**Why:** Eliminates the read-modify-write race condition and saves 1 DB round-trip per email sent.  
**Risk:** Medium — requires Supabase migration, updating call site.

**Migration:**
```sql
CREATE OR REPLACE FUNCTION increment_email_account_sent_count(
  p_account_id UUID, 
  p_increment INT DEFAULT 1
) RETURNS void AS $$
  UPDATE email_accounts
  SET daily_sent_count = daily_sent_count + p_increment,
      updated_at = NOW()
  WHERE id = p_account_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

---

### P2-C: Consolidate AI Usage Count Queries into a Single RPC

**File:** `src/lib/ai/runtime.ts`, Supabase Dashboard  
**Change:** Replace the 8-query `Promise.all` with a single RPC call  
**Why:** Reduces 8 DB connections to 1; dramatically reduces pressure on `ai_usage_logs`.  
**Risk:** Medium — requires writing and deploying a Postgres function.

**Migration:**
```sql
CREATE OR REPLACE FUNCTION get_ai_usage_summary(
  p_user_id UUID,
  p_daily_from TIMESTAMPTZ,
  p_monthly_from TIMESTAMPTZ
) RETURNS JSON AS $$
SELECT json_build_object(
  'daily_calls', COUNT(*) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_daily_from),
  'monthly_calls', COUNT(*) FILTER (WHERE skipped = false AND cache_hit = false),
  'flash_lite_today', COUNT(*) FILTER (WHERE skipped = false AND cache_hit = false AND model = 'gemini-3.1-flash-lite' AND created_at >= p_daily_from),
  'flash25_today', COUNT(*) FILTER (WHERE skipped = false AND cache_hit = false AND model = 'gemini-2.5-flash' AND created_at >= p_daily_from),
  'tokens_today', COALESCE(SUM(tokens_total) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_daily_from), 0),
  'monthly_tokens', COALESCE(SUM(tokens_total) FILTER (WHERE skipped = false AND cache_hit = false), 0),
  'cache_hits', COUNT(*) FILTER (WHERE cache_hit = true),
  'skipped', COUNT(*) FILTER (WHERE skipped = true)
)
FROM public.ai_usage_logs
WHERE user_id = p_user_id AND created_at >= p_monthly_from;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

### P2-D: Add `GET /api/leads` Pagination

**File:** `src/app/api/leads/route.ts`  
**Change:** Add `page`/`limit` or `cursor` query params; push all filters to DB; remove in-process JS filtering  
**Why:** The single most impactful API fix. An unbounded table scan on 10,000 leads is not scalable.  
**Risk:** Medium — requires frontend changes to adopt pagination.

**API Change:**
```
GET /api/leads?page=1&limit=50&search=acme&status=active&...
```

**Implementation Approach:**
- Keep all filter params but translate `search` to `.ilike()` across key columns (or `tsvector` FTS)
- Add `.range(offset, offset + limit - 1)` (Supabase range pagination)
- Return `{ leads, total, page, limit }` in response

---

### P2-E: Refactor `bulk-analyze` to Share Context and Run in Parallel

**File:** `src/app/api/ai/bulk-analyze/route.ts`  
**Change:** Extract analysis logic from `analyze-lead/route.ts` into a shared module; call with `Promise.all`  
**Why:** 5× throughput improvement; eliminates self-referencing HTTP calls.  
**Risk:** Medium — significant refactor of the AI analysis pipeline.

**Architecture:**
```
lib/ai/
  ├── analyze-lead.ts     ← extracted core analysis function (NEW)
  ├── efficiency.ts       ← (existing)
  └── runtime.ts          ← (existing)

api/ai/
  ├── analyze-lead/route.ts  ← thin HTTP wrapper calling lib/ai/analyze-lead.ts
  └── bulk-analyze/route.ts  ← fetches shared context once, calls Promise.all(batchLeads.map(...))
```

---

## PHASE 3 — Medium Impact / Low Risk (1 day)
*Configuration and caching improvements.*

---

### P3-A: Cache AI Settings Per User (5-minute TTL)

**File:** `src/lib/ai/runtime.ts`  
**Change:** Wrap `getAiSettingsForUser` with a module-level `Map<userId, { settings, expiresAt }>`  
**Why:** AI settings almost never change. Eliminates repeated DB queries during bulk operations.

---

### P3-B: Cache AI Budget Status (30-second TTL)

**File:** `src/app/api/ai/analyze-lead/route.ts`  
**Change:** Cache the daily/monthly count result with a 30s TTL keyed by userId + date  
**Why:** Budget checks are the most frequent redundant queries during bulk analysis.

---

### P3-C: Remove `.select().single()` from Audit Log (covered in P1-A)

Already included in Phase 1.

---

### P3-D: Lazy Load `AnalyticsCharts` Component

**File:** `src/components/reachmira/AnalyticsCharts.tsx` (and its parent page)  
**Change:** Wrap with `next/dynamic`  
**Why:** Removes recharts (~300KB) from the initial bundle.

---

## PHASE 4 — Medium Impact / Medium Risk (2–3 days)
*Structural refactors to improve long-term maintainability and performance.*

---

### P4-A: Thread Service Client Through Cron Call Chain

**Files:** `src/lib/cron/send-due-emails.ts`, `src/lib/queue/queue.ts`, `src/lib/suppression/check-suppression.ts`, `src/lib/audit/create-audit-log.ts`  
**Change:** Refactor all helper functions to accept an optional `supabase` client parameter; pass it from the cron entry point  
**Why:** Reduces ~20+ service client instantiations per cron run to 1.

---

### P4-B: Atomic Lead Claiming with `FOR UPDATE SKIP LOCKED`

**Files:** `src/lib/queue/queue.ts`, Supabase  
**Change:** Replace the 3-step SELECT → UPDATE → SELECT with a single Postgres RPC using `FOR UPDATE SKIP LOCKED`  
**Why:** Eliminates TOCTOU race condition and reduces from 3 to 1 DB round-trip.

---

### P4-C: `add_tag` Bulk Operation — Single UPDATE Query

**File:** `src/app/api/leads/bulk/route.ts`  
**Change:** Replace N individual updates with a single Postgres UPDATE with array input  
**Why:** Reduces 101 queries to 2 (1 fetch + 1 batch update) for tag operations.

---

## Verification Plan

### After Each Phase
1. Run `next build` — confirm no TypeScript errors
2. Test cron endpoint manually: `GET /api/cron/send-emails` with `Authorization: Bearer <CRON_SECRET>`
3. Test `POST /api/ai/analyze-lead` with a single lead
4. Test `POST /api/ai/bulk-analyze` with 3 leads
5. Verify audit logs are still being created after P1-A change

### Database
- After P2-A: Check Supabase index usage via `EXPLAIN ANALYZE` on the hot queries
- After P2-B/C: Verify RPC functions exist in Supabase dashboard
- After P2-D: Test paginated leads endpoint returns correct `total` count

### Regression Tests
- Email sending: send a test campaign email and confirm it arrives
- Unsubscribe link: click the unsubscribe link after P1-B and confirm it resolves correctly
- AI generation: generate one lead's AI content and confirm it saves to DB

---

## Open Questions for User Review

> [!IMPORTANT]
> **Pagination Design:** The `GET /api/leads` endpoint currently returns all leads at once. Does the frontend (leads list page) already support pagination, or will that need to be built alongside the API change?

> [!IMPORTANT]
> **Vercel Plan:** The `maxDuration` for AI routes is set to 30–60 seconds. This requires a Vercel Pro or above plan. Is the project on Pro? Hobby plan is capped at 10s.

> [!NOTE]
> **Cron Schedule:** The `vercel.json` crons use UTC. Are the desired send times already accounted for in the 5-minute interval, or should the `send-emails` cron be restricted to business hours (e.g., `0 8-18 * * 1-5`)?

> [!NOTE]
> **`NEXT_PUBLIC_APP_URL` env var:** This needs to be set in Vercel environment variables for production, staging, and preview environments before deploying P1-B.
