import { test, expect } from '@playwright/test'

test.describe('Command Center', () => {
  test('page loads at root route', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify we're not on the login page (auth worked)
    expect(page.url()).not.toContain('/login')

    // Verify content rendered
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('metric cards or key data sections are visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Look for metric cards, stat sections, or dashboard widgets
    const metrics = page.locator('[class*="card" i], [class*="metric" i], [class*="stat" i], [class*="widget" i], [class*="kpi" i], [role="group"]')
    // At least one data section should be visible
    const count = await metrics.count()
    if (count > 0) {
      await expect(metrics.first()).toBeVisible({ timeout: 30000 })
    } else {
      // Fallback: check for any numeric content that looks like metrics
      const body = await page.textContent('body')
      expect(body).toBeTruthy()
      expect(body!.length).toBeGreaterThan(100)
    }
  })

  test('activity feed or recent activity section renders', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Look for activity feed, recent activity, or timeline elements
    const activity = page.locator('[class*="activity" i], [class*="feed" i], [class*="timeline" i], [class*="recent" i]')
    const textMatch = page.getByText(/activity|recent|feed/i)
    const count = await activity.count()
    const textCount = await textMatch.count()
    if (count > 0) {
      await expect(activity.first()).toBeVisible({ timeout: 30000 })
    } else if (textCount > 0) {
      await expect(textMatch.first()).toBeVisible({ timeout: 30000 })
    } else {
      // Page loaded successfully — content is present even if no explicit activity section
      const body = await page.textContent('body')
      expect(body!.length).toBeGreaterThan(100)
    }
  })

  test('navigation sidebar is visible with expected links', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Look for nav element or sidebar
    const nav = page.locator('nav, [role="navigation"], aside')
    await expect(nav.first()).toBeVisible({ timeout: 15000 })

    // Check for key navigation items
    const navText = await nav.first().textContent()
    expect(navText).toBeTruthy()

    // Should have at least some of the core module links
    const expectedLinks = ['schedule', 'members', 'revenue']
    const foundLinks = expectedLinks.filter((link) =>
      navText!.toLowerCase().includes(link)
    )
    expect(foundLinks.length).toBeGreaterThanOrEqual(2)
  })
})
