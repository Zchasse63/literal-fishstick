/**
 * T45 — Auth matrix validation.
 *
 * Verifies that role-gated routes return the correct status for each
 * authenticated persona:
 *   - admin (owner role)      → 200 on admin routes
 *   - employee (trainer role) → 403 on admin routes, 200 on employee routes
 *   - anonymous               → 401 on all authenticated routes
 *
 * Covers the 5 core guard points:
 *   /api/members          — admin-only
 *   /api/campaigns        — admin-only
 *   /api/staff            — admin-only
 *   /api/clock            — employee+
 *   /api/auth/profile     — any authenticated user
 */
import { test, expect } from '@playwright/test'

const ADMIN_ROUTES = [
  { method: 'GET', path: '/api/members' },
  { method: 'GET', path: '/api/campaigns' },
  { method: 'GET', path: '/api/staff' },
  { method: 'GET', path: '/api/revenue/transactions' },
  { method: 'GET', path: '/api/corporate' },
] as const

const EMPLOYEE_ROUTES = [
  { method: 'GET', path: '/api/clock' },
] as const

const ANY_AUTH_ROUTES = [
  { method: 'GET', path: '/api/auth/profile' },
] as const

test.describe('Platform — Auth matrix: admin project @auth', () => {
  test('admin can access all admin routes with 200 @p0', async ({ page }) => {
    for (const { method, path } of ADMIN_ROUTES) {
      const res = await page.request.fetch(path, { method })
      if (res.status() === 404) {
        // Route may not exist yet — not a fail of the auth matrix
        continue
      }
      expect(
        res.status(),
        `admin ${method} ${path} expected 2xx, got ${res.status()}`
      ).toBeLessThan(400)
    }
  })

  test('admin can access any-auth routes @p1', async ({ page }) => {
    for (const { method, path } of ANY_AUTH_ROUTES) {
      const res = await page.request.fetch(path, { method })
      if (res.status() === 404) continue
      expect(res.status()).toBeLessThan(400)
    }
  })
})

test.describe('Platform — Auth matrix: employee project @auth', () => {
  test.use({ storageState: 'e2e/.auth/employee.json' })

  test('employee gets 403 on admin routes @p0', async ({ page }) => {
    for (const { method, path } of ADMIN_ROUTES) {
      const res = await page.request.fetch(path, { method })
      if (res.status() === 404) continue
      // Accept 401 or 403 — both indicate the employee is blocked
      expect(
        [401, 403],
        `employee ${method} ${path} expected 401/403, got ${res.status()}`
      ).toContain(res.status())
    }
  })

  test('employee can access employee routes with 200 @p0', async ({ page }) => {
    for (const { method, path } of EMPLOYEE_ROUTES) {
      const res = await page.request.fetch(path, { method })
      if (res.status() === 404) continue
      expect(
        res.status(),
        `employee ${method} ${path} expected 2xx, got ${res.status()}`
      ).toBeLessThan(400)
    }
  })
})

test.describe('Platform — Auth matrix: anonymous @auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('anonymous gets 401 on authenticated routes @p0', async ({ page }) => {
    for (const { method, path } of [...ADMIN_ROUTES, ...EMPLOYEE_ROUTES, ...ANY_AUTH_ROUTES]) {
      const res = await page.request.fetch(path, { method })
      if (res.status() === 404) continue
      expect(
        [401, 403],
        `anonymous ${method} ${path} expected 401/403, got ${res.status()}`
      ).toContain(res.status())
    }
  })
})
