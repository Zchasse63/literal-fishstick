/**
 * Tier 5.3 — Marketing: Create Automation Flow (API-level)
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

const PREFIX = 'E2ETestAutomation_'

function uniqueName(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${PREFIX}${label}_${tag}`
}

async function cleanup(): Promise<void> {
  const { data } = await testDb
    .from('automation_flows')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('name', `${PREFIX}%`)
  const ids = (data ?? []).map((r) => r.id)
  if (ids.length > 0) {
    await testDb.from('activity_log').delete().eq('subject_type', 'automation_flow').in('subject_id', ids)
    await testDb.from('automation_flows').delete().in('id', ids)
  }
}

test.describe('Marketing — Create Automation Flow (Tier 5.3)', () => {
  test.beforeEach(async () => { await cleanup() })
  test.afterAll(async () => { await cleanup() })

  test('creates automation with trigger + steps @p0', async ({ page }) => {
    const name = uniqueName('WelcomeFlow')
    const res = await page.request.post('/api/automations', {
      data: {
        name,
        trigger_type: 'signup',
        steps: [
          { type: 'delay', wait_minutes: 5 },
          { type: 'send_email', template: 'welcome' },
        ],
      },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.id).toBeTruthy()
    expect(body.data.trigger_type).toBe('signup')
    expect(body.data.is_active).toBe(false)
    expect(body.data.version).toBe(1)

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description')
      .eq('subject_id', body.data.id)
      .eq('type', 'automation_created')
    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toContain('Automation flow created')
    expect(logs![0].description).toContain(name)
  })

  test('rejects invalid trigger type @p1', async ({ page }) => {
    const res = await page.request.post('/api/automations', {
      data: { name: uniqueName('BadTrigger'), trigger_type: 'invalid_trigger', steps: [{ type: 'delay' }] },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects empty steps array @p1', async ({ page }) => {
    const res = await page.request.post('/api/automations', {
      data: { name: uniqueName('NoSteps'), trigger_type: 'signup', steps: [] },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects missing trigger_type @p1', async ({ page }) => {
    const res = await page.request.post('/api/automations', {
      data: { name: uniqueName('NoTrigger'), steps: [{ type: 'delay' }] },
    })
    expect(res.status()).toBe(400)
  })
})
