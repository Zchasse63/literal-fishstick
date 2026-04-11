/**
 * Corporate smoke tests — Tier 2.6.
 *
 * Baseline page-mount coverage for the Corporate module (4 routes).
 * Uses the shared Tier 2 smoke infrastructure (`BasePage.expectSmokeMount`,
 * `adminShellLandmark`).
 *
 * Five tests covering the smoke contract for all 4 routes:
 *   1. `/corporate` overview mounts — metrics row + pipeline + events + invoices
 *   2. `/corporate` → "New Account" header CTA rendered (content semantics)
 *   3. `/corporate/new` mounts — create-company form
 *   4. `/corporate/events` mounts — event calendar
 *   5. `/corporate/[bogus-uuid]` mounts + renders not-found fallback
 *
 * Happy-path company detail (seeded company with credit history, allocation
 * panel) and write flows (create account, allocate credits, event CRUD) are
 * deferred to Tier 4 (Corporate & Operations) per the QA roadmap.
 */
import { test, expect } from '@playwright/test'
import { CorporatePage } from './pages/CorporatePage'
import { ANIM_TIMEOUT } from './pages/BasePage'

test.describe('Corporate — Smoke (Tier 2.6)', () => {
  // ---------------------------------------------------------------------
  // P0 — core mount contract for the module overview
  // ---------------------------------------------------------------------

  test('/corporate mounts — admin shell + corporate-page-root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new CorporatePage(page)
    await pom.expectOverviewMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — content semantics + sub-page smokes
  // ---------------------------------------------------------------------

  test('/corporate → "New Account" header CTA rendered @p1', async ({ page }) => {
    // Content-level signal: CorporateClient renders a "New Account" primary
    // link in the header (CorporateClient.tsx:219-225) that points to
    // /corporate/new. The create flow itself is exercised in Tier 4.
    const pom = new CorporatePage(page)
    await pom.expectOverviewMounted()
    await expect(
      page.getByRole('link', { name: /New Account/ }).first(),
    ).toBeVisible({ timeout: ANIM_TIMEOUT })
  })

  test('/corporate/new mounts — admin shell + create-company form visible @p1', async ({
    page,
  }) => {
    // Pure client form (no server reads on mount). Smoke proves the form
    // scaffolding renders without any seeded data.
    const pom = new CorporatePage(page)
    await pom.expectNewMounted()
    await expect(
      page.getByRole('button', { name: /Save Account/ }),
    ).toBeVisible({ timeout: ANIM_TIMEOUT })
  })

  test('/corporate/events mounts — admin shell + event calendar visible @p1', async ({
    page,
  }) => {
    const pom = new CorporatePage(page)
    await pom.expectEventsMounted()
  })

  test('/corporate/[bogus-uuid] mounts + renders not-found fallback @p1', async ({
    page,
  }) => {
    // Server-component fetch returns null for a well-formed-but-nonexistent
    // UUID, and CompanyDetailClient renders the "Company not found" branch
    // keyed by `data-testid="corporate-detail-not-found"`.
    const pom = new CorporatePage(page)
    await pom.expectBogusCompanyDetailNotFound()
  })
})
