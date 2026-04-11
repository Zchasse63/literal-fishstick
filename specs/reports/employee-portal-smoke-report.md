# Employee Portal Smoke — Tier 2.11 Report

**Council Run:** Employee Portal Smoke (Tier 2.11) — **FINAL Tier 2 run**
**Date:** 2026-04-09
**Status:** ✅ PASSED — CLEAN
**Pipeline:** Analyst → Architect → Engineer → Sentinel → Healer (skipped) → Scribe

---

## Scope

Tier 2 baseline page-mount coverage for the Meridian Employee Portal.
This is the **first** Tier 2 smoke to run against the `employee`
Playwright project (trainer auth state) rather than the `admin`
project — and the **last** Tier 2 run overall, completing Tier 2 at
11/11.

### Routes Covered (9)

| # | Route | Priority | Test |
|---|---|---|---|
| 1 | `/employee` (home) | P0 | ✅ |
| 2 | `/employee/clock` (clock in/out) | P0 | ✅ |
| 3 | `/employee/timesheets` (pay period totals) | P0 | ✅ |
| 4 | `/employee/schedule` (weekly view) | P1 | ✅ |
| 5 | `/employee/classes` (instructor class list) | P1 | ✅ |
| 6 | `/employee/pay` (pay stubs + YTD + tax docs) | P1 | ✅ |
| 7 | `/employee/performance` (trainer metrics) | P1 | ✅ |
| 8 | `/employee/profile` (employee info) | P1 | ✅ |
| 9 | `/employee/promo` (referral code) | P1 | ✅ |

3 P0 + 6 P1 = **9 tests**, largest Tier 2 run after Analytics (2.7, 16 routes).

### Deferred (per QA Roadmap)

- Clock in/out writes → **Tier 7.1**
- Submit timesheet → **Tier 7.2**
- View pay / performance writes → **Tier 7.3** (read-only, but any
  future comment/acknowledgement flows)
- Update profile → **Tier 7.4**
- Generate promo code link → **Tier 7.5**
- View schedule writes → **Tier 7.6** (read-only tier entry)

---

## Test Results

### Primary Run
```
Running 11 tests using 1 worker
  ✓ auth-setup → create admin session (5.1s)
  ✓ auth-setup → create employee session (3.7s)
  ✓ /employee mounts @p0 (1.1s)
  ✓ /employee/clock mounts @p0 (3.9s)
  ✓ /employee/timesheets mounts @p0 (1.9s)
  ✓ /employee/schedule mounts @p1 (1.4s)
  ✓ /employee/classes mounts @p1 (1.9s)
  ✓ /employee/pay mounts @p1 (1.9s)
  ✓ /employee/performance mounts @p1 (2.2s)
  ✓ /employee/profile mounts @p1 (1.9s)
  ✓ /employee/promo mounts @p1 (1.9s)

  11 passed (33.9s)
```

**9/9 employee-portal tests passing on first run.** No failures, no
Healer iterations required.

### Flake Check (`--repeat-each=3`)
```
  29 passed (54.0s)
```

**0/27 flake.** Stable across all 3 repeats.

### Full Admin + Employee Regression
```
  80 passed (2.0m)
```

**80/80 tests passing** (62 admin + 9 new employee + 9 previous admin
smoke routes running in the admin regression — no overlap). No
regressions in either project.

---

## Files Modified

### Source (testid seeds)

| File | Testid Added |
|---|---|
| `apps/web/src/app/(employee)/employee/page.tsx` | `employee-home-page-root` |
| `apps/web/src/app/(employee)/employee/clock/page.tsx` | `employee-clock-page-root` |
| `apps/web/src/app/(employee)/employee/timesheets/page.tsx` | `employee-timesheets-page-root` |
| `apps/web/src/app/(employee)/employee/schedule/page.tsx` | `employee-schedule-page-root` |
| `apps/web/src/app/(employee)/employee/classes/page.tsx` | `employee-classes-page-root` |
| `apps/web/src/app/(employee)/employee/pay/page.tsx` | `employee-pay-page-root` |
| `apps/web/src/app/(employee)/employee/performance/page.tsx` | `employee-performance-page-root` |
| `apps/web/src/app/(employee)/employee/profile/page.tsx` | `employee-profile-page-root` |
| `apps/web/src/app/(employee)/employee/promo/page.tsx` | `employee-promo-page-root` |

**9 seeds, 9 unique testids.** Every seed went on the main default
exported component's return statement (post-loading-guard), on the
outer `<div className="space-y-6">` wrapper. After the Tier 2.9
lesson on multi-function files, I ran
`grep -n "^export default function\|^function [A-Z]"` against each
file BEFORE seeding to confirm function boundaries — only
`pay/page.tsx` had a helper component (`PayStubRow`), and all 9
default exports had a single clear main return.

### Tests (new)

- `apps/web/e2e/pages/EmployeePortalPage.ts` (93 lines) — POM with 9
  locators + 9 `expect*Mounted()` helpers.
- `apps/web/e2e/employee-portal.spec.ts` (100 lines, 9 tests) — smoke
  suite covering all 9 employee portal routes.

