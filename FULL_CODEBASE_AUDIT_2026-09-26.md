# ReachMira — Full Codebase Audit (2026-09-26)

Read-only audit across billing, the AI personalization pipeline, the admin scraper/global lead pool, plus a competitor feature-gap pass and a verification sweep of this repo's own prior audit docs. No code was changed as part of this audit.

**A meta-finding first:** this repo already has `Reachmira Audit.md`, `Reachmira tasklist.md`, `ReachMira_TASKLIST.md`, and `PERFORMANCE_AUDIT.md`/`PERFORMANCE_PLAN.md`. Several items those docs mark as *not done* are actually already shipped in code (atomic sent-count RPC, AI usage summary RPC, `GET /api/leads` pagination, atomic lead claiming, bulk-tag RPC, composite indexes, Sentry monitoring) — the docs were never updated after the fixes landed. Treat their checkboxes as unreliable; this doc reflects verified current code state.

---

## Priority 1 — Fix before this handles real money or real prospects

1. **The entire Stripe billing integration is wired against a schema that doesn't exist.** `src/app/api/webhooks/stripe/route.ts`'s `handleSubscriptionChange` writes `profiles.stripe_subscription_id`, `stripe_price_id`, `subscription_status`, `stripe_current_period_end`, `trial_ends_at` — **none of these columns exist in any migration or `schema.sql`**. Even `stripe_customer_id`, read/written by the checkout and portal routes, isn't in any migration either. In a real database these writes/selects fail (or silently return `undefined`), and because the webhook handler never checks the Supabase `.update()` error, Stripe still gets a `200 {received:true}` while the DB write silently fails. Concretely: **every checkout call likely creates a brand-new Stripe customer** instead of finding the existing one, since the lookup column may not even exist to query against. `src/types/database.types.ts` has zero stripe/subscription fields, confirming generated types are stale too. **Severity: Critical.**

2. **Billing enforces nothing, by design, but nothing else fills the gap either.** `checkSendingLimits` (`src/lib/billing/limits.ts:12-22`) is a literal no-op (`return { allowed: true }`), and its `BILLING_LIMITS` constants are read nowhere. This is disclosed in the UI ("Paid plans coming soon — full access, no limits," `settings/billing/page.tsx:108-117`) so it's not a hidden bug — but combined with finding 1, even *if* someone flips this stub on, there's no plan-tier data model to enforce against (no `plans` table, no `plan_tier` column anywhere). **Severity: Critical (structural) / Info for now (intentionally disclosed).**

3. **AI leads can get stuck in `processing` forever, with zero recovery.** `releaseStuckProcessingLeads` and `claimLeadsForAIProcessing` (`src/lib/queue/queue.ts:10-49`) were clearly written to sweep leads stuck in `processing` for >15 minutes — but grep confirms **neither function is called from any route or cron job**. If a serverless function hard-times-out mid-Gemini-call (`analyze-lead` has `maxDuration: 30`, `bulk-analyze` has `60`, per `vercel.json`) after setting `ai_status: 'processing'`, that lead is stuck permanently — no cron, no UI action recovers it. **Severity: Critical.**

4. **Prompt injection risk with zero output validation before a real send.** `buildCompactAiPrompt` (`src/lib/ai/efficiency.ts:394`) interpolates raw scraped website text directly as free-form prose (not JSON-escaped, up to 2800 chars) — an adversarial or compromised prospect website can embed plain-English instructions Gemini may follow. Separately, `approve-lead` (`src/app/api/campaigns/[id]/approve-lead/route.ts:41-73`) accepts arbitrary subject/body with **no validation at all** (no empty check, no leftover-`{{placeholder}}` check, no length sanity check), and `send-due-emails.ts` only checks the AI copy is non-empty before sending — nothing catches injected or malformed content before it reaches a real prospect's inbox. **Severity: High-Critical combined.**

