/**
 * CorporatePage — thin POM for the admin Corporate module.
 *
 * Tier 2.6 smoke covers FOUR routes:
 *   - `/corporate` (overview: metrics + pipeline + upcoming events + invoices)
 *   - `/corporate/new` (create company form)
 *   - `/corporate/events` (event calendar)
 *   - `/corporate/[id]` (company detail — smoked via bogus UUID → not-found branch)
 *
 * Happy-path company detail (seeded company rendered with credit history,
 * allocation panel, etc.) is deferred to Tier 4 (Corporate & Operations) per
 * the QA roadmap. Both testid paths (`corporate-detail-not-found` and
 * `corporate-detail-root`) are seeded on `CompanyDetailClient` so Tier 4 can
 * reuse this POM without re-editing source.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export const BOGUS_COMPANY_ID = '00000000-0000-0000-0000-000000000000'

export class CorporatePage extends BasePage {
  // ─── Locators ────────────────────────────────────────────
  pageRoot(): Locator {
    return this.byTestId('corporate-page-root')
  }
  newPageRoot(): Locator {
    return this.byTestId('corporate-new-page-root')
  }
  eventsPageRoot(): Locator {
    return this.byTestId('corporate-events-page-root')
  }
  detailRoot(): Locator {
    return this.byTestId('corporate-detail-root')
  }
  detailNotFound(): Locator {
    return this.byTestId('corporate-detail-not-found')
  }

  // ─── Mount helpers ───────────────────────────────────────
  async expectOverviewMounted(): Promise<void> {
    await this.expectSmokeMount('/corporate', this.adminShellLandmark())
    await expect(this.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectNewMounted(): Promise<void> {
    await this.expectSmokeMount('/corporate/new', this.adminShellLandmark())
    await expect(this.newPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectEventsMounted(): Promise<void> {
    await this.expectSmokeMount('/corporate/events', this.adminShellLandmark())
    await expect(this.eventsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectBogusCompanyDetailNotFound(): Promise<void> {
    const url = `/corporate/${BOGUS_COMPANY_ID}`
    await this.expectSmokeMount(url, this.adminShellLandmark())
    await expect(this.detailNotFound()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.page.getByText('Company not found')).toBeVisible()
  }
}
