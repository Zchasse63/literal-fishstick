/**
 * Employee portal smoke tests — Tier 2.11.
 *
 * Baseline page-mount coverage for the Meridian Employee Portal.
 *
 * This is the FIRST Tier 2 smoke to run against the `employee`
 * Playwright project (trainer auth state) rather than the `admin`
 * project. It uses `BasePage.employeeShellLandmark()` ("Employee
 * Portal" label in the header) instead of `adminShellLandmark()`
 * ("Sign out" button), because the employee portal currently has no
 * logout button (BUG-003).
 *
 * Covers all 9 employee portal routes:
 *
 *   1. `/employee`             (home)
 *   2. `/employee/clock`       (clock in/out)
 *   3. `/employee/timesheets`  (pay period summaries)
 *   4. `/employee/schedule`    (weekly view)
 *   5. `/employee/classes`     (class list)
 *   6. `/employee/pay`         (pay stubs + YTD)
 *   7. `/employee/performance` (trainer metrics)
 *   8. `/employee/profile`     (employee info)
 *   9. `/employee/promo`       (referral code)
 *
 * All writes (clock in/out, submit timesheet, update profile, generate
 * promo link) are deferred to Tier 7 per the QA roadmap.
 */
import { test } from '@playwright/test'
import { EmployeePortalPage } from './pages/EmployeePortalPage'

test.describe('Employee Portal — Smoke (Tier 2.11)', () => {
  // ---------------------------------------------------------------------
  // P0 — core mount contracts (home + the two highest-signal routes)
  // ---------------------------------------------------------------------

  test('/employee mounts — employee shell + home page root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new EmployeePortalPage(page)
    await pom.expectHomeMounted()
  })

  test('/employee/clock mounts — employee shell + clock page root visible @p0', async ({
    page,
  }) => {
    const pom = new EmployeePortalPage(page)
    await pom.expectClockMounted()
  })

  test('/employee/timesheets mounts — employee shell + timesheets root visible @p0', async ({
    page,
  }) => {
    const pom = new EmployeePortalPage(page)
    await pom.expectTimesheetsMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — remaining employee portal pages
  // ---------------------------------------------------------------------

  test('/employee/schedule mounts — employee shell + schedule root visible @p1', async ({
    page,
  }) => {
    const pom = new EmployeePortalPage(page)
    await pom.expectScheduleMounted()
  })

  test('/employee/classes mounts — employee shell + classes root visible @p1', async ({
    page,
  }) => {
    const pom = new EmployeePortalPage(page)
    await pom.expectClassesMounted()
  })

  test('/employee/pay mounts — employee shell + pay root visible @p1', async ({
    page,
  }) => {
    const pom = new EmployeePortalPage(page)
    await pom.expectPayMounted()
  })

  test('/employee/performance mounts — employee shell + performance root visible @p1', async ({
    page,
  }) => {
    const pom = new EmployeePortalPage(page)
    await pom.expectPerformanceMounted()
  })

  test('/employee/profile mounts — employee shell + profile root visible @p1', async ({
    page,
  }) => {
    const pom = new EmployeePortalPage(page)
    await pom.expectProfileMounted()
  })

  test('/employee/promo mounts — employee shell + promo root visible @p1', async ({
    page,
  }) => {
    const pom = new EmployeePortalPage(page)
    await pom.expectPromoMounted()
  })
})
