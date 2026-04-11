/**
 * OperationsPage — thin POM for the admin Operations module.
 *
 * Tier 2.8 smoke covers 3 static routes:
 *   - `/operations`           (directory / schedule / payroll / permissions tabs)
 *   - `/operations/documents` (employee documents library)
 *   - `/operations/payroll`   (payroll periods + line items)
 *
 * All writes (employee CRUD, document upload, payroll period create/close/reopen,
 * permission edits, clock-in/out) and the schedule tab's scheduling UI are
 * deferred to Tier 4 (Corporate & Operations) per the QA roadmap.
 *
 * `PayrollClient` has two render branches (empty state vs. happy path) — both
 * are seeded with the same `operations-payroll-page-root` testid so the smoke
 * test passes regardless of whether the DB has seeded payroll_periods rows.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export class OperationsPage extends BasePage {
  // ─── Locators ────────────────────────────────────────────
  pageRoot(): Locator { return this.byTestId('operations-page-root') }
  documentsPageRoot(): Locator { return this.byTestId('operations-documents-page-root') }
  payrollPageRoot(): Locator { return this.byTestId('operations-payroll-page-root') }

  // ─── Mount helpers ───────────────────────────────────────
  async expectMainMounted(): Promise<void> {
    await this.expectSmokeMount('/operations', this.adminShellLandmark())
    await expect(this.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectDocumentsMounted(): Promise<void> {
    await this.expectSmokeMount('/operations/documents', this.adminShellLandmark())
    await expect(this.documentsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectPayrollMounted(): Promise<void> {
    await this.expectSmokeMount('/operations/payroll', this.adminShellLandmark())
    await expect(this.payrollPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }
}
