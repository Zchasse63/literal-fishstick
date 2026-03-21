# Meridian Codebase Audit — Executive Summary

**Audit completed:** 2026-03-20
**Codebase:** `/Users/zach/Desktop/literal-fishstick`
**Primary language:** TypeScript (Next.js 16, React 19, Supabase, Inngest, Stripe)
**Scale:** ~45,000 lines, ~120 API routes, ~45 pages, 13 AI functions, 12 Inngest jobs
**Phases complete:** 1–4 (admin dashboard + employee portal)
**Phase 5 readiness:** Not yet ready — 6 critical issues must be resolved first

---

## Architecture Health Score

**Overall: 62 / 100**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Architecture / Structure | 82 | Clean monorepo, well-organized route groups, strong type system |
| Data Model | 55 | Well-designed schema, but 3 critical runtime bugs (field mismatches, table split) |
| API Design | 60 | Consistent patterns, but no auth middleware and minimal role authorization |
| Testing & Quality | 10 | Zero application tests, no CI, no test infrastructure |
| Security | 58 | Strong auth foundation, critical RLS and authorization gaps |
| AI Integration | 65 | Sophisticated architecture with good fallbacks, corrupted inputs on churn |
| Frontend / UX | 68 | Polished design system, significant mock data and disconnect issues |
| Infrastructure | 70 | Clean Netlify + Inngest setup, missing production configs |

---

## Summary of Findings

| Severity | Count | Immediate Action Required |
|----------|-------|--------------------------|
| CRITICAL | 6 | Yes — several break core functionality today |
| HIGH | 10 | Yes — required before Phase 5 |
| MEDIUM | 15 | Yes — required before SaaS launch |
| LOW | 15 | Before Phase 5 |
| INFO | 6 | No action required |
| **Total** | **52** | |

---

## Critical Issues (Must Fix Now)

These issues cause active functional failures. Some are breaking the platform today.

### CRIT-001 — Automation Engine Is Completely Broken

The entire Inngest automation engine — all 12 trigger types — silently does nothing.

**Root cause:** `evaluate-triggers.ts` queries `.eq('status', 'active')` but the `automation_flows` SQL schema defines the field as `is_active BOOLEAN`. The query returns 0 flows every time it runs.

**Fix (1 line):** Change `.eq('status', 'active')` to `.eq('is_active', true)`.

The marketing automation module (win-back sequences, churn re-engagement, birthday flows, credit-expiry reminders) has never executed a single automation step.

---

### CRIT-002 — Stripe Subscriptions Write to Wrong Table

The Stripe webhook writes subscription status updates to `.from('members')`. The entire UI reads from `.from('profiles')`. These appear to be separate tables.

**Impact:** Membership status in the admin dashboard has never updated from a Stripe event. Every subscription activation, cancellation, and payment failure has been invisible to the UI since day one.

**Fix:** Verify whether `members` is a separate table or a view of `profiles`. If separate, migrate the Stripe webhook to update `profiles.membership_status` instead.

---

### CRIT-003 — All Churn Predictions Are Corrupted

Every churn prediction Claude generates is based on incorrect credit data. The query uses `.select('remaining')` but the column is `credits_remaining`. Supabase returns null, meaning every member appears to have zero credits and no expiring credits.

**Fix (1 line):** Change `.select('remaining')` to `.select('credits_remaining')`. Then clear the `ai_cache` table entries where `cache_type = 'churn_narrative'`.

---

### CRIT-004 — Phase 2 RLS Policies Likely Not Enforced

Phase 2 tables (campaigns, automations, leads, content, email preferences) use RLS policies that require `app.studio_id` to be set as a Postgres session variable. No code sets this variable. Either all Phase 2 table queries fail silently or data isolation is not enforced.

**Fix:** Either (a) rewrite RLS policies to use `auth.uid()` + a studio membership lookup, which is Supabase's standard pattern, or (b) add session variable injection to the server Supabase client. Verify with integration tests.

---

### CRIT-005 — Automation Cooldowns Schema Mismatch

