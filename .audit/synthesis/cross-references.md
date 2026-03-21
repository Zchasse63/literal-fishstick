# Cross-Reference Analysis: Corroborated Findings

**Synthesizer:** audit-synthesizer
**Completed:** 2026-03-20

This document tracks findings that were independently identified by multiple agents, increasing confidence.

---

## CR-001 — Automation `is_active` vs `status` Field Mismatch

**Corroborated by:** data-model, integration, user-flow, ai-layer (4 agents)

**Description:** The `automation_flows` table defines `is_active BOOLEAN DEFAULT FALSE` in the SQL schema, but `evaluate-triggers.ts` (Inngest) queries `.eq('status', 'active')`. This query will always return zero rows.

**Impact:** All automation flows (win-back, churn re-engagement, birthday, credit-expiry, etc.) silently never execute. Members are never enrolled. This is a complete failure of the marketing automation engine.

**Severity:** CRITICAL (confirmed across 4 independent layers)

---

## CR-002 — `members` vs `profiles` Table Split

**Corroborated by:** data-model, integration, security (3 agents)

**Description:** The Stripe webhook handler writes subscription events to `.from('members')`. The entire API layer reads from `.from('profiles')`. The churn prediction helper (`canEnrollMember`) also queries `.from('members')` for `membership_status`. If `members` and `profiles` are separate tables (not a view), Stripe subscription events write to a table that is never read by the UI.

**Impact:** Membership status shown in the admin UI would never update from Stripe events. Subscription cancellations, activations, and billing failures would be invisible. Revenue data in the dashboard would be stale.

**Severity:** CRITICAL

---

## CR-003 — STUDIO_ID Hardcoded Throughout Stack

**Corroborated by:** data-model, api-surface, integration, security, user-flow (5 agents)

**Description:** The string `'11111111-1111-1111-1111-111111111111'` appears in at least 15+ route handlers, Inngest functions, and AI routes. Multiple fallback patterns: `profile?.studio_id ?? STUDIO_ID`.

**Impact:** Multi-tenant SaaS deployment is currently impossible. All background jobs (Inngest) process only one hardcoded studio. Authentication bypass pattern: if profile lookup fails, user gets development studio data.

**Severity:** HIGH (currently single-tenant by design, but a blocker for Phase 5 / SaaS launch)

---

## CR-004 — No Centralized Auth Middleware

**Corroborated by:** api-surface, security, project-structure (3 agents)

**Description:** No `middleware.ts` exists. Auth is per-handler boilerplate. Any new route that omits the check is public.

**Impact:** Growing surface area risk as more routes are added for Phase 5.

**Severity:** HIGH

---

## CR-005 — Missing Role-Based Authorization

**Corroborated by:** api-surface, security, user-flow (3 agents)

**Description:** Only `campaigns/route.ts` checks roles. ~119 other admin endpoints check only authentication.

**Impact:** A member-role account can read all revenue, payroll, and member data.

**Severity:** HIGH

---

## CR-006 — Mock Data on Production Admin Pages

**Corroborated by:** ui-ux, user-flow (2 agents)

**Description:** Marketing overview and analytics overview pages render hardcoded TypeScript data arrays as live data. Admins see fabricated campaign performance and KPI numbers.

**Impact:** Incorrect business decisions based on fake data. No indication that data is mocked.

**Severity:** HIGH

---

## CR-007 — Employee Clock Badge Disconnected from API

**Corroborated by:** ui-ux, user-flow (2 agents)

**Description:** The employee layout header's clock status badge uses `useState(true)` locally. Toggling it fires no API call. Actual clock entries require navigating to `/employee/clock`.

**Impact:** Employees believe they have clocked in/out but have not. Payroll data is incorrect.

**Severity:** HIGH

---

## CR-008 — Credit Pack Field Name Mismatch (`remaining` vs `credits_remaining`)

**Corroborated by:** data-model, ai-layer (2 agents)

**Description:** The churn prediction route queries `credit_packs` with `.select('remaining')`. The TypeScript type defines `credits_remaining`. This silently returns null/0 for all members' credit data.

**Impact:** All churn predictions receive corrupted input — credits_remaining = 0 and credits_expiring_soon = false for every member. AI churn outputs are systematically incorrect.

**Severity:** CRITICAL

---

## CR-009 — Zero Test Coverage

**Corroborated by:** testing-quality, project-structure, performance-infra (3 agents)

**Description:** No unit, integration, or E2E tests exist in the application. No test runner is installed. No CI pipeline runs checks.

**Impact:** Regressions in financial flows, RLS isolation, and AI parsing go undetected.

**Severity:** CRITICAL (no automated safety net for any functionality)

---

## CR-010 — RLS `app.studio_id` Session Variable Not Set

**Corroborated by:** security, data-model (2 agents)

**Description:** Phase 2 RLS policies use `current_setting('app.studio_id')::uuid`. No code was found that sets this Postgres session variable. Without it, RLS policies fail or use null, potentially not isolating studio data.

**Impact:** Phase 2 table data (campaigns, automation, leads, content) may be accessible cross-studio or may return empty results for all queries.

**Severity:** CRITICAL

---

## CR-011 — No Rate Limiting on AI or Public Endpoints

**Corroborated by:** api-surface, security, performance-infra (3 agents)

**Description:** 13 AI Claude endpoints and the public `/api/leads/capture` endpoint have no rate limiting.

**Impact:** AI endpoints can be abused to generate Anthropic API costs. Public lead capture can be spammed.

**Severity:** HIGH

---

## Finding Count by Severity (Pre-Dedup)

| Layer | CRITICAL | HIGH | MEDIUM | LOW | INFO |
|-------|----------|------|--------|-----|------|
| project-structure | 0 | 0 | 3 | 2 | 2 |
| data-model | 2 | 2 | 3 | 2 | 1 |
| api-surface | 0 | 3 | 3 | 2 | 1 |
| testing-quality | 2 | 2 | 2 | 1 | 0 |
| ui-ux | 0 | 2 | 3 | 2 | 1 |
| user-flow | 0 | 2 | 3 | 2 | 0 |
| ai-layer | 1 | 2 | 3 | 2 | 1 |
| integration | 1 | 3 | 2 | 2 | 0 |
| security | 1 | 3 | 3 | 2 | 1 |
| performance-infra | 0 | 2 | 3 | 2 | 1 |
| **Total (raw)** | **7** | **21** | **28** | **19** | **8** |
| **After dedup** | **5** | **10** | **15** | **12** | **6** |
