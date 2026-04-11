/**
 * Tier 4.3 — Memberships: Downgrade (next cycle, narrow scope, API-level)
 *
 * Four scenarios covering POST /api/members/[id]/downgrade. Same pattern as
 * Tier 4.1 — direct API testing because the MemberProfilePanel doesn't
 * expose a Downgrade button at all (the panel only has Pause + Upgrade +
 * Archive). This means downgrade is API-only in production currently.
 *
 * BUG-022 (`'membership_downgrade_scheduled'` not in activity_log enum +
 * missing description) fixed inline as part of this tier.
 *
 * Note: this is a "schedule for next cycle" operation — it does NOT change
 * `members.membership_tier` immediately. It appends a pending note to
 * `members.notes` and writes an activity_log row. The actual plan change
 * happens at the next billing cycle (cron-driven, out of tier scope).
 */
import { test, expect } from '@playwright/test'
import { resetStudioTestData, testDb, seedMember } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

test.describe('Memberships — Downgrade (Tier 4.3, API-level)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path: schedule a downgrade
  // ---------------------------------------------------------------------

  test('schedules a downgrade for next cycle @p0', async ({ page }) => {
    const { profileId, memberId } = await seedMember({
      studioId: DEFAULT_STUDIO_ID,
      membershipTier: 'unlimited',
    })

    await page.goto('/members')

    const res = await page.request.post(
      `/api/members/${profileId}/downgrade`,
      { data: { new_plan: '6_class' } },
    )

    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.member_id).toBe(profileId)
    expect(body.data.current_plan).toBe('unlimited')
    expect(body.data.scheduled_plan).toBe('6_class')
    expect(body.data.effective).toBe('next_billing_cycle')

    // DB: membership_tier is UNCHANGED (still unlimited) — downgrade is pending
    const { data: post } = await testDb
      .from('members')
      .select('membership_tier, notes')
      .eq('id', memberId)
      .single()
    expect(post?.membership_tier).toBe('unlimited')
    // Notes column has the pending marker
    expect(post?.notes).toContain('Pending downgrade to 6_class')

    // DB: activity_log has the membership_change row (BUG-022 fix)
    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description, metadata')
      .eq('subject_id', profileId)
      .eq('type', 'membership_change')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    const log = logs![0]
    expect(log.description).toBeTruthy()
    expect(log.description).toContain('downgrade scheduled')
    expect(log.description).toContain('unlimited')
    expect(log.description).toContain('6_class')
    const metadata = log.metadata as Record<string, unknown>
    expect(metadata.old_plan).toBe('unlimited')
    expect(metadata.new_plan).toBe('6_class')
    expect(metadata.action).toBe('downgrade_scheduled')
    expect(metadata.effective).toBe('next_billing_cycle')
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P1 already-on-plan rejection
  // ---------------------------------------------------------------------

  test('rejects downgrade when member is already on the requested plan @p1', async ({
    page,
  }) => {
    const { profileId } = await seedMember({
      studioId: DEFAULT_STUDIO_ID,
      membershipTier: '6_class',
    })

    await page.goto('/members')

    const res = await page.request.post(
      `/api/members/${profileId}/downgrade`,
      { data: { new_plan: '6_class' } },
    )

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('already on this plan')

    // DB: no activity_log row written
    const { data: logs } = await testDb
      .from('activity_log')
      .select('id')
      .eq('subject_id', profileId)
      .eq('type', 'membership_change')

    expect(logs?.length ?? 0).toBe(0)
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P1 invalid plan name rejection
  // ---------------------------------------------------------------------

  test('rejects downgrade with invalid plan name @p1', async ({ page }) => {
    const { profileId } = await seedMember({
      studioId: DEFAULT_STUDIO_ID,
      membershipTier: 'unlimited',
    })

    await page.goto('/members')

    const res = await page.request.post(
      `/api/members/${profileId}/downgrade`,
      { data: { new_plan: 'silver' } },
    )

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('new_plan')
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P1 404 on non-existent member
  // ---------------------------------------------------------------------

  test('returns 404 for non-existent member @p1', async ({ page }) => {
    await page.goto('/members')

    const res = await page.request.post(
      `/api/members/00000000-0000-4000-a000-000000000099/downgrade`,
      { data: { new_plan: '6_class' } },
    )

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(404)
  })
})
