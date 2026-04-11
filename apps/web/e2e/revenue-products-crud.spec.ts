/**
 * Revenue: Products CRUD — Tier 3.4 council run.
 *
 * The full write-flow for the merchandise catalog: create a product, read it
 * on the list + detail pages, update it, soft-delete it. Before this tier,
 * zero products had ever been created — BUG-009 documented a 5-layer schema
 * divergence (UI → phantom columns, API → different phantom columns, activity
 * log → missing enum values, read mappers → silent corruption, Save/Delete
 * buttons → unwired stubs). All five fixed inline in this council run.
 *
 * Contract (same as Tier 3.1):
 *   1. beforeEach wipes the studio via resetStudioTestData()
 *   2. Tests drive the UI through the admin project
 *   3. After each write, tests assert the row landed in Postgres with the
 *      correct DB column names (price / inventory_count / is_active /
 *      image_url / compare_at_price / barcode / low_stock_threshold)
 *   4. Tests also assert activity_log entries for created/updated/deleted
 *   5. afterAll runs resetStudioTestData() as belt-and-braces cleanup
 */
import { test, expect } from '@playwright/test'
import { RevenuePage } from './pages/RevenuePage'
import {
  seedProduct,
  resetStudioTestData,
  testDb,
  type SeededProduct,
} from './fixtures/db'
import {
  E2E_PRODUCT_NAME_PREFIX,
  DEFAULT_STUDIO_ID,
} from './fixtures/test-data'

