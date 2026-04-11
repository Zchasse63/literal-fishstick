# QA Council — Revenue: Products CRUD (Tier 3.4)

**Pipeline ID:** `revenue-products-crud`
**Tier:** 3.4 (Core Writes — 4 of 12)
**Project:** `admin`
**Run date:** 2026-04-09
**Final status:** ✅ COMPLETE — 9 tests passing, 3 real bugs surfaced and fixed

---

## Summary

Full write-flow coverage for the products catalog: create, read (list + detail), update, soft-delete, plus search and validation edge cases. Before this run, **zero products had ever been created** in production — the feature was broken at 5 independent layers (BUG-009) and every Save/Delete button on the detail page was a no-op stub. All five layers fixed inline during this council run; a sixth issue (silent `activity_log` insert failure due to NOT NULL `description` column) was surfaced during the Healer phase and also fixed inline.

| Metric | Value |
|---|---|
| Tests written | 9 (P0=6, P1=3) |
| POM additions | ~30 locators + ~15 helpers on `RevenuePage` |
| Testids seeded | 27 across `NewProductPage`, `ProductDetailClient`, `ProductsClient` |
| Source files edited | 8 |
| Bugs filed | BUG-009 (already open — closed by this run) |
| Flake detection | 29/29 passing across 3 repeats (1.9m) |
| Full admin regression | 88/88 passing (3.1m) |
| Full pipeline duration | Single session (Engineer → Sentinel → Healer → Sentinel round 2 → Scribe) |

---

## The six layers of BUG-009 (all fixed inline)

The Analyst flagged 5 layers in the bug ticket. The Healer phase surfaced a sixth.

1. **Phantom columns in `NewProductPage.handleSave`** — the client insert used `quantity` and `images` which do not exist on `public.products`. Fixed by rewriting the save handler to POST to `/api/products` with the DB-canonical column names.

2. **Phantom columns in `PUT /api/products/[id]`** — the `allowedFields` allowlist included `'quantity'` and `'images'`; the real columns are `inventory_count` and `image_url`. Fixed by replacing the allowlist with the exact DB column set.

3. **`activity_log.type` CHECK constraint missing product values** — was 12 values, extended to 15 with `product_created`, `product_updated`, `product_deleted`. Verified post-fix against `pg_constraint` via Supabase MCP.

4. **Silent corruption in the read mappers** — both the list page (`/revenue/products/page.tsx`) and the detail page (`/revenue/products/[id]/page.tsx`) mapped DB rows using snake_case names that didn't match the schema. Pre-fix, every product card rendered `$0.00` even when the row had a real `price` value. Fixed by rewriting both mappers to read `p.price / p.compare_at_price / p.inventory_count / p.image_url / p.is_active`, and the detail page now adapts the single `image_url` column into the client's `images: string[]` prop.

5. **Unwired Save and Delete buttons on the detail page** — `ProductDetailClient.tsx` rendered buttons that were never wired to handlers. Fixed by adding `handleSave` (PUT), `handleDelete` (native confirm → DELETE → navigate to list), loading states, error display, and the full testid inventory.

6. **[Surfaced by Healer] `activity_log.description` is NOT NULL but all three products API routes omitted it** — the DB-layer writes succeeded, but every activity_log insert silently dropped because the Supabase JS client does not throw on insert errors. The first test run passed every DB assertion on the `products` table and failed on every `activity_log.type` assertion. Diagnosed by inspecting the `activity_log` column metadata via the Supabase MCP. Fixed by adding `description: \`Product {created|updated|deleted}: ${name}\`` to all three inserts. Pattern confirmed against the Tier 3.1 `transactions` route which already passes a description string.

---

## Files changed

| File | Change |
|---|---|
| `apps/web/src/app/(admin)/revenue/products/new/page.tsx` | Rewrote `handleSave` to POST to `/api/products` with DB-canonical fields; removed direct Supabase browser client; added 13 testids |
| `apps/web/src/app/(admin)/revenue/products/page.tsx` | Fixed list read mapper to use `price / compare_at_price / inventory_count / image_url / is_active` |
| `apps/web/src/app/(admin)/revenue/products/[id]/page.tsx` | Fixed detail read mapper; adapted `image_url` → `images: string[]` for client consumption |
| `apps/web/src/app/(admin)/revenue/products/[id]/_components/ProductDetailClient.tsx` | Wired Save/Delete buttons, added `useRouter`, `saving/deleting/error` state, 14 testids, error display block |
| `apps/web/src/app/(admin)/revenue/products/_components/ProductsClient.tsx` | Added `revenue-products-grid-card` (+ `data-product-id`), add-button testid, category pill testids, search input testid, empty state testids, table row testids |
| `apps/web/src/app/api/products/route.ts` | POST handler: added `description: \`Product created: ${name}\`` to activity_log insert |
| `apps/web/src/app/api/products/[id]/route.ts` | PUT + DELETE handlers: replaced phantom `quantity`/`images` allowlist with real columns; added `description` to both activity_log inserts |
| `apps/web/e2e/fixtures/test-data.ts` | Added `E2E_PRODUCT_NAME_PREFIX = 'E2ETestProduct_'` |
| `apps/web/e2e/fixtures/db.ts` | Added `seedProduct`, `deleteProduct`; extended `resetStudioTestData` with scoped product + activity_log cleanup step |
| `apps/web/e2e/pages/RevenuePage.ts` | Extended POM with Tier 3.4 products locators (30) + helpers (15) including native-confirm-aware `deleteProductDetail` |
| `apps/web/e2e/revenue-products-crud.spec.ts` | NEW — 312 lines, 9 tests |

