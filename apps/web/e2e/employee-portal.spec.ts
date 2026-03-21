import { test, expect } from '@playwright/test'

test.describe('Employee Portal', () => {
  test('dashboard loads at /employee', async ({ page }) => {
    await page.goto('/employee')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('clock page loads at /employee/clock', async ({ page }) => {
    await page.goto('/employee/clock')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)

    // Should have clock-in/out related content
    expect(body!.toLowerCase()).toMatch(/clock|punch|shift|in|out|time/i)
  })

  test('schedule page loads at /employee/schedule', async ({ page }) => {
    await page.goto('/employee/schedule')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)

    // Should have schedule-related content
    expect(body!.toLowerCase()).toMatch(/schedule|class|session|shift|calendar/i)
  })

  test('timesheet page loads at /employee/timesheets', async ({ page }) => {
    await page.goto('/employee/timesheets')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)

    // Should have timesheet-related content
    expect(body!.toLowerCase()).toMatch(/timesheet|hours|pay|period|total/i)
  })
})
