/**
 * Members: Archive / Exclude from Analytics — Tier 3.7 council run.
 *
 * Two distinct admin flows covered by this suite:
 *
 *   1. Archive member — the red "Archive" button in the profile panel's
 *      Active Membership card, wired through `DELETE /api/members/[id]`.
 *   2. Exclude from Analytics — a new checkbox in the Edit Member modal
 *      (Tier 3.6 surface), wired through `PUT /api/members/[id]`.
 *
 * Before this tier, the archive path was broken at FOUR layers (BUG-014):
 *   L1. Handler wrote `profiles.status = 'archived'` — column does not exist.
 *       The actual soft-delete flag is `profiles.is_active`.
 *   L2. `activity_log.description` (NOT NULL) was omitted on the insert.
 *       Same silent-swallow pattern as Tiers 3.1 / 3.4 / 3.5 / 3.6.
 *   L3. `activity_log.type` was set to `'member_archived'` — not in the
 *       CHECK constraint enum. Canonical value is `'member_deleted'`.
 *   L4. Panel's Archive button called `/api/members/${member.id}` — but
 *       `member.id` is `members.id`, and the route expects `profile_id`.
 *       BUG-013 inheritance. Narrow Option B fix: flip to `member.profileId`.
 *
 * All four layers fixed inline in the Engineer phase.
 *
 * Exclude from Analytics closes BUG-008 GAP-5: the PUT allowlist was
 * extended in Tier 3.6 to accept `exclude_from_analytics`, but no UI
 * toggle existed anywhere. The value had never been flipped for any member
 * in production (0/1,204). This tier adds a checkbox to the existing
 * EditMemberModal — a delta-payload extension that is regression-safe for
 * the Tier 3.6 test suite (those tests never toggle the field).
 */
import { test, expect } from '@playwright/test'
import { MembersPage } from './pages/MembersPage'
import { resetStudioTestData, seedMember, testDb } from './fixtures/db'
import {
  DEFAULT_STUDIO_ID,
  E2E_MEMBER_NAME_PREFIX,
} from './fixtures/test-data'

