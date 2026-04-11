/**
 * Analytics smoke tests — Tier 2.7 (the LARGEST Tier 2 run).
 *
 * Baseline page-mount coverage for the Analytics module — 16 routes:
 *   Static (13):
 *     - /analytics                        (KPI overview + AI briefing hub)    @p0
 *     - /analytics/dashboards             (list of pre-built dashboards)      @p1
 *     - /analytics/dashboards/executive                                       @p1
 *     - /analytics/dashboards/operations                                      @p1
 *     - /analytics/dashboards/growth                                          @p1
 *     - /analytics/kpi                    (customizable deep-dive tab)        @p1
 *     - /analytics/insights               (AI-generated insights feed)        @p1
 *     - /analytics/migration              (Glofox data migration tool)        @p1
 *     - /analytics/reports                (saved-report library)              @p1
 *     - /analytics/reports/new            (report builder wizard)             @p1
 *     - /analytics/pricing                (pricing simulator list)            @p1
 *     - /analytics/pricing/new            (new simulation wizard)             @p1
 *     - /analytics/trainers               (trainer performance list)          @p1
 *
 *   Dynamic (3 — smoked via bogus UUID):
 *     - /analytics/reports/[id]           (no not-found branch, renders default)  @p1
 *     - /analytics/pricing/[id]           (no not-found branch, renders empty)    @p1
 *     - /analytics/trainers/[id]          (HAS not-found branch)                  @p1
 *
 * Happy-path detail coverage (seeded report/simulation/trainer with data) and
 * all writes (create report, apply pricing change, export CSV, etc.) are
 * deferred to Tier 6 (Analytics & Insights) per the QA roadmap.
 */
import { test } from '@playwright/test'
import { AnalyticsPage } from './pages/AnalyticsPage'

test.describe('Analytics — Smoke (Tier 2.7)', () => {
  // ---------------------------------------------------------------------
  // P0 — core mount contract for the module overview
  // ---------------------------------------------------------------------

  test('/analytics mounts — admin shell + analytics-page-root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectMainMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — dashboards sub-tree (4 routes)
  // ---------------------------------------------------------------------

  test('/analytics/dashboards mounts — list of pre-built dashboards @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectDashboardsMounted()
  })

  test('/analytics/dashboards/executive mounts — executive summary dashboard @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectDashboardsExecutiveMounted()
  })

  test('/analytics/dashboards/operations mounts — operations dashboard @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectDashboardsOperationsMounted()
  })

  test('/analytics/dashboards/growth mounts — growth dashboard @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectDashboardsGrowthMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — KPI + insights + migration (3 routes)
  // ---------------------------------------------------------------------

  test('/analytics/kpi mounts — customizable KPI deep-dive @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectKpiMounted()
  })

  test('/analytics/insights mounts — AI-generated insights feed @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectInsightsMounted()
  })

  test('/analytics/migration mounts — Glofox data migration tool @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectMigrationMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — reports sub-tree (3 routes, incl. bogus-id detail)
  // ---------------------------------------------------------------------

  test('/analytics/reports mounts — saved-report library @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectReportsMounted()
  })

  test('/analytics/reports/new mounts — report builder wizard @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectReportsNewMounted()
  })

  test('/analytics/reports/[bogus-uuid] mounts — renders default report viewer @p1', async ({
    page,
  }) => {
    // Server component uses `report?.name ?? 'Report'` fallback. No explicit
    // not-found branch — bogus UUID still mounts the viewer with defaults.
    const pom = new AnalyticsPage(page)
    await pom.expectBogusReportDetailMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — pricing sub-tree (3 routes, incl. bogus-id detail)
  // ---------------------------------------------------------------------

  test('/analytics/pricing mounts — pricing simulator list @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectPricingMounted()
  })

  test('/analytics/pricing/new mounts — new simulation wizard @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectPricingNewMounted()
  })

  test('/analytics/pricing/[bogus-uuid] mounts — renders empty simulation viewer @p1', async ({
    page,
  }) => {
    // Server component creates an empty simulation if `data === null`. No
    // explicit not-found branch — viewer renders with a blank simulation.
    const pom = new AnalyticsPage(page)
    await pom.expectBogusPricingDetailMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — trainers sub-tree (2 routes, incl. bogus-id not-found)
  // ---------------------------------------------------------------------

  test('/analytics/trainers mounts — trainer performance list @p1', async ({
    page,
  }) => {
    const pom = new AnalyticsPage(page)
    await pom.expectTrainersMounted()
  })

  test('/analytics/trainers/[bogus-uuid] mounts + renders not-found fallback @p1', async ({
    page,
  }) => {
    // TrainerDetailClient has an explicit `!TRAINER || !TRAINER.id` branch
    // that renders a "Trainer not found" fallback keyed by
    // `analytics-trainers-detail-not-found`.
    const pom = new AnalyticsPage(page)
    await pom.expectBogusTrainerDetailNotFound()
  })
})
