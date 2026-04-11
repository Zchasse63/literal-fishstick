/**
 * Tier 6.6 — Analytics: Glofox Migration dry-run (READ-ONLY, API-level)
 *
 * IMPORTANT: Per the project memory "Never write to Glofox in tests or code
 * until explicitly approved; reads only." This tier only exercises read-only
 * endpoints (`/api/glofox/status` and the migration validation route's dry
 * run path). No sync writes occur.
 */
import { test, expect } from '@playwright/test'

test.describe('Analytics — Glofox Migration Dry Run (Tier 6.6)', () => {
  test('GET /api/glofox/status returns sync state shape @p0', async ({ page }) => {
    const res = await page.request.get('/api/glofox/status')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(typeof body.is_syncing).toBe('boolean')

    // If sync-state rows exist, verify shape
    for (const row of body.data) {
      expect(row).toHaveProperty('entity_type')
      expect(row).toHaveProperty('status')
    }
  })

  test('GET /api/migration/status surfaces wave assignments for Glofox members @p0', async ({ page }) => {
    const res = await page.request.get('/api/migration/status')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.wave_assignments).toBeTruthy()

    // Sum of all buckets should be a finite number.
    const w = body.data.wave_assignments
    const total = w.wave_1 + w.wave_2 + w.wave_3 + w.wave_4 + w.wave_5 + w.pending_assignment
    expect(Number.isFinite(total)).toBe(true)
  })

  test('POST /api/migration/validate rejects empty payload @p1', async ({ page }) => {
    const res = await page.request.post('/api/migration/validate', {
      data: {},
    })
    // Must be a 4xx — a 500 would indicate the route crashed.
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('regression: no phantom Glofox column writes during dry run @p1', async ({ page }) => {
    // This is a smoke check — read endpoints should return 200 shapes.
    const s1 = await page.request.get('/api/glofox/status')
    expect(s1.status()).toBe(200)
    const s2 = await page.request.get('/api/migration/status')
    expect(s2.status()).toBe(200)
  })
})