---

## Shell Landmark — Why Employee Differs From Admin

Every Tier 2 admin smoke uses `adminShellLandmark()` which targets the
sidebar's "Sign out" button (`aria-label="Sign out"`). The employee
portal has **no sign-out button** (BUG-003), so we cannot use the
same landmark.

Instead, `BasePage.employeeShellLandmark()` targets the "Employee
Portal" label in the header bar at `(employee)/layout.tsx:226`:

```tsx
<span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Employee Portal</span>
```

This label:
- Is rendered by the employee layout, so it's present on every
  employee page (not just home)
- Is unique to the employee layout (no admin page has this text)
- Is not gated by any loading state or async fetch
- Is not hidden behind any conditional rendering

When BUG-003 is fixed (employee portal gains a sign-out button), the
`employeeShellLandmark()` helper can be updated to use
`aria-label="Sign out"` and all employee smokes will remain green
with no source changes.

---

## Bugs Filed

**None.** All 9 employee portal routes render clean — no pageerrors,
no hydration issues, no 500s.

### Observations (informational, not blocking)

- **`/employee/clock` took ~3.9s on first cold compile** — the largest
  client component in the portal at 618 lines (clock hero card,
  break timer, GPS status, recent entries, employee list dropdown).
  Warm repeats stayed <1.5s. No HEAVY_TIMEOUT needed (within
  `ANIM_TIMEOUT` 10s budget even cold).
- **All 9 pages share an identical loading-guard pattern:**
  ```tsx
  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 ... /></div>
  }
  return (<div className="space-y-6">...</div>)
  ```
  The testid is seeded on the main return only. Since `loading`
  resolves from Supabase queries in ~1s, the main return is the
  one visible during smoke assertion. No dual-branch seeding needed
  here.
- **BUG-003 (employee portal missing logout)** remains unfixed but
  does not block this tier — documented in the POM as a landmark
  caveat.
- Pre-existing rate-limit RPC warning and middleware→proxy
  deprecation notice continue to fire. Unrelated to this tier.

---

## Shared Infrastructure Reuse

Consumed Tier 2 shared infra (`expectSmokeMount`, `employeeShellLandmark`,
`byTestId`, `ANIM_TIMEOUT`) without modification. The
`employeeShellLandmark()` helper — added to `BasePage` during Tier 2.1
in anticipation of this run — scaled cleanly to 9 routes on first try.

**Per-page effort:** ~1 testid + ~1 POM locator + ~1 POM helper + ~1 test.
Flat cost model held across all 11 Tier 2 runs.

---

## Tier 2 Final Stats

With Tier 2.11 complete, **Tier 2 is 11/11 DONE**:

| # | Feature | Routes | Tests | Healer? | Bugs | Duration |
|---|---|---|---|---|---|---|
| 2.1 | Command Center | 1 | 4 | 2 iter | BUG-005 | — |
| 2.2 | Schedule | 1 | 3 | — | none | — |
| 2.3 | Members | 2 | 4 | — | none | — |
| 2.4 | Revenue | 5 | 6 | — | none (1 polish obs) | — |
| 2.5 | Marketing | 5 | 5 | — | none | — |
| 2.6 | Corporate | 4 | 5 | — | none | — |
| 2.7 | Analytics | 16 | 16 | 1 iter (dev-mode) | none | — |
| 2.8 | Operations | 3 | 3 | — | none | — |
| 2.9 | Settings | 3 | 3 | 1 iter (seed) | none | — |
| 2.10 | Utility Pages | 3 | 3 | — | none | — |
| 2.11 | Employee Portal | 9 | 9 | — | none | — |
| **Total** | **11** | **52** | **61** | **3 iter** | **1 (BUG-005)** | — |

**61 Tier 2 tests** covering **52 routes** across the entire admin
dashboard + employee portal. Shared infrastructure from Tier 2.1
(`expectSmokeMount`, `adminShellLandmark`, `employeeShellLandmark`,
`byTestId`, `ANIM_TIMEOUT`) consumed by all 11 specs without
modification.

**Healer iterations: 3 total across 11 runs** (1 real infra race in
2.1, 1 dev-mode compile timeout in 2.7, 1 seed-placement error in
2.9). Only BUG-005 (command-center activity API returning 500) was a
real product bug surfaced by Tier 2 smokes.

---

## Conclusion

Tier 2.11 Employee Portal smoke is **complete and green**. 9 routes
covered by 9 tests, 0 flake, 80/80 combined admin+employee
regression. **Tier 2 is 100% complete — 11/11 council runs done.**

**Next:** Tier 3 (Core Studio Writes) — 12 council runs covering
Revenue + Members + Schedule write flows with DB assertions. This is
a significant shift from Tier 2's read-only smoke contract — tests
will now seed data, perform writes, assert DB state, and clean up.
The toast helper fix from Tier 0 and the `db.ts` parameterization
will both get exercised for real here.

**Roadmap status:** 14/61 → **15/61** complete. Tier 2 done,
Tier 3 starting.