The `automation_cooldowns` SQL table has two timestamp columns (`last_automation_email_at`, `last_automation_sms_at`). The `checkAutomationCooldown()` and `updateCooldown()` Inngest helper functions query with `.eq('channel', channel)` expecting a `channel` TEXT column that does not exist. Every cooldown check will fail.

**Fix:** Add `channel TEXT NOT NULL` and a `last_sent_at TIMESTAMPTZ` column to `automation_cooldowns`, and a UNIQUE constraint on `(member_id, studio_id, channel)`. Or rewrite helpers to use the two-timestamp schema.

---

### CRIT-006 — Zero Test Coverage on Financial and Security Paths

No automated tests exist for the Stripe webhook, booking capacity enforcement, RLS isolation, or role authorization. No CI pipeline.

**Impact:** Any regression in payment processing, membership management, or access control reaches production silently.

**Minimum viable test plan:** (1) Stripe webhook subscription lifecycle tests, (2) concurrent booking capacity tests, (3) RLS cross-tenant isolation integration tests, (4) role-based API authorization tests.

---

## High Priority Issues (Required Before Phase 5)

### Auth & Security
- **No centralized `middleware.ts`** — any new route handler that omits the auth boilerplate is publicly accessible (HIGH-001)
- **~95% of admin endpoints lack role-based authorization** — any authenticated member-role account can read revenue, payroll, and modify any member record (HIGH-002)
- **No rate limiting** on 13 AI endpoints (monetary cost attack) or public lead capture (spam) (HIGH-003)

### UI / Data Integrity
- **Mock data on production admin pages** — Marketing and Analytics pages display hardcoded data as if it were live (HIGH-004)
- **Employee clock badge disconnected from DB** — employees see visual feedback but no timesheet entry is created (HIGH-005)

### Infrastructure
- **Campaign sends fail for large lists** — no chunking logic for >100 recipients (HIGH-006)
- **Netlify 26s timeout risk** for Inngest step functions during `evaluate-triggers` with many flows (HIGH-007)

### Integration Hygiene
- **JSON.parse() without try/catch** in AI insight generator — malformed Claude response crashes the route handler (HIGH-010)
- **`FROM` email hardcoded** to `noreply@thesaunaguys.com` — cannot be used as SaaS without making this a settings field (HIGH-009)

---

## What Is Working Well

Despite the critical findings, Meridian has a genuinely strong foundation:

**Architecture strengths:**
- Clean Turborepo monorepo with `@meridian/types` as the single source of truth — all future surfaces (iOS, web portal) inherit correct type contracts
- Next.js App Router route group pattern cleanly separates admin, employee, and auth surfaces
- All 13 AI functions have rules-based fallbacks — the platform degrades gracefully without an API key

**Data model strengths:**
- Phase 2 SQL migration is well-structured with proper transactions, indexed queries, and a GDPR deletion function
- The single `profiles` table with a `roles TEXT[]` column elegantly solves the dual-role account problem (admin + member, trainer + member)
- Automation flow versioning and immutable `flow_snapshot` on enrollment are production-grade design decisions

**Integration strengths:**
- Stripe and Resend webhook signature verification is correctly implemented
- The SMS abstraction layer (`StubProvider` / `TwilioProvider`) is provider-agnostic and swap-ready
- Inngest's built-in step chunking and retry queues handle background job reliability correctly (once the `is_active` bug is fixed)
- Resend's `sendBatchEmails()` implementation correctly sets `Message-ID` headers for reply threading and campaign attribution

**AI layer strengths:**
- Fingerprint-based dedup in `insights-generator.ts` prevents redundant AI results
- Per-function caching in `ai_briefings` and `ai_cache` tables with configurable TTLs
- Typed input/output contracts for every AI function enable safe fallback behavior

**Design system:**
- Consistent use of the Meridian design tokens (indigo-600, amber, emerald, coral) throughout
- framer-motion spring animations are tasteful and consistent
- shadcn/ui primitives are used correctly and the component library is solid