5. **Bulk AI analysis can blow past your own configured budget cap.** `analyzeSingleLead`'s budget check (`src/lib/ai/analyze-lead.ts:347-416`) reads a stale in-process count with no atomic reservation. `bulk-analyze` fires a whole batch concurrently via `Promise.allSettled` — all N calls read the same "3 remaining" snapshot before any usage-log insert lands, so a 10-lead batch can let all 10 through even with `stop_ai_when_limit_reached=true` and only 3 actually remaining. **Severity: High.**

6. **Admin actions are completely un-audited, and "deleting" a user doesn't delete them.** `createAuditLog` is used extensively elsewhere in the app but never once under `src/app/api/admin/*`. Deleting a user, toggling someone's admin flag, bulk-deleting pool leads, approving/rejecting scraped leads — all happen with zero trace of who did it or when. Worse: `users/route.ts` DELETE only removes the `profiles` row, not the actual Supabase Auth account (explicit comment in the code acknowledging this) — **the "deleted" user's session/JWT can remain valid and they may still be able to authenticate.** **Severity: High.**

---

## Priority 2 — Real gaps worth planning around

7. **Unbounded scraping concurrency.** `src/app/api/admin/scrape/route.ts` has no queue-depth check, no per-minute throttle, and doesn't validate/clamp the client-supplied `limit` server-side. Each search fans out to Firecrawl fully in parallel per lead found, with failures just logged and swallowed (no backoff on 429s). A few back-to-back large searches can blow through Firecrawl's quota or get target sites to block you. **Severity: High.**

8. **The scraper's AI prompt is instructed to fabricate emails.** It literally tells Gemini "you must ALWAYS return an email... guess their primary contact email" when none is found — fabricated addresses are stored indistinguishably from real, found ones, with no flag marking "AI-guessed" vs "verified." These become real send targets later. **Severity: High** (deliverability/reputation risk).

9. **Enrichment work is silently discarded when a scraped lead is approved into the pool.** `admin_scraping_queue` has 13 AI/enrichment columns (pain points, outreach angle, tech stack, funding stage, etc.); `admin_leads_pool` has none of them. The approve action only maps the basic fields — all the AI research is thrown away, acknowledged in-code with a `// Note: we'd map other columns here, but currently admin_leads_pool doesn't have AI columns` comment. **Severity: Medium-High.**

10. **No de-duplication before insert**, anywhere in the admin lead flow — not in the scraper (only in-memory dedup within a single request), not in CSV bulk upload. Running similar search queries twice, or two admins searching overlapping terms, duplicates companies into the pool with no unique constraint on website/email/company_name to catch it. **Severity: Medium-High**, compounds over time.

11. **Three-to-four divergent reimplementations of the same AI pipeline.** `analyze-lead.ts` is the canonical shared implementation (bulk-analyze correctly calls into it now — the old "sequential self-HTTP-calls" complaint from `PERFORMANCE_AUDIT.md` is fixed), but `src/app/api/leads/personalize/route.ts` and `src/app/api/leads/[id]/personalize/route.ts` each independently reimplement the entire decision→cache→budget→Gemini→persist flow, with subtly different cache-hit keys and different fields written back. Any future fix to budget/validation logic has to be manually ported to 3-4 call sites. **Severity: Medium** (maintainability, not an active bug by itself).

12. **`max_bulk_ai_batch_size` is read from two different tables** depending on code path (`profiles` directly in bulk-analyze vs. `ai_settings`-preferred in the shared helper), so a user with a stricter `ai_settings` cap can still get the looser `profiles` value applied in bulk-analyze. **Severity: Medium.**

---

## Maintenance & hygiene (verified directly, not via agent)

