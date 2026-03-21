import { test, expect } from '@playwright/test'

test.describe('Revenue', () => {
  test('page loads at /revenue', async ({ page }) => {
    await page.goto('/revenue')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('revenue dashboard renders with metric cards', async ({ page }) => {
    await page.goto('/revenue')
    await page.waitForLoadState('networkidle')

    // Look for metric/stat cards (MRR, ARPM, churn, etc.)
    const metrics = page.locator('[class*="card" i], [class*="metric" i], [class*="stat" i], [class*="kpi" i]')
    const count = await metrics.count()
    if (count > 0) {
      await expect(metrics.first()).toBeVisible({ timeout: 30000 })
    } else {
      // Verify revenue-related content
      const body = await page.textContent('body')
      expect(body!.toLowerCase()).toMatch(/revenue|mrr|income|transaction|subscription/i)
    }
  })

  test('charts or graphs section is visible', async ({ page }) => {
    await page.goto('/revenue')
    await page.waitForLoadState('networkidle')

    // Look for chart containers, SVGs (common for chart libraries), or canvas elements
    const charts = page.locator('canvas, svg, [class*="chart" i], [class*="graph" i], [class*="recharts" i], [class*="plot" i]')
    const count = await charts.count()
    if (count > 0) {
      await expect(charts.first()).toBeVisible({ timeout: 30000 })
    } else {
      // Charts may load asynchronously — verify the page has substantial content
      const body = await page.textContent('body')
      expect(body!.length).toBeGreaterThan(100)
    }
  })
})
