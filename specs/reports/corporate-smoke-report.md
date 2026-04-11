# Corporate Smoke — Tier 2.6 Report

**Council Run:** Corporate Smoke (Tier 2.6)
**Date:** 2026-04-09
**Status:** ✅ PASSED — CLEAN
**Pipeline:** Analyst → Architect → Engineer → Sentinel → Healer (skipped, no failures) → Scribe

---

## Scope

Tier 2 baseline page-mount coverage for the Corporate module. No data
assertions, no write flows — purely "route mounts, landmark + testid visible,
no pageerrors."

### Routes Covered

| # | Route | Render Path | Test |
|---|---|---|---|
| 1 | `/corporate` | Server → `CorporateClient` | ✅ P0 mount @p0 + P1 CTA |
| 2 | `/corporate/new` | Client page (no server reads) | ✅ P1 mount + "Save Account" btn |
| 3 | `/corporate/events` | Server → `EventCalendarClient` | ✅ P1 mount |
| 4 | `/corporate/[id]` | Server → `CompanyDetailClient` | ✅ P1 bogus-UUID not-found |

### Deferred (per QA Roadmap)

- Write flows (create account, edit, allocate credits, event CRUD, invoice
  generation) → **Tier 4 (Corporate & Operations)**
- Happy-path company detail (seeded company with credit history panel) →
  **Tier 4**
- Event detail route `/corporate/events/[id]` → **Tier 4**

---

## Test Results

### Primary Run

```
Running 7 tests using 1 worker
  ✓ auth-setup → create admin session (4.8s)
  ✓ auth-setup → create employee session (3.7s)
  ✓ /corporate mounts @p0 (3.4s)
  ✓ /corporate → "New Account" CTA @p1 (817ms)
  ✓ /corporate/new mounts @p1 (1.6s)
  ✓ /corporate/events mounts @p1 (1.8s)
  ✓ /corporate/[bogus-uuid] not-found @p1 (1.7s)

  7 passed (24.7s)
```

**5/5 corporate tests passing on first run.** No failures, no Healer
iterations required.

### Flake Check (`--repeat-each=3`)

```
Running 17 tests using 1 worker
  ✓  1–2  auth-setup (8.4s)
  ✓  3–7  corporate.spec.ts × run 1 (5 tests)
  ✓  8–12 corporate.spec.ts × run 2 (5 tests)
  ✓ 13–17 corporate.spec.ts × run 3 (5 tests)

  17 passed (30.7s)
```

**0/15 flake across 3 repeats.** Stable on every run.

### Full Admin Regression

```
  ✓ 37 tests passed (1.2m)
```

**37/37 admin project tests passing** (32 pre-existing + 5 new corporate
tests). No pre-existing tests broken by the Tier 2.6 testid seeds.

---

## Files Modified

### Source (testid seeds — minimal diff, one attribute each)

| File | Line | Testid Added |
|---|---|---|
| `apps/web/src/app/(admin)/corporate/_components/CorporateClient.tsx` | 208 | `corporate-page-root` |
| `apps/web/src/app/(admin)/corporate/new/page.tsx` | 100 | `corporate-new-page-root` |
| `apps/web/src/app/(admin)/corporate/events/_components/EventCalendarClient.tsx` | 115 | `corporate-events-page-root` |
| `apps/web/src/app/(admin)/corporate/[id]/_components/CompanyDetailClient.tsx` | 219 | `corporate-detail-not-found` |
| `apps/web/src/app/(admin)/corporate/[id]/_components/CompanyDetailClient.tsx` | 237 | `corporate-detail-root` |

All seeds on the outermost render wrapper of each branch. Dual-branch testids
on `CompanyDetailClient` (not-found + happy-path) mirror the Tier 2.3
(Members) and Tier 2.4 (Revenue/ProductDetail) pattern — Tier 4 can reuse the
POM for happy-path coverage without touching source again.

### Tests (new)

- `apps/web/e2e/pages/CorporatePage.ts` (66 lines) — POM with 5 locators + 4
  `expect*Mounted()` helpers + 1 `expectBogusCompanyDetailNotFound()`.
- `apps/web/e2e/corporate.spec.ts` (77 lines, 5 tests) — smoke suite.

---

## Bugs Filed

**None.** Corporate module was clean — all 4 routes render without errors,
without hydration issues. The `/corporate/dashboard` API fetch on the overview
page logs no failures, the company detail not-found branch renders correctly,
and the events calendar mounts without needing seeded event data.

### Observations (informational, not blocking)

- **Pre-existing `/corporate` page calls `fetch` to `/api/corporate/dashboard`**
  from a server component (lines 13 of `corporate/page.tsx`) — catches errors
  with `.catch(() => ({ data: null }))` so a 500 on that API wouldn't break
  mount. During testing the call succeeded, but this is the kind of silent
  fallback worth monitoring in Tier 4.
- **`/corporate/new` is a pure client page** — no `'use client'` is actually
  written (it's inferred from the directive on line 1). Mount smoke is trivial
  since there are no server fetches to fail.
- Pre-existing rate-limit RPC warning and middleware→proxy deprecation notice
  still present (both already in the follow-up list).

---

## Shared Infrastructure Reuse

Consumed Tier 2 shared infrastructure introduced in Tier 2.1 without any
modifications:

- `BasePage.expectSmokeMount(url, landmark, expectedPath?)`
- `BasePage.adminShellLandmark()`
- `BasePage.byTestId(id)`
- `ANIM_TIMEOUT` (10s)

**Per-page effort:** ~1 testid + ~1 POM locator + ~1 POM helper + ~1 test.
Flat cost model held. Tier 2.6 took 4 routes with 5 testids (dual-branch on
detail) in ~77 lines of spec + ~66 lines of POM.

---

## Conclusion

Tier 2.6 Corporate smoke is **complete and green**. 4 routes covered by 5
tests, 0 flake across 3 repeats, full admin regression passes clean.

**Next:** Tier 2.7 Analytics smoke (14 sub-pages — the largest Tier 2 run).

**Roadmap status:** 9/61 → **10/61** complete.