---

## Test inventory

| # | Priority | Scenario | Key assertion |
|---|---|---|---|
| 1 | P0 | Create product end-to-end, all fields | 13 DB columns + activity_log `product_created` |
| 2 | P0 | Create product with only required fields | DB defaults applied (`inventory_count=0`, `low_stock_threshold=5`, `is_active=true`, `category='apparel'`) |
| 3 | P1 | Blank name blocks submission | Client-side error + zero DB rows |
| 4 | P1 | Zero price blocks submission | Client-side error + zero DB rows |
| 5 | P0 | List page renders seeded product | Grid card shows `$42.00` + `7 in stock` (read-mapper fix proof) |
| 6 | P0 | Detail page pre-fills existing product | 8 input `toHaveValue` assertions |
| 7 | P0 | Update via detail Save persists | DB assert + activity_log `product_updated` |
| 8 | P0 | Soft-delete via detail Delete flips `is_active` | `is_active=false` + activity_log `product_deleted` + navigation back to list |
| 9 | P1 | List search narrows to matching products | Both seeded rows visible pre-search, one visible post-search |

---

## Phase log

### Phase 1 — Analyst ✅
Report: `specs/reports/revenue-products-crud-analyst.md`
Scenarios: 9 (6 P0, 3 P1). Testid inventory enumerated — 20+ testids flagged `[NEEDS SEEDING]`.
Current state: BUG-009 filed, 5 layers documented, feature non-functional end-to-end.

### Phase 2 — Architect ✅
Report: `specs/reports/revenue-products-crud-architect.md`
Step 0: DB migration to add `compare_at_price`, `barcode`, `low_stock_threshold` columns + extend `activity_log.type` CHECK.
Step 1: Seed 27 testids across 3 component files.
Step 2–7: Fix API routes, fix read mappers, wire Save/Delete, add `seedProduct` fixture, extend POM.
Step 8: Write spec (~312 lines).
Step 9: Run with `--repeat-each=3`.
Step 10: Run full admin regression.

### Phase 3 — Engineer ✅
All 8 blueprint steps completed inline. 312-line spec file authored using the 9-scenario Analyst list as the contract.

### Phase 4 — Sentinel (round 1) 🚫 BLOCKED
First `--repeat-each=3` run: 20/29 passing. **3 tests × 3 repeats = 9 failures**, all on `activity_log` type assertions for `product_created`, `product_updated`, `product_deleted`. DB row assertions on the `products` table all passed — writes were landing, but activity logs were not.

### Phase 5 — Healer ✅
Root cause: the `activity_log.description` column is `NOT NULL` with no default. The three products API routes inserted activity rows **without** a description. The Supabase JS client does not throw on insert failures — the `await ...insert(...)` call returned `{ error: <NOT NULL violation> }` and was then discarded. Confirmed via `information_schema.columns` probe through the Supabase MCP. Fix: added `description: \`Product {created|updated|deleted}: ${name}\`` to all three inserts. Cross-checked against the Tier 3.1 `transactions` route which already uses this pattern — matches.

### Phase 4' — Sentinel (round 2) ✅ PASS
- Flake detection: **29/29 passing** across `--repeat-each=3` (1.9m)
- Full admin regression: **88/88 passing** (3.1m) — no regression in any Tier 1/2/3 suite

### Phase 6 — Scribe ✅
This report + `pipeline-log.md` update + `qa-pipeline-roadmap.md` advance.

---

## Design notes

**BUG-009 is the worst write-flow bug surfaced by the QA pipeline so far.** Five independent layers of divergence in a single feature, none of which were caught by type checks because the `products` table was typed with `any` in the client mapper and the API route used a `Record<string, unknown>` allowlist. The Healer-surfaced sixth layer (NOT NULL `description`) is particularly insidious because it only shows up when something *downstream* of the write tries to assert the activity log exists — the user-facing UI never noticed. The Tier 3.1 `record-payment` council run caught the equivalent bug in the `transactions` route because it also asserted the activity log; every other Tier 3 run that asserts `activity_log` should use the same pattern.

**Lesson for future Tier 3 runs:** when diagnosing a silent write failure, always probe `information_schema.columns` for `NOT NULL` + no-default constraints before assuming the app code is correct. The Supabase JS client's swallow-on-error default makes this category of bug undetectable from app logs alone.

**POM extension pattern holds:** `RevenuePage` is now the home of Tier 2.4 (smoke) + Tier 3.1 (Record Payment) + Tier 3.4 (Products CRUD) locators/helpers, separated by clear section headers. The file is growing but remains navigable. Future Tier 3 Revenue runs (3.2/3.3 if ever ungapped) will continue to extend rather than duplicate.

**Tier 3 progress: 4/12.** 2 full runs (3.1, 3.4), 2 gap-filed (3.2, 3.3). Next: Tier 3.5 — Members: Create Member.
