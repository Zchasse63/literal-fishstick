---
id: BUG-009
title: Products CRUD fully broken — 5-layer schema divergence (UI, API, read mappers, activity_log enum, unwired buttons)
status: Open
severity: CRITICAL — The products feature is non-functional end-to-end. No product has ever been created because every write path fails.
discovered_by: QA pipeline Tier 3.4 Analyst phase (2026-04-09)
related:
  - specs/qa-pipeline-roadmap.md Tier 3.4 (Revenue: Products CRUD)
  - BUG-006 (same class of schema-divergence bug affecting Record Payment modal; fixed inline in Tier 3.1)
---

# BUG-009 — Products CRUD is broken end-to-end (5-layer schema divergence)

## Summary

The entire Revenue → Products feature is non-functional. The Products table has **0 rows** in production because no product has ever been successfully created. Five distinct layers of schema divergence all block the write path and corrupt the read path:

1. **UI insert** (`NewProductPage`) writes to phantom columns via direct Supabase client — fails immediately.
2. **API insert/update** (`/api/products` + `/api/products/[id]`) writes to different phantom columns — would also fail.
3. **`activity_log.type` CHECK constraint** does not allow `'product_created'`, `'product_updated'`, or `'product_deleted'` — the API's post-insert activity log write would also fail.
4. **Read mappers** (`products/page.tsx`, `products/[id]/page.tsx`) reference phantom columns that always return `undefined`, so even if a product existed it would display as $0 / 0 inventory / inactive.
5. **Detail page Save/Delete buttons** (`ProductDetailClient`) have no `onClick` handlers — they are visual stubs.

This is materially the same class of bug as BUG-006 (Record Payment modal schema divergence), but affects far more surface area. The pattern suggests the UI and API were each built by a different agent/pass against an imagined schema that doesn't match the actual DB.

## Discovered during

Tier 3.4 (Revenue: Products CRUD) Analyst phase. Analyst read the UI and API files, spotted divergent field names between them, then queried the actual `products` and `activity_log` schemas via the Supabase MCP and confirmed BOTH the UI and the API target non-existent columns.

**Audit method:**
1. `information_schema.columns` query for `products` table (actual schema)
2. `pg_constraint` query for `activity_log_type_check` (actual allowed types)
3. `SELECT COUNT(*) FROM products` — confirmed zero rows exist (consistent with a table that has never been successfully written to)
4. File reads of all 5 product surface files + 2 API route files
5. Grep for related phantom columns elsewhere (found a parallel bug in orders page — filed separately as note below)

## Ground truth: actual `products` schema

```
id                  uuid        NOT NULL  default gen_random_uuid()
studio_id           uuid        NOT NULL
name                text        NOT NULL
description         text
price               integer     NOT NULL   -- stored as cents
sku                 text
category            text
image_url           text                   -- single URL, not an array
inventory_count     integer     NOT NULL   default 0
is_active           boolean     NOT NULL   default true
shipping_enabled    boolean     NOT NULL   default false
weight_oz           numeric
created_at          timestamptz NOT NULL   default now()
updated_at          timestamptz NOT NULL   default now()
```

**Columns the UI and API both assume exist but DO NOT:**
- `price_in_cents` (UI) — real column is `price`
- `compare_at_price_in_cents` (UI) / `compare_at_price` (API) — no such column
- `barcode` (both) — no such column
- `inventory` (UI) / `quantity` (API) — real column is `inventory_count`
- `low_stock_threshold` (both) — no such column
- `active` (UI) — real column is `is_active`
- `images` text[] (API) — real column is `image_url` (single text)

## Ground truth: actual `activity_log_type_check`

```sql
CHECK (type = ANY (ARRAY[
  'check_in', 'booking', 'cancellation', 'payment', 'failed_payment',
  'membership_change', 'walk_in', 'new_member', 'refund', 'strike',
  'clock_in', 'clock_out'
]))
```

The API inserts `type: 'product_created'` / `'product_updated'` / `'product_deleted'` — NONE of these are in the enum.

## Gap inventory

### GAP-1 — NewProductPage direct Supabase insert uses 6 phantom columns

**File:** `apps/web/src/app/(admin)/revenue/products/new/page.tsx` (lines 63–77)

The page bypasses the `/api/products` route entirely and calls `supabase.from('products').insert(...)` directly from the browser client, with this body:

```ts
{
  studio_id: STUDIO_ID,
  name: name.trim(),
  description: description.trim() || null,
  price_in_cents: priceInCents,                  // ❌ column is `price`
  compare_at_price_in_cents: compareAtPriceInCents, // ❌ column does not exist
  category,
  sku: sku.trim() || null,
  barcode: barcode.trim() || null,               // ❌ column does not exist
  inventory: parseInt(inventory, 10) || 0,        // ❌ column is `inventory_count`
  low_stock_threshold: parseInt(lowStockThreshold, 10) || 5, // ❌ column does not exist
  active,                                         // ❌ column is `is_active`
}
```

**Result:** Supabase returns a PostgREST error about unknown columns, the error surfaces in the `error` state, and the user sees `"Could not find the 'active' column of 'products' in the schema cache"` or similar. Product is not created.

**Root cause:** The UI was built against an imagined schema that was never migrated. The UI should use the `/api/products` POST route, not direct Supabase access — but the API has the same bug, so switching to the API alone would not fix it.

---

### GAP-2 — `POST /api/products` inserts 5 phantom columns

**File:** `apps/web/src/app/api/products/route.ts` (lines 158–174)

```ts
await supabase.from('products').insert({
  studio_id: studioId,
  name,
  description: description ?? null,
  category: category ?? null,
  price,                                   // ✅ matches DB
  compare_at_price: compare_at_price ?? null, // ❌ column does not exist
  sku: sku ?? null,
  barcode: barcode ?? null,                 // ❌ column does not exist
  quantity: quantity ?? 0,                  // ❌ column is `inventory_count`
  low_stock_threshold: low_stock_threshold ?? 5, // ❌ column does not exist
  images: images ?? [],                     // ❌ column is `image_url` (single)
  weight_oz: weight_oz ?? null,
  is_active: is_active ?? true,             // ✅ matches DB
})
```

The API also has the same issue in `PUT /api/products/[id]` (line 122 `allowedFields` list contains `compare_at_price`, `barcode`, `quantity`, `low_stock_threshold`, `images`).

**Result:** Any API-based create or update fails with the same PostgREST schema error.

---

### GAP-3 — `activity_log` inserts use 3 invalid `type` values

**Files:**
- `apps/web/src/app/api/products/route.ts` line 186: `type: 'product_created'`
- `apps/web/src/app/api/products/[id]/route.ts` line 166: `type: 'product_updated'`
- `apps/web/src/app/api/products/[id]/route.ts` line 241: `type: 'product_deleted'`

**Result:** Even if the product write succeeded, the follow-up `activity_log` insert would fail with `check constraint "activity_log_type_check" violated`. This is the SAME pattern as BUG-006 — a route introduces a new activity type without updating the enum migration.

---

### GAP-4 — Read mappers silently corrupt display

**Files:**
- `apps/web/src/app/(admin)/revenue/products/page.tsx` (lines 15–25)
- `apps/web/src/app/(admin)/revenue/products/[id]/page.tsx` (lines 21–36)

Both files do `.select('*')` (which works — returns all real columns) but then map to a client-side type using phantom names:

```ts
priceInCents: p.price_in_cents ?? 0,           // ❌ always 0, real col is `price`
compareAtPriceInCents: p.compare_at_price_in_cents || undefined, // ❌ always undefined
inventory: p.inventory ?? 0,                    // ❌ always 0, real col is `inventory_count`
active: p.active ?? true,                       // ❌ always true (default), real col is `is_active`
image: p.image_url || null,                     // ✅ correct
```

**Result:** If a product existed, it would display as `$0.00`, `0 in stock`, `Active` (always), no compare-at price. Since no products exist today, this bug is latent — but the moment the write path is fixed, the read display will still be wrong unless these mappers are also fixed.

---

### GAP-5 — ProductDetailClient Save/Delete buttons are unwired stubs

**File:** `apps/web/src/app/(admin)/revenue/products/[id]/_components/ProductDetailClient.tsx` (lines 119–127)

```tsx
<button className="... bg-white ... text-red-600 ...">
  <Trash2 className="h-4 w-4" />
  Delete
</button>
<button className="... bg-indigo-600 text-white ...">
  <Save className="h-4 w-4" />
  Save Changes
</button>
```