- **Inconsistent base-URL resolution** across the app: a proper shared `getAppBaseUrl()` helper exists but is only used by OAuth routes; a hardcoded `https://reachmira.vercel.app` fallback lives in the manual-send route; Stripe checkout/portal and click-tracking each independently inline `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'`. If that env var is ever unset in production, Stripe redirects and tracking links could silently point at `localhost`.
- **Thin test coverage** — 4 test files total, all narrow pure-logic (suppression check, lead status, email verification, warmup ramp). Zero coverage on the send pipeline, campaign logic, or any API route.
- **Componentization debt, growing.** `LeadWorkspace.tsx` is 1,864 lines. `campaigns/[id]/page.tsx` is 1,655, `campaigns/new/page.tsx` 1,333, `leads/page.tsx` 1,237 — monolithic page components mixing data-fetching, form state, and rendering.
- `admin_leads_pool`'s RLS policy grants SELECT to *any* authenticated user (not just admins) — an explicit "for now" placeholder per its own migration comment. Read-only exposure, not a write path, but real.
- The admin scraper/enrich tools require the *acting admin's own* personal `gemini_api_key` rather than a shared server-side key — ties a shared team tool's availability to one person's personal credential.

---

## Product/feature gaps vs. Instantly / Smartlead / Apollo / Lemlist (web research)

Not bugs — things competitors ship that ReachMira doesn't yet, roughly ranked by how often reviews/marketing cite them as differentiators:

1. **Real warmup is inbox-to-inbox simulated traffic, not just a volume ramp.** Confirmed: both Instantly (pool of up to 1M accounts) and Smartlead (peer-to-peer pool of real opted-in mailboxes) run genuine send/open/reply/move-from-spam engagement loops between pooled mailboxes, continuously, *in addition to* a daily-volume ramp. ReachMira's warmup (just built this session) is ramp-only — that's a legitimate, defensible scope decision already made, but worth naming explicitly: it is not "the same thing" competitors call warmup, just a related, smaller piece of it.
2. **Deliverability tooling beyond warmup**: mailbox rotation across a campaign's connected accounts, pre-send spam/inbox-placement testing (seed-test tools), in-app DKIM/DMARC/SPF checkers. None of these exist in ReachMira; they're cheaper to build than a full warmup network and frequently cited as differentiators.
3. **Built-in B2B contact/company database.** Apollo (210M+ contacts), Instantly (450M+), Lemlist (650M+) all sell/bundle this as a first-party product; ReachMira relies entirely on user-imported lists + its own admin-curated pool. Smartlead notably does *not* have this either, showing it's viable to compete without one.
4. **Multichannel sequencing** (LinkedIn, calls, SMS) — Lemlist and Apollo both support it; ReachMira is email-only.
5. **AI reply sentiment/auto-categorization in the shared inbox** — Smartlead and Instantly both auto-score/bucket every reply (Interested/Not Interested/etc.) with no manual tagging. ReachMira's "AI-drafted reply suggestions" isn't the same thing. Most-cited AI gap.
6. **Auto-optimizing A/B testing** — Instantly auto-deactivates losing subject-line variants based on a chosen metric; ReachMira's is manual approve-before-send only.
7. Smaller gaps: AI send-time optimization, a built-in dialer (Apollo paid add-on), native CRM/deal-pipeline sync beyond two freeform fields.
8. **Pricing model context**: the market splits into volume-based-unlimited-seats (Instantly), per-seat-credit-gated (Apollo/Lemlist), and mailbox-count-based (Smartlead). Since ReachMira has no first-party lead database, a volume-based model (emails/month or active leads, unlimited seats+mailboxes) matches its current feature set most closely — worth considering once billing enforcement (Priority 1, #1-2) actually gets built.

---

## What's solid (worth naming, not everything is a gap)

- Admin route/page authorization is genuinely sound — every admin surface has a real server-side `is_admin` check, not just a client-side hide.
- Stripe webhook signature verification is done correctly.
- Checkout/portal are correctly scoped to the authenticated user — no way to target another account's billing.
- `min_data_quality_for_ai` / `full_ai_min_solution_score` gating is applied consistently across single-lead and bulk AI paths (one of the few things that isn't inconsistent between the duplicated pipelines).
- The bulk-analyze-to-shared-function refactor (fixing the old sequential self-HTTP-call pattern) is actually done, contrary to what the stale performance docs imply.
