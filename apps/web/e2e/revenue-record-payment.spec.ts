/**
 * Revenue: Record Payment — Tier 3.1 council run.
 *
 * The FIRST write-flow spec in the Meridian QA pipeline. Previous tiers were
 * read-only smokes (Tier 2) or auth-flow tests (Tier 1). Tier 3.1 shifts the
 * contract:
 *
 *   1. beforeEach seeds a real member into the admin studio
 *   2. Tests drive the Record Payment modal through the full happy path
 *   3. After submit, tests assert the `transactions` row exists in the DB
 *      (via `testDb` service-role client) with the correct amount, type,
 *      status, payment_method, and link to the seeded member
 *   4. afterAll runs `resetStudioTestData()` to wipe anything the tests seeded
 *
 * **BUG-006 surfaced by this run.** The `RecordPaymentModal` previously
 * searched the `profiles` table and submitted `profile.id` as `member_id`,
 * but `transactions.member_id` is a FK to `members.id`. Every submit failed
 * the FK constraint. On top of that, the default type (`other`) and two
 * other values (`merchandise`, `event`) violated the `transactions_type_check`
 * CHECK constraint. All three issues fixed as part of this council run —
 * see `specs/bugs/revenue-record-payment-modal-broken.md`.
 */
import { test, expect } from '@playwright/test'
import { RevenuePage } from './pages/RevenuePage'
import {
  seedMember,
  resetStudioTestData,
  testDb,
  type SeededMember,
} from './fixtures/db'
import {
  E2E_TRANSACTION_DESCRIPTION_PREFIX,
  DEFAULT_STUDIO_ID,
} from './fixtures/test-data'

// Stable, unique marker so `resetStudioTestData` can scope cleanup even if a
// prior run crashed before the afterEach.
const TX_DESC = `${E2E_TRANSACTION_DESCRIPTION_PREFIX} Record Payment Suite`

