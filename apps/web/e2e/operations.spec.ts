/**
 * Operations smoke tests — Tier 2.8.
 *
 * Baseline page-mount coverage for the Operations module (3 routes).
 * Uses the shared Tier 2 smoke infrastructure (`BasePage.expectSmokeMount`,
 * `adminShellLandmark`).
 *
 * Three tests covering the smoke contract:
 *   1. `/operations` overview mounts (directory/schedule/payroll/permissions tabs)
 *   2. `/operations/documents` mounts (employee documents library)
 *   3. `/operations/payroll` mounts (dual-branch testid covers empty + happy)
 *
 * All writes (employee CRUD, document upload, payroll period create/close/reopen,
 * permission edits, clock-in/out) are deferred to Tier 4 per the QA roadmap.
 */
import { test } from '@playwright/test'
import { OperationsPage } from './pages/OperationsPage'

test.describe('Operations — Smoke (Tier 2.8)', () => {
  // ---------------------------------------------------------------------
  // P0 — core mount contract for the module overview
  // ---------------------------------------------------------------------

  test('/operations mounts — admin shell + operations-page-root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new OperationsPage(page)
    await pom.expectMainMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — sub-page smokes
  // ---------------------------------------------------------------------

  test('/operations/documents mounts — admin shell + documents library visible @p1', async ({
    page,
  }) => {
    const pom = new OperationsPage(page)
    await pom.expectDocumentsMounted()
  })

  test('/operations/payroll mounts — admin shell + payroll page visible (dual-branch) @p1', async ({
    page,
  }) => {
    // PayrollClient has two render branches (empty state when no
    // payroll_periods rows exist vs. happy path with data). Both are seeded
    // with the same `operations-payroll-page-root` testid so the smoke
    // passes regardless of DB state.
    const pom = new OperationsPage(page)
    await pom.expectPayrollMounted()
  })
})
