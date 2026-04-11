/**
 * Revenue smoke tests — Tier 2.4.
 *
 * Baseline page-mount coverage for the entire Revenue module (5 routes).
 * Uses the shared Tier 2 smoke infrastructure (`BasePage.expectSmokeMount`,
 * `adminShellLandmark`).
 *
 * Six tests covering the smoke contract for all 5 pages:
 *   1. `/revenue` mounts — overview tab + metrics row + tabs
 *   2. `/revenue` → "Record Payment" button rendered (content semantics)
 *   3. `/revenue/orders` mounts — orders list page
 *   4. `/revenue/products` mounts — products list page
 *   5. `/revenue/products/new` mounts — create-product form page
 *   6. `/revenue/products/[bogus-uuid]` mounts + renders not-found fallback
 *
 * Happy-path detail coverage (seeded product, full form rendered) is deferred
 * to Tier 3.4 (Revenue: Product Create/Edit/Archive).
 */
import { test, expect } from '@playwright/test'
import { RevenuePage } from './pages/RevenuePage'
import { ANIM_TIMEOUT } from './pages/BasePage'

test.describe('Revenue — Smoke (Tier 2.4)', () => {
  // ---------------------------------------------------------------------
  // P0 — core mount contracts for each page
  // ---------------------------------------------------------------------

  test('/revenue mounts — admin shell + revenue-page-root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    await pom.expectOverviewMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — content semantics + sub-page smokes
  // ---------------------------------------------------------------------

  test('/revenue → "Record Payment" header button rendered @p1', async ({ page }) => {
    // Content-level signal: RevenuePage renders a "Record Payment" primary
    // button in the header (revenue/page.tsx:590-596). This button opens the
    // Record Payment modal — Tier 3.1 will exercise the modal itself.
    const pom = new RevenuePage(page)
    await pom.goto('/revenue')
    await expect(pom.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(
      page.getByRole('button', { name: 'Record Payment', exact: true }),
    ).toBeVisible({ timeout: ANIM_TIMEOUT })
  })

  test('/revenue/orders mounts — admin shell + revenue-orders-page-root visible @p1', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    await pom.expectOrdersMounted()
  })

  test('/revenue/products mounts — admin shell + revenue-products-page-root visible @p1', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    await pom.expectProductsMounted()
  })

  test('/revenue/products/new mounts — admin shell + create-product form visible @p1', async ({
    page,
  }) => {
    // Proves the form scaffolding renders without any seeded data —
    // this is a pure client form, no Supabase reads on mount.
    const pom = new RevenuePage(page)
    await pom.expectProductsNewMounted()
    await expect(
      page.getByRole('button', { name: /Create Product/ }),
    ).toBeVisible({ timeout: ANIM_TIMEOUT })
  })

  test('/revenue/products/[bogus-uuid] mounts + renders not-found fallback @p1', async ({
    page,
  }) => {
    // Server-component fetch returns null for a well-formed-but-nonexistent
    // UUID, and ProductDetailClient renders the "Product not found" branch
    // keyed by `data-testid="revenue-products-detail-not-found"`.
    const pom = new RevenuePage(page)
    await pom.expectBogusProductDetailNotFound()
  })
})
