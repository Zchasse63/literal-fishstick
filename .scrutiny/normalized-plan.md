# Normalized Plan: Glofox API Migration to Meridian

**Scrutiny Session:** 2026-03-31
**Original Document:** glofox-api-migration-plan.md
**Input Type:** Single plan document (migration strategy)
**Complexity Classification:** SIGNIFICANT → Deep mode (7 agents)

---

## 1. Plan Summary

**What is being proposed:**
Replace a one-time CSV data import from Glofox with a live two-way API integration, enabling Meridian to become the sole operational system for The Sauna Guys (Tampa-based sauna/recovery studio, ~1,100 members).

**Core goal:** Full system cutover from Glofox to Meridian within 8–9 weeks, with Stripe replacing Glofox's payment processor.

**Why now:** Glofox has granted API access (57 endpoints, two-way read/write). This unblocks enrichment of 27 previously uncaptured data fields and enables live sync.

---

## 2. Scope Breakdown

### Phase 1 — Schema Preparation (Week 1)
- Add `glofox_id` columns to 7 tables (members, classes, bookings, transactions, credit_packs, leads, membership_plans)
- Add `glofox_synced_at` timestamps to 4 tables
- Add 27 new fields across 6 tables (profiles, members, bookings, transactions, classes, credit_packs)
- Create 3 new tables: `glofox_sync_state`, `glofox_sync_conflicts`, `lead_interactions`
- Store API credentials in Netlify environment variables

### Phase 2 — Sync Engine Build (Weeks 2–3)
- Build `GlofoxClient` TypeScript class with paginated fetch helper and 15+ entity methods
- Build 5 inbound Inngest cron functions (members every 10 min, bookings every 5 min, events every 15 min, transactions every 30 min, full refresh daily 3am)
- Build 3 outbound event-driven Inngest functions (member updates, booking creates/cancels, attendance check-ins)
- Per-field conflict resolution logic with 10 field-category rules
- Logging to `glofox_sync_conflicts` table

### Phase 3 — Transition Period (Weeks 4–6)
- Week 4: Shadow mode (inbound only, read-only mirror, daily integrity checks)
- Weeks 5–6: Parallel mode (bidirectional sync, staff uses either system)
- Staff training checklist
- Sync monitoring dashboard (new admin page)

### Phase 4 — Cutover (Weeks 7–8)
- Sunday night cutover sequence (22:00–00:00)
- DNS switch to Meridian
- Stripe payment activation
- Payment migration: create Stripe Customers + Subscriptions for all ~1,100 active recurring members
- Rollback plan (DNS revert within 1 hour, 24-hour window, fix-forward after 24 hours)

### Phase 5 — Post-Cutover Cleanup (Week 9+)
- Disable Glofox sync functions
- Remove API credentials
- Archive sync tables
- Switch member classification to Stripe subscription status
- Cancel Glofox subscription

---

## 3. Technical Approach

**Architecture:** Inngest (background job orchestration) + Supabase Postgres + Glofox REST API

**Sync strategy:**
- Inbound: polling with `utc_modified_start_date` filter for incremental sync; full reconciliation daily
- Outbound: event-driven (database change triggers Inngest event → Glofox API call)
- No webhooks (Glofox has none); polling only

**Conflict resolution:** Per-field ownership rules during transition; Glofox wins on financial data, last-modified wins on profile data, Meridian always wins on AI/segments fields

**Payments:** Stripe direct (not Connect); payment methods collected from members 2 weeks before cutover; subscriptions created with next billing date alignment

**Testing:** 229 existing tests must pass after schema migration; unit + integration tests for sync engine; integrity checks during shadow/parallel mode

---

## 4. Key Assumptions