---

## Phase 5 Readiness Assessment

Meridian is **not yet ready for Phase 5** (member-facing web portal, iOS app). The following are blockers:

| Blocker | Required Action |
|---------|----------------|
| CRIT-001 Automation engine broken | Fix `is_active` query |
| CRIT-002 Stripe table split | Reconcile `members` vs `profiles` |
| CRIT-003 Corrupted churn predictions | Fix `credits_remaining` column name |
| CRIT-004 RLS not enforced | Implement correct RLS pattern |
| HIGH-001 No auth middleware | Add `middleware.ts` |
| HIGH-002 No role authorization | Add role checks to all admin endpoints |
| HIGH-003 No rate limiting | Add rate limiting before public AI exposure |
| HIGH-004 Mock data in production | Wire Marketing and Analytics to real APIs |
| HIGH-005 Clock badge disconnected | Wire to `/api/clock` |
| CRIT-006 No test coverage | Minimum viable test suite for critical paths |

**Estimated pre-Phase-5 effort:** The 6 critical fixes are largely targeted (some are 1–5 line changes plus schema migrations). The high-priority items (auth middleware, role authorization, test infrastructure) represent a meaningful sprint (2–4 weeks) but are straightforward to implement given the clean architecture.

---

## Recommended Prioritization

### Sprint 1: Fix the Broken Pipes (1–3 days)

1. Fix `evaluate-triggers.ts` `.eq('status', 'active')` → `.eq('is_active', true)` — 1 line
2. Verify/fix `members` vs `profiles` table confusion in Stripe webhook — investigation required
3. Fix `credit_packs` column name in churn prediction route — 1 line
4. Reconcile `automation_cooldowns` schema vs helpers — schema migration

### Sprint 2: Security and Authorization (1–2 weeks)

5. Add `middleware.ts` to protect all `/api/*` routes
6. Create `requireRole(roles)` middleware helper and apply to all admin endpoints
7. Add rate limiting to AI endpoints and public lead capture
8. Investigate and fix RLS `app.studio_id` session variable issue

### Sprint 3: UI Integrity (1 week)

9. Wire Marketing and Analytics pages to real API data
10. Wire employee clock badge to `/api/clock`
11. Wire sidebar user identity to `AuthContext`

### Sprint 4: Test Infrastructure (2 weeks)

12. Install Vitest, write critical path tests (Stripe webhook, capacity, RLS, role auth)
13. Set up GitHub Actions CI
14. Add `type-check` to build pipeline

### Sprint 5: Pre-Phase-5 Polish (1 week)

15. Add `netlify.toml`
16. Implement campaign send chunking
17. Add Zod validation to POST endpoints
18. Fix sidebar shortcut collision
19. Create member deep-link URLs (`/members/[id]`)

---

## Files Produced by This Audit

- `/Users/zach/Desktop/literal-fishstick/.audit/layers/` — 10 detailed layer reports
- `/Users/zach/Desktop/literal-fishstick/.audit/diagrams/` — 10 Mermaid diagram files
- `/Users/zach/Desktop/literal-fishstick/.audit/synthesis/cross-references.md` — 11 cross-layer corroborations
- `/Users/zach/Desktop/literal-fishstick/.audit/synthesis/contradictions.md` — 5 agent disagreements resolved
- `/Users/zach/Desktop/literal-fishstick/.audit/synthesis/gaps.md` — 10 coverage gaps identified
- `/Users/zach/Desktop/literal-fishstick/.audit/findings/critical.md` — 6 critical findings with fixes
- `/Users/zach/Desktop/literal-fishstick/.audit/findings/high.md` — 10 high findings
- `/Users/zach/Desktop/literal-fishstick/.audit/findings/medium.md` — 15 medium findings
- `/Users/zach/Desktop/literal-fishstick/.audit/findings/low-info.md` — 21 low/info findings
- `/Users/zach/Desktop/literal-fishstick/.audit/AUDIT-SUMMARY.md` — this document
