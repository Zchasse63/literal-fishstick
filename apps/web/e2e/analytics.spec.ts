import { test, expect } from '@playwright/test'

test.describe('Analytics', () => {
  test('overview loads at /analytics', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('reports page loads at /analytics/reports', async ({ page }) => {
    await page.goto('/analytics/reports')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)

    // Should have report-related content
    expect(body!.toLowerCase()).toMatch(/report|export|generate|download|summary/i)
  })

  test('AI insights page loads at /analytics/insights', async ({ page }) => {
    await page.goto('/analytics/insights')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)

    // Should have insight/AI-related content
    expect(body!.toLowerCase()).toMatch(/insight|ai|recommendation|intelligence|analysis/i)
  })

  test('trainer performance page loads at /analytics/trainers', async ({ page }) => {
    await page.goto('/analytics/trainers')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)

    // Should have trainer-related content
    expect(body!.toLowerCase()).toMatch(/trainer|instructor|performance|class|rating/i)
  })
})
