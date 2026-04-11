/**
 * Tier 4.1 — Memberships: Assign (narrow scope, API-level)
 *
 * Five scenarios covering the membership upgrade endpoint
 * `POST /api/members/[id]/upgrade`. The endpoint handles BOTH "assign"
 * (oldPlan='none' → newPlan='6_class') and "upgrade" (oldPlan='6_class'
 * → newPlan='unlimited') as a degenerate case of the same operation.
 *
 * Tests use page.request.post directly because the MemberProfilePanel's
 * Upgrade button is currently broken by BUG-013 (it passes `member.id`
 * but the route expects `profile_id`). Tests bypass the broken UI to
 * verify the underlying contract works.
 *
 * BUG-021 (`'membership_upgraded'` not in activity_log enum + missing
 * description) was fixed inline as part of this tier.
 *
 * BUG-013 inheritance on the Upgrade panel button is documented in
 * `specs/bugs/members-id-vs-profile-id-divergence.md` and remains open.
 */
import { test, expect } from '@playwright/test'
import { resetStudioTestData, testDb, seedMember } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

test.describe('Memberships — Assign / Upgrade (Tier 4.1, API-level)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path: assign a plan to a member without one
  // ---------------------------------------------------------------------

  test('assigns a plan to a member with no membership @p0', async ({
    page,
  }) => {
    // Seed a member with no membership_tier
    const { profileId, memberId } = await seedMember({
      studioId: DEFAULT_STUDIO_ID,
    })

    // Pre-check: membership_tier is null (default for seedMember)
    const { data: pre } = await testDb
      .from('members')
      .select('membership_tier')
      .eq('id', memberId)
      .single()
    expect(pre?.membership_tier).toBeNull()

    // Navigate first to establish auth cookies
    await page.goto('/members')

    const res = await page.request.post(
      `/api/members/${profileId}/upgrade`,
      { data: { new_plan: 'unlimited' } },
    )

    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.member_id).toBe(profileId)
    expect(body.data.old_plan).toBe('none')
    expect(body.data.new_plan).toBe('unlimited')

    // DB: membership_tier is now 'unlimited'
    const { data: post } = await testDb
      .from('members')
      .select('membership_tier')
      .eq('id', memberId)
      .single()
    expect(post?.membership_tier).toBe('unlimited')

    // DB: activity_log has the membership_change row (BUG-021 fix)
    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description, metadata')
      .eq('subject_id', profileId)
      .eq('type', 'membership_change')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    const log = logs![0]
    // BUG-021 L2 proof: description is non-null
    expect(log.description).toBeTruthy()
    expect(log.description).toContain('Membership changed')
    expect(log.description).toContain('unlimited')
    // metadata has the action marker
    const metadata = log.metadata as Record<string, unknown>
    expect(metadata.old_plan).toBe('none')
    expect(metadata.new_plan).toBe('unlimited')
    expect(metadata.action).toBe('upgrade')
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0 upgrade between tiers
  // ---------------------------------------------------------------------

  test('upgrades a member from 6_class to unlimited @p0', async ({ page }) => {
    const { profileId, memberId } = await seedMember({
      studioId: DEFAULT_STUDIO_ID,
      membershipTier: '6_class',
    })

    await page.goto('/members')

    const res = await page.request.post(
      `/api/members/${profileId}/upgrade`,
      { data: { new_plan: 'unlimited' } },
    )

    expect(res.ok()).toBe(true)

    const { data: post } = await testDb
      .from('members')
      .select('membership_tier')
      .eq('id', memberId)
      .single()
    expect(post?.membership_tier).toBe('unlimited')

    // Activity log captures the old_plan correctly
    const { data: logs } = await testDb
      .from('activity_log')
      .select('description, metadata')
      .eq('subject_id', profileId)
      .eq('type', 'membership_change')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toContain('6_class')
    expect(logs![0].description).toContain('unlimited')
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P1 already-on-plan rejection
  // ---------------------------------------------------------------------

  test('rejects upgrade when member is already on the requested plan @p1', async ({
    page,
  }) => {
    const { profileId } = await seedMember({
      studioId: DEFAULT_STUDIO_ID,
      membershipTier: 'unlimited',
    })

    await page.goto('/members')

    const res = await page.request.post(
      `/api/members/${profileId}/upgrade`,
      { data: { new_plan: 'unlimited' } },
    )

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('already on this plan')

    // DB: no activity_log row written for the rejected request
    const { data: logs } = await testDb
      .from('activity_log')
      .select('id')
      .eq('subject_id', profileId)
      .eq('type', 'membership_change')

    expect(logs?.length ?? 0).toBe(0)
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P1 invalid plan name rejection
  // ---------------------------------------------------------------------

  test('rejects upgrade with invalid plan name @p1', async ({ page }) => {
    const { profileId } = await seedMember({ studioId: DEFAULT_STUDIO_ID })

    await page.goto('/members')

    const res = await page.request.post(
      `/api/members/${profileId}/upgrade`,
      { data: { new_plan: 'platinum' } },
    )

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('new_plan')
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1 404 on non-existent member
  // ---------------------------------------------------------------------

  test('returns 404 for a non-existent member profile @p1', async ({
    page,
  }) => {
    await page.goto('/members')

    // A valid UUID format that doesn't exist
    const nonExistentId = '00000000-0000-4000-a000-000000000099'
    const res = await page.request.post(
      `/api/members/${nonExistentId}/upgrade`,
      { data: { new_plan: 'unlimited' } },
    )

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(404)
  })
})
