/**
 * UtilityPages — thin POM for 3 standalone admin routes that don't
 * belong to a larger module.
 *
 * Tier 2.10 smoke covers 3 static routes:
 *   - `/segments`  (Smart Segments — AI-driven member segmentation)
 *   - `/engagement` (Gamification / Leaderboard / Achievements / Challenges)
 *   - `/docs/api`  (Swagger UI API reference)
 *
 * All writes (create/update/delete segments, achievement config,
 * challenge creation, custom leaderboard rules) are deferred to later
 * tiers. `/docs/api` is read-only (renders the OpenAPI spec via
 * dynamically imported SwaggerUI); there is no write flow to cover.
 *
 * These 3 routes share no data/UI patterns, but they share the same
 * Tier 2 smoke contract ("landmark + testid + no pageerrors"), so they
 * are grouped into one POM to avoid creating 3 near-identical files.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export class UtilityPages extends BasePage {
  // ─── Locators ────────────────────────────────────────────
  segmentsPageRoot(): Locator { return this.byTestId('segments-page-root') }
  engagementPageRoot(): Locator { return this.byTestId('engagement-page-root') }
  docsApiPageRoot(): Locator { return this.byTestId('docs-api-page-root') }

  // ─── Mount helpers ───────────────────────────────────────
  async expectSegmentsMounted(): Promise<void> {
    await this.expectSmokeMount('/segments', this.adminShellLandmark())
    await expect(this.segmentsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectEngagementMounted(): Promise<void> {
    await this.expectSmokeMount('/engagement', this.adminShellLandmark())
    await expect(this.engagementPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectDocsApiMounted(): Promise<void> {
    await this.expectSmokeMount('/docs/api', this.adminShellLandmark())
    await expect(this.docsApiPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }
}
