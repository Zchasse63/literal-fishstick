/**
 * EmployeePortalPage — thin POM for the entire Meridian Employee Portal.
 *
 * Tier 2.11 smoke — the FIRST council run that targets the `employee`
 * Playwright project (uses the trainer auth state, not admin). All
 * previous Tier 2 runs hit the admin shell; this one hits the employee
 * shell via `employeeShellLandmark()` (the "Employee Portal" label in
 * the header bar at `(employee)/layout.tsx:226`).
 *
 * Covers all 9 employee portal routes:
 *
 *   - `/employee`             (home / greeting + today's clock summary)
 *   - `/employee/clock`       (clock in/out + break tracking)
 *   - `/employee/timesheets`  (pay period totals + hour breakdowns)
 *   - `/employee/schedule`    (weekly schedule view)
 *   - `/employee/classes`     (instructor class list + earnings)
 *   - `/employee/pay`         (pay stubs + YTD + tax docs)
 *   - `/employee/performance` (trainer metrics + trends)
 *   - `/employee/profile`     (employee info + settings)
 *   - `/employee/promo`       (personal referral code + commissions)
 *
 * **Landmark caveat (BUG-003):** the employee portal has no logout
 * button, so we can't use the same landmark as the admin shell
 * (`aria-label="Sign out"`). Instead, `BasePage.employeeShellLandmark()`
 * targets the "Employee Portal" label in the header — unique to the
 * employee layout, rendered on every employee page. When BUG-003 is
 * fixed, we can migrate to a real sign-out landmark.
 *
 * All writes (clock in/out, submit timesheet, update profile, generate
 * promo link) are deferred to Tier 7 per the QA roadmap.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export class EmployeePortalPage extends BasePage {
  // ─── Locators (9 page roots) ─────────────────────────────
  homePageRoot(): Locator { return this.byTestId('employee-home-page-root') }
  clockPageRoot(): Locator { return this.byTestId('employee-clock-page-root') }
  timesheetsPageRoot(): Locator { return this.byTestId('employee-timesheets-page-root') }
  schedulePageRoot(): Locator { return this.byTestId('employee-schedule-page-root') }
  classesPageRoot(): Locator { return this.byTestId('employee-classes-page-root') }
  payPageRoot(): Locator { return this.byTestId('employee-pay-page-root') }
  performancePageRoot(): Locator { return this.byTestId('employee-performance-page-root') }
  profilePageRoot(): Locator { return this.byTestId('employee-profile-page-root') }
  promoPageRoot(): Locator { return this.byTestId('employee-promo-page-root') }

  // ─── Mount helpers ───────────────────────────────────────
  async expectHomeMounted(): Promise<void> {
    await this.expectSmokeMount('/employee', this.employeeShellLandmark())
    await expect(this.homePageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectClockMounted(): Promise<void> {
    await this.expectSmokeMount('/employee/clock', this.employeeShellLandmark())
    await expect(this.clockPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectTimesheetsMounted(): Promise<void> {
    await this.expectSmokeMount('/employee/timesheets', this.employeeShellLandmark())
    await expect(this.timesheetsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectScheduleMounted(): Promise<void> {
    await this.expectSmokeMount('/employee/schedule', this.employeeShellLandmark())
    await expect(this.schedulePageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectClassesMounted(): Promise<void> {
    await this.expectSmokeMount('/employee/classes', this.employeeShellLandmark())
    await expect(this.classesPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectPayMounted(): Promise<void> {
    await this.expectSmokeMount('/employee/pay', this.employeeShellLandmark())
    await expect(this.payPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectPerformanceMounted(): Promise<void> {
    await this.expectSmokeMount('/employee/performance', this.employeeShellLandmark())
    await expect(this.performancePageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectProfileMounted(): Promise<void> {
    await this.expectSmokeMount('/employee/profile', this.employeeShellLandmark())
    await expect(this.profilePageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectPromoMounted(): Promise<void> {
    await this.expectSmokeMount('/employee/promo', this.employeeShellLandmark())
    await expect(this.promoPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }
}