// Unique per-run tag so parallel workers never collide on names.
function uniqueName(label: string): string {
  return `${E2E_PRODUCT_NAME_PREFIX}${label}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

test.describe('Revenue — Products CRUD (Tier 3.4)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // P0 — Happy path (create) with full DB assertion
  // ---------------------------------------------------------------------

  test('creates a product end-to-end and writes all fields to the DB @p0', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    const name = uniqueName('HappyPath')

    await pom.gotoProductsList()
    await pom.clickAddProduct()

    await pom.fillNewProductForm({
      name,
      description: 'A product seeded by the Tier 3.4 suite.',
      category: 'apparel',
      priceDollars: '25.00',
      comparePriceDollars: '35.00',
      sku: 'E2E-SKU-001',
      barcode: 'E2E-BC-001',
      inventory: '12',
      lowStockThreshold: '3',
    })
    await pom.submitNewProduct()

    // The page redirects to /revenue/products/{id} on success — wait for the
    // detail root + name input to confirm the write path completed.
    await expect(pom.productsDetailRoot()).toBeVisible()
    await expect(pom.productsDetailNameInput()).toHaveValue(name)

    // Assert the DB row with DB-canonical column names
    const { data: rows, error } = await testDb
      .from('products')
      .select(
        'id, studio_id, name, description, category, price, compare_at_price, sku, barcode, inventory_count, low_stock_threshold, image_url, is_active'
      )
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('name', name)
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
    const row = rows![0]
    expect(row.description).toBe('A product seeded by the Tier 3.4 suite.')
    expect(row.category).toBe('apparel')
    expect(row.price).toBe(2500)
    expect(row.compare_at_price).toBe(3500)
    expect(row.sku).toBe('E2E-SKU-001')
    expect(row.barcode).toBe('E2E-BC-001')
    expect(row.inventory_count).toBe(12)
    expect(row.low_stock_threshold).toBe(3)
    expect(row.image_url).toBeNull()
    expect(row.is_active).toBe(true)

    // activity_log should show the creation event
    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, subject_type, subject_id, metadata')
      .eq('subject_type', 'product')
      .eq('subject_id', row.id)
    expect(logs?.some((l) => l.type === 'product_created')).toBe(true)
  })

  // ---------------------------------------------------------------------
  // P0 — Minimal field create (defaults pathway)
  // ---------------------------------------------------------------------

  test('creates a product with only required fields and applies DB defaults @p0', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    const name = uniqueName('Minimal')

    await pom.gotoNewProduct()
    await pom.fillNewProductForm({
      name,
      priceDollars: '10.00',
    })
    await pom.submitNewProduct()

    await expect(pom.productsDetailRoot()).toBeVisible()

    const { data: rows } = await testDb
      .from('products')
      .select('price, inventory_count, is_active, low_stock_threshold, category')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('name', name)
    expect(rows).toHaveLength(1)
    const row = rows![0]
    expect(row.price).toBe(1000)
    // inventory defaults to 0 from the form state, but the API default is 0
    expect(row.inventory_count).toBe(0)
    expect(row.is_active).toBe(true)
    expect(row.low_stock_threshold).toBe(5)
    // UI defaults to 'apparel' when nothing is picked
    expect(row.category).toBe('apparel')
  })

  // ---------------------------------------------------------------------
  // P1 — Validation (client-side): blank name blocks write
  // ---------------------------------------------------------------------

  test('blocks submission when product name is blank @p1', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)

    await pom.gotoNewProduct()
    await pom.fillNewProductForm({ priceDollars: '12' })
    await pom.submitNewProduct()

    await pom.expectNewProductError(/name is required/i)

    // No row written — count should still be zero
    const { count } = await testDb
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .like('name', `${E2E_PRODUCT_NAME_PREFIX}%`)
    expect(count).toBe(0)
  })

  // ---------------------------------------------------------------------
  // P1 — Validation: zero price blocks write
  // ---------------------------------------------------------------------

  test('blocks submission when price is zero @p1', async ({ page }) => {
    const pom = new RevenuePage(page)
    const name = uniqueName('ZeroPrice')

    await pom.gotoNewProduct()
    await pom.fillNewProductForm({ name, priceDollars: '0' })
    await pom.submitNewProduct()

    await pom.expectNewProductError(/greater than zero/i)

    const { count } = await testDb
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('name', name)
    expect(count).toBe(0)
  })

  // ---------------------------------------------------------------------
  // P0 — Read path: list page renders a seeded product with real numbers
  // ---------------------------------------------------------------------

  test('list page displays a seeded product with correct price in the grid @p0', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    const seeded: SeededProduct = await seedProduct({
      name: uniqueName('ListRead'),
      price: 4200,
      inventoryCount: 7,
    })

    await pom.gotoProductsList()
    await pom.expectProductInGrid(seeded.name)

    // The grid card should show the real price — before BUG-009 was fixed,
    // the mapper silently returned 0 and the UI rendered "$0.00" for every row.
    const card = pom.productsGridCard().filter({ hasText: seeded.name }).first()
    await expect(card).toContainText('$42.00')
    await expect(card).toContainText('7 in stock')
  })

  // ---------------------------------------------------------------------
  // P0 — Read path: detail page pre-fills all fields from the DB
  // ---------------------------------------------------------------------

  test('detail page loads an existing product and pre-fills its fields @p0', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    const seeded = await seedProduct({
      name: uniqueName('DetailRead'),
      description: 'Seeded description for detail read',
      price: 1599,
      compareAtPrice: 1999,
      sku: 'DR-SKU',
      barcode: 'DR-BC',
      inventoryCount: 3,
      lowStockThreshold: 1,
    })

    await pom.gotoProductDetail(seeded.productId)

    await expect(pom.productsDetailNameInput()).toHaveValue(seeded.name)
    await expect(pom.productsDetailDescriptionInput()).toHaveValue(
      'Seeded description for detail read'
    )
    await expect(pom.productsDetailPriceInput()).toHaveValue('15.99')
    await expect(pom.productsDetailComparePriceInput()).toHaveValue('19.99')
    await expect(pom.productsDetailInventoryInput()).toHaveValue('3')
    await expect(pom.productsDetailLowStockInput()).toHaveValue('1')
    await expect(pom.productsDetailSkuInput()).toHaveValue('DR-SKU')
    await expect(pom.productsDetailBarcodeInput()).toHaveValue('DR-BC')
  })

  // ---------------------------------------------------------------------
  // P0 — Update via the detail page Save button (wires GAP-5)
  // ---------------------------------------------------------------------

  test('updates a product via detail page Save and persists the new values @p0', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    const seeded = await seedProduct({
      name: uniqueName('Update'),
      price: 1000,
      inventoryCount: 5,
    })

    await pom.gotoProductDetail(seeded.productId)

    // Change price + inventory
    await pom.fillProductDetailForm({
      priceDollars: '15.50',
      inventory: '20',
    })
    await pom.saveProductDetail()

    // The Save button returns to its idle state once the fetch resolves +
    // router.refresh() reconciles. Wait for that before asserting the DB.
    await expect(pom.productsDetailSaveBtn()).toBeEnabled()

    const { data: rows } = await testDb
      .from('products')
      .select('price, inventory_count')
      .eq('id', seeded.productId)
    expect(rows).toHaveLength(1)
    expect(rows![0].price).toBe(1550)
    expect(rows![0].inventory_count).toBe(20)

    // activity_log should record the update
    const { data: logs } = await testDb
      .from('activity_log')
      .select('type')
      .eq('subject_type', 'product')
      .eq('subject_id', seeded.productId)
    expect(logs?.some((l) => l.type === 'product_updated')).toBe(true)
  })

  // ---------------------------------------------------------------------
  // P0 — Soft-delete via the detail page Delete button (wires GAP-5)
  // ---------------------------------------------------------------------

  test('soft-deletes a product via detail page Delete and flips is_active @p0', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    const seeded = await seedProduct({
      name: uniqueName('Delete'),
      price: 2000,
    })

    await pom.gotoProductDetail(seeded.productId)
    await pom.deleteProductDetail()

    // After accepting the confirm, the page navigates back to the list
    await expect(pom.productsPageRoot()).toBeVisible()

    // The row is still there but is_active = false
    const { data: rows } = await testDb
      .from('products')
      .select('id, is_active')
      .eq('id', seeded.productId)
    expect(rows).toHaveLength(1)
    expect(rows![0].is_active).toBe(false)

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type')
      .eq('subject_type', 'product')
      .eq('subject_id', seeded.productId)
    expect(logs?.some((l) => l.type === 'product_deleted')).toBe(true)
  })

  // ---------------------------------------------------------------------
  // P1 — Search on the list page narrows to a seeded product
  // ---------------------------------------------------------------------

  test('list search filters the grid to matching products @p1', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    const keep = await seedProduct({ name: uniqueName('Search_KEEP') })
    const drop = await seedProduct({ name: uniqueName('Search_DROP') })

    await pom.gotoProductsList()
    await pom.expectProductInGrid(keep.name)
    await pom.expectProductInGrid(drop.name)

    // Search for just the "KEEP" marker — both products start with
    // E2E_PRODUCT_NAME_PREFIX so we search on the tail half to disambiguate.
    await pom.searchProducts('KEEP')
    await pom.expectProductInGrid(keep.name)
    await pom.expectProductNotInGrid(drop.name)
  })
})
