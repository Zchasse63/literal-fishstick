/**
 * AnalyticsPage — thin POM for the admin Analytics module.
 *
 * Tier 2.7 smoke — the LARGEST Tier 2 run — covers 16 routes:
 *   Static (13):
 *     - `/analytics` (KPI overview + AI briefing hub)
 *     - `/analytics/dashboards` (list of pre-built dashboards)
 *     - `/analytics/dashboards/executive`
 *     - `/analytics/dashboards/operations`
 *     - `/analytics/dashboards/growth`
 *     - `/analytics/kpi` (deep-dive tab, customizable)
 *     - `/analytics/insights` (AI-generated insights feed)
 *     - `/analytics/migration` (Glofox data migration tool)
 *     - `/analytics/reports` (saved-report library)
 *     - `/analytics/reports/new` (report builder wizard)
 *     - `/analytics/pricing` (pricing simulator list)
 *     - `/analytics/pricing/new` (new simulation wizard)
 *     - `/analytics/trainers` (trainer performance list)
 *
 *   Dynamic (3 — smoked via bogus UUID):
 *     - `/analytics/reports/[id]` — no not-found branch, renders default report
 *     - `/analytics/pricing/[id]` — no not-found branch, renders empty simulation
 *     - `/analytics/trainers/[id]` — HAS not-found branch → use `analytics-trainers-detail-not-found`
 *
 * Happy-path detail coverage for reports/pricing/trainers with seeded data,
 * plus all writes (create report, apply pricing change, etc.) is deferred to
 * Tier 6 (Analytics & Insights) per the QA roadmap.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export const BOGUS_ANALYTICS_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Extended timeout for the heaviest analytics client components.
 *
 * The KPI (1017 LoC), Migration (858 LoC), Executive (606 LoC), Growth (568
 * LoC), and Operations (448 LoC) dashboards all embed multiple Recharts trees
 * and are compiled on-demand by the Next.js dev server. Under full-regression
 * load, the cold-compile latency occasionally pushes the first visit past the
 * standard 10s ANIM_TIMEOUT, producing a spurious `toBeVisible` timeout even
 * though the page content is already in the DOM (verified via Playwright's
 * error-context snapshot). Bumping the testid visibility window to 20s for
 * these five routes removes the flake without affecting the rest of the suite.
 */
const HEAVY_TIMEOUT = 20_000

export class AnalyticsPage extends BasePage {
  // ─── Locators ────────────────────────────────────────────
  pageRoot(): Locator { return this.byTestId('analytics-page-root') }
  dashboardsPageRoot(): Locator { return this.byTestId('analytics-dashboards-page-root') }
  dashboardsExecutiveRoot(): Locator { return this.byTestId('analytics-dashboards-executive-page-root') }
  dashboardsOperationsRoot(): Locator { return this.byTestId('analytics-dashboards-operations-page-root') }
  dashboardsGrowthRoot(): Locator { return this.byTestId('analytics-dashboards-growth-page-root') }
  kpiPageRoot(): Locator { return this.byTestId('analytics-kpi-page-root') }
  insightsPageRoot(): Locator { return this.byTestId('analytics-insights-page-root') }
  migrationPageRoot(): Locator { return this.byTestId('analytics-migration-page-root') }
  reportsPageRoot(): Locator { return this.byTestId('analytics-reports-page-root') }
  reportsNewPageRoot(): Locator { return this.byTestId('analytics-reports-new-page-root') }
  reportsDetailRoot(): Locator { return this.byTestId('analytics-reports-detail-root') }
  pricingPageRoot(): Locator { return this.byTestId('analytics-pricing-page-root') }
  pricingNewPageRoot(): Locator { return this.byTestId('analytics-pricing-new-page-root') }
  pricingDetailRoot(): Locator { return this.byTestId('analytics-pricing-detail-root') }
  trainersPageRoot(): Locator { return this.byTestId('analytics-trainers-page-root') }
  trainersDetailRoot(): Locator { return this.byTestId('analytics-trainers-detail-root') }
  trainersDetailNotFound(): Locator { return this.byTestId('analytics-trainers-detail-not-found') }

  // ─── Mount helpers ───────────────────────────────────────
  async expectMainMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics', this.adminShellLandmark())
    await expect(this.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectDashboardsMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/dashboards', this.adminShellLandmark())
    await expect(this.dashboardsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectDashboardsExecutiveMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/dashboards/executive', this.adminShellLandmark())
    await expect(this.dashboardsExecutiveRoot()).toBeVisible({ timeout: HEAVY_TIMEOUT })
  }

  async expectDashboardsOperationsMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/dashboards/operations', this.adminShellLandmark())
    await expect(this.dashboardsOperationsRoot()).toBeVisible({ timeout: HEAVY_TIMEOUT })
  }

  async expectDashboardsGrowthMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/dashboards/growth', this.adminShellLandmark())
    await expect(this.dashboardsGrowthRoot()).toBeVisible({ timeout: HEAVY_TIMEOUT })
  }

  async expectKpiMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/kpi', this.adminShellLandmark())
    await expect(this.kpiPageRoot()).toBeVisible({ timeout: HEAVY_TIMEOUT })
  }

  async expectInsightsMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/insights', this.adminShellLandmark())
    await expect(this.insightsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectMigrationMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/migration', this.adminShellLandmark())
    await expect(this.migrationPageRoot()).toBeVisible({ timeout: HEAVY_TIMEOUT })
  }

  async expectReportsMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/reports', this.adminShellLandmark())
    await expect(this.reportsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectReportsNewMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/reports/new', this.adminShellLandmark())
    await expect(this.reportsNewPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectBogusReportDetailMounted(): Promise<void> {
    // Server component uses `report?.name ?? 'Report'` fallback — no not-found
    // branch. Bogus UUID still mounts the viewer with default data.
    const url = `/analytics/reports/${BOGUS_ANALYTICS_ID}`
    await this.expectSmokeMount(url, this.adminShellLandmark())
    await expect(this.reportsDetailRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectPricingMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/pricing', this.adminShellLandmark())
    await expect(this.pricingPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectPricingNewMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/pricing/new', this.adminShellLandmark())
    await expect(this.pricingNewPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectBogusPricingDetailMounted(): Promise<void> {
    // Server component creates an empty simulation if `data === null`. Still
    // renders the viewer — no explicit not-found branch.
    const url = `/analytics/pricing/${BOGUS_ANALYTICS_ID}`
    await this.expectSmokeMount(url, this.adminShellLandmark())
    await expect(this.pricingDetailRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectTrainersMounted(): Promise<void> {
    await this.expectSmokeMount('/analytics/trainers', this.adminShellLandmark())
    await expect(this.trainersPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectBogusTrainerDetailNotFound(): Promise<void> {
    // TrainerDetailClient has an explicit `!TRAINER || !TRAINER.id` branch.
    const url = `/analytics/trainers/${BOGUS_ANALYTICS_ID}`
    await this.expectSmokeMount(url, this.adminShellLandmark())
    await expect(this.trainersDetailNotFound()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.page.getByText('Trainer not found')).toBeVisible()
  }
}
