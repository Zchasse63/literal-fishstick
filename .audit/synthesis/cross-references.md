# Cross-Reference Analysis

**Generated:** 2026-04-05
**Source layers:** 10 (project-structure, data-model, api-surface, testing-quality, ui-ux, user-flow, ai-layer, integration, security, performance-infra)

---

## Method

Each finding was compared against all other layer reports. A finding is "corroborated" when 2+ independent agents identified the same root cause from different angles.

---

## Corroborated Findings (Multiple Layers Agree)

### XR-001: daily_metrics revenue data is wrong — corroborated by 5 layers

**Corroborating agents:** data-model, user-flow, ui-ux, ai-layer, performance-infra

Every layer that touches revenue data independently identified this issue:
- **data-model (DM-001):** The cron will not re-aggregate historical rows after a transaction backfill
- **user-flow (UF-001):** The Command Center — the first screen the owner sees — shows wrong revenue
- **ui-ux (UX-002):** The executive dashboard fetches this same wrong data via API
- **ai-layer (AI-002):** The AI briefing's revenue context is wrong, making AI recommendations incorrect
- **performance-infra (PERF-003):** 60-second polling actively refreshes wrong data

**Combined severity:** CRITICAL. Not only is the data wrong, but it is actively presented on 4+ surfaces and fed into AI reasoning.

---

### XR-002: automation_flows CHECK constraint blocks 6 new trigger types — code/schema divergence

**Corroborating agents:** data-model, user-flow, testing-quality

- **data-model (DM-003):** The schema CHECK constraint lists only 12 trigger types; 6 new ones added to code
- **user-flow (UF-002):** The create automation flow UI lets users select these types; saving fails silently
- **testing-quality (TQ-002):** The 6 new trigger types in `evaluate-triggers.ts` also have no tests

**Pattern:** A new feature (6 trigger types) was added to the Inngest evaluation code and the UI dropdown but not propagated to: (1) the database schema, (2) the test suite. Classic "backend added, schema not updated" failure.

---

### XR-003: Rate limiter is ineffective — corroborated by 3 layers

**Corroborating agents:** api-surface, security, performance-infra

- **api-surface (AS-001):** Returns in-memory result immediately; async Supabase update never read back
- **security (SEC-002):** Creates AI cost exposure when combined with 10 unrated AI routes
- **performance-infra:** Each serverless instance maintains separate counter

**Pattern:** The rate limiter was added as a protection measure but its implementation does not achieve distributed rate limiting in a serverless environment. This is a known-wrong implementation.

---

### XR-004: credit_packs table is empty — corroborated by 3 layers

**Corroborating agents:** data-model, user-flow, integration

- **data-model (DM-002):** `credit_packs` table never populated; `getCredits()` method never called
- **user-flow (UF-003):** Member detail page's Credits tab always shows empty
- **integration (INT-001):** Backfill code exists in `glofox-backfill.ts` step 6 but was never triggered successfully

**Pattern:** The feature was built (transformers exist, backfill step exists, member detail UI shows credits) but the data pipeline was never run end-to-end. The `credit_expiry` automation trigger is therefore permanently unable to fire.

---

### XR-005: DEFAULT_STUDIO_ID fallback is a multi-tenancy anti-pattern — corroborated by 3 layers

**Corroborating agents:** api-surface, security, user-flow

- **api-surface (AS-006):** Routes use `DEFAULT_STUDIO_ID` fallback for null `studio_id`
- **security (SEC-004):** `getStudioId()` function fails-open, not fail-closed
- **user-flow:** Campaign send uses this fallback

**Pattern:** Consistent use of `DEFAULT_STUDIO_ID` as a fallback was appropriate during single-tenant development but is a known pre-SaaS debt item that must be resolved before Phase 4.

---

### XR-006: Integration tests disabled — corroborated by 2 layers

**Corroborating agents:** testing-quality, performance-infra

- **testing-quality (TQ-003):** Integration tests never run in CI — 6 test files exist but are disabled
- **performance-infra (PERF-006):** No query performance regression detection as a result

**Pattern:** The infrastructure for integration tests exists (test files, helper factories, integration vitest config) but a Supabase test project was never provisioned. MED-27 is an open ticket. This gap means data layer bugs and performance regressions are caught only in production.

---

### XR-007: Missing composite indexes — corroborated by 2 layers

**Corroborating agents:** data-model, performance-infra

Both the data-model agent (DM-004) and the performance-infra agent (PERF-002) independently identified the same 3 missing indexes on `bookings`, `transactions`, and `profiles`. These queries are called daily (or every 10 minutes for trigger evaluation) and will degrade at multi-tenant scale.

---

### XR-008: AI layer receives stale or incorrect inputs — corroborated by 2 layers

**Corroborating agents:** ai-layer, data-model

- **ai-layer (AI-002):** AI briefing and churn prediction may receive stale visit data
- **data-model (DM-001):** Revenue data fed to AI briefing comes from `daily_metrics` which is wrong

**Combined effect:** The AI features are producing insights based on incorrect and potentially stale data. This undermines trust in the AI layer — recommendations may be confidently wrong.
