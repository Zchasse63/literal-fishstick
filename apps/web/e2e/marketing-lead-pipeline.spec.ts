/**
 * Tier 5.5 — Marketing: Lead Pipeline Update (API-level)
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

const PREFIX = 'E2ETestLead_'

function uniqueFirst(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${PREFIX}${label}_${tag}`
}

async function cleanup(): Promise<void> {
  const { data } = await testDb
    .from('leads')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('first_name', `${PREFIX}%`)
  const ids = (data ?? []).map((r) => r.id)
  if (ids.length > 0) {
    await testDb.from('activity_log').delete().eq('subject_type', 'lead').in('subject_id', ids)
    await testDb.from('leads').delete().in('id', ids)
  }
}

async function seedLead(firstName: string): Promise<string> {
  const { data, error } = await testDb
    .from('leads')
    .insert({
      studio_id: DEFAULT_STUDIO_ID,
      first_name: firstName,
      last_name: 'Tester',
      email: `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}@test.meridian.app`,
      status: 'new',
      source: 'website',
    })
    .select('id')
    .single()
  if (error) throw new Error(`seedLead: ${error.message}`)
  return data!.id
}

test.describe('Marketing — Lead Pipeline Update (Tier 5.5)', () => {
  test.beforeEach(async () => { await cleanup() })
  test.afterAll(async () => { await cleanup() })

  test('updates lead status @p0', async ({ page }) => {
    const name = uniqueFirst('PipelineTest')
    const leadId = await seedLead(name)

    const res = await page.request.put(`/api/leads/${leadId}`, {
      data: { status: 'contacted' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.status).toBe('contacted')

    const { data: logs } = await testDb
      .from('activity_log')
      .select('description, type')
      .eq('subject_id', leadId)
      .eq('type', 'lead_updated')
    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toBeTruthy()
  })

  test('updates lead contact info @p0', async ({ page }) => {
    const name = uniqueFirst('Contact')
    const leadId = await seedLead(name)

    const res = await page.request.put(`/api/leads/${leadId}`, {
      data: { phone: '+15555550123', notes: 'Called back, interested' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.notes).toBe('Called back, interested')
  })

  test('returns 404 for non-existent lead @p1', async ({ page }) => {
    const res = await page.request.put(`/api/leads/00000000-0000-4000-a000-000000000099`, {
      data: { status: 'contacted' },
    })
    expect(res.status()).toBe(404)
  })
})
