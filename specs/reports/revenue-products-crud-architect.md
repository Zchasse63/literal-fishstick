# QA Architect — Revenue: Products CRUD (Tier 3.4)

**Pipeline ID:** `revenue-products-crud`
**Tier:** 3.4
**Phase:** 2 — Architect
**Run date:** 2026-04-09

---

## Input

- Analyst scenarios: `specs/reports/revenue-products-crud-analyst.md`
- BUG-009 (inline fix required): `specs/bugs/products-crud-schema-divergence.md`

## Blueprint

### Step 0 — Database migration (BUG-009 Part A)

Single migration file: `apps/web/supabase/migrations/<timestamp>_bug009_products_schema_alignment.sql`

```sql
-- BUG-009 Part A: align products schema with UI/API intent + extend activity_log enum

-- 1. Add the 3 intended-but-missing product columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS compare_at_price INTEGER,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;

-- 2. Extend activity_log.type CHECK to include product events
ALTER TABLE activity_log DROP CONSTRAINT activity_log_type_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_type_check CHECK (type = ANY (ARRAY[
  'check_in'::text, 'booking'::text, 'cancellation'::text, 'payment'::text,
  'failed_payment'::text, 'membership_change'::text, 'walk_in'::text,
  'new_member'::text, 'refund'::text, 'strike'::text, 'clock_in'::text,
  'clock_out'::text,
  'product_created'::text, 'product_updated'::text, 'product_deleted'::text
]));
```

**Deliberate non-renames:** `price` stays as `price` (not `price_in_cents`). `inventory_count` stays (not `inventory` / `quantity`). `is_active` stays (not `active`). `image_url` stays as single text (not `images[]`). The DB is the source of truth; code aligns to it.

### Step 1 — Fix API routes (`/api/products/*`)

**File 1: `apps/web/src/app/api/products/route.ts`** — `POST` body handling + insert:
- Body field rename: `quantity` → keep at `inventory_count` (API accepts `inventory_count` field)
- Remove `images[]` from body destructure; accept `image_url` (single string) instead
- `insert({ ... })` uses real column names: `price`, `compare_at_price`, `barcode`, `inventory_count`, `low_stock_threshold`, `image_url`, `is_active`
- `activity_log` insert unchanged (`type: 'product_created'` now passes after migration)

**File 2: `apps/web/src/app/api/products/[id]/route.ts`** — `PUT` allowedFields + insert:
- `allowedFields` array: replace `quantity` with `inventory_count`, replace `images` with `image_url`, keep all others
- `activity_log` inserts unchanged (`product_updated`, `product_deleted` now pass after migration)

### Step 2 — Rewrite NewProductPage write path

**File:** `apps/web/src/app/(admin)/revenue/products/new/page.tsx`

- Replace direct Supabase client import + call with `fetch('/api/products', { method: 'POST', body: JSON.stringify(...) })`
- Map form state to API body with correct field names:
  ```ts
  const body = {
    name: name.trim(),
    description: description.trim() || null,
    category,
    price: priceInCents,                 // was price_in_cents
    compare_at_price: compareAtPriceInCents,
    sku: sku.trim() || null,
    barcode: barcode.trim() || null,
    inventory_count: parseInt(inventory, 10) || 0,  // was inventory
    low_stock_threshold: parseInt(lowStockThreshold, 10) || 5,
    image_url: null,                     // not wired in UI yet
    is_active: active,                    // was active
  }
  ```
- Handle response: on success, `router.push(\`/revenue/products/\${data.id}\`)`
- Handle error: set `error` state with the API error message
- Preserve all existing local state (form controlled inputs) — only `handleSave` changes

### Step 3 — Fix read mappers (list + detail)

**File 3: `apps/web/src/app/(admin)/revenue/products/page.tsx`** — list page read mapper:
```ts
const products: Product[] = (data ?? []).map((p: any) => ({
  id: p.id,
  name: p.name || 'Unnamed Product',
  category: (p.category || 'all') as Product['category'],
  priceInCents: p.price ?? 0,                            // was p.price_in_cents
  compareAtPriceInCents: p.compare_at_price || undefined, // was p.compare_at_price_in_cents
  sku: p.sku || '',
  inventory: p.inventory_count ?? 0,                      // was p.inventory
  image: p.image_url || null,                             // already correct
  active: p.is_active ?? true,                            // was p.active
}))
```

**File 4: `apps/web/src/app/(admin)/revenue/products/[id]/page.tsx`** — detail page read mapper: same shape fix pattern, also includes `barcode`, `lowStockThreshold`, `weightOz`, `images`.

Note on `images` in detail: the `ProductDetail` type has `images: string[]`. DB has `image_url: string | null`. Map as: `images: data.image_url ? [data.image_url] : []`.

### Step 4 — Wire detail page Save + Delete (GAP-5)

**File 5: `apps/web/src/app/(admin)/revenue/products/[id]/_components/ProductDetailClient.tsx`**

Add state + handlers:
- `const [saving, setSaving] = useState(false)`
- `const [deleting, setDeleting] = useState(false)`
- `const [error, setError] = useState<string | null>(null)`
- `const router = useRouter()`

`handleSave` function:
```ts
async function handleSave() {
  if (!product) return
  setSaving(true)
  setError(null)
  try {
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, description, category,
        price: priceInCents,
        compare_at_price: compareAtPrice || null,
        inventory_count: inventory,
        low_stock_threshold: lowStockThreshold,
        sku, barcode,
        weight_oz: weightOz,
        is_active: active,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Failed to save')
      return
    }
    router.refresh()
  } finally {
    setSaving(false)
  }
}
```

`handleDelete` function — same pattern, calls `DELETE /api/products/${product.id}`, then `router.push('/revenue/products')`.

