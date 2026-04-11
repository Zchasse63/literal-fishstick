# Marketing Smoke — Tier 2.5 Report

**Council Run:** Marketing Smoke (Tier 2.5)
**Date:** 2026-04-09
**Status:** ✅ PASSED — CLEAN
**Pipeline:** Analyst → Architect → Engineer → Sentinel → Healer (skipped, no failures) → Scribe

---

## Scope

Tier 2 baseline page-mount coverage for the entire Marketing module. No data
assertions, no write flows — purely "route mounts, landmark + testid visible,
no pageerrors."

### Routes Covered

| # | Route | Render Path | Test |
|---|---|---|---|
| 1 | `/marketing` | Server component (`marketing/page.tsx`) | ✅ P0 mount + @p0 |
| 2 | `/marketing/campaigns` | Server → `CampaignsClient` | ✅ P1 mount + "New Campaign" CTA |
| 3 | `/marketing/automations` | Server → `AutomationsClient` | ✅ P1 mount |
| 4 | `/marketing/content` | Server → `ContentHubClient` | ✅ P1 mount |
| 5 | `/marketing/leads` | Server → `LeadPipelineClient` | ✅ P1 mount |

### Deferred (per QA Roadmap)

- Write flows (campaign create/edit/send, automation builder, lead kanban
  drag-and-drop, content upload) → **Tier 5 (Marketing/AI writes)**
- Deep content semantics (metric cards, per-row actions, filter behavior) →
  **Tier 3+ as appropriate**
- Dynamic detail routes (e.g. `/marketing/campaigns/[id]`) → **Tier 5**

---

## Test Results

### Primary Run

```
Running 7 tests using 1 worker
  ✓ auth-setup → create admin session (4.7s)
  ✓ auth-setup → create employee session (3.8s)
  ✓ /marketing mounts @p0 (1.6s)
  ✓ /marketing/campaigns → "New Campaign" CTA @p1 (1.4s)
  ✓ /marketing/automations mounts @p1 (1.4s)
  ✓ /marketing/content mounts @p1 (1.4s)
  ✓ /marketing/leads mounts @p1 (1.4s)

  7 passed (21.0s)
```

**5/5 marketing tests passing on first run.** No failures, no Healer
iterations required.

### Flake Check (`--repeat-each=3`)

```
Running 17 tests using 1 worker
  ✓  1–2  auth-setup (8s)
  ✓  3–7  marketing.spec.ts × run 1 (5 tests)
  ✓  8–12 marketing.spec.ts × run 2 (5 tests)
  ✓ 13–17 marketing.spec.ts × run 3 (5 tests)

  17 passed (30.0s)
```

**0/15 flake across 3 repeats.** Stable on every run.

### Full Admin Regression

```
  ✓ 32 tests passed (1.1m)
```

**32/32 admin project tests passing.** No pre-existing tests broken by the
Tier 2.5 testid seeds. Covered suites:
- `auth.setup.ts` (admin + employee sessions)
- `command-center.spec.ts` (Tier 2.1)
- `schedule.spec.ts` (Tier 2.2)
- `members.spec.ts` (Tier 2.3)
- `revenue.spec.ts` (Tier 2.4)
- `marketing.spec.ts` (Tier 2.5 — **this run**)
- `login.spec.ts`, `logout.spec.ts`, `session-refresh.spec.ts` (Tier 1)

---

## Files Modified

### Source (testid seeds — minimal diff, one attribute each)

| File | Line | Testid Added |
|---|---|---|
| `apps/web/src/app/(admin)/marketing/page.tsx` | 311 | `marketing-page-root` |
| `apps/web/src/app/(admin)/marketing/campaigns/_components/CampaignsClient.tsx` | 150 | `marketing-campaigns-page-root` |
| `apps/web/src/app/(admin)/marketing/automations/_components/AutomationsClient.tsx` | 226 | `marketing-automations-page-root` |
| `apps/web/src/app/(admin)/marketing/content/_components/ContentHubClient.tsx` | 262 | `marketing-content-page-root` |
| `apps/web/src/app/(admin)/marketing/leads/_components/LeadPipelineClient.tsx` | 489 | `marketing-leads-page-root` |

All seeds placed on the outermost render wrapper (either a `motion.div` or a
plain `div` depending on the component's animation strategy). No component
structure was changed.

### Tests (new)

- `apps/web/e2e/pages/MarketingPage.ts` (57 lines) — POM with 5 locators + 5
  `expect*Mounted()` helpers consuming `BasePage.expectSmokeMount` and
  `adminShellLandmark`.
- `apps/web/e2e/marketing.spec.ts` (70 lines, 5 tests) — smoke suite.

---

## Bugs Filed

**None.** Marketing module was clean — all 5 routes render without errors,
without hydration issues, without missing testids after seeding. No new bug
reports to open.

### Observations (informational, not blocking)

- **Rate-limit RPC warning** (pre-existing, logged during every test run):
  `[rate-limit] RPC error, failing open: Could not find the function
  public.increment_rate_limit(...) in the schema cache`. Already tracked in
  the follow-up bug list from earlier tiers; not specific to Marketing.
- **Middleware→proxy deprecation warning** (pre-existing Next.js notice):
  `The "middleware" file convention is deprecated. Please use "proxy"
  instead.` Already in follow-up list.

Neither appears as a `pageerror` — both are console warnings and pass the
smoke `expectNoPageErrors` contract.

---

## Shared Infrastructure Reuse

This run reused the Tier 2 shared infrastructure introduced in Tier 2.1
without any modifications:

- `BasePage.expectSmokeMount(url, landmark, expectedPath?)`
- `BasePage.adminShellLandmark()`
- `BasePage.byTestId(id)`
- `ANIM_TIMEOUT` (10s)

**Per-page effort stays at ~1 testid seed + 1 POM locator + 1 POM helper + 1
test** — the same cost model as Tier 2.4 Revenue. Confirms the shared infra
scales cleanly to multi-page modules.

---

## Conclusion

Tier 2.5 Marketing smoke is **complete and green**. 5 routes covered by 5
tests, 0 flake across 3 repeats, full admin regression passes.

**Next:** Tier 2.6 Corporate smoke.

**Roadmap status:** 8/61 → **9/61** complete.
