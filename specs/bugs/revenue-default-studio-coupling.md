# BUG — Admin pages hardcode `DEFAULT_STUDIO_ID` instead of reading the authenticated user's `studio_id`

**Status:** Open — architectural, not regression
**Severity:** High (blocks multi-tenant operation AND blocks meaningful E2E testing of ~43 admin pages)
**Discovered by:** QA pipeline pilot (`/qa-council login`) during Record Payment exploration
**Date:** 2026-04-09
**Related:** `specs/features/login-spec.md` §8 (Clarification log, CL-1)

---

## Summary

Forty-three admin UI files hardcode `DEFAULT_STUDIO_ID` (value: `11111111-1111-1111-1111-111111111111`) as a studio filter in Supabase queries instead of reading the authenticated user's `profiles.studio_id`. This means:

1. The admin UI is effectively single-tenant at the application layer, even though the database is multi-tenant with RLS.
2. E2E tests that seed rows into `TEST_STUDIO_ID` (`00000000-0000-4000-a000-000000000000`) cannot exercise write flows on admin pages, because the UI queries `WHERE studio_id = DEFAULT_STUDIO_ID` and never sees the test data.
3. The pilot run of the QA pipeline originally targeted Record Payment in the Revenue module and had to pivot to the Login feature because of this bug. Login has no studio coupling, so it is the only admin-adjacent feature that can be tested end-to-end right now.

The issue is not a regression — it was baked in during Phase 1 development, presumably as a shortcut because the app was built for a single customer (The Sauna Guys) and multi-tenancy is not yet exercised in production. It becomes a blocker the moment a second studio signs up.

## Evidence

### The constant

`apps/web/src/lib/constants.ts:10`
```typescript
export const DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'
```

### Primary offenders (Revenue module, verified by hand)

**`apps/web/src/app/(admin)/revenue/page.tsx`**
- Line 46: `import { DEFAULT_STUDIO_ID } from '@/lib/constants'`
- Line 56: `const STUDIO_ID = DEFAULT_STUDIO_ID` (module-level alias)
- `STUDIO_ID` is referenced **12 times** in this file, filtering transactions, memberships, revenue charts, and MRR queries.

**`apps/web/src/app/(admin)/revenue/_components/RecordPaymentModal.tsx`**
- Line 17: `import { DEFAULT_STUDIO_ID } from '@/lib/constants'`
- Line 81: `.eq('studio_id', DEFAULT_STUDIO_ID)` — member search lookup for the payment form.
- **Consequence:** A test user seeded into `TEST_STUDIO_ID` will not appear in the Record Payment member search. Even a read-only "admin sees N transactions" scenario would hit the wrong studio.

### Full scope (43 files)

```
$ grep -rln DEFAULT_STUDIO_ID apps/web/src/app/(admin)
```

| Module | Files |
|---|---|
| Revenue | `revenue/page.tsx`, `revenue/_components/RecordPaymentModal.tsx`, `revenue/orders/page.tsx`, `revenue/products/page.tsx`, `revenue/products/[id]/page.tsx`, `revenue/products/new/page.tsx` |
| Marketing | `marketing/page.tsx`, `marketing/campaigns/page.tsx`, `marketing/campaigns/new/page.tsx`, `marketing/campaigns/[id]/page.tsx`, `marketing/campaigns/[id]/report/page.tsx`, `marketing/automations/page.tsx`, `marketing/content/page.tsx`, `marketing/leads/page.tsx`, `marketing/leads/[id]/page.tsx` |
| Analytics | `analytics/kpi/page.tsx`, `analytics/pricing/page.tsx`, `analytics/pricing/new/page.tsx`, `analytics/pricing/[id]/page.tsx`, `analytics/reports/page.tsx`, `analytics/reports/[id]/page.tsx`, `analytics/trainers/page.tsx`, `analytics/trainers/[id]/page.tsx`, `analytics/migration/page.tsx`, `analytics/migration/_components/MigrationClient.tsx`, `analytics/dashboards/executive/page.tsx`, `analytics/dashboards/growth/page.tsx`, `analytics/dashboards/operations/page.tsx` |
| Members | `members/page.tsx`, `members/[id]/page.tsx` |
| Schedule | `schedule/_components/ClassFormModal.tsx` |
| Corporate | `corporate/page.tsx`, `corporate/[id]/page.tsx`, `corporate/[id]/_components/CompanyDetailClient.tsx`, `corporate/events/page.tsx`, `corporate/events/[id]/page.tsx` |
| Operations | `operations/page.tsx`, `operations/documents/page.tsx`, `operations/payroll/page.tsx` |
| Command Center | `page.tsx` (the `/` root admin dashboard) |
| Segments | `segments/page.tsx` |
| Engagement | `engagement/page.tsx` |
| Settings | `settings/geofence/page.tsx` |