Wire buttons:
- `<button onClick={handleDelete} disabled={deleting} data-testid="revenue-products-detail-delete-btn">`
- `<button onClick={handleSave} disabled={saving} data-testid="revenue-products-detail-save-btn">`

Show error under the buttons: `{error && <p data-testid="revenue-products-detail-error" className="text-sm text-red-600">{error}</p>}`

### Step 5 — Seed data-testids

Per Analyst inventory. Edit:
- `NewProductPage` — ~14 testids on inputs + buttons + error block
- `ProductDetailClient` — ~14 testids on inputs + save/delete + toggle
- `ProductsClient` — `revenue-products-add-btn`, `revenue-products-grid-card`, `revenue-products-search-input`, `revenue-products-empty-state`, `revenue-products-category-{value}`
- `revenue/products/new/page.tsx` already has page root ✅
- `revenue/products/page.tsx` uses client component (already has `revenue-products-page-root` via ProductsClient)

### Step 6 — Extend `fixtures/db.ts` + `fixtures/test-data.ts`

**`test-data.ts`**:
```ts
export const E2E_PRODUCT_NAME_PREFIX = 'E2ETestProduct_'
```

**`db.ts`**:
- Add `SeedProductOptions`, `SeededProduct` types
- Add `seedProduct({ studioId, name, price, inventoryCount, ... })` helper
- Add `deleteProduct(productId)` helper
- Extend `resetStudioTestData()` to delete product rows matching `name LIKE 'E2ETestProduct_%'`

### Step 7 — Extend `RevenuePage` POM (no separate ProductsPage file)

Keep all Products helpers in `RevenuePage.ts` — it already covers the Revenue module and has the smoke helpers for `products`, `products/new`, `products/[id]`. Add:

**New locators:**
- `productsAddBtn()`, `productsGridCard()`, `productsSearchInput()`, `productsEmptyState()`
- `productsNewNameInput()`, `productsNewPriceInput()`, `productsNewCategorySelect()`, etc.
- `productsNewSubmitBtn()`, `productsNewCancelLink()`, `productsNewError()`
- `productsDetailSaveBtn()`, `productsDetailDeleteBtn()`, `productsDetailNameInput()`, etc.

**New helpers:**
- `async gotoProductsList()`
- `async gotoNewProduct()`
- `async fillNewProductForm({ name, price, category, ... })`
- `async submitNewProduct()`
- `async gotoProductDetail(id: string)`
- `async updateProductNameAndPrice(name, price)`
- `async saveProductDetail()`
- `async deleteProductDetail()` — handles confirm
- `async expectProductInGrid(name: string)`

### Step 8 — Write spec file

**File:** `apps/web/e2e/revenue-products-crud.spec.ts`

Structure mirrors `revenue-record-payment.spec.ts` (BUG-006 precedent). 9 tests (see Analyst scenarios). Uses `RevenuePage` POM. `beforeEach` + `afterAll` cleanup via `resetStudioTestData()`.

### Step 9 — Run tests

```bash
# Admin project, single feature, 3 repeats for flake detection
npx playwright test revenue-products-crud.spec.ts --project=admin --repeat-each=3
```

### Step 10 — Run admin regression (Sentinel phase)

```bash
npx playwright test --project=admin
```

Make sure nothing else broke from the migration or the code changes.

## File change inventory

| # | File | Change type | LoC est |
|---|---|---|---|
| 1 | `apps/web/supabase/migrations/<ts>_bug009_products_schema_alignment.sql` | create | 20 |
| 2 | `apps/web/src/app/api/products/route.ts` | edit | 15 |
| 3 | `apps/web/src/app/api/products/[id]/route.ts` | edit | 15 |
| 4 | `apps/web/src/app/(admin)/revenue/products/new/page.tsx` | edit | 40 |
| 5 | `apps/web/src/app/(admin)/revenue/products/page.tsx` | edit | 10 |
| 6 | `apps/web/src/app/(admin)/revenue/products/[id]/page.tsx` | edit | 10 |
| 7 | `apps/web/src/app/(admin)/revenue/products/[id]/_components/ProductDetailClient.tsx` | edit | 80 |
| 8 | `apps/web/src/app/(admin)/revenue/products/_components/ProductsClient.tsx` | edit (testids) | 10 |
| 9 | `apps/web/e2e/fixtures/test-data.ts` | edit | 3 |
| 10 | `apps/web/e2e/fixtures/db.ts` | edit | 70 |
| 11 | `apps/web/e2e/pages/RevenuePage.ts` | edit | 120 |
| 12 | `apps/web/e2e/revenue-products-crud.spec.ts` | create | 300 |

Total: ~693 LoC across 12 files. Larger than BUG-006's Tier 3.1 fix (~450 LoC) but within the inline-fix scope — no new feature work, just schema alignment + wiring + tests.

## Risks / open questions

- **Q: Does the migration need to back-fill `low_stock_threshold` for any existing rows?** A: No — `0` existing rows. DEFAULT 5 applies on insert.
- **Q: Does wiring the detail page Save/Delete break the `ProductDetail` type?** A: No — we only add onClick + state. The type shape is unchanged.
- **Q: What happens to `shipping_enabled` and `weight_oz` in the UI?** A: `weight_oz` is already wired in the detail page. `shipping_enabled` is not surfaced — leave untouched; BUG-009 scope is "make Products CRUD work", not "fully expose every DB column".
- **Risk: Activity log constraint drop + re-create is atomic?** A: Yes — Postgres wraps DROP + ADD CONSTRAINT in the same transaction when combined in a migration file. If the ADD fails mid-transaction, Postgres rolls back the DROP.

## Next phase

Engineer: execute steps 0–10 in order. Report back with migration success, test output, and updated todo list.
