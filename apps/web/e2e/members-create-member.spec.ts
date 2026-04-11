/**
 * Members: Create Member — Tier 3.5 council run.
 *
 * The full admin "Add Member" write flow: click the header button on
 * /members, fill the modal, submit it, and assert that a real `profiles`
 * row, a real `members` row, and a real `activity_log` row all land in the
 * database. Before this tier, the flow was broken at four independent layers
 * (BUG-010) — phantom `profiles.status` column, missing `members` insert,
 * invalid `activity_log.type` enum value, missing NOT NULL `description`.
 * All four fixed inline in the Engineer phase of this council run.
 *
 * Contract (mirrors Tier 3.4 products CRUD):
 *   1. beforeEach wipes the studio via resetStudioTestData()
 *   2. Tests drive the UI through the admin project
 *   3. After each write, tests assert the rows landed in Postgres with the
 *      correct DB column names (profiles.is_active, members.membership_status,
 *      activity_log.description, activity_log.type='member_created')
 *   4. Tests also assert the members row is keyed back to profile_id — the
 *      critical Layer-2 fix proof that BUG-010 is gone
 *   5. afterAll runs resetStudioTestData() as belt-and-braces cleanup
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

test.describe('Members — Create Member (Tier 3.5)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path: creates profile + member + activity_log
  // ---------------------------------------------------------------------

  test('creates a member end-to-end and writes profile + member + activity_log @p0', async ({
    page,
  }) => {
    const members = new MembersPage(page)
    const name = uniqueName('HappyPath')
    const email = uniqueEmail('happypath')

    await page.goto('/members')
    await members.expectDirectoryMounted()

    await members.createMemberViaModal({
      name,
      email,
      phone: '+15555551234',
    })

    // DB: profiles row — Layer 1 fix (no phantom `status` column)
    const { data: profile, error: profileError } = await testDb
      .from('profiles')
      .select('*')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('email', email)
      .single()

    expect(profileError).toBeNull()
    expect(profile).not.toBeNull()
    expect(profile?.full_name).toBe(name)
    expect(profile?.roles).toContain('member')
    expect(profile?.is_active).toBe(true)

    // DB: members row — Layer 2 fix (companion row exists)
    const { data: member, error: memberError } = await testDb
      .from('members')
      .select('*')
      .eq('profile_id', profile!.id)
      .single()

    expect(memberError).toBeNull()
    expect(member).not.toBeNull()
    expect(member?.studio_id).toBe(DEFAULT_STUDIO_ID)
    expect(member?.membership_status).toBe('active')
    expect(member?.credits_remaining).toBe(0)
    expect(member?.join_date).toBeTruthy()

    // DB: activity_log row — Layers 3 & 4 fix (valid enum + description)
    const { data: logs } = await testDb
      .from('activity_log')
      .select('*')
      .eq('subject_id', profile!.id)

    const createLog = logs?.find((l) => l.type === 'member_created')
    expect(createLog).toBeDefined()
    expect(createLog?.description).toBeTruthy()
    expect(createLog?.description).toContain(name)
    expect(createLog?.subject_type).toBe('profile')
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0: both profile AND member rows written
  // (explicit Layer-2 fix proof; even if Scenario 1 assertions drift, this
  // one stays laser-focused on the companion-row invariant)
  // ---------------------------------------------------------------------

  test('writes both profiles AND members rows keyed by profile_id @p0', async ({
    page,
  }) => {
    const members = new MembersPage(page)
    const name = uniqueName('DualWrite')
    const email = uniqueEmail('dualwrite')

    await page.goto('/members')
    await members.expectDirectoryMounted()

    await members.createMemberViaModal({ name, email })

    // Start at the profiles row
    const { data: profile } = await testDb
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()
    expect(profile?.id).toBeTruthy()

    // ... then walk to the members row by profile_id
    const { data: memberRows } = await testDb
      .from('members')
      .select('id, profile_id, studio_id')
      .eq('profile_id', profile!.id)

    expect(memberRows?.length).toBe(1)
    expect(memberRows?.[0]?.studio_id).toBe(DEFAULT_STUDIO_ID)
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P0: activity_log description NOT NULL (Layer 4 proof)
  // ---------------------------------------------------------------------

  test('activity_log entry has non-null description and valid type @p0', async ({
    page,
  }) => {
    const members = new MembersPage(page)
    const name = uniqueName('ActivityLog')
    const email = uniqueEmail('activitylog')

    await page.goto('/members')
    await members.expectDirectoryMounted()

    await members.createMemberViaModal({ name, email })

    const { data: profile } = await testDb
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    const { data: logs } = await testDb
      .from('activity_log')
      .select('*')
      .eq('subject_id', profile!.id)
      .eq('type', 'member_created')

    expect(logs?.length).toBe(1)
    const log = logs![0]
    // Layer 4 proof: description is not null
    expect(log.description).not.toBeNull()
    expect(log.description).toBeTruthy()
    expect(log.description).toContain('Member created')
    expect(log.description).toContain(name)
    // Layer 3 proof: valid CHECK enum value
    expect(log.type).toBe('member_created')
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P0: directory list surfaces new member via search
  //
  // The directory list query at members/page.tsx:207 orders by `id ASC`
  // with `limit(50)`. With ~1,187 existing members in the studio, newly
  // created rows never appear in the first 50 — they land further down the
  // list. That's a pre-existing UX issue (filed as BUG-011) but not in
  // scope for BUG-010. This scenario proves the create path makes the row
  // findable via the existing search box, which is the real contract we
  // care about: can an admin actually locate a member they just added?
  // ---------------------------------------------------------------------

  test('directory search finds the new member after create @p0', async ({
    page,
  }) => {
    const members = new MembersPage(page)
    const name = uniqueName('ListRefresh')
    const email = uniqueEmail('listrefresh')

    await page.goto('/members')
    await members.expectDirectoryMounted()

    await members.createMemberViaModal({ name, email })

    // Type the unique test name into the search box. The list uses a
    // 300ms debounce before refetching, so we allow up to 10s for the
    // filtered row to render.
    await page.getByPlaceholder('Search members...').fill(name)
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 })
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1: blank email blocks submission
  // ---------------------------------------------------------------------

  test('blank email blocks submit; no DB mutation @p1', async ({ page }) => {
    const members = new MembersPage(page)
    const name = uniqueName('BlankEmail')

    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openAddMemberModal()

    // Fill only the name — submit stays disabled, clicking does nothing.
    await members.addMemberNameInput().fill(name)
    await expect(members.addMemberSubmitBtn()).toBeDisabled()

    // Zero DB mutation keyed to our test prefix
    const { data } = await testDb
      .from('profiles')
      .select('id')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('full_name', name)

    expect(data?.length ?? 0).toBe(0)
  })

  // ---------------------------------------------------------------------
  // Scenario 6 — P1: blank name keeps Submit disabled
  // ---------------------------------------------------------------------

  test('blank name keeps submit button disabled @p1', async ({ page }) => {
    const members = new MembersPage(page)
    const email = uniqueEmail('blankname')

    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openAddMemberModal()

    // Type only the email. Submit should stay disabled per the modal's
    // `disabled={... || !addForm.full_name || !addForm.email}` guard.
    await members.addMemberEmailInput().fill(email)
    await expect(members.addMemberSubmitBtn()).toBeDisabled()

    // Zero DB mutation keyed to the literal email we typed.
    const { data } = await testDb
      .from('profiles')
      .select('id')
      .eq('email', email)

    expect(data?.length ?? 0).toBe(0)
  })

  // ---------------------------------------------------------------------
  // Scenario 7 — P1: duplicate email returns 409 and surfaces error
  // ---------------------------------------------------------------------

  test('duplicate email returns 409 and shows modal error @p1', async ({
    page,
  }) => {
    // Seed a profile + member first with a known email
    const dupEmail = uniqueEmail('duplicate')
    const dupName = uniqueName('DupSeed')
    await seedMember({
      email: dupEmail,
      fullName: dupName,
      studioId: DEFAULT_STUDIO_ID,
    })

    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openAddMemberModal()

    // Try to create a second member with the same email
    await members.fillAddMemberForm({
      name: uniqueName('DupAttempt'),
      email: dupEmail,
    })
    await members.submitAddMemberForm()

    // Modal should stay open and surface the 409 error
    await members.expectAddMemberError('already exists')
    await expect(members.addMemberModal()).toBeVisible()

    // Exactly one profile row should exist for that email
    const { data: profiles } = await testDb
      .from('profiles')
      .select('id')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('email', dupEmail)

    expect(profiles?.length).toBe(1)
  })

  // ---------------------------------------------------------------------
  // Scenario 8 — P1: invalid email format returns 400 directly from server
  //
  // We bypass the UI for this scenario — the browser's HTML5 type="email"
  // validation would block the form before the server regex ever runs. To
  // actually verify the server-side check, we POST directly via the
  // authenticated session and assert the 400 response.
  // ---------------------------------------------------------------------

  test('invalid email format returns 400 from server regex @p1', async ({
    page,
  }) => {
    // Establish the admin session via the page so cookies are present on
    // page.request (Playwright shares storage state within a context).
    await page.goto('/members')
    const members = new MembersPage(page)
    await members.expectDirectoryMounted()

    const name = uniqueName('InvalidEmail')

    // HTML5 regex for input[type=email] accepts `no.tld@x` (one @, at least
    // one char on each side). The server's stricter regex requires a dot
    // after the domain portion: /^[^\s@]+@[^\s@]+\.[^\s@]+$/. Sending this
    // via a direct API call exercises the server's validation path
    // unambiguously.
    const res = await page.request.post('/api/members', {
      data: {
        full_name: name,
        email: 'no.tld@x',
      },
    })

    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid email format')

    // Zero DB mutation keyed to our test name
    const { data } = await testDb
      .from('profiles')
      .select('id')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('full_name', name)

    expect(data?.length ?? 0).toBe(0)
  })

  // ---------------------------------------------------------------------
  // Scenario 9 — P1: cancel closes modal without writing
  // ---------------------------------------------------------------------

  test('cancel button closes modal without writing to DB @p1', async ({
    page,
  }) => {
    const members = new MembersPage(page)
    const name = uniqueName('CancelFlow')
    const email = uniqueEmail('cancelflow')

    await page.goto('/members')
    await members.expectDirectoryMounted()
    await members.openAddMemberModal()

    await members.fillAddMemberForm({ name, email })
    await members.cancelAddMemberForm()

    // Zero DB mutation
    const { data } = await testDb
      .from('profiles')
      .select('id')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('email', email)

    expect(data?.length ?? 0).toBe(0)
  })
})