Neither button has an `onClick`. They are visual only. The local `useState` form values (`name`, `priceInCents`, `inventory`, `active`, etc.) are updated as the user types but never persisted anywhere.

**Result:** Admins can edit product fields in the detail page with no feedback that nothing is saving. This is BUG-002-class stub functionality.

## Impact

- **User-facing:** Admins cannot create products, cannot edit products, cannot delete products. The entire merchandise management feature is non-functional. The `Add Product` button leads to a form that cannot save. The `Save Changes` button on detail pages does nothing.
- **Revenue:** The Sauna Guys cannot sell merch through Meridian until this is fixed. Merch is a listed Phase 1 revenue stream in CLAUDE.md.
- **Data integrity:** Zero rows in `products`. No risk of corrupt data because no writes have ever succeeded.
- **QA pipeline:** Tier 3.4 cannot run as a standard pipeline until this is fixed inline. Per BUG-006 precedent, the QA council fixes broken write paths as part of the Engineer phase when the fix is scoped and the schema intent is clear.

## Related (not in scope for BUG-009 fix)

**Orders page has the same class of bug** — `apps/web/src/app/(admin)/revenue/orders/page.tsx` line 30 reads `item.price_in_cents` but the actual `order_items` column is `unit_price` (integer). Line 32 reads `o.total_in_cents` but the actual `orders` column is `total` (integer). This will be addressed in Tier 3 when orders are touched, or filed separately as BUG-010 if a future council run surfaces it. Noted here because the fix pattern is identical.

## Fix plan

This bug will be fixed inline during Tier 3.4 Engineer phase, following the BUG-006 precedent. The fix has two parts:

### Part A — DB migration (add missing columns + activity_log types)

```sql
-- Add the 3 intended-but-missing product columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS compare_at_price INTEGER,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;

-- Extend activity_log.type enum with product events
ALTER TABLE activity_log DROP CONSTRAINT activity_log_type_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_type_check CHECK (type = ANY (ARRAY[
  'check_in', 'booking', 'cancellation', 'payment', 'failed_payment',
  'membership_change', 'walk_in', 'new_member', 'refund', 'strike',
  'clock_in', 'clock_out',
  'product_created', 'product_updated', 'product_deleted'
]));
```

`inventory_count`, `is_active`, and `image_url` (single) STAY as the canonical DB names — the UI and API will align to them rather than the other way around. Renaming the existing columns would be riskier and less principled.

### Part B — Code alignment

1. **API `POST /api/products`**: rename `quantity` → `inventory_count`, remove `images[]` handling (single `image_url` string only), keep other fields.
2. **API `PUT /api/products/[id]`**: same `allowedFields` fix.
3. **API DELETE**: no field changes needed — only `is_active = false` update + activity_log.
4. **NewProductPage**: replace direct Supabase insert with `POST /api/products` fetch call. Map form fields to the API's schema. Rename local state vars that match new API shape where helpful but NOT required.
5. **products/page.tsx read mapper**: `p.price_in_cents` → `p.price`, `p.compare_at_price_in_cents` → `p.compare_at_price`, `p.inventory` → `p.inventory_count`, `p.active` → `p.is_active`. Keep `Product` type's client-side prop names (`priceInCents`, `inventory`) — only the map changes.
6. **products/[id]/page.tsx read mapper**: same fixes.
7. **ProductDetailClient**: wire Save button `onClick` → `PUT /api/products/${id}`, wire Delete button `onClick` → `DELETE /api/products/${id}` with confirm. Handle loading state, errors, toast success.
8. **Testids** per `AGENTS.md` convention:
   - `revenue-products-new-name-input`, `-price-input`, `-category-select`, `-submit-btn`, `-cancel-btn`
   - `revenue-products-detail-save-btn`, `-delete-btn`, `-name-input`, `-price-input`, `-inventory-input`, `-active-toggle`
   - `revenue-products-grid-card` per product card
9. **POM**: `apps/web/e2e/pages/ProductsPage.ts` with helpers for create/edit/delete + assertions.
10. **Spec**: `apps/web/e2e/revenue-products-crud.spec.ts` with ~8 scenarios (see Tier 3.4 Analyst scenarios doc).

## Status

**Open — inline fix planned as part of Tier 3.4 Engineer phase.** Will be closed when the fix ships and tests pass.
