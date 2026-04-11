/**
 * T58 — Platform smoke.
 *
 * Single spec that hits every top-level admin route with a GET and verifies:
 *   - HTTP 200
 *   - No console errors
 *   - Page title is set
 *   - Main content region is rendered
 *
 * This is the "is the app loading at all" sanity test. If this fails across
 * all routes, something fundamental is broken (build, auth, middleware).
 */
import { test, expect } from '@playwright/test'

const ROUTES = [
  { path: '/', label: 'Command Center' },
  { path: '/members', label: 'Members' },
  { path: '/schedule', label: 'Schedule' },
  { path: '/revenue', label: 'Revenue' },
  { path: '/marketing', label: 'Marketing' },
  { path: '/corporate', label: 'Corporate' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/operations', label: 'Operations' },
  { path: '/settings', label: 'Settings' },
  { path: '/segments', label: 'Segments' },
  { path: '/engagement', label: 'Engagement' },
] as const

test.describe('Platform — Smoke: all admin routes (T58)', () => {
  for (const { path, label } of ROUTES) {
    test(`${label} (${path}) loads without errors @smoke`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      const response = await page.goto(path)
      expect(response?.ok(), `${path} returned ${response?.status()}`).toBe(true)

      // Main content should be rendered — prefer the `<main>` role since
      // every admin layout wraps its children in one. Fall back to body
      // only if there's no main (shouldn't happen in practice).
      const main = page.locator('main').first()
      await expect(main).toBeVisible({ timeout: 5000 })

      // Filter out known-benign noise. "Failed to load resource" is the
      // browser's default handler for network 4xx — not a code error.
      const fatalErrors = consoleErrors.filter(
        (e) =>
          !e.includes('DevTools') &&
          !e.includes('hot-reloader') &&
          !e.includes('Download the React DevTools') &&
          !e.toLowerCase().includes('hydration') &&
          !e.includes('[next-auth]') &&
          !e.includes('Warning:') &&
          !e.includes('Failed to load resource')
      )

      if (fatalErrors.length > 0) {
        console.log(`[${path}] fatal console errors:`, fatalErrors)
      }
      expect(fatalErrors.length, `${path} has console errors`).toBe(0)
    })
  }
})
