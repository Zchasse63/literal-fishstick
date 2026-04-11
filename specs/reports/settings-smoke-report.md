# Settings Smoke — Tier 2.9 Report

**Council Run:** Settings Smoke (Tier 2.9)
**Date:** 2026-04-09
**Status:** ✅ PASSED (1 Healer iteration)
**Pipeline:** Analyst → Architect → Engineer → Sentinel → Healer → Scribe

---

## Scope

Tier 2 baseline page-mount coverage for the Settings module. No data
assertions, no write flows — purely "route mounts, landmark + testid visible,
no pageerrors."

### Routes Covered

| # | Route | Render Path | Test |
|---|---|---|---|
| 1 | `/settings` | Client `SettingsClient` (Tabs: General, Booking Rules, Membership Pricing, Notifications, Integrations) | ✅ P0 mount @p0 |
| 2 | `/settings/geofence` | Server → `GeofenceClient` | ✅ P1 mount |
| 3 | `/settings/sms` | Client page (Twilio config stub) | ✅ P1 mount |

### Deferred (per QA Roadmap)

- Save settings (any tab) → **Tier 4**
- Add/delete geofence location → **Tier 4**
- SMS credential update, send test SMS → **Tier 4**

---

## Test Results

### Primary Run (Post-Healer)
```
Running 5 tests using 1 worker
  ✓ auth-setup → create admin session (4.6s)
  ✓ auth-setup → create employee session (3.8s)
  ✓ /settings mounts @p0 (645ms)
  ✓ /settings/geofence mounts @p1 (2.7s)
  ✓ /settings/sms mounts @p1 (1.2s)

  5 passed (20.5s)
```

### Flake Check (`--repeat-each=3`)
```
  11 passed (24.1s)
```

**0/9 flake.** Stable across all 3 repeats.

### Full Admin Regression
```
  59 passed (1.5m)
```

**59/59 admin project tests passing** (56 pre-existing + 3 new settings
tests). No regressions.

---

## Healer Iteration (Initial Failure → Fix)

### Initial Failure

On first primary run, `/settings` test failed with a timeout on
`expect(pageRoot()).toBeVisible()` for `settings-page-root`. The other 2
Settings routes (`/settings/geofence`, `/settings/sms`) passed cleanly,
confirming the seed placement was the issue rather than a harness/landmark
problem.

### Root Cause

`SettingsClient.tsx` (998 lines) contains **7** top-level function
declarations:

| Line | Function | Kind |
|---|---|---|
| 65 | `SectionHeader` | Helper component |
| 75 | `FieldRow` | Helper component |
| 124 | `SaveButton` | Helper component |
| 149 | `GeneralTab` | Tab sub-component (return @ 186) |
| 322 | `BookingRulesTab` | Tab sub-component (return @ 353) |
| 499 | `MembershipPricingTab` | Tab sub-component (return @ 535) |
| 660 | `NotificationsTab` | Tab sub-component |
| 780 | `IntegrationsTab` | Tab sub-component |
| **956** | **`SettingsClient`** (default export) | **Main component (return @ 957)** |

The testid was initially seeded at **line 354 inside `BookingRulesTab`** —
not the main `SettingsClient` default export. Since the default active tab
is `General` (index 0), `BookingRulesTab` never mounts on page load and
the testid was never rendered.

### Fix

- Removed `data-testid="settings-page-root"` from the `BookingRulesTab`
  return's `<div>` (line 354).
- Added `data-testid="settings-page-root"` to the `<motion.div>` in the
  main `SettingsClient` default-exported function's return (line 958) —
  the outermost wrapper that always renders regardless of which tab is
  active.

This is a one-attribute relocation (2 edits on the same file). No
structural changes to the component.

### Re-validation

Primary run passed 5/5; flake check passed 11/11; full regression passed
59/59. Clean.

---

## Files Modified

### Source (testid seeds)

| File | Line | Testid Added |
|---|---|---|
| `apps/web/src/app/(admin)/settings/_components/SettingsClient.tsx` | 958 | `settings-page-root` (on main `<motion.div>`) |
| `apps/web/src/app/(admin)/settings/geofence/_components/GeofenceClient.tsx` | 70 | `settings-geofence-page-root` |
| `apps/web/src/app/(admin)/settings/sms/page.tsx` | 71 | `settings-sms-page-root` |

**3 seeds, 3 unique testids.**

### Tests (new)

- `apps/web/e2e/pages/SettingsPage.ts` (38 lines) — POM with 3 locators +
  3 `expect*Mounted()` helpers.
- `apps/web/e2e/settings.spec.ts` (46 lines, 3 tests) — smoke suite.

---

## Bugs Filed

**None.** The failure was a seed-placement error by the Engineer, not a
bug in the product. Settings module renders cleanly on all 3 routes.

### Observations (informational, not blocking)

- **`SettingsClient` is heavily partitioned** (7 internal function
  components + 1 default export). The main-function return is the
  correct seed target for a "page mounts" assertion; Tier 3/4 writes
  targeting specific tabs will need per-tab testids (e.g.
  `settings-general-tab-root`, `settings-booking-rules-tab-root`).
- **`/settings/geofence` ran 2.7s on first cold visit**, then <800ms on
  warm repeats. Consistent with prior client-component cold-compile
  observations; well within `ANIM_TIMEOUT` (10s).
- **`/settings/sms`** is the Twilio-stubbed SMS provider config page.
  Backend SMS integration remains stubbed per Phase 2 roadmap.
- Pre-existing rate-limit RPC warning, middleware→proxy deprecation
  notice, and tampered-cookie `TypeError` from `session-refresh.spec.ts`
  (intentional malformed-jwt test) continue to fire.

---

## Lesson Learned — Multi-Function Files

When a client component file contains multiple helper/sub-components and
the Engineer seeds a testid in the wrong function's return, the smoke
test will silently fail because the seed simply never mounts. For future
tiers, the Engineer should **grep for `export default function`** (or
equivalent) to locate the true component root before adding testids, and
the Architect should explicitly list the target function name in the
plan when the file has >1 function declaration.

The pattern:
```bash
grep -n "^export default\|^function [A-Z]" SomeClient.tsx
```
...quickly reveals the structure. Using it as a pre-seed step would
have caught this mistake before the Sentinel run.

---

## Shared Infrastructure Reuse

Consumed Tier 2 shared infra (`expectSmokeMount`, `adminShellLandmark`,
`byTestId`, `ANIM_TIMEOUT`) without modification.

**Per-page effort:** ~1 testid + ~1 POM locator + ~1 POM helper + ~1 test.
Flat cost model continues to hold (aside from the 1 Healer iteration for
the misplaced seed).

---

## Conclusion

Tier 2.9 Settings smoke is **complete and green**. 3 routes covered by 3
tests, 0 flake, full admin regression passes clean. One Healer iteration
was required to relocate a misplaced testid — no product bugs filed.

**Next:** Tier 2.10 Segments + Engagement + Docs smoke (`/segments`,
`/engagement`, `/docs/api`).

**Roadmap status:** 12/61 → **13/61** complete.
