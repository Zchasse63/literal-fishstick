# Utility Pages Smoke — Tier 2.10 Report

**Council Run:** Utility Pages Smoke (Tier 2.10)
**Date:** 2026-04-09
**Status:** ✅ PASSED — CLEAN
**Pipeline:** Analyst → Architect → Engineer → Sentinel → Healer (skipped) → Scribe

---

## Scope

Tier 2 baseline page-mount coverage for 3 standalone admin routes that
don't belong to a larger module. No data assertions, no write flows —
purely "route mounts, landmark + testid visible, no pageerrors."

### Routes Covered

| # | Route | Render Path | Test |
|---|---|---|---|
| 1 | `/segments` | Server → `SegmentsClient` | ✅ P0 mount @p0 |
| 2 | `/engagement` | Server → `EngagementClient` | ✅ P1 mount |
| 3 | `/docs/api` | Client page (dynamic `SwaggerUI`) | ✅ P1 mount |

### Deferred (per QA Roadmap)

- Segment create/edit/delete, segment analytics → **Tier 4 (4.8)**
- Engagement leaderboard config, achievement/challenge CRUD → later tier
- `/docs/api` is read-only (renders `/api/openapi`) — no write flows exist

---

## Test Results

### Primary Run
```
Running 5 tests using 1 worker
  ✓ auth-setup → create admin session (4.5s)
  ✓ auth-setup → create employee session (3.5s)
  ✓ /segments mounts @p0 (2.8s)
  ✓ /engagement mounts @p1 (1.2s)
  ✓ /docs/api mounts @p1 (2.2s)

  5 passed (21.0s)
```

**3/3 utility-pages tests passing on first run.** No failures, no
Healer iterations required.

### Flake Check (`--repeat-each=3`)
```
  11 passed (25.7s)
```

**0/9 flake.** Stable across all 3 repeats.

### Full Admin Regression
```
  62 passed (1.6m)
```

**62/62 admin project tests passing** (59 pre-existing + 3 new
utility-pages tests). No regressions.

---

## Files Modified

### Source (testid seeds)

| File | Testid Added |
|---|---|
| `apps/web/src/app/(admin)/segments/_components/SegmentsClient.tsx` | `segments-page-root` |
| `apps/web/src/app/(admin)/engagement/_components/EngagementClient.tsx` | `engagement-page-root` |
| `apps/web/src/app/(admin)/docs/api/page.tsx` | `docs-api-page-root` |

**3 seeds, 3 unique testids.** Each seeded on the outermost render
wrapper (`<div className="space-y-6">` in all 3 cases). For
`/docs/api`, the outer wrapper renders both during the SwaggerUI
loading state ("Loading API specification...") and after the spec
loads — so the smoke passes regardless of OpenAPI fetch latency.

### Tests (new)

- `apps/web/e2e/pages/UtilityPages.ts` (48 lines) — POM with 3
  locators + 3 `expect*Mounted()` helpers. Grouped 3 unrelated routes
  into one POM since they share no data/UI patterns but share the
  same Tier 2 contract.
- `apps/web/e2e/utility-pages.spec.ts` (45 lines, 3 tests) — smoke
  suite.

---

## Bugs Filed

**None.** All 3 utility routes render clean — no pageerrors, no
hydration issues, no 500s.

### Observations (informational, not blocking)

- **`/docs/api`** dynamically imports `swagger-ui-react` (SSR-disabled)
  and fetches `/api/openapi` via `useEffect`. Cold-compile + spec-load
  latency sat at ~2.2s on first visit, <700ms on warm repeats. Well
  within `ANIM_TIMEOUT`.
- **`/segments`** is powered by `SegmentsClient` which takes an
  `initialSegments` prop from a server fetch (`AiSegmentsClient.get`).
  The smoke test mounts against live data, which is expected behavior
  for Tier 2 — no assertion on segment count/content.
- **`/engagement`** takes `initialActiveMemberCount` + `initialLeaderboard`
  from server fetches. The smoke test mounts against live data. The
  current module is a stub with tab stubs for Achievements/Challenges
  ("Coming Soon") — those stubs render within the same outer wrapper,
  so the smoke passes regardless of which tab is active.
- Pre-existing rate-limit RPC warning and middleware→proxy deprecation
  notice continue to fire. Unrelated to this tier.

---

## Grouping Rationale

Tier 2.10 is the first Tier 2 run to combine multiple unrelated
routes into a single POM. The roadmap lists these 3 as a single
council run, and they share no code/data patterns — creating 3
separate POMs (`SegmentsPage`, `EngagementPage`, `DocsPage`) with
identical structure would be pure duplication. When Tier 4 picks
up `segments` for write-flow coverage, `UtilityPages` can be split
into a dedicated `SegmentsPage` then — or write methods can be
added to the existing POM and it can be renamed. Decision deferred
to Tier 4.

---

## Shared Infrastructure Reuse

Consumed Tier 2 shared infra (`expectSmokeMount`, `adminShellLandmark`,
`byTestId`, `ANIM_TIMEOUT`) without modification.

**Per-page effort:** ~1 testid + ~1 POM locator + ~1 POM helper + ~1 test.
Flat cost model continues to hold across 10 Tier 2 runs now.

---

## Conclusion

Tier 2.10 Utility Pages smoke is **complete and green**. 3 routes
covered by 3 tests, 0 flake, full admin regression passes clean.

**Next:** Tier 2.11 Employee Portal smoke (~10 pages, last of the
Tier 2 module smokes, first run against the `employee` Playwright
project).

**Roadmap status:** 13/61 → **14/61** complete.
