# QA Report — Revenue Smoke (Tier 2.4)

**Pipeline ID:** `revenue-smoke`
**Tier:** 2.4 (Admin Smoke — 4 of 11)
**Project:** `admin`
**Run date:** 2026-04-09
**Status:** ✅ COMPLETE — all phases green, no Healer iteration, 1 minor observation

---

## TL;DR

First Tier 2 multi-page smoke: 5 routes under the Revenue module (`/revenue`, `/revenue/orders`, `/revenue/products`, `/revenue/products/new`, `/revenue/products/[id]`) all mount under the admin shell with no pageerrors. 6 tests added. The `[id]` route is smoked against a bogus UUID (same pattern as Tier 2.3's members detail), deferring happy-path coverage to Tier 3.4. Observation: `/revenue/products/new` logs a benign "empty src attribute" warning from the image-preview img tag — filed below as a minor polish follow-up.

## What was tested

| # | Scenario | Priority | Type | Result |
|---|---|---|---|---|
| 1 | `/revenue` mounts — admin shell + `revenue-page-root` testid visible, no pageerrors | P0 | E2E smoke | ✅ PASS (2.9s) |
| 2 | `/revenue` → "Record Payment" header button rendered | P1 | E2E content | ✅ PASS (2.7s) |
| 3 | `/revenue/orders` mounts — admin shell + `revenue-orders-page-root` visible | P1 | E2E smoke | ✅ PASS (1.4s) |
| 4 | `/revenue/products` mounts — admin shell + `revenue-products-page-root` visible | P1 | E2E smoke | ✅ PASS (1.7s) |
| 5 | `/revenue/products/new` mounts — form scaffold renders, "Create Product" button visible | P1 | E2E smoke | ✅ PASS (1.5s) |
| 6 | `/revenue/products/[bogus-uuid]` mounts + renders not-found fallback | P1 | E2E smoke | ✅ PASS (1.6s) |

**Coverage:** 100% of P0 (1/1) + 100% of P1 (5/5) = **6/6 tests passing**.

## Files changed

### Created
- `apps/web/e2e/revenue.spec.ts` — 6 tests, 90 lines
- `apps/web/e2e/pages/RevenuePage.ts` — POM with 6 locators + 5 mount helpers + `BOGUS_PRODUCT_ID` export (71 lines)
- `specs/reports/revenue-smoke-report.md` — this report

### Modified
- `apps/web/src/app/(admin)/revenue/page.tsx` — seeded `data-testid="revenue-page-root"` at line 564
- `apps/web/src/app/(admin)/revenue/orders/_components/OrdersClient.tsx` — seeded `data-testid="revenue-orders-page-root"` at line 266 (OrdersClient is the default export consumed by `orders/page.tsx`)
- `apps/web/src/app/(admin)/revenue/products/_components/ProductsClient.tsx` — seeded `data-testid="revenue-products-page-root"` at line 157
- `apps/web/src/app/(admin)/revenue/products/new/page.tsx` — seeded `data-testid="revenue-products-new-page-root"` at line 91
- `apps/web/src/app/(admin)/revenue/products/[id]/_components/ProductDetailClient.tsx` — seeded TWO testids: `revenue-products-detail-not-found` on the null-product fallback (line 82) and `revenue-products-detail-root` on the main motion.div (line 97). Tier 3.4 will reuse `revenue-products-detail-root` for happy-path coverage.

## Test run

### First run
```
Running 8 tests using 1 worker  (2 auth-setup + 6 revenue)
  8 passed (25.9s)
```

### Flake check — `--repeat-each=3`
```
Running 20 tests using 1 worker  (2 auth-setup + 6 revenue × 3 repeats)
  20 passed (41.8s)
```
**Flake count: 0/20.**

### Full admin project — regression suite
```
Running 27 tests using 1 worker
  (2 auth-setup + 4 command-center + 3 schedule + 4 members + 6 revenue + 4 logout + 4 session-refresh)
  27 passed (57.1s)
```
**No regression in prior-tier suites.**

## Bugs found

None blocking. One minor observation:

- **Polish — empty `src=""` warning on `/revenue/products/new`**: The image-preview `<img data-product-preview="" src="" alt="" className="hidden">` at `revenue/products/new/page.tsx:192` starts with an empty src attribute (hidden by CSS until a file is chosen). React logs `"An empty string ("") was passed to the src attribute"`. This is a console warning only — no pageerror, test still passes. Fix: conditionally render the `<img>` only when a preview URL exists, OR use `src={undefined}`. Low priority.

## Design notes

### Why the orders and products testids are on `*Client.tsx` not `page.tsx`

Unlike `/revenue/page.tsx` (a client component with its own top-level motion.div) and `/revenue/products/new/page.tsx` (also a single client file), the `/revenue/orders` and `/revenue/products` pages are async server components that just fetch data and hand off to a `*Client` component. Seeding the testid inside the client component is correct — that's the element that actually owns the page's top-level render tree.

### Shared pattern: bogus-UUID smokes for dynamic routes

Tiers 2.3 (members/[id]) and 2.4 (products/[id]) now both follow the same pattern for their detail route smokes:
1. Seed TWO testids on the client component — one for the null-row fallback, one for the happy-path root.
2. Tier 2 spec uses a bogus UUID to hit the not-found branch.
3. Tier 3+ will use a seeded real row to hit the happy-path branch, reusing the same POM.

This lets Tier 2 stay pure "smoke" (no fixture coupling) while keeping the testids ready for Tier 3+ without re-editing source files.

## Follow-up work

- All previously-filed follow-ups remain open (BUG-001 through BUG-005, `handleSupabaseAuthError` cleanup, middleware→proxy migration, missing `public.increment_rate_limit`).
- New: empty-src warning on `/revenue/products/new` image preview (low priority polish).

## Agent trail

| Phase | Agent | Outcome |
|---|---|---|
| 1 — Analyst | inline | ✅ 6 scenarios designed (1 P0, 5 P1) — 5 route mounts + 1 content check |
| 2 — Architect | inline | ✅ Plan: 6 testid seeds across 5 files, 1 POM extending BasePage, 1 spec consuming shared Tier 2 infra |
| 3 — Engineer | inline | ✅ Tests written; 6/6 passing on first run |
| 4 — Sentinel | inline | ✅ PASS — 0/20 flake check, 27/27 admin regression |
| 5 — Healer | — | SKIPPED (no failures) |
| 6 — Scribe | inline | ✅ This report |

**Run time:** single session. Playwright time: ~26s first run + ~42s flake + ~57s admin = ~125s.
