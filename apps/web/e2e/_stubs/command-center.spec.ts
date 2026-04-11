/**
 * Command Center smoke tests — Tier 2.1.
 *
 * Baseline page-mount coverage for `/` (the admin root). No data assertions,
 * no write flows. Each test exercises a different aspect of "mounted":
 *
 *   1. Full mount via expectSmokeMount() — landmark + pathname + no pageerrors
 *   2. Stability after 1.5s idle — guard against deferred hydration crashes
 *   3. AI briefing greeting header renders — proves the CommandCenter component
 *      actually executed (not just the shell wrapping an empty crash boundary)
 *   4. /api/bookings returns 200 under a clean admin session — probes the
 *      pre-existing 500 observation from Tier 1.4 session-refresh report
 *
 * Runs under the `admin` Playwright project, using `e2e/.auth/admin.json`
 * storage state. See `specs/qa-pipeline-roadmap.md` Tier 2.1 for context.
 *
 * NOTE: This spec also exists as a sanity check on the shared infrastructure
 * added in Tier 2.1: BasePage.expectSmokeMount, adminShellLandmark, and the
 * CommandCenterPage POM. All 10 downstream Tier 2 smoke specs will use the
 * same pattern, so if this one works, they should scale.
 */
import { test, expect } from '@playwright/test'
import { CommandCenterPage } from './pages/CommandCenterPage'
import { ANIM_TIMEOUT } from './pages/BasePage'

test.describe('Command Center — Smoke (Tier 2.1)', () => {
  // ---------------------------------------------------------------------
  // P0 — core mount contract
  // ---------------------------------------------------------------------

  test('/ mounts — admin shell + command-page-root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new CommandCenterPage(page)
    // expectMounted calls BasePage.expectSmokeMount('/', adminShellLandmark())
    // which tracks pageerror events for the whole navigation + mount window,
    // asserts landmark visibility, and asserts the final pathname is exactly `/`.
    // Then it additionally asserts the command-page-root testid is visible
    // (proves the CommandCenter component itself rendered, not just the shell).
    await pom.expectMounted()
  })

  test('/ → /api/bookings under admin session returns 500 (gap guard — BUG-005) @p1', async ({
    page,
  }) => {
    // GAP GUARD — CONFIRMED BUG. Tier 1.4's session-refresh run surfaced
    // that /api/bookings was returning 500 when the admin session's request
    // fixture hit it during a leaked middleware-redirect test. This smoke
    // resolved the ambiguity: even under a clean admin session navigated
    // via the normal UI flow, the bookings API returns 500.
    //
    // Filed as BUG-005 — /api/bookings GET handler returns 500 for any
    // authenticated request. The route at src/app/api/bookings/route.ts:24
    // selects `profiles!bookings_member_id_fkey(...)` which likely references
    // a foreign key that doesn't exist (the bookings.member_id FK probably
    // points at the `members` table, not `profiles`). The route swallows the
    // real error at line 36-38 and returns a generic 500.
    //
    // This test ASSERTS the current buggy behavior so that when the bug is
    // fixed, this test fails and the fix can be flipped to an assertion of
    // the correct behavior (<500 + proper payload shape). Mirrors the
    // gap-guard pattern used for BUG-004 in session-refresh.spec.ts.
    //
    // DO NOT "fix" this test by changing the expected value without also
    // fixing BUG-005 in the route handler. The test is the contract.
    const pom = new CommandCenterPage(page)
    await pom.goto('/')
    // Use page.request so cookies flow from the browser context.
    const response = await page.request.get('/api/bookings')
    expect(
      response.status(),
      `BUG-005 gap guard: expected 500 (current buggy behavior). If you see a different status, BUG-005 may be fixed — flip this test to assert <500 and update specs/pipeline-log.md.`,
    ).toBe(500)
    const body = await response.json()
    expect(body).toEqual({ error: 'Internal server error' })
  })

  // ---------------------------------------------------------------------
  // P1 — stability + content checks
  // ---------------------------------------------------------------------

  test('/ remains stable after 1.5s idle — no hydration crash @p1', async ({
    page,
  }) => {
    // Guard against deferred hydration crashes — React mounts, then a useEffect
    // (or async data fetch) throws and unmounts the tree. This test navigates,
    // waits 1.5s (longer than most hydration passes), and re-asserts the
    // command-page-root is STILL visible.
    const pom = new CommandCenterPage(page)
    const pageErrors: Error[] = []
    const errorListener = (err: Error) => pageErrors.push(err)
    page.on('pageerror', errorListener)
    try {
      await pom.goto('/')
      await expect(pom.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
      // Idle wait — gives async effects a chance to fire and potentially crash.
      await page.waitForTimeout(1500)
      // Re-assert: the content root must STILL be visible.
      await expect(pom.pageRoot()).toBeVisible()
      // And no pageerrors fired during the idle window.
      const errorMessages = pageErrors.map((e) => e.message)
      expect(
        errorMessages,
        `Deferred page errors on /: ${errorMessages.join('; ')}`,
      ).toEqual([])
    } finally {
      page.off('pageerror', errorListener)
    }
  })

  test('/ → AI briefing greeting header renders @p1', async ({ page }) => {
    // Content-level signal: the CommandCenter component's return tree contains
    // an AIBriefingCard which renders `<h2>{greeting}, {firstName}</h2>`.
    // If the component swallows its render into an error boundary, this test
    // fails. If the briefing is fully skeletonized (data loading), the h2 is
    // still rendered — it's a pure UI element, not data-dependent.
    const pom = new CommandCenterPage(page)
    await pom.goto('/')
    // Wait for data to settle OR skeleton → real content to swap.
    await expect(pom.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await pom.expectGreetingVisible()
  })
})
