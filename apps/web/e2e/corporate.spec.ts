import { test, expect } from '@playwright/test'

test.describe('Corporate', () => {
  test('page loads at /corporate', async ({ page }) => {
    await page.goto('/corporate')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('events page loads at /corporate/events', async ({ page }) => {
    await page.goto('/corporate/events')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)

    // Should have event-related content
    expect(body!.toLowerCase()).toMatch(/event|booking|party|group|private/i)
  })
})
