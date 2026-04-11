/**
 * Schedule smoke tests — Tier 2.2.
 *
 * Baseline page-mount coverage for `/schedule`. Uses the shared Tier 2
 * smoke infrastructure (`BasePage.expectSmokeMount`, `adminShellLandmark`)
 * established in Tier 2.1 — see `specs/reports/command-center-smoke-report.md`.
 *
 * Three tests covering the core smoke contract:
 *   1. Mount — shell + testid + pathname + no pageerrors
 *   2. Stability — no deferred hydration crash
 *   3. Content semantics — the schedule view-mode toggle renders (proves the
 *      SchedulePage component actually executed, not just the shell)
 */
import { test, expect } from '@playwright/test'
import { SchedulePage } from './pages/SchedulePage'
import { ANIM_TIMEOUT } from './pages/BasePage'

test.describe('Schedule — Smoke (Tier 2.2)', () => {
  // ---------------------------------------------------------------------
  // P0 — core mount contract
  // ---------------------------------------------------------------------

  test('/schedule mounts — admin shell + schedule-page-root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new SchedulePage(page)
    await pom.expectMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — stability + content
  // ---------------------------------------------------------------------

  test('/schedule remains stable after 1.5s idle — no hydration crash @p1', async ({
    page,
  }) => {
    const pom = new SchedulePage(page)
    const pageErrors: Error[] = []
    const errorListener = (err: Error) => pageErrors.push(err)
    page.on('pageerror', errorListener)
    try {
      await pom.goto('/schedule')
      await expect(pom.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
      await page.waitForTimeout(1500)
      await expect(pom.pageRoot()).toBeVisible()
      const errorMessages = pageErrors.map((e) => e.message)
      expect(
        errorMessages,
        `Deferred page errors on /schedule: ${errorMessages.join('; ')}`,
      ).toEqual([])
    } finally {
      page.off('pageerror', errorListener)
    }
  })

  test('/schedule → Week view-mode button rendered @p1', async ({ page }) => {
    // Content-level signal: the SchedulePage renders a view-mode toggle with
    // "Day" / "Week" / "Month" buttons (schedule/page.tsx:675-687). This is
    // a UI element, not data-dependent, so it renders whether or not classes
    // have loaded yet.
    const pom = new SchedulePage(page)
    await pom.goto('/schedule')
    await expect(pom.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(
      page.getByRole('button', { name: 'Week', exact: true }),
    ).toBeVisible({ timeout: ANIM_TIMEOUT })
  })
})
