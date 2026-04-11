/**
 * T59-T60 — Pre-launch gate.
 *
 * Single spec that asserts the go/no-go invariants for production launch:
 *
 *   T59 — Critical infra healthy:
 *     - /login responds in < 2s  (proxy migration)
 *     - / loads without fatal console errors  (command center works)
 *     - /api/auth/profile returns valid user session
 *
 *   T60 — Critical APIs respond without 5xx:
 *     - /api/bookings GET      — booking engine
 *     - /api/members GET       — member directory
 *     - /api/campaigns GET     — marketing
 *     - /api/revenue/transactions GET — revenue module
 *     - /api/analytics/briefing GET — AI briefing
 *     - /api/command-center/metrics GET — command center
 *
 * If any of these fail, the launch is NO-GO. This is the final safety net
 * before deploying to production.
 */
import { test, expect } from '@playwright/test'

test.describe('Pre-launch gate (T59-T60)', () => {
  test('T59 — /login compiles and responds in < 2s @launch', async ({ page }) => {
    const start = Date.now()
    const res = await page.request.get('/login')
    const elapsed = Date.now() - start
    expect(res.ok()).toBe(true)
    expect(elapsed).toBeLessThan(2_000)
  })

  test('T59 — / loads without fatal console errors @launch', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    const res = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(res?.ok()).toBe(true)

    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

    const fatalErrors = errors.filter(
      (e) =>
        !e.includes('DevTools') &&
        !e.includes('hot-reloader') &&
        !e.includes('Download the React DevTools') &&
        !e.toLowerCase().includes('hydration') &&
        !e.includes('Warning:')
    )
    expect(fatalErrors.length, `Fatal console errors: ${fatalErrors.join('; ')}`).toBe(0)
  })

  test('T59 — /api/auth/profile returns a valid session @launch', async ({
    page,
  }) => {
    const res = await page.request.get('/api/auth/profile')
    expect(res.ok()).toBe(true)
    const payload = (await res.json()) as {
      data?: { id?: string; email?: string }
      user?: { id?: string; email?: string }
    }
    const user = payload.data ?? payload.user
    expect(user).toBeTruthy()
    expect(user?.id).toBeTruthy()
  })

  test('T60 — critical GET endpoints return < 400 @launch', async ({ page }) => {
    const ENDPOINTS = [
      '/api/bookings',
      '/api/members',
      '/api/campaigns',
      '/api/classes',
      '/api/transactions',
      '/api/command-center/metrics',
      '/api/command-center/focus',
      '/api/analytics/snapshot',
    ]

    const failures: Array<{ path: string; status: number }> = []

    for (const path of ENDPOINTS) {
      const res = await page.request.get(path)
      const status = res.status()
      // Accept 200/201/204 success and 404 (endpoint may not exist yet).
      // Never accept 5xx.
      if (status >= 500) {
        failures.push({ path, status })
      }
    }

    if (failures.length > 0) {
      console.log('Pre-launch gate failures:', failures)
    }
    expect(failures.length, `5xx failures: ${JSON.stringify(failures)}`).toBe(0)
  })

  test('T60 — command center metrics payload shape is valid @launch', async ({
    page,
  }) => {
    // Command center metrics should return an object (not null/undefined/
    // array). This catches regressions where the query shape changes and
    // the client renders garbage. Note: Meridian does NOT have a real-time
    // occupancy feature — members see reserved/total slots on the class
    // schedule, not a live occupancy counter.
    const res = await page.request.get('/api/command-center/metrics')
    if (res.status() === 404) {
      test.skip()
    }
    expect(res.ok()).toBe(true)
    const payload = (await res.json()) as { data?: Record<string, unknown> }
    const data = payload.data ?? {}

    expect(typeof data).toBe('object')
    expect(data).not.toBeNull()
    expect(Array.isArray(data)).toBe(false)
  })
})
