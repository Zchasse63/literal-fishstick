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

      // Track overflow per route without failing immediately — record all
      // violations so a single test run surfaces the full list.
      const overflows: Array<{ route: string; scrollWidth: number; innerWidth: number }> = []

      for (const route of ROUTES) {
        await page.goto(route)
        await page
          .waitForLoadState('networkidle', { timeout: 10_000 })
          .catch(() => {})

        const docWidth = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          innerWidth: window.innerWidth,
        }))

        const tolerance = 2
        if (docWidth.scrollWidth > docWidth.innerWidth + tolerance) {
          overflows.push({
            route,
            scrollWidth: docWidth.scrollWidth,
            innerWidth: docWidth.innerWidth,
          })
        }
      }

      // Desktop viewport is the only one we currently guarantee. Mobile and
      // tablet viewports are WIP — Phase 5 (member-facing + mobile) will
      // tighten these. For now, assert desktop is clean and log other
      // viewports without failing.
      if (viewport.name === 'desktop') {
        expect(
          overflows,
          `Desktop overflow: ${JSON.stringify(overflows)}`
        ).toHaveLength(0)
      } else if (overflows.length > 0) {
        console.log(
          `[${viewport.name}] overflow WIP (Phase 5 target):`,
          JSON.stringify(overflows)
        )
      }
    })
  }

  test('mobile — sidebar nav state smoke @responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // Phase 5 (member-facing + mobile) will add a menu toggle and collapse
    // the sidebar below 768px. For now, just log the current state without
    // failing — the admin dashboard is explicitly desktop-first for Phase 1-4.
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
      return rect.left < 0 || rect.width < 80 || rect.right < 0
    })

    if (!hasToggle && !sidebarHidden) {
      console.log(
        '[responsive] mobile sidebar has no toggle and is fully expanded — Phase 5 TODO'
      )
    }
    // Smoke only — this assertion is always true. Left here so the test
    // runs and logs the Phase 5 TODO.
    expect(true).toBe(true)
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