**Total: 43 files.**

## Impact

### On the product

- **Multi-tenancy is broken at the UI layer.** As soon as Meridian has a second studio, the admin UI will show studio 1's data to studio 2's users (or vice versa, depending on who logs in). RLS protects the database, but the hardcoded `.eq('studio_id', DEFAULT_STUDIO_ID)` filter bypasses whatever RLS would otherwise do for us — the query returns nothing for anyone whose rows live under a different studio_id.
- **The "SaaS sellability" pillar of the roadmap is blocked** until this is fixed. Onboarding a second customer requires every one of those 43 files to read the authenticated user's `studio_id` from their profile.
- **The fix is not reversible-at-runtime.** Each file needs an edit. There is no feature flag or config knob that turns this off.

### On the QA pipeline

- **Write-flow E2E testing of admin pages is impossible without the fix.** Every test that seeds a row into `TEST_STUDIO_ID` and then expects the admin UI to display it will fail — the UI queries `DEFAULT_STUDIO_ID` and sees nothing.
- **The pilot had to pivot.** The original pilot target was Record Payment. We pivoted to Login, which has no studio coupling, and wrote 8 passing tests. The next write-flow pilot (once this bug is fixed) can run against Record Payment.
- **Read-only admin tests (e.g., "page loads", "nav renders") are unaffected** because they don't depend on test-seeded data. The existing `command-center.spec.ts`, `revenue.spec.ts` etc. smoke tests pass against the real production-like `DEFAULT_STUDIO_ID` rows.

## Suggested fix

Replace the hardcoded import with a session-derived studio ID. The authenticated user's `studio_id` lives on their `profiles` row and is already fetched by the login flow. Options:

### Option A — Thread `studio_id` through a layout/context (recommended)

1. Create a server-component hook or helper (e.g., `getCurrentStudioId()`) that reads the Supabase session, queries `profiles.studio_id`, and returns it.
2. In `(admin)/layout.tsx`, resolve the studio ID once and inject it into a React context (`StudioContext`).
3. Replace each `DEFAULT_STUDIO_ID` usage with `useStudio()` (client components) or the server-side helper (server components).
4. Delete the `DEFAULT_STUDIO_ID` export from `apps/web/src/lib/constants.ts` to prevent regression.

This is a single-pass refactor — one new hook, one new context provider, 43 file edits (mechanical find-replace), one export removal.

### Option B — Per-page fetch

Each page fetches `studio_id` itself. Simpler to reason about but adds 43 duplicate queries. Not recommended.

### Option C — Middleware injection via headers

The `proxy`/middleware file sets an `x-studio-id` header on every admin request. Pages read it via `headers().get('x-studio-id')`. Works for server components but is awkward for client components. Not recommended.

## Out of scope for this bug doc

- Whether RLS policies on Postgres are correctly scoped. They're separate — RLS protects the DB; this bug is about the UI layer sending the wrong filter.
- Whether `DEFAULT_STUDIO_ID` is also used in API routes or background jobs. A follow-up audit should run `grep -rn DEFAULT_STUDIO_ID apps/web/src` to catch non-page usages.
- The 43-file edit itself. This doc documents the problem; the fix is a separate work stream.

## Verification plan (once fixed)

1. Run `grep -rn DEFAULT_STUDIO_ID apps/web/src/app/\(admin\)` — should return zero matches.
2. Re-run `/qa-council record-payment` — the pilot should be able to seed a test member into `TEST_STUDIO_ID`, open Record Payment, see that member in the search, submit a $50 transaction, and verify the row in Postgres.
3. Manually log in as a second studio's user (when multi-tenant demo data exists) and confirm they see their own data, not `DEFAULT_STUDIO_ID`'s.

## References

- `apps/web/src/lib/constants.ts:10` — where the constant lives
- `apps/web/src/app/(admin)/revenue/page.tsx:46,56` — primary example
- `apps/web/src/app/(admin)/revenue/_components/RecordPaymentModal.tsx:17,81` — the blocker for the Record Payment pilot
- `specs/features/login-spec.md` §8 CL-1 — original pivot explanation
- `specs/plans/login-plan.md` §1 — pilot context
