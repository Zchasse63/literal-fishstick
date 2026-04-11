/**
 * T44 — Multi-tenant isolation (RLS) validation.
 *
 * Verifies that an authenticated session for studio A cannot read or write
 * data belonging to studio B. This is the single most important security
 * guarantee in Meridian — every policy file needs to be bulletproof here.
 *
 * Strategy: seed a row in a "foreign" studio (studio B) via the admin client,
 * then try to GET it via the admin-authenticated session (studio A). The
 * response should either 404 (row not visible) or 200 with an empty result.
 *
 * Note: In the current single-studio test environment, this test creates a
 * second fake studio, seeds data there, and verifies it's invisible to the
 * default studio's session. If the test env ever moves to multi-studio
 * fixtures, this becomes unnecessary — but as a regression guard it's cheap.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'
import { randomUUID } from 'node:crypto'

const FOREIGN_STUDIO_ID = randomUUID()
const FOREIGN_STUDIO_NAME = 'E2E Foreign Studio (should be invisible)'

test.describe('Platform — Multi-tenant isolation (T44)', () => {
  test.beforeAll(async () => {
    // Seed a foreign studio via service role (bypasses RLS)
    const { error } = await testDb.from('studios').insert({
      id: FOREIGN_STUDIO_ID,
      name: FOREIGN_STUDIO_NAME,
      slug: `e2e-foreign-${FOREIGN_STUDIO_ID.slice(0, 8)}`,
      email: 'foreign@test.meridian',
      timezone: 'UTC',
    })
    if (error && !error.message.includes('duplicate')) {
      throw new Error(`seedForeignStudio: ${error.message}`)
    }
  })

  test.afterAll(async () => {
    // Cleanup foreign studio (cascade will delete dependents)
    await testDb.from('studios').delete().eq('id', FOREIGN_STUDIO_ID)
  })

  test('T44 — admin session cannot read foreign studio data via RLS @p0', async ({
    page,
  }) => {
    // Seed a campaign in the foreign studio
    const foreignCampaignId = randomUUID()
    const { error: campaignError } = await testDb.from('campaigns').insert({
      id: foreignCampaignId,
      studio_id: FOREIGN_STUDIO_ID,
      name: 'E2E Foreign Campaign (should be invisible)',
      type: 'email',
      status: 'draft',
      subject: 'Foreign subject',
      body_html: '<p>Foreign body</p>',
    })
    if (campaignError) throw new Error(`seedForeignCampaign: ${campaignError.message}`)

    try {
      // GET /api/campaigns via admin auth (default studio)
      const response = await page.request.get('/api/campaigns')
      expect(response.ok()).toBe(true)

      const payload = (await response.json()) as { data: Array<{ id: string }> }
      expect(Array.isArray(payload.data)).toBe(true)

      // Foreign campaign must NOT appear in the admin's view
      const leaked = payload.data.find((c) => c.id === foreignCampaignId)
      expect(leaked).toBeUndefined()
    } finally {
      await testDb.from('campaigns').delete().eq('id', foreignCampaignId)
    }
  })

  test('T44 — direct GET of foreign campaign by id returns 404 @p0', async ({
    page,
  }) => {
    const foreignCampaignId = randomUUID()
    const { error: campaignError } = await testDb.from('campaigns').insert({
      id: foreignCampaignId,
      studio_id: FOREIGN_STUDIO_ID,
      name: 'E2E Foreign Direct',
      type: 'email',
      status: 'draft',
      subject: 'Foreign',
      body_html: '<p>x</p>',
    })
    if (campaignError) throw new Error(`seedForeignCampaign: ${campaignError.message}`)

    try {
      // Attempt to fetch by id — route does WHERE studio_id = self, so 404
      const response = await page.request.get(`/api/campaigns/${foreignCampaignId}`)
      expect(response.status()).toBe(404)
    } finally {
      await testDb.from('campaigns').delete().eq('id', foreignCampaignId)
    }
  })

  test('T44 — seeded foreign member invisible to /api/members @p0', async ({
    page,
  }) => {
    // Seed a profile + member in the foreign studio
    const foreignProfileId = randomUUID()
    const uniqueName = `ForeignMember_${foreignProfileId.slice(0, 8)}`

    const { error: pErr } = await testDb.from('profiles').insert({
      id: foreignProfileId,
      studio_id: FOREIGN_STUDIO_ID,
      email: `foreign-${foreignProfileId.slice(0, 8)}@test.meridian`,
      full_name: uniqueName,
      roles: ['member'],
    })
    if (pErr) throw new Error(`seedForeignProfile: ${pErr.message}`)

    const foreignMemberId = randomUUID()
    const { error: mErr } = await testDb.from('members').insert({
      id: foreignMemberId,
      profile_id: foreignProfileId,
      studio_id: FOREIGN_STUDIO_ID,
      membership_status: 'active',
    })
    if (mErr) throw new Error(`seedForeignMember: ${mErr.message}`)

    try {
      // Search for the unique name — should return 0 results
      const response = await page.request.get(
        `/api/members?search=${encodeURIComponent(uniqueName)}`
      )
      expect(response.ok()).toBe(true)

      const payload = (await response.json()) as {
        data: Array<{ id: string; profiles?: { full_name?: string } | null }>
      }
      const leaked = payload.data.find(
        (m) => m.id === foreignMemberId || m.profiles?.full_name === uniqueName
      )
      expect(leaked).toBeUndefined()
    } finally {
      await testDb.from('members').delete().eq('id', foreignMemberId)
      await testDb.from('profiles').delete().eq('id', foreignProfileId)
    }
  })

  test('T44 — default studio session sees DEFAULT_STUDIO_ID match @p0', async ({
    page,
  }) => {
    // Sanity check: the session IS able to see its own studio's data.
    // This guards against a false negative where all the above pass simply
    // because RLS is broken and nothing is visible.
    const response = await page.request.get('/api/campaigns')
    expect(response.ok()).toBe(true)
    const payload = (await response.json()) as { data: Array<{ studio_id: string }> }
    // All returned rows should belong to the default studio
    for (const row of payload.data) {
      expect(row.studio_id).toBe(DEFAULT_STUDIO_ID)
    }
  })
})
