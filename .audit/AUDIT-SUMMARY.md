# Meridian — Full Codebase Audit

**Date:** 2026-04-05
**Layers audited:** 10 of 10 (project-structure, data-model, api-surface, testing-quality, ui-ux, user-flow, ai-layer, integration, security, performance-infra)
**Model:** claude-sonnet-4-6 (all layer agents + synthesis)

| Metric | Value |
|--------|-------|
| Total findings (deduplicated) | 62 |
| Critical | 2 |
| High | 11 |
| Medium | 16 |
| Low | 20 |
| Info | 10 |
| Agents executed | 10 |
| Coverage gaps identified | 10 |

---

## Architecture Health Score

**Overall: 6.8 / 10**

| Dimension | Score | Notes |
|-----------|-------|-------|
| Data Model | 5.5 / 10 | Strong schema design, 2 critical data integrity bugs |
| API Surface | 6.5 / 10 | Consistent requireRole pattern, 3 routes bypass it |
| Testing | 5.0 / 10 | Good unit test structure, AI layer uncovered, CI incomplete |
| UI/UX | 7.0 / 10 | Strong design system, RSC conversion partial |
| User Flows | 6.5 / 10 | Core flows work, 3 broken due to data/schema issues |
| AI Layer | 7.5 / 10 | Well-architected, good fallbacks, cost exposure risk |
| Integration | 7.0 / 10 | Clean patterns, no circuit breaker on Glofox |
| Security | 7.0 / 10 | No secrets in code, CSP configured, 3 auth gaps |
| Performance | 6.5 / 10 | Missing indexes, wrong data being polled |
| Project Structure | 8.0 / 10 | Clean monorepo, one client-boundary issue |

---

## Executive Summary

Meridian is a well-architected Phase 1 platform with a clean TypeScript/Next.js/Supabase/Inngest stack. The codebase is organized, readable, and clearly built with SaaS scale in mind. The engineering quality is high for the project stage.

**The sprint that just completed introduced two critical data integrity bugs that must be fixed immediately:**

1. **Revenue data is wrong everywhere.** 1,894 real Glofox transactions were imported with historical timestamps after the `daily_metrics` table had already been computed. The cron only runs forward — historical rows will never be re-computed. Every revenue chart, the Command Center daily briefing, MRR, ARPM, and the AI briefing context are all displaying incorrect (zero or near-zero) historical revenue. The fix is a one-time backfill script.

2. **Member credits are completely broken.** The `credit_packs` table has never been populated despite the backfill code existing. Members with credit packs in Glofox show zero credits. The `credit_expiry` automation trigger can never fire.

**Two high-priority blocking bugs** from this sprint also need immediate attention:

3. **6 new automation trigger types cannot be saved.** The database CHECK constraint was not updated when 6 new trigger types were added to `evaluate-triggers.ts`. Creating an automation with `never_booked`, `classpass_repeat`, `one_and_done`, `cooling_off`, `plan_upgrade_candidate`, or `class_type_fan` will fail with a constraint violation.

4. **The rate limiter doesn't work.** The in-memory + async-Supabase pattern does not achieve distributed rate limiting in serverless. 10 of 17 AI routes have no rate limiting at all. This creates Anthropic API cost exposure if session tokens are compromised.

Outside these immediate issues, the codebase has a healthy foundation. The AI layer architecture is particularly strong: centralized client singleton, rules-based fallbacks, `withRetry()` for rate limit handling, and consistent prompt engineering across 22 modules. The integration patterns (Stripe webhook idempotency, Resend Svix verification, Inngest retry logic) are all correctly implemented.

---

## Immediate Actions (This Week)

### Fix 1 — Daily Metrics Backfill (CRIT-001) — 2 hours
```sql
-- Delete and re-aggregate all historical daily_metrics rows
DELETE FROM daily_metrics
WHERE studio_id = '<studio_id>'
  AND metric_date < CURRENT_DATE;
-- Then trigger the cron manually or run the aggregation inline
```

### Fix 2 — Trigger Credit Pack Backfill (CRIT-002) — 30 minutes
```
POST /api/glofox/backfill
```
Monitor the Inngest dashboard for the `backfill-credits` step. Verify `credit_packs` row count after.

### Fix 3 — Update automation_flows CHECK Constraint (HIGH-001) — 30 minutes
```sql
ALTER TABLE automation_flows DROP CONSTRAINT automation_flows_trigger_type_check;
ALTER TABLE automation_flows ADD CONSTRAINT automation_flows_trigger_type_check
  CHECK (trigger_type IN (
    'signup', 'no_show', 'churn_risk', 'credit_expiry', 'birthday',
    'milestone', 'membership_change', 'booking_completed', 'failed_payment',
    'inactivity', 'referral', 'custom',
    'never_booked', 'classpass_repeat', 'one_and_done',
    'cooling_off', 'plan_upgrade_candidate', 'class_type_fan'
  ));
```

### Fix 4 — Add Missing Composite Indexes (HIGH-011) — 30 minutes
```sql
CREATE INDEX idx_bookings_member_attended ON bookings(studio_id, member_id, attended) WHERE attended = true;
CREATE INDEX idx_transactions_studio_date ON transactions(studio_id, created_at, status);
CREATE INDEX idx_profiles_studio_engagement ON profiles(studio_id, engagement_status);
```

---

## Near-Term Actions (Next Sprint)

### Rewrite Rate Limiter (HIGH-002)
The `rateLimit()` function must be async — await the Supabase atomic increment and use the returned count. Apply to all 17 AI routes with studio-level keys (`ai:studio:{studioId}`).