// Unique per-run tag so parallel workers never collide on names/emails.
function uniqueTag(label: string): string {
  return `${label}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function uniqueName(label: string): string {
  return `${E2E_MEMBER_NAME_PREFIX}${uniqueTag(label)}`
}

function uniqueEmail(label: string): string {
  return `e2e-member-${uniqueTag(label)}@test.meridian.app`
}

test.describe('Members — Archive / Exclude from Analytics (Tier 3.7)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path: Archive flips is_active=false + logs it
  // (Implicit proof for Layers 1, 3, 4)
  // ---------------------------------------------------------------------

  test('archives a member, flipping profiles.is_active false + activity_log @p0', async ({
    page,
  }) => {
    const seededName = uniqueName('ArchiveHappy')
    const seededEmail = uniqueEmail('archivehappy')
    const { profileId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)

    await members.archiveMemberFromPanel(true)

    // Panel should close on successful archive — edit button becomes hidden.
    await expect(members.editMemberTriggerBtn()).toBeHidden({ timeout: 5000 })

    // DB: profiles row flipped
    const { data: profile, error: profileError } = await testDb
      .from('profiles')
      .select('is_active, exclude_from_analytics')
      .eq('id', profileId)
      .single()

    expect(profileError).toBeNull()
    expect(profile?.is_active).toBe(false)
    // Regression: archive is distinct from exclude-from-analytics
    expect(profile?.exclude_from_analytics).toBe(false)

    // DB: activity_log row lands (implicit proof for Layer 4 — if the
    // route had 404'd on the wrong id, there'd be no log row at all)
    const { data: logs } = await testDb
      .from('activity_log')
      .select('*')
      .eq('subject_id', profileId)
      .eq('type', 'member_deleted')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0: activity_log has non-null description + valid type
  // (Explicit proof for Layers 2 and 3 — the silent-swallow layers)
  // ---------------------------------------------------------------------

  test('archive activity_log has non-null description and valid type @p0', async ({
    page,
  }) => {
    const seededName = uniqueName('ArchiveLog')
    const seededEmail = uniqueEmail('archivelog')
    const { profileId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)

    await members.archiveMemberFromPanel(true)
    await expect(members.editMemberTriggerBtn()).toBeHidden({ timeout: 5000 })

    const { data: logs } = await testDb
      .from('activity_log')
      .select('description, type, metadata, subject_type, subject_id')
      .eq('subject_id', profileId)
      .eq('type', 'member_deleted')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    const log = logs![0]
    // Layer 2 proof — description is NOT NULL, non-empty, and contains the name
    expect(log.description).toBeTruthy()
    expect(log.description).toContain('archived')
    expect(log.description).toContain(seededName)
    // Layer 3 proof — type is the canonical enum value, not 'member_archived'
    expect(log.type).toBe('member_deleted')
    expect(log.subject_type).toBe('profile')
    // Metadata marker so ops dashboards can distinguish archive-from-delete
    expect(log.metadata).toMatchObject({ action: 'archive' })
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P0: Exclude from Analytics toggle writes the field
  // (Closes BUG-008 GAP-5 — the toggle UI is wired end-to-end)
  // ---------------------------------------------------------------------

  test('exclude from analytics checkbox writes profiles.exclude_from_analytics @p0', async ({
    page,
  }) => {
    const seededName = uniqueName('ExcludeHappy')
    const seededEmail = uniqueEmail('excludehappy')
    const { profileId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      excludeFromAnalytics: false,
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)
    await members.openEditMemberModal()

    // Starting state should match the seed
    await members.expectExcludeFromAnalyticsChecked(false)

    // Toggle + submit
    await members.toggleExcludeFromAnalytics()
    await members.submitEditMemberForm()
    await expect(members.editMemberModal()).toBeHidden({ timeout: 5000 })

    // DB: the flag is now true, other fields untouched (delta-payload proof)
    const { data: profile } = await testDb
      .from('profiles')
      .select('full_name, email, phone, exclude_from_analytics')
      .eq('id', profileId)
      .single()

    expect(profile?.exclude_from_analytics).toBe(true)
    expect(profile?.full_name).toBe(seededName)
    expect(profile?.email).toBe(seededEmail)

    // DB: activity_log records the field in metadata.fields
    const { data: logs } = await testDb
      .from('activity_log')
      .select('description, type, metadata')
      .eq('subject_id', profileId)
      .eq('type', 'member_updated')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].metadata.fields).toContain('exclude_from_analytics')
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P1: Dismissing the archive dialog leaves the member active
  // ---------------------------------------------------------------------

  test('cancelling archive dialog leaves member active @p1', async ({
    page,
  }) => {
    const seededName = uniqueName('ArchiveCancel')
    const seededEmail = uniqueEmail('archivecancel')
    const { profileId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)

    // Dismiss the confirm() dialog — the onClick handler bails out early
    await members.archiveMemberFromPanel(false)

    // Panel stays open — edit button still visible
    await expect(members.editMemberTriggerBtn()).toBeVisible()

    // DB: profile row unchanged
    const { data: profile } = await testDb
      .from('profiles')
      .select('is_active')
      .eq('id', profileId)
      .single()

    expect(profile?.is_active).toBe(true)

    // DB: no deletion log row exists
    const { data: logs } = await testDb
      .from('activity_log')
      .select('id')
      .eq('subject_id', profileId)
      .eq('type', 'member_deleted')

    expect(logs?.length ?? 0).toBe(0)
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1: Exclude toggle persists through modal reopen
  // (Proves the round-trip: DB → directory mapper → panel prop → modal initial)
  // ---------------------------------------------------------------------

  test('exclude from analytics persists through modal reopen @p1', async ({
    page,
  }) => {
    const seededName = uniqueName('ExcludePersist')
    const seededEmail = uniqueEmail('excludepersist')
    const { profileId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      excludeFromAnalytics: false,
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)

    // First open: toggle + submit
    await members.openEditMemberModal()
    await members.toggleExcludeFromAnalytics()
    await members.submitEditMemberForm()
    await expect(members.editMemberModal()).toBeHidden({ timeout: 5000 })

    // DB sanity: the value landed
    const { data: afterFirst } = await testDb
      .from('profiles')
      .select('exclude_from_analytics')
      .eq('id', profileId)
      .single()
    expect(afterFirst?.exclude_from_analytics).toBe(true)

    // Close the panel so the next open picks up the refreshed directory row.
    // onEditSuccess fires fetchMembers() after the modal closes, but
    // `selectedMember` is still the pre-update snapshot — closing + reopening
    // re-reads from the refreshed `members` state. MemberProfilePanel has no
    // Escape handler, so we MUST click the X (not press Escape).
    await members.closeMemberPanel()

    // Re-open the profile and the modal — the checkbox should be checked
    await members.openMemberProfileByName(seededName)
    await members.openEditMemberModal()

    await members.expectExcludeFromAnalyticsChecked(true)

    // Submitting without touching the checkbox should be a no-op
    // (delta-payload short-circuit — nothing in the payload).
    await members.submitEditMemberForm()
    await expect(members.editMemberModal()).toBeHidden({ timeout: 5000 })

    // DB: only one member_updated log row (no duplicate from the no-op submit)
    const { data: logs } = await testDb
      .from('activity_log')
      .select('id')
      .eq('subject_id', profileId)
      .eq('type', 'member_updated')

    expect(logs?.length ?? 0).toBe(1)
  })
})
