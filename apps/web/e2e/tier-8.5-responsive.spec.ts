/**
 * T43 — Responsive / viewport smoke tests.
 *
 * Verifies the admin dashboard renders without horizontal scroll or
 * critical overflow at three viewports:
 *   - mobile (375×812)     — iPhone 13 Mini
 *   - tablet (768×1024)    — iPad
 *   - desktop (1440×900)   — laptop / default dashboard target
 *
 * These are smoke checks — full responsive verification requires visual
 * diffing, which is out of scope. The goal here is to catch hard breakage
 * (horizontal scroll, overlapping content, invisible nav).
 */
import { test, expect } from '@playwright/test'

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

const ROUTES = ['/', '/members', '/schedule', '/revenue']

test.describe('Responsive — Viewport Smoke (T43)', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} (${viewport.width}x${viewport.height}) — no horizontal scroll @responsive`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      for (const route of ROUTES) {
        await page.goto(route)
        await page
          .waitForLoadState('networkidle', { timeout: 10_000 })
          .catch(() => {})

        // Check that document width doesn't exceed viewport width (allow a
        // small tolerance for scrollbar / subpixel math).
        const docWidth = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          innerWidth: window.innerWidth,
        }))

        const tolerance = 2
        if (docWidth.scrollWidth > docWidth.innerWidth + tolerance) {
          console.log(
            `[${viewport.name}] ${route} overflows: scrollWidth=${docWidth.scrollWidth}, innerWidth=${docWidth.innerWidth}`
          )
        }
        expect(
          docWidth.scrollWidth,
          `${route} @ ${viewport.name} has horizontal overflow`
        ).toBeLessThanOrEqual(docWidth.innerWidth + tolerance)
      }
    })
  }

  test('mobile — sidebar nav collapses or has menu toggle @responsive', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // On mobile either:
    //  - a menu toggle button is visible, OR
    //  - the sidebar is collapsed (hidden or very narrow)
    const hasToggle = await page
      .locator(
        'button[aria-label*="menu" i], button[aria-label*="nav" i], [data-testid*="menu-toggle"], [data-testid*="sidebar-toggle"]'
      )
      .first()
      .isVisible()
      .catch(() => false)

    const sidebarHidden = await page.evaluate(() => {
      const sidebar = document.querySelector(
        '[data-testid*="sidebar"], aside, nav[role="navigation"]'
      )
      if (!sidebar) return true
      const rect = sidebar.getBoundingClientRect()
      // Hidden if offscreen or width < 80px
      return rect.left < 0 || rect.width < 80 || rect.right < 0
    })

    // At least one must be true on mobile, otherwise the nav is broken
    expect(hasToggle || sidebarHidden).toBe(true)
  })

  test('desktop — sidebar nav is visible and contains key routes @responsive', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // Verify some nav link to /members is visible
    const membersLink = page.locator('a[href="/members"], a[href*="/members/"]').first()
    await expect(membersLink).toBeVisible({ timeout: 5_000 })
  })
})
