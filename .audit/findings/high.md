# High Findings

**Generated:** 2026-04-05
**Deduplicated and cross-referenced from 10 layer audit reports.**

---

## HIGH-001: automation_flows CHECK constraint blocks 6 new trigger types

**IDs:** DM-003, UF-002, TQ-002
**Corroborated by:** data-model, user-flow, testing-quality (3/10 layers)

The Phase 2 migration's CHECK constraint on `automation_flows.trigger_type` was not updated when 6 new trigger types were added to `evaluate-triggers.ts`. Creating any automation with these types will fail silently at the database level. Additionally, these 6 types have no unit tests.

**New types blocked:** `never_booked`, `classpass_repeat`, `one_and_done`, `cooling_off`, `plan_upgrade_candidate`, `class_type_fan`

**Fix:** Apply schema migration to update the CHECK constraint. Add test coverage for new trigger evaluation logic.

---

## HIGH-002: Rate limiter is non-functional for cross-instance protection

**IDs:** AS-001, SEC-002
**Corroborated by:** api-surface, security (2/10 layers)

`rateLimit()` returns an in-memory optimistic result. In serverless, each instance has its own counter. 10 AI routes lack any rate limiting. A stolen session token can generate unbounded Anthropic API costs.

**Fix:** Rewrite `rateLimit()` to be async — await the Supabase atomic increment. Apply `rateLimit()` to all 17 AI routes using studio-level keys.

---

## HIGH-003: POST /api/campaigns/send bypasses requireRole() and uses DEFAULT_STUDIO_ID

**IDs:** AS-002, SEC-003
**Corroborated by:** api-surface, security (2/10 layers)

The campaign bulk send route uses inline auth without `requireRole()` and falls back to `DEFAULT_STUDIO_ID` if the user's profile has no `studio_id`. This is the highest-impact route in the system (sends bulk email to hundreds of members).

**Fix:** Refactor to `requireRole(['owner', 'manager'])`.

---

## HIGH-004: AI NL Search executes AI-generated SQL without DB-layer read-only enforcement

**IDs:** AS-003, SEC-001, AI-001
**Corroborated by:** api-surface, security, ai-layer (3/10 layers)

The NL search feature translates natural language to SQL via Claude, then executes via `execute_readonly_sql` RPC. Application-layer SELECT-only check exists but the RPC definition was not found in audited migration files. DB-layer enforcement (read-only role, `SET TRANSACTION READ ONLY`) is unconfirmed.

**Fix:** Verify or create `execute_readonly_sql` with read-only role enforcement, `statement_timeout = '5s'`, and add `studio_id` presence validation before execution.

---

## HIGH-005: AI layer has near-zero test coverage — 22 modules, 1 test

**ID:** TQ-001
**Layer:** testing-quality

The entire AI layer (briefing, churn prediction, health score, insights generator, revenue anomaly, etc.) has only 1 unit test (ai-search). Every module has a rules-based fallback path that is testable without the real API.

**Fix:** Add unit tests for rules-based fallback in each AI module by mocking `getAnthropicClient()` to return null.

---

## HIGH-006: Integration tests are disabled in CI — never run

**ID:** TQ-003
**Corroborated by:** testing-quality, performance-infra (2/10 layers)

6 integration test files exist (bookings, auth, Stripe webhooks, Supabase CRUD) but the CI step is commented out pending a Supabase test project (MED-27). Data layer bugs and performance regressions are caught only in production.

**Fix:** Provision Supabase test project or use Supabase local Docker. Uncomment integration test CI step.

---

## HIGH-007: Glofox sync has no circuit breaker or failure alerting

**ID:** INT-002
**Layer:** integration

Glofox API outage stops all incremental sync. The function retries 3 times then silently stops. No alerting is triggered. `glofox_sync_state` shows errors but no notification reaches admins.

**Fix:** Add failure alerting (email/Slack) when Glofox sync exhausts retries. Surface sync error count in the admin Glofox status page.

---

## HIGH-008: 10 of 17 AI routes lack rate limiting — Anthropic cost exposure

**ID:** AI-003, AS-004
**Corroborated by:** ai-layer, api-surface (2/10 layers)

Routes without rate limiting: insights/generate, recommendations, revenue-anomaly, booking-patterns, trainer-summary, intake-enrichment, auto-reply, waitlist-message, and others. At Sonnet 4.6 pricing, a loop against these endpoints could accumulate hundreds of dollars in API costs.

**Fix:** Apply `rateLimit()` with studio-level keys to all AI routes.

---

## HIGH-009: Command Center revenue display is wrong — first screen owners see daily

**ID:** UF-001
**Corroborated by:** user-flow, ui-ux, data-model (3/10 layers)

The Command Center reads revenue from `daily_metrics` which is wrong for all historical dates. This is compounded by the AI briefing also receiving incorrect revenue context.

**Fix:** Same as CRIT-001. Interim: query `transactions` directly for Command Center revenue widgets.

---

## HIGH-010: Engagement leaderboard shows placeholder data for two of four metrics

**ID:** UX-001
**Layer:** ui-ux

The Engagement module (the gamification/retention surface) shows "--" for `currentStreak` and `referrals` columns. The code has explicit TODOs noting these data pipelines are missing. Users who navigate to the Engagement module see an incomplete and unexplained interface.

**Fix:** Implement streak and referral data pipelines before shipping the Engagement module, or hide the incomplete columns until the data is available.

---

## HIGH-011: Missing composite indexes on 3 high-frequency query paths

**IDs:** DM-004, PERF-002
**Corroborated by:** data-model, performance-infra (2/10 layers)

Three missing indexes will cause scan degradation at multi-tenant scale:
- `bookings(studio_id, member_id, attended)` — daily enrichment cron
- `transactions(studio_id, created_at, status)` — daily metrics cron + revenue analytics
- `profiles(studio_id, engagement_status)` — trigger evaluation every 10 minutes

**Fix:** Apply 3 CREATE INDEX statements. Low effort, high impact.
