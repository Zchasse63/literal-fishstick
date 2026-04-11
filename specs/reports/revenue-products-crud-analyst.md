# QA Analyst — Revenue: Products CRUD (Tier 3.4)

**Pipeline ID:** `revenue-products-crud`
**Tier:** 3.4 (Core Writes — 4 of 12)
**Project:** `admin`
**Run date:** 2026-04-09
**Phase:** 1 — Analyst

---

## Scope

Full create/read/update/delete (soft delete) of products through the admin UI and API. Covers:
- Create product via `/revenue/products/new`
- View products list at `/revenue/products`
- View detail at `/revenue/products/[id]`
- Update product via detail page
- Soft-delete product via detail page (sets `is_active = false`)

## Current state (audit findings)

**BUG-009 filed — feature is non-functional end-to-end.** See `specs/bugs/products-crud-schema-divergence.md` for the full 5-layer bug.

TL;DR: UI and API target phantom columns that don't exist in the DB. Zero products have ever been created. Before any test can run, BUG-009 must be fixed inline. The Engineer phase will apply the migration and code fix, then write tests.

## Data-testid inventory

### Already present
- `revenue-products-page-root` (ProductsClient.tsx line 157) — ✅
- `revenue-products-new-page-root` (NewProductPage line 91) — ✅
- `revenue-products-detail-root` (ProductDetailClient line 97) — ✅
- `revenue-products-detail-not-found` (ProductDetailClient line 82) — ✅

### [NEEDS SEEDING] for scenarios below

**List page (`/revenue/products`):**
- `revenue-products-add-btn` on the "Add Product" link (line 171)
- `revenue-products-grid-card` on each grid card link (line 100)
- `revenue-products-search-input` on the search box (line 215)
- `revenue-products-category-{value}` on each category pill (line 197)
- `revenue-products-empty-state` on both empty-state blocks (lines 269, 352)

**New page (`/revenue/products/new`):**
- `revenue-products-new-name-input` on name input (line 131)
- `revenue-products-new-description-input` on description textarea (line 144)
- `revenue-products-new-category-select` on category select (line 158)
- `revenue-products-new-price-input` on price input (line 213)
- `revenue-products-new-compare-price-input` on compare-at price input (line 231)
- `revenue-products-new-sku-input` on SKU input (line 255)
- `revenue-products-new-barcode-input` on barcode input (line 268)
- `revenue-products-new-inventory-input` on inventory input (line 284)
- `revenue-products-new-low-stock-input` on low-stock-threshold input (line 297)
- `revenue-products-new-active-toggle` on active toggle button (line 313)
- `revenue-products-new-submit-btn` on Create Product button (line 348)
- `revenue-products-new-cancel-link` on Cancel link (line 342)
- `revenue-products-new-error` on the error alert block (line 335)

**Detail page (`/revenue/products/[id]`):**
- `revenue-products-detail-save-btn` on Save Changes button (line 123)
- `revenue-products-detail-delete-btn` on Delete button (line 119)
- `revenue-products-detail-name-input` on name input (line 164)
- `revenue-products-detail-description-input` on description textarea (line 171)
- `revenue-products-detail-category-select` on category select (line 180)
- `revenue-products-detail-price-input` on price input (line 212)
- `revenue-products-detail-compare-price-input` on compare-at price input (line 224)
- `revenue-products-detail-inventory-input` on inventory input (line 251)
- `revenue-products-detail-low-stock-input` on low stock alert input (line 260)
- `revenue-products-detail-sku-input` on SKU input (line 270)
- `revenue-products-detail-barcode-input` on barcode input (line 279)
- `revenue-products-detail-weight-input` on weight input (line 301)
- `revenue-products-detail-active-toggle` on active toggle button (line 323)

## Scenarios

| # | Scenario | Priority | Project |
|---|---|---|---|
| 1 | Create product happy path — all required fields, assert `products` row exists with correct `price`, `inventory_count`, `is_active`, `activity_log.type='product_created'` | P0 | admin |
| 2 | Create product with minimal fields — name + price only; assert defaults (`inventory_count=0`, `is_active=true`, `low_stock_threshold=5`) | P0 | admin |
| 3 | Create product blocks empty name — client-side validation fires, `error` state set, zero DB mutation | P1 | admin |
| 4 | Create product blocks zero/negative price — client-side validation fires, zero DB mutation | P1 | admin |
| 5 | List page displays created product in grid view with correct price and inventory badge | P0 | admin |
| 6 | Detail page loads existing product and pre-fills all fields from DB | P0 | admin |
| 7 | Edit product via detail page — change name + price + inventory, Save persists to DB, `activity_log.type='product_updated'` appears | P0 | admin |
| 8 | Delete product via detail page — confirms, soft-deletes (`is_active=false`), `activity_log.type='product_deleted'` appears, detail page shows inactive or list hides it | P0 | admin |
| 9 | Unauthorized user (non owner/manager) cannot access `POST /api/products` — returns 403 | P1 | admin |

Scenarios 1–8 are admin project. Scenario 9 could be anonymous or a member-role test — defer to Sentinel phase.

## Test data strategy

- Seeded via Playwright fixture in `before` hook using `testDb` service-role client
- Cleanup via `delete from products where studio_id = DEFAULT_STUDIO_ID and name like 'TestProduct_%'` in `after` hook
- Unique product names per test (`TestProduct_${Date.now()}_${scenario}`) to avoid cross-test flake

## Assertions pattern (DB)

```ts
// After successful create
const { data } = await testDb
  .from('products')
  .select('*')
  .eq('studio_id', DEFAULT_STUDIO_ID)
  .eq('name', testName)
  .single()

expect(data?.price).toBe(2500) // $25.00 in cents
expect(data?.inventory_count).toBe(10)
expect(data?.is_active).toBe(true)

// And the activity_log entry
const { data: logs } = await testDb
  .from('activity_log')
  .select('*')
  .eq('subject_type', 'product')
  .eq('subject_id', data!.id)

expect(logs?.some(l => l.type === 'product_created')).toBe(true)
```

## Pre-requisites

1. **BUG-009 must be fixed inline before Engineer can write tests.** The migration and code fix are prerequisite to any test execution.
2. Testids must be seeded in Engineer Step 1.
3. `apps/web/e2e/pages/ProductsPage.ts` POM must be written (does not currently exist).

## Next phase

Architect: design the fix plan + test plan as a single Engineer-phase checklist.
