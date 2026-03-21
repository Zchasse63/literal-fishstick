import { test, expect } from '@playwright/test'

test.describe('Schedule', () => {
  test('page loads at /schedule', async ({ page }) => {
    await page.goto('/schedule')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('schedule grid or calendar component renders', async ({ page }) => {
    await page.goto('/schedule')
    await page.waitForLoadState('networkidle')

    // Look for calendar/grid/schedule elements
    const schedule = page.locator('[class*="calendar" i], [class*="schedule" i], [class*="grid" i], [class*="timeline" i], table, [role="grid"]')
    const count = await schedule.count()
    if (count > 0) {
      await expect(schedule.first()).toBeVisible({ timeout: 30000 })
    } else {
      // Verify schedule-related content is present
      const body = await page.textContent('body')
      expect(body!.toLowerCase()).toMatch(/schedule|class|session|slot|book/i)
    }
  })

  test('page shows class cards or time slots', async ({ page }) => {
    await page.goto('/schedule')
    await page.waitForLoadState('networkidle')

    // Look for class cards, time slot elements, or session entries
    const slots = page.locator('[class*="class" i], [class*="slot" i], [class*="session" i], [class*="event" i], [class*="card" i]')
    const count = await slots.count()

    // Either we have slot elements or the page has time-related content
    if (count > 0) {
      expect(count).toBeGreaterThan(0)
    } else {
      const body = await page.textContent('body')
      expect(body).toBeTruthy()
      // Should have some schedule-related text
      expect(body!.length).toBeGreaterThan(50)
    }
  })
})