test.describe('Revenue — Record Payment (Tier 3.1)', () => {
  // ---------------------------------------------------------------------
  // Shared state
  // ---------------------------------------------------------------------
  let seeded: SeededMember

  test.beforeEach(async () => {
    // Wipe any prior test rows before seeding the next member.
    await resetStudioTestData()
    seeded = await seedMember({
      fullName: `E2E RP ${Date.now().toString(36)}`,
    })
  })

  test.afterAll(async () => {
    // Final belt-and-braces cleanup. `beforeEach` handles inter-test isolation.
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // P0 — Happy path with DB assertion (the contract for Tier 3+)
  // ---------------------------------------------------------------------

  test('records a valid drop-in payment end-to-end and writes to the DB @p0', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)

    // 1. Open the modal
    await pom.gotoRevenue()
    await pom.openRecordPaymentModal()

    // 2. Fill the form
    await pom.searchMember(seeded.fullName)
    await pom.selectMemberResult(seeded.fullName)
    await pom.fillAmount('12.50')
    await pom.selectType('drop_in')
    await pom.selectPaymentMethod('cash')
    await pom.fillDescription(`${TX_DESC} drop-in`)

    // 3. Submit
    await pom.submitPayment()

    // 4. The dialog closes + the page shows the success toast
    await pom.expectDialogClosed()
    await pom.expectToast(/payment recorded/i)

    // 5. Assert the transaction landed in Postgres with the expected shape
    const { data: rows, error } = await testDb
      .from('transactions')
      .select('id, member_id, studio_id, amount, type, status, description, payment_method')
      .eq('member_id', seeded.memberId)
      .eq('studio_id', DEFAULT_STUDIO_ID)
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
    const row = rows![0]
    expect(row.amount).toBe(1250) // $12.50 → 1250 cents
    expect(row.type).toBe('drop_in')
    expect(row.status).toBe('completed')
    expect(row.payment_method).toBe('cash')
    expect(row.description).toBe(`${TX_DESC} drop-in`)
  })

  // ---------------------------------------------------------------------
  // P0 — Validation contract (fast-fail branches BEFORE writing to DB)
  // ---------------------------------------------------------------------

  test('blocks submission when no member is selected @p0', async ({ page }) => {
    const pom = new RevenuePage(page)
    await pom.gotoRevenue()
    await pom.openRecordPaymentModal()

    // Amount filled but no member chosen
    await pom.fillAmount('10')
    await pom.submitPayment()

    await pom.expectValidationError(/select a member/i)

    // Confirm no row was written
    const { count } = await testDb
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', seeded.memberId)
    expect(count).toBe(0)
  })

  test('blocks submission when amount is empty @p0', async ({ page }) => {
    const pom = new RevenuePage(page)
    await pom.gotoRevenue()
    await pom.openRecordPaymentModal()

    await pom.searchMember(seeded.fullName)
    await pom.selectMemberResult(seeded.fullName)
    // amount intentionally left blank
    await pom.submitPayment()

    await pom.expectValidationError(/valid amount/i)

    const { count } = await testDb
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', seeded.memberId)
    expect(count).toBe(0)
  })

  // ---------------------------------------------------------------------
  // P1 — Supporting happy-path variants and UX flows
  // ---------------------------------------------------------------------

  test('blocks submission when amount is zero @p1', async ({ page }) => {
    const pom = new RevenuePage(page)
    await pom.gotoRevenue()
    await pom.openRecordPaymentModal()

    await pom.searchMember(seeded.fullName)
    await pom.selectMemberResult(seeded.fullName)
    await pom.fillAmount('0')
    await pom.submitPayment()

    await pom.expectValidationError(/valid amount/i)

    const { count } = await testDb
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', seeded.memberId)
    expect(count).toBe(0)
  })

  test('records a membership payment with bank_transfer method @p1', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    await pom.gotoRevenue()
    await pom.openRecordPaymentModal()

    await pom.searchMember(seeded.fullName)
    await pom.selectMemberResult(seeded.fullName)
    await pom.fillAmount('199.00')
    await pom.selectType('membership')
    await pom.selectPaymentMethod('bank_transfer')
    await pom.fillDescription(`${TX_DESC} monthly membership`)
    await pom.submitPayment()

    await pom.expectDialogClosed()

    const { data: rows } = await testDb
      .from('transactions')
      .select('amount, type, payment_method, status')
      .eq('member_id', seeded.memberId)
    expect(rows).toHaveLength(1)
    expect(rows![0].amount).toBe(19900)
    expect(rows![0].type).toBe('membership')
    expect(rows![0].payment_method).toBe('bank_transfer')
    expect(rows![0].status).toBe('completed')
  })

  test('records a payment without a description (description is optional) @p1', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    await pom.gotoRevenue()
    await pom.openRecordPaymentModal()

    await pom.searchMember(seeded.fullName)
    await pom.selectMemberResult(seeded.fullName)
    await pom.fillAmount('25')
    await pom.selectType('drop_in')
    // no description
    await pom.submitPayment()

    await pom.expectDialogClosed()

    const { data: rows } = await testDb
      .from('transactions')
      .select('amount, description')
      .eq('member_id', seeded.memberId)
    expect(rows).toHaveLength(1)
    expect(rows![0].amount).toBe(2500)
    // Server falls back to the modal's default description when the form was
    // left blank: "Manual {method} payment". Either null/empty or the server
    // default is acceptable — we just assert nothing was submitted by us.
    if (rows![0].description) {
      expect(rows![0].description).toMatch(/Manual/i)
    }
  })

  test('lets the user Change the selected member after picking @p1', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    // Seed a second member so we have two rows to swap between
    const second = await seedMember({
      fullName: `E2E RP Alt ${Date.now().toString(36)}`,
    })

    await pom.gotoRevenue()
    await pom.openRecordPaymentModal()

    // Select the first, then change and pick the second
    await pom.searchMember(seeded.fullName)
    await pom.selectMemberResult(seeded.fullName)
    await expect(pom.memberSelected()).toContainText(seeded.fullName)

    await pom.changeSelectedMember()
    await pom.searchMember(second.fullName)
    await pom.selectMemberResult(second.fullName)
    await expect(pom.memberSelected()).toContainText(second.fullName)

    // Submit against the second member and assert the row lands on the right one
    await pom.fillAmount('5')
    await pom.selectType('drop_in')
    await pom.fillDescription(`${TX_DESC} change-test`)
    await pom.submitPayment()
    await pom.expectDialogClosed()

    const { data: primaryRows } = await testDb
      .from('transactions')
      .select('id')
      .eq('member_id', seeded.memberId)
    const { data: altRows } = await testDb
      .from('transactions')
      .select('id, amount')
      .eq('member_id', second.memberId)
    expect(primaryRows ?? []).toHaveLength(0)
    expect(altRows).toHaveLength(1)
    expect(altRows![0].amount).toBe(500)
  })

  test('cancelling the dialog writes nothing to the DB @p1', async ({
    page,
  }) => {
    const pom = new RevenuePage(page)
    await pom.gotoRevenue()
    await pom.openRecordPaymentModal()

    // Fill everything but cancel at the last step
    await pom.searchMember(seeded.fullName)
    await pom.selectMemberResult(seeded.fullName)
    await pom.fillAmount('99')
    await pom.selectType('credit_pack')
    await pom.fillDescription(`${TX_DESC} cancel-test`)
    await pom.cancelPayment()

    const { count } = await testDb
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', seeded.memberId)
    expect(count).toBe(0)
  })
})
