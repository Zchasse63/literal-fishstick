/**
 * RevenuePage — POM for the admin Revenue module.
 *
 * Originally a thin Tier 2.4 smoke POM, now extended in Tier 3.1 (Record
 * Payment) with full modal-drive helpers, and again in Tier 3.4 (Products CRUD)
 * with full create/edit/delete helpers for the products surface.
 *
 * Tier 2.4 covered FIVE routes:
 *   - `/revenue` (overview + tabs)
 *   - `/revenue/orders` (merchandise orders list)
 *   - `/revenue/products` (products list)
 *   - `/revenue/products/new` (create product form)
 *   - `/revenue/products/[id]` (product detail — smoked via bogus UUID → not-found branch)
 *
 * Tier 3.4 (Products CRUD) drives the full write path for products — resolves
 * BUG-009 (5-layer schema divergence). Uses these testids:
 *
 *   List page (`/revenue/products`):
 *     - revenue-products-add-btn
 *     - revenue-products-grid-card (data-product-id={id})
 *     - revenue-products-table-row  (data-product-id={id})
 *     - revenue-products-search-input
 *     - revenue-products-category-{value}
 *     - revenue-products-empty-state
 *
 *   New page (`/revenue/products/new`):
 *     - revenue-products-new-name-input
 *     - revenue-products-new-description-input
 *     - revenue-products-new-category-select
 *     - revenue-products-new-price-input
 *     - revenue-products-new-compare-price-input
 *     - revenue-products-new-sku-input
 *     - revenue-products-new-barcode-input
 *     - revenue-products-new-inventory-input
 *     - revenue-products-new-low-stock-input
 *     - revenue-products-new-active-toggle
 *     - revenue-products-new-submit-btn
 *     - revenue-products-new-cancel-link
 *     - revenue-products-new-error
 *
 *   Detail page (`/revenue/products/[id]`):
 *     - revenue-products-detail-save-btn
 *     - revenue-products-detail-delete-btn
 *     - revenue-products-detail-name-input
 *     - revenue-products-detail-description-input
 *     - revenue-products-detail-category-select
 *     - revenue-products-detail-price-input
 *     - revenue-products-detail-compare-price-input
 *     - revenue-products-detail-inventory-input
 *     - revenue-products-detail-low-stock-input
 *     - revenue-products-detail-sku-input
 *     - revenue-products-detail-barcode-input
 *     - revenue-products-detail-weight-input
 *     - revenue-products-detail-active-toggle
 *     - revenue-products-detail-error
 *
 * Tier 3.1 (Record Payment) drives the modal rendered by
 * `revenue/_components/RecordPaymentModal.tsx` — includes its own testid
 * vocabulary:
 *
 *   - `revenue-record-payment-btn`          — header trigger on /revenue
 *   - `revenue-payment-form-dialog`         — DialogContent
 *   - `revenue-payment-form-member-search-input`
 *   - `revenue-payment-form-member-results` — dropdown container
 *   - `revenue-payment-form-member-result`  — per-row (data-member-id={id})
 *   - `revenue-payment-form-member-selected`
 *   - `revenue-payment-form-member-change-btn`
 *   - `revenue-payment-form-amount-input`
 *   - `revenue-payment-form-type-select`
 *   - `revenue-payment-form-method-select`
 *   - `revenue-payment-form-description-input`
 *   - `revenue-payment-form-error`
 *   - `revenue-payment-form-submit-btn`
 *   - `revenue-payment-form-cancel-btn`
 *
 * See `specs/bugs/revenue-record-payment-modal-broken.md` (BUG-006) for the
 * production issues this tier's tests exercise — schema mismatch between the
 * modal's member search (profiles) and the transactions FK (members.id) was
 * fixed as part of this council run.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export const BOGUS_PRODUCT_ID = '00000000-0000-0000-0000-000000000000'

export class RevenuePage extends BasePage {
  // ─── Page root locators (Tier 2.4 smoke) ────────────────
  pageRoot(): Locator {
    return this.byTestId('revenue-page-root')
  }
  ordersPageRoot(): Locator {
    return this.byTestId('revenue-orders-page-root')
  }
  productsPageRoot(): Locator {
    return this.byTestId('revenue-products-page-root')
  }
  productsNewPageRoot(): Locator {
    return this.byTestId('revenue-products-new-page-root')
  }
  productsDetailRoot(): Locator {
    return this.byTestId('revenue-products-detail-root')
  }
  productsDetailNotFound(): Locator {
    return this.byTestId('revenue-products-detail-not-found')
  }

  // ─── Record Payment modal locators (Tier 3.1) ───────────
  recordPaymentBtn(): Locator {
    return this.byTestId('revenue-record-payment-btn')
  }
  paymentDialog(): Locator {
    return this.byTestId('revenue-payment-form-dialog')
  }
  memberSearchInput(): Locator {
    return this.byTestId('revenue-payment-form-member-search-input')
  }
  memberResults(): Locator {
    return this.byTestId('revenue-payment-form-member-results')
  }
  memberResultRow(): Locator {
    return this.byTestId('revenue-payment-form-member-result')
  }
  memberSelected(): Locator {
    return this.byTestId('revenue-payment-form-member-selected')
  }
  memberChangeBtn(): Locator {
    return this.byTestId('revenue-payment-form-member-change-btn')
  }
  amountInput(): Locator {
    return this.byTestId('revenue-payment-form-amount-input')
  }
  typeSelect(): Locator {
    return this.byTestId('revenue-payment-form-type-select')
  }
  methodSelect(): Locator {
    return this.byTestId('revenue-payment-form-method-select')
  }
  descriptionInput(): Locator {
    return this.byTestId('revenue-payment-form-description-input')
  }
  paymentError(): Locator {
    return this.byTestId('revenue-payment-form-error')
  }
  submitBtn(): Locator {
    return this.byTestId('revenue-payment-form-submit-btn')
  }
  cancelBtn(): Locator {
    return this.byTestId('revenue-payment-form-cancel-btn')
  }

  // ─── Tier 2 smoke helpers ────────────────────────────────
  async expectOverviewMounted(): Promise<void> {
    await this.expectSmokeMount('/revenue', this.adminShellLandmark())
    await expect(this.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectOrdersMounted(): Promise<void> {
    await this.expectSmokeMount('/revenue/orders', this.adminShellLandmark())
    await expect(this.ordersPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectProductsMounted(): Promise<void> {
    await this.expectSmokeMount('/revenue/products', this.adminShellLandmark())
    await expect(this.productsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectProductsNewMounted(): Promise<void> {
    await this.expectSmokeMount('/revenue/products/new', this.adminShellLandmark())
    await expect(this.productsNewPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectBogusProductDetailNotFound(): Promise<void> {
    const url = `/revenue/products/${BOGUS_PRODUCT_ID}`
    await this.expectSmokeMount(url, this.adminShellLandmark())
    await expect(this.productsDetailNotFound()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.page.getByText('Product not found')).toBeVisible()
  }

  // ─── Tier 3.1 Record Payment helpers ─────────────────────

  /**
   * Navigate to `/revenue` (admin-authenticated) and wait for the page root
   * + Record Payment button to be ready to click.
   */
  async gotoRevenue(): Promise<void> {
    await this.page.goto('/revenue')
    await expect(this.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.recordPaymentBtn()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /** Click the header "Record Payment" button and wait for the modal. */
  async openRecordPaymentModal(): Promise<void> {
    await this.recordPaymentBtn().click()
    await expect(this.paymentDialog()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.memberSearchInput()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Type into the search input and wait for either (a) a result row containing
   * `name` OR (b) for Playwright's auto-wait to time out. Uses a filter rather
   * than the first row so we handle the search suggesting multiple matches.
   *
   * The search debounce is 300ms, so we give extra headroom with ANIM_TIMEOUT.
   */
  async searchMember(name: string): Promise<void> {
    await this.memberSearchInput().fill(name)
    await expect(this.memberResults()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /** Click the result row whose text contains `name` (typically the seeded full name). */
  async selectMemberResult(name: string): Promise<void> {
    const row = this.memberResultRow().filter({ hasText: name }).first()
    await expect(row).toBeVisible({ timeout: ANIM_TIMEOUT })
    await row.click()
    await expect(this.memberSelected()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /** Click the "Change" link on a selected member card to clear selection. */
  async changeSelectedMember(): Promise<void> {
    await this.memberChangeBtn().click()
    await expect(this.memberSearchInput()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /** Fill the dollar amount input (value in dollars, e.g., "12.50"). */
  async fillAmount(amount: string): Promise<void> {
    await this.amountInput().fill(amount)
  }

  /** Select a payment type from the dropdown (must match PAYMENT_TYPES values). */
  async selectType(value: string): Promise<void> {
    await this.typeSelect().selectOption(value)
  }

  /** Select a payment method (cash/check/bank_transfer/other). */
  async selectPaymentMethod(value: string): Promise<void> {
    await this.methodSelect().selectOption(value)
  }

  /** Fill the optional description field. */
  async fillDescription(text: string): Promise<void> {
    await this.descriptionInput().fill(text)
  }

  /** Click submit. Does NOT wait for the dialog to close — caller decides. */
  async submitPayment(): Promise<void> {
    await this.submitBtn().click()
  }

  /** Click cancel. Closes the dialog without submitting. */
  async cancelPayment(): Promise<void> {
    await this.cancelBtn().click()
    await expect(this.paymentDialog()).toBeHidden({ timeout: ANIM_TIMEOUT })
  }

  /** Assert a validation error is visible with the given (regex or string) text. */
  async expectValidationError(message: string | RegExp): Promise<void> {
    const err = this.paymentError()
    await expect(err).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(err).toContainText(message)
  }

  /** Assert the dialog has closed (used after a successful submit). */
  async expectDialogClosed(): Promise<void> {
    await expect(this.paymentDialog()).toBeHidden({ timeout: ANIM_TIMEOUT })
  }

  // ─── Tier 3.4 Products CRUD locators ────────────────────

  // List page
  productsAddBtn(): Locator {
    return this.byTestId('revenue-products-add-btn')
  }
  productsGridCard(): Locator {
    return this.byTestId('revenue-products-grid-card')
  }
  productsSearchInput(): Locator {
    return this.byTestId('revenue-products-search-input')
  }
  productsCategoryPill(value: string): Locator {
    return this.byTestId(`revenue-products-category-${value}`)
  }
  productsEmptyState(): Locator {
    return this.byTestId('revenue-products-empty-state')
  }

  // New page
  productsNewNameInput(): Locator {
    return this.byTestId('revenue-products-new-name-input')
  }
  productsNewDescriptionInput(): Locator {
    return this.byTestId('revenue-products-new-description-input')
  }
  productsNewCategorySelect(): Locator {
    return this.byTestId('revenue-products-new-category-select')
  }
  productsNewPriceInput(): Locator {
    return this.byTestId('revenue-products-new-price-input')
  }
  productsNewComparePriceInput(): Locator {
    return this.byTestId('revenue-products-new-compare-price-input')
  }
  productsNewSkuInput(): Locator {
    return this.byTestId('revenue-products-new-sku-input')
  }
  productsNewBarcodeInput(): Locator {
    return this.byTestId('revenue-products-new-barcode-input')
  }
  productsNewInventoryInput(): Locator {
    return this.byTestId('revenue-products-new-inventory-input')
  }
  productsNewLowStockInput(): Locator {
    return this.byTestId('revenue-products-new-low-stock-input')
  }
  productsNewActiveToggle(): Locator {
    return this.byTestId('revenue-products-new-active-toggle')
  }
  productsNewSubmitBtn(): Locator {
    return this.byTestId('revenue-products-new-submit-btn')
  }
  productsNewCancelLink(): Locator {
    return this.byTestId('revenue-products-new-cancel-link')
  }
  productsNewError(): Locator {
    return this.byTestId('revenue-products-new-error')
  }

  // Detail page
  productsDetailSaveBtn(): Locator {
    return this.byTestId('revenue-products-detail-save-btn')
  }
  productsDetailDeleteBtn(): Locator {
    return this.byTestId('revenue-products-detail-delete-btn')
  }
  productsDetailNameInput(): Locator {
    return this.byTestId('revenue-products-detail-name-input')
  }
  productsDetailDescriptionInput(): Locator {
    return this.byTestId('revenue-products-detail-description-input')
  }
  productsDetailCategorySelect(): Locator {
    return this.byTestId('revenue-products-detail-category-select')
  }
  productsDetailPriceInput(): Locator {
    return this.byTestId('revenue-products-detail-price-input')
  }
  productsDetailComparePriceInput(): Locator {
    return this.byTestId('revenue-products-detail-compare-price-input')
  }
  productsDetailInventoryInput(): Locator {
    return this.byTestId('revenue-products-detail-inventory-input')
  }
  productsDetailLowStockInput(): Locator {
    return this.byTestId('revenue-products-detail-low-stock-input')
  }
  productsDetailSkuInput(): Locator {
    return this.byTestId('revenue-products-detail-sku-input')
  }
  productsDetailBarcodeInput(): Locator {
    return this.byTestId('revenue-products-detail-barcode-input')
  }
  productsDetailWeightInput(): Locator {
    return this.byTestId('revenue-products-detail-weight-input')
  }
  productsDetailActiveToggle(): Locator {
    return this.byTestId('revenue-products-detail-active-toggle')
  }
  productsDetailError(): Locator {
    return this.byTestId('revenue-products-detail-error')
  }

  // ─── Tier 3.4 Products CRUD helpers ──────────────────────

  /** Navigate to `/revenue/products` and wait for the list page to mount. */
  async gotoProductsList(): Promise<void> {
    await this.page.goto('/revenue/products')
    await expect(this.productsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.productsAddBtn()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /** Navigate directly to `/revenue/products/new`. */
  async gotoNewProduct(): Promise<void> {
    await this.page.goto('/revenue/products/new')
    await expect(this.productsNewPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.productsNewNameInput()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /** Click the Add Product link on the list page and wait for the new form. */
  async clickAddProduct(): Promise<void> {
    await this.productsAddBtn().click()
    await expect(this.productsNewPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.productsNewNameInput()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Fill the New Product form with the provided fields. Omitted fields keep
   * their current value (caller can seed defaults by setting them explicitly).
   * Price is provided in dollars (as a string) to match the input.
   */
  async fillNewProductForm(fields: {
    name?: string
    description?: string
    category?: string
    priceDollars?: string
    comparePriceDollars?: string
    sku?: string
    barcode?: string
    inventory?: string
    lowStockThreshold?: string
  }): Promise<void> {
    if (fields.name !== undefined) await this.productsNewNameInput().fill(fields.name)
    if (fields.description !== undefined) await this.productsNewDescriptionInput().fill(fields.description)
    if (fields.category !== undefined) await this.productsNewCategorySelect().selectOption(fields.category)
    if (fields.priceDollars !== undefined) await this.productsNewPriceInput().fill(fields.priceDollars)
    if (fields.comparePriceDollars !== undefined) await this.productsNewComparePriceInput().fill(fields.comparePriceDollars)
    if (fields.sku !== undefined) await this.productsNewSkuInput().fill(fields.sku)
    if (fields.barcode !== undefined) await this.productsNewBarcodeInput().fill(fields.barcode)
    if (fields.inventory !== undefined) await this.productsNewInventoryInput().fill(fields.inventory)
    if (fields.lowStockThreshold !== undefined) await this.productsNewLowStockInput().fill(fields.lowStockThreshold)
  }

  /** Click Create Product. Does NOT wait for navigation — caller decides. */
  async submitNewProduct(): Promise<void> {
    await this.productsNewSubmitBtn().click()
  }

  /** Assert the New Product error block is visible with optional text match. */
  async expectNewProductError(message?: string | RegExp): Promise<void> {
    const err = this.productsNewError()
    await expect(err).toBeVisible({ timeout: ANIM_TIMEOUT })
    if (message !== undefined) await expect(err).toContainText(message)
  }

  /** Navigate directly to a product detail page by id. */
  async gotoProductDetail(productId: string): Promise<void> {
    await this.page.goto(`/revenue/products/${productId}`)
    await expect(this.productsDetailRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.productsDetailNameInput()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Fill the detail page form with the provided fields. Any undefined field
   * is left unchanged. `priceDollars` is provided in dollars.
   */
  async fillProductDetailForm(fields: {
    name?: string
    description?: string
    category?: string
    priceDollars?: string
    comparePriceDollars?: string
    inventory?: string
    lowStockThreshold?: string
    sku?: string
    barcode?: string
    weight?: string
  }): Promise<void> {
    if (fields.name !== undefined) await this.productsDetailNameInput().fill(fields.name)
    if (fields.description !== undefined) await this.productsDetailDescriptionInput().fill(fields.description)
    if (fields.category !== undefined) await this.productsDetailCategorySelect().selectOption(fields.category)
    if (fields.priceDollars !== undefined) await this.productsDetailPriceInput().fill(fields.priceDollars)
    if (fields.comparePriceDollars !== undefined) await this.productsDetailComparePriceInput().fill(fields.comparePriceDollars)
    if (fields.inventory !== undefined) await this.productsDetailInventoryInput().fill(fields.inventory)
    if (fields.lowStockThreshold !== undefined) await this.productsDetailLowStockInput().fill(fields.lowStockThreshold)
    if (fields.sku !== undefined) await this.productsDetailSkuInput().fill(fields.sku)
    if (fields.barcode !== undefined) await this.productsDetailBarcodeInput().fill(fields.barcode)
    if (fields.weight !== undefined) await this.productsDetailWeightInput().fill(fields.weight)
  }

  /** Click Save Changes on the detail page. */
  async saveProductDetail(): Promise<void> {
    await this.productsDetailSaveBtn().click()
  }

  /**
   * Click Delete on the detail page. Accepts the native confirm() dialog
   * automatically via a one-shot handler. If `dismiss` is true, dismisses
   * the confirm instead (useful for testing the "cancel delete" case).
   */
  async deleteProductDetail(opts: { dismiss?: boolean } = {}): Promise<void> {
    const dismiss = opts.dismiss ?? false
    this.page.once('dialog', async (dialog) => {
      if (dismiss) await dialog.dismiss()
      else await dialog.accept()
    })
    await this.productsDetailDeleteBtn().click()
  }

  /** Search the products list by name or SKU. */
  async searchProducts(query: string): Promise<void> {
    await this.productsSearchInput().fill(query)
  }

  /**
   * Assert a grid card with the given product name is visible on the list.
   * Uses a scoped text filter since the grid card does not expose the name
   * as a testid (that would be over-indexing — one row can have many products).
   */
  async expectProductInGrid(name: string): Promise<void> {
    const card = this.productsGridCard().filter({ hasText: name }).first()
    await expect(card).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /** Assert that the grid has zero cards matching the given product name. */
  async expectProductNotInGrid(name: string): Promise<void> {
    const card = this.productsGridCard().filter({ hasText: name })
    await expect(card).toHaveCount(0, { timeout: ANIM_TIMEOUT })
  }
}
