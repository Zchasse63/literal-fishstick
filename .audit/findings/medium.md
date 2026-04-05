# Medium Findings

**Generated:** 2026-04-05
**Deduplicated and cross-referenced from 10 layer audit reports.**

---

## MED-001: cron-member-enrichment loads all bookings into JavaScript memory

**IDs:** DM-005, PERF-001
**Corroborated by:** data-model, performance-infra (2/10 layers)

Full table fetch of all `attended=true` bookings in memory. At scale (100,000+ rows), this will exceed serverless memory limits or cause timeouts.

**Fix:** Replace with a Postgres `GROUP BY` aggregate: `SELECT member_id, COUNT(*), MAX(checked_in_at) FROM bookings WHERE studio_id=? AND attended=true GROUP BY member_id`

---

## MED-002: MRR calculation silently excludes members with unmapped plan codes

**ID:** DM-006
**Layer:** data-model

`SUM(plan_price) WHERE membership_status='active'` skips members where `plan_price IS NULL`. With 20 plan mappings, some Glofox plan codes may not be mapped.

**Fix:** Query for unmapped active members. Add missing entries to `glofox_plan_map`.

---

## MED-003: Profiles-Members split creates inconsistent data access patterns

**ID:** DM-007
**Layer:** data-model

Different routes access member data via `profiles`, `members`, or the `member_360` view. Edge cases exist for users with a profile but no members row.

**Fix:** Standardize on `member_360` view or `profiles LEFT JOIN members` pattern across all routes.

---

## MED-004: Zod validation inconsistently applied — only 4 schemas for 150 routes

**ID:** SEC-007
**Layer:** security

4 Zod schemas exist; remaining 140+ POST/PUT routes use ad-hoc if-checks. Unexpected input shapes can cause DB errors or logic bugs.

**Fix:** Extend Zod validation to all state-mutating routes (POST/PUT/DELETE). Prioritize: members, campaigns, automations, leads.

---

## MED-005: getStudioId() utility fails-open with DEFAULT_STUDIO_ID

**ID:** SEC-004
**Layer:** security

The `getStudioId()` helper returns `DEFAULT_STUDIO_ID` if `studio_id` is null on the profile — fail-open behavior. This becomes a multi-tenancy security hole at Phase 4.

**Fix:** Add a `required` flag to `getStudioId()` that returns null/throws instead of falling back. Migrate all routes per MED-008.

---

## MED-006: EasyPost webhook may lack signature verification

**ID:** AS-007, SEC-005
**Corroborated by:** api-surface, security (2/10 layers)

The EasyPost webhook directory exists. Stripe and Resend webhooks have explicit HMAC verification. EasyPost verification was not confirmed.

**Fix:** Implement EasyPost HMAC-SHA256 signature verification.

---

## MED-007: RLS policies not actively enforced for server-side clients

**ID:** INT-003
**Layer:** integration

Phase 2 RLS policies use `current_setting('app.studio_id')::uuid` but server-side clients never set this. All isolation relies on manual `WHERE studio_id = ?` clauses.

**Fix:** Document that current RLS policies are not the actual enforcement boundary. Plan RLS rewrite for Phase 5 using `auth.uid()`.

---

## MED-008: CSP uses 'unsafe-inline' and 'unsafe-eval' for script-src

**ID:** SEC-006
**Layer:** security

These flags significantly weaken XSS protections. They may be required by React/Stripe but should be reviewed after Next.js 16 / React 19 upgrade.

**Fix:** Evaluate if `unsafe-eval` can be removed. Move toward nonce-based CSP where possible.

---

## MED-009: Admin layout is a client component — limits RSC conversion benefits

**IDs:** PS-001, UX-003
**Corroborated by:** project-structure, ui-ux (2/10 layers)

`(admin)/layout.tsx` is `'use client'` which makes it the client boundary root for all 32 admin pages. RSC-converted page.tsx files gain only partial benefit.

**Fix:** Extract `AdminShell` client component for interactive parts (sidebar toggle, keyboard shortcuts). Make the layout itself a server component.

---

## MED-010: Automation cooldown check has race condition for parallel flows

**ID:** INT-004
**Layer:** integration

Two flows triggering simultaneously for the same member could both pass the cooldown check before either inserts the cooldown record.

**Fix:** Move cooldown enforcement to `execute-flow` step with atomic upsert (`ON CONFLICT DO NOTHING`).

---

## MED-011: Not all AI modules use withRetry() wrapper

**ID:** AI-004
**Layer:** ai-layer

Some AI modules call `anthropic.messages.create()` directly, not via `withRetry()`. They throw immediately on 429 rate limit.

**Fix:** Audit all 22 modules for direct `messages.create()` calls. Wrap in `withRetry()`.

---

## MED-012: AI briefing imports from deprecated lib/anthropic.ts

**ID:** AI-005
**Layer:** ai-layer

The briefing API route imports from `@/lib/anthropic` instead of `@/lib/ai/briefing`. This means two Anthropic client singletons may exist.

**Fix:** Remove `lib/anthropic.ts`. Update briefing route to import from `@/lib/ai/briefing`.

---

## MED-013: Glofox client has zero tests after 15-method rewrite

**ID:** TQ-004
**Layer:** testing-quality

906 lines across 50+ methods, zero unit tests. 15 methods were recently rewritten.

**Fix:** Add unit tests for the 15 corrected methods using the existing `mock-glofox.ts` helper.

---

## MED-014: Coverage thresholds at 30% — far below industry standard

**ID:** TQ-005
**Layer:** testing-quality

Coverage thresholds (30% branches/functions/lines) are below the minimum recommended for a financial/member-data platform.

**Fix:** Raise to 50% near-term, 70% by Phase 2 completion. Prioritize auth layer and payment routes.

---

## MED-015: Executive dashboard fetches all data client-side despite RSC pattern

**IDs:** UX-002, PERF-004
**Corroborated by:** ui-ux, performance-infra (2/10 layers)

`ExecutiveDashboardClient` handles all data fetching because of a misunderstanding about RSC capabilities. All 4+ API calls execute in the browser sequentially.

**Fix:** Move data fetching to RSC page layer using direct Supabase calls. Pass as props.

---

## MED-016: Campaign recipient count doesn't account for unsubscribed/bounced members

**ID:** UX-005, UF (user flow)
**Layer:** ui-ux

Campaign wizard shows segment count; actual delivered count is lower after filtering `email_preferences`. Users see misleading recipient numbers.

**Fix:** Query `email_preferences` when displaying recipient count in the campaign wizard.