1. Glofox API token and API key are available (currently an open question)
2. Glofox API rate limits are unknown (docs don't mention them)
3. The `has_more` pagination field exists in Glofox API responses (inferred from guide, not confirmed)
4. All 1,100 members will voluntarily re-enter payment methods in Meridian before cutover
5. Glofox API remains stable and available for 8+ weeks
6. Glofox will not revoke API access during the migration
7. Staff (unknown count) can be trained in 2 weeks (Weeks 5–6)
8. Sunday night is genuinely low-traffic (2-hour cutover window is sufficient)
9. Member-facing features (booking portal, app) will be ready by Week 7 (pre-cutover checklist item)
10. The Supabase branch/preview deploy is available for staging dry runs
11. DNS propagation is fast enough for the cutover sequence (23:00 step)
12. All 229 existing tests are passing today
13. Stripe merchant account setup is already done or nearly done
14. `glofox_id` on profiles table already exists (noted as checkmark in plan)
15. The analytics transactions endpoint returns enough data for full transaction history

---

## 5. Constraints and Dependencies

- **Glofox API access:** Granted but credentials not yet in hand
- **Glofox limitations:** No webhooks, no write endpoints for classes/schedules/membership plans, no direct payment processor access
- **Phase ordering:** Member-facing features (booking portal, iOS app) must be ready before cutover — but per CLAUDE.md, these are Phase 5 and have not started
- **Inngest:** Already in use for marketing/analytics cron jobs; Glofox sync adds 8 new functions
- **Stripe:** Already integrated; merchant account status unclear
- **Timeline:** 8-week window is aggressive given open questions on API credentials, rate limits, and member payment collection

---

## 6. Existing System Context

**Codebase:** Turborepo monorepo (Next.js 16 web app, Supabase package, shared types/utils)

**Tech stack confirmed:**
- Next.js 16.2.0 (React 19) on Netlify
- Supabase (Postgres + Auth + Realtime)
- Inngest 4.0.2 — already in production with 12 cron/event functions
- Stripe — integrated (src/lib/stripe.ts exists)
- Anthropic SDK 0.80.0 — integrated
- Resend — integrated (email campaigns)
- SMS — stubbed (Twilio provider exists but not production-ready)

**Existing Inngest functions (12 total):** executeFlow, evaluateTriggers, cronDailyMetrics, cronCohortRefresh, cronTrainerMetrics, cronAIInsights, cronReportScheduler, cronExportCleanup, cronPayrollReminder, cronInvoiceOverdue, cronContractExpiry, cronCorporateCredits

**Existing API routes:** bookings, members, classes, transactions, staff, leads, segments, campaigns, revenue, check-in, corporate, events, reports, orders, content, automations, and more

**Test suite:** Integration tests exist (src/__tests__/integration/) covering inngest-helpers, ai-endpoints, stripe-webhook-effects, auth-flow, api-bookings, supabase-crud. E2E tests via Playwright for all major modules. Plan references 229 tests.

**Schema patterns:** studio_id on every table (multi-tenant RLS), UUID primary keys, timestamptz for all timestamps

**Phase status per CLAUDE.md:** Phase 1 (core platform) complete. Phase 2 (Marketing) in progress. Phase 3 (Analytics) and Phase 4 (Corporate) partially built. Phase 5 (member-facing, iOS) not started. The pre-cutover checklist requires member-facing features to be ready — this is a significant dependency gap.

---

## 7. Success Criteria (from plan)

- Member count within 1% of Glofox after shadow mode
- All bookings from last 7 days present in both systems
- Transaction totals match within $1 per day
- Zero data corruption
- Staff fully trained and operational on Meridian
- All Stripe subscriptions created and verified
- Rollback drill completed successfully
- 14+ days parallel mode with zero integrity issues before cutover

---

## 8. Risks Called Out in Plan

| Risk | Likelihood | Impact |
|------|-----------|--------|
| Glofox API rate limiting | Medium | High |
| Payment gap during cutover | Low | Critical |
| Data conflict during parallel mode | High | Medium |
| Glofox API downtime | Low | Medium |
| Staff resistance | Medium | Medium |
| Member payment method collection | Medium | High |
| Glofox revokes API access | Low | Critical |
| Schema migration breaks existing features | Low | High |
