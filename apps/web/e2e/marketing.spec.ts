import { test, expect } from '@playwright/test'

test.describe('Marketing', () => {
  test('overview loads at /marketing', async ({ page }) => {
    await page.goto('/marketing')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('campaigns page loads at /marketing/campaigns', async ({ page }) => {
    await page.goto('/marketing/campaigns')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)

    // Should have campaign-related content
    expect(body!.toLowerCase()).toMatch(/campaign|email|send|create|draft/i)
  })

  test('leads pipeline loads at /marketing/leads', async ({ page }) => {
    await page.goto('/marketing/leads')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)

    // Should have lead-related content
    expect(body!.toLowerCase()).toMatch(/lead|pipeline|prospect|contact|stage/i)
  })

  test('automations page loads at /marketing/automations', async ({ page }) => {
    await page.goto('/marketing/automations')
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/login')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)

    // Should have automation-related content
    expect(body!.toLowerCase()).toMatch(/automation|flow|trigger|workflow|sequence/i)
  })
})