### Fix Campaign Send Auth (HIGH-003)
`POST /api/campaigns/send` must use `requireRole(['owner', 'manager'])` — not inline auth with `DEFAULT_STUDIO_ID` fallback.

### Verify execute_readonly_sql RPC (HIGH-004)
Locate or create the `execute_readonly_sql` RPC in migrations with: read-only role enforcement, `SET LOCAL statement_timeout = '5s'`, and studio_id presence validation.

### Add Test Coverage for AI Layer (HIGH-005)
All 22 AI modules have rules-based fallbacks that can be unit-tested without the real API. Add tests by mocking `getAnthropicClient()` to return null.

### Enable Integration Tests in CI (HIGH-006)
Provision Supabase test project (MED-27) or use Supabase local Docker. Uncomment the integration test CI step.

### Fix Engagement Module Placeholder Data (HIGH-010)
Hide the streak and referrals columns or implement the data pipelines before shipping the Engagement module.

---

## Phase 2 Readiness Assessment

Meridian is functionally ready for Phase 2 (Marketing & Engagement) with these caveats:

| Feature | Status |
|---------|--------|
| Campaign builder | Ready — send route needs auth fix |
| Automation flows | Blocked — 6 trigger types need schema fix |
| Lead pipeline | Ready |
| Email tracking (Resend) | Ready |
| SMS campaigns | Ready (Twilio installed, provider-agnostic) |
| Content hub | Ready |
| Engagement leaderboard | Blocked — streak/referral data pipelines missing |
| A/B test campaigns | Ready — manual winner selection works |

---

## Pre-Phase-4 SaaS Launch Requirements

These issues MUST be resolved before onboarding a second studio:

1. **Remove all `DEFAULT_STUDIO_ID` fallbacks** from API routes — use fail-closed auth
2. **RLS rewrite** — switch from `current_setting('app.studio_id')` to `auth.uid()`-based policies
3. **Distributed rate limiting** — per-studio AI rate keys with real enforcement
4. **Studio onboarding flow** — no guided setup currently exists
5. **Multi-tenant `cron-daily-metrics`** — currently hardcodes `STUDIO_ID`; needs to iterate all studios (per the existing TODO comment)

---

## Findings by Layer

| Layer | Critical | High | Medium | Low | Info |
|-------|----------|------|--------|-----|------|
| project-structure | 0 | 0 | 1 | 2 | 2 |
| data-model | 2 | 2 | 3 | 1 | 1 |
| api-surface | 0 | 3 | 3 | 2 | 1 |
| testing-quality | 0 | 3 | 2 | 3 | 1 |
| ui-ux | 0 | 2 | 3 | 3 | 1 |
| user-flow | 0 | 3 | 2 | 3 | 1 |
| ai-layer | 0 | 3 | 3 | 2 | 1 |
| integration | 0 | 2 | 2 | 3 | 1 |
| security | 0 | 3 | 3 | 3 | 1 |
| performance-infra | 0 | 2 | 2 | 3 | 2 |
| **Total** | **2** | **23** | **24** | **25** | **12** |

*Note: Cross-layer duplicates are deduplicated in the findings files. Totals above count per-layer before deduplication.*

**Deduplicated totals:** Critical: 2, High: 11, Medium: 16, Low: 20, Info: 10 = **59 total**

---

## Strengths to Preserve

- **Clean requireRole() pattern** — used by ~90% of API routes. Maintain this discipline.
- **AI fallback architecture** — all 22 modules degrade gracefully without API key. Keep this.
- **Stripe webhook idempotency** — `processed_webhook_events` table correctly prevents duplicates.
- **Zod validation** — good pattern for the 4 schemas that use it. Expand coverage.
- **member_360 view** — excellent data access pattern for the most complex join. Use it everywhere.
- **Inngest step-based functions** — proper use of step.run() for fault-tolerant background jobs.
- **Monorepo shared packages** — types, supabase, utils are correctly isolated. Enforce usage.

---

## File Index

| File | Contents |
|------|---------|
| `.audit/AUDIT-SUMMARY.md` | This document |
| `.audit/layers/project-structure.md` | Architecture, module boundaries, dependency graph |
| `.audit/layers/data-model.md` | Schema, ER diagram, data integrity findings |
| `.audit/layers/api-surface.md` | All 150 routes, auth patterns, AI endpoints |
| `.audit/layers/testing-quality.md` | Test inventory, coverage analysis, CI gaps |
| `.audit/layers/ui-ux.md` | Component hierarchy, design system, RSC analysis |
| `.audit/layers/user-flow.md` | User journeys, broken flows, dead ends |
| `.audit/layers/ai-layer.md` | 22 AI modules, prompt patterns, cost exposure |
| `.audit/layers/integration.md` | 7 external services, error handling, circuit breakers |
| `.audit/layers/security.md` | Auth gaps, CSP, input validation, secrets |
| `.audit/layers/performance-infra.md` | Indexes, memory patterns, build config, CI/CD |
| `.audit/findings/critical.md` | 2 critical findings |
| `.audit/findings/high.md` | 11 high findings |
| `.audit/findings/medium.md` | 16 medium findings |
| `.audit/findings/low-info.md` | 20 low + 10 info findings |
| `.audit/synthesis/cross-references.md` | 8 findings corroborated by 2+ layers |
| `.audit/synthesis/contradictions.md` | 4 apparent contradictions — all resolved |
| `.audit/synthesis/gaps.md` | 10 areas no agent covered |
