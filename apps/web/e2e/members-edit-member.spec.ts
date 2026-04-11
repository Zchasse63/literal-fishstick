/**
 * Members: Edit Member — Tier 3.6 council run.
 *
 * The full admin "Edit Member" write flow: open the profile panel from the
 * directory, click the Pencil icon, fill the modal, submit it, and assert
 * that the relevant rows actually changed in Postgres.
 *
 * Before this tier, PUT /api/members/[id] was broken at six independent
 * layers (BUG-012):
 *   1. `notes` was sent to `profiles` but lives on `members`
 *   2. Three phantom `members` columns (`membership_tier`,
 *      `membership_status`, `credits_remaining`) had been wired into the
 *      old `allowedFields` list — actually live on `members` and have their
 *      own dedicated routes (/upgrade, /pause)
 *   3. `exclude_from_analytics` was the only valid pre-fix field, so the
 *      handler appeared to "work" while doing nothing else
 *   4. `activity_log.description` was missing on the insert (NOT NULL)
 *   5. `profiles` had no RLS UPDATE policy for non-owner rows (only
 *      `profiles_update_own` existed) — `profiles_update_admin` policy was
 *      added in Step 1 of this council run
 *   6. No duplicate-email check on the PUT path (POST has one)
 *
 * All six fixed inline in the Engineer phase.
 *
 * BUG-013 (related, surfaced during this run): the Member.id mapping in
 * `members/page.tsx` set `id: row.id` (members.id), but PUT/DELETE/GET/
 * pause/upgrade routes all expect URL [id] = profile_id. The narrow fix
 * was to add `profileId: string` to the Member type and pass it explicitly
 * to EditMemberModal. The wider fix (pause/upgrade/archive buttons in
 * MemberProfilePanel still pass member.id) is filed separately as BUG-013.
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

test.describe('Members — Edit Member (Tier 3.6)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path: edit name + phone, assert profile updated
  // ---------------------------------------------------------------------

  test('edits a member end-to-end and writes profile + activity_log @p0', async ({
    page,
  }) => {
    // Seed a known member then edit it
    const seededName = uniqueName('EditHappyPath')
    const seededEmail = uniqueEmail('edithappypath')
    const { profileId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      phone: '+15555550000',
      studioId: DEFAULT_STUDIO_ID,
    })

    const newName = `${seededName}_Edited`
    const newPhone = '+15555559999'

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()

    // Open the panel by searching for the seeded name
    await members.openMemberProfileByName(seededName)

    // Open and submit the Edit modal
    await members.editMemberViaModal({
      name: newName,
      phone: newPhone,
    })

    // DB: profiles row updated — Layer 1/2/3 fix proof (real fields applied)
    const { data: profile, error: profileError } = await testDb
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', profileId)
      .single()

    expect(profileError).toBeNull()
    expect(profile?.full_name).toBe(newName)
    expect(profile?.email).toBe(seededEmail) // unchanged
    expect(profile?.phone).toBe(newPhone)

    // DB: activity_log row landed — Layer 4 fix proof (description NOT NULL)
    const { data: logs } = await testDb
      .from('activity_log')
      .select('*')
      .eq('subject_id', profileId)
      .eq('type', 'member_updated')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    const log = logs![0]
    expect(log.description).toBeTruthy()
    expect(log.description).toContain('Member updated')
    expect(log.description).toContain(newName)
    expect(log.subject_type).toBe('profile')
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0: notes write to members.notes, NOT profiles
  // (BUG-012 Layer 1 fix proof — the most insidious of the six layers)
  // ---------------------------------------------------------------------

  test('notes field writes to members.notes table not profiles @p0', async ({
    page,
  }) => {
    const seededName = uniqueName('NotesLayer1')
    const seededEmail = uniqueEmail('noteslayer1')
    const { profileId, memberId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      studioId: DEFAULT_STUDIO_ID,
    })

    const notesText = 'VIP member — knows the owner. Allergic to eucalyptus.'

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)

    await members.editMemberViaModal({ notes: notesText })

    // The notes value MUST land on members.notes
    const { data: member } = await testDb
      .from('members')
      .select('notes')
      .eq('id', memberId)
      .single()

    expect(member?.notes).toBe(notesText)

    // And the profiles table must NOT have a notes column populated
    // (this is a probe for the Layer 1 bug — pre-fix the handler tried to
    // write notes to profiles, which silently failed because there's no
    // such column on profiles).
    const { data: profile } = await testDb
      .from('profiles')
      .select('id, full_name')
      .eq('id', profileId)
      .single()
    expect(profile?.id).toBe(profileId)
    // No assertion on profiles.notes because the column does not exist —
    // selecting it would error. The members.notes assertion above is the
    // single source of truth.
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P0: activity_log entry has non-null description
  // (BUG-012 Layer 4 fix proof — the silent-swallow column)
  // ---------------------------------------------------------------------

  test('activity_log entry has non-null description and valid type @p0', async ({
    page,
  }) => {
    const seededName = uniqueName('ActivityLog')
    const seededEmail = uniqueEmail('activitylog')
    const { profileId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)

    await members.editMemberViaModal({ phone: '+15555551234' })

    const { data: logs } = await testDb
      .from('activity_log')
      .select('*')
      .eq('subject_id', profileId)
      .eq('type', 'member_updated')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    const log = logs![0]
    // Layer 4 proof: description is not null
    expect(log.description).not.toBeNull()
    expect(log.description).toBeTruthy()
    expect(log.description).toContain('Member updated')
    // Layer 3 enum proof: 'member_updated' is in the activity_log CHECK
    expect(log.type).toBe('member_updated')
    // Metadata records the changed fields
    expect(log.metadata).toBeTruthy()
    expect(log.metadata.fields).toContain('phone')
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P0: RLS UPDATE policy lets admin update other profiles
  // (BUG-012 Layer 5 fix proof — the policy added in this council run)
  // ---------------------------------------------------------------------

  test('admin can update profile they do not own (RLS policy proof) @p0', async ({
    page,
  }) => {
    // The admin test user is meridian-e2e-admin@..., not this seeded
    // member. Pre-fix, profiles_update_own would have blocked the update
    // because auth.uid() != target row id. The new profiles_update_admin
    // policy lets owners/managers in the same studio update any profile.
    const seededName = uniqueName('RLSAdmin')
    const seededEmail = uniqueEmail('rlsadmin')
    const { profileId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      studioId: DEFAULT_STUDIO_ID,
    })

    const newName = `${seededName}_RLS`

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)

    await members.editMemberViaModal({ name: newName })

    // The profile must have actually been updated (no RLS denial)
    const { data: profile } = await testDb
      .from('profiles')
      .select('full_name')
      .eq('id', profileId)
      .single()

    expect(profile?.full_name).toBe(newName)
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1: blank required field keeps Submit disabled
  // ---------------------------------------------------------------------

  test('blank name keeps submit button disabled @p1', async ({ page }) => {
    const seededName = uniqueName('BlankName')
    const seededEmail = uniqueEmail('blankname')
    await seedMember({
      fullName: seededName,
      email: seededEmail,
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)
    await members.openEditMemberModal()

    // Clear the name field — submit must go disabled
    await members.editMemberNameInput().fill('')
    await expect(members.editMemberSubmitBtn()).toBeDisabled()
  })

  // ---------------------------------------------------------------------
  // Scenario 6 — P1: duplicate email returns 409 and surfaces error
  // (BUG-012 Layer 6 fix proof — the dup-email check the PUT was missing)
  // ---------------------------------------------------------------------

  test('duplicate email returns 409 and shows modal error @p1', async ({
    page,
  }) => {
    // Seed two members
    const memberAName = uniqueName('DupTargetA')
    const memberAEmail = uniqueEmail('duptargeta')
    const memberBName = uniqueName('DupTargetB')
    const memberBEmail = uniqueEmail('duptargetb')

    await seedMember({
      fullName: memberAName,
      email: memberAEmail,
      studioId: DEFAULT_STUDIO_ID,
    })
    const { profileId: profileBId } = await seedMember({
      fullName: memberBName,
      email: memberBEmail,
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(memberBName)
    await members.openEditMemberModal()

    // Try to overwrite memberB's email with memberA's email
    await members.editMemberEmailInput().fill(memberAEmail)
    await members.submitEditMemberForm()

    // Modal should stay open and surface the 409 error
    await members.expectEditMemberError('already exists')
    await expect(members.editMemberModal()).toBeVisible()

    // memberB's email should NOT have been overwritten
    const { data: profileB } = await testDb
      .from('profiles')
      .select('email')
      .eq('id', profileBId)
      .single()

    expect(profileB?.email).toBe(memberBEmail)
  })

  // ---------------------------------------------------------------------
  // Scenario 7 — P1: invalid email format returns 400 from server regex
  // ---------------------------------------------------------------------

  test('invalid email format returns 400 from server regex @p1', async ({
    page,
  }) => {
    const seededName = uniqueName('InvalidEmail')
    const seededEmail = uniqueEmail('invalidemail')
    const { profileId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      studioId: DEFAULT_STUDIO_ID,
    })

    // Establish the admin session by visiting the page first
    await page.goto('/members')
    const members = new MembersPage(page)
    await members.expectDirectoryMounted()

    // Bypass the UI's HTML5 type="email" check by hitting the API directly
    const res = await page.request.put(`/api/members/${profileId}`, {
      data: { email: 'no.tld@x' },
    })

    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid email format')

    // Server email NOT changed
    const { data: profile } = await testDb
      .from('profiles')
      .select('email')
      .eq('id', profileId)
      .single()
    expect(profile?.email).toBe(seededEmail)
  })

  // ---------------------------------------------------------------------
  // Scenario 8 — P1: cancel closes modal without writing
  // ---------------------------------------------------------------------

  test('cancel button closes modal without writing to DB @p1', async ({
    page,
  }) => {
    const seededName = uniqueName('CancelFlow')
    const seededEmail = uniqueEmail('cancelflow')
    const { profileId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      phone: '+15555550000',
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)
    await members.openEditMemberModal()

    // Type a new value but cancel before submitting
    await members.editMemberNameInput().fill(`${seededName}_NEVER_SAVED`)
    await members.cancelEditMemberForm()

    // Profile name NOT changed
    const { data: profile } = await testDb
      .from('profiles')
      .select('full_name, phone')
      .eq('id', profileId)
      .single()
    expect(profile?.full_name).toBe(seededName)
    expect(profile?.phone).toBe('+15555550000')
  })

  // ---------------------------------------------------------------------
  // Scenario 9 — P1: PUT only updates the fields that actually changed
  // (regression: PUT must NOT clobber email/phone/notes when only name changes)
  // ---------------------------------------------------------------------

  test('PUT updates only changed fields, leaves others intact @p1', async ({
    page,
  }) => {
    const seededName = uniqueName('OnlyChanged')
    const seededEmail = uniqueEmail('onlychanged')
    const seededPhone = '+15555556789'
    const seededNotes = 'Original notes that must survive an unrelated edit'

    const { profileId, memberId } = await seedMember({
      fullName: seededName,
      email: seededEmail,
      phone: seededPhone,
      notes: seededNotes,
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openMemberProfileByName(seededName)

    // Edit ONLY the name
    await members.editMemberViaModal({ name: `${seededName}_OnlyName` })

    // Profile: name changed, email + phone untouched
    const { data: profile } = await testDb
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', profileId)
      .single()
    expect(profile?.full_name).toBe(`${seededName}_OnlyName`)
    expect(profile?.email).toBe(seededEmail)
    expect(profile?.phone).toBe(seededPhone)

    // Members: notes untouched (Layer 1 regression check — notes must NOT
    // be cleared just because the user only changed the name)
    const { data: member } = await testDb
      .from('members')
      .select('notes')
      .eq('id', memberId)
      .single()
    expect(member?.notes).toBe(seededNotes)
  })
})
