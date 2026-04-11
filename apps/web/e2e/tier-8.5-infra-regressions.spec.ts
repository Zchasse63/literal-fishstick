/**
 * T11 + T12 — Infrastructure regression guards.
 *
 * T11: Next 16 proxy migration — verify src/proxy.ts exists and runs
 *      (login loads in <2s), src/middleware.ts does NOT exist.
 * T12: shadcn CommandDialog wrapper — verify opening the palette does NOT
 *      throw cmdk subscribe errors (which would fail the render).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test.describe('Infrastructure Regressions (T11 + T12)', () => {
  test('T11 — src/proxy.ts exists and src/middleware.ts does not @p0', async () => {
    const proxyPath = path.resolve(process.cwd(), 'src/proxy.ts')
    const middlewarePath = path.resolve(process.cwd(), 'src/middleware.ts')
    expect(fs.existsSync(proxyPath)).toBe(true)
    expect(fs.existsSync(middlewarePath)).toBe(false)
  })

  test('T11 — proxy.ts exports `proxy` not `middleware` @p0', async () => {
    const proxyPath = path.resolve(process.cwd(), 'src/proxy.ts')
    const source = fs.readFileSync(proxyPath, 'utf8')
    expect(source).toMatch(/export\s+async\s+function\s+proxy\s*\(/)
    expect(source).not.toMatch(/export\s+async\s+function\s+middleware\s*\(/)
  })

  test('T11 — /login compiles under 2s (no turbopack hang) @p0', async ({ page }) => {
    const startMs = Date.now()
    const res = await page.request.get('/login')
    const elapsed = Date.now() - startMs
    expect(res.ok()).toBe(true)
    // Pre-fix: never responded. Post-fix: 4-50ms typical.
    expect(elapsed).toBeLessThan(2_000)
  })

  test('T12 — command palette opens without cmdk subscribe errors @p0', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-quick-create-btn"]', { timeout: 10_000 })
    await page.locator('[data-testid="header-quick-create-btn"]').click()
    await expect(page.locator('[data-testid="palette-root"]')).toBeVisible({ timeout: 3_000 })
    // Specifically guard against the "Cannot read properties of undefined (reading 'subscribe')"
    // error that occurs when CommandDialog children are not wrapped in <Command>.
    const subscribeError = consoleErrors.find((e) =>
      e.includes("reading 'subscribe'") || e.includes('Cannot read properties of undefined')
    )
    expect(subscribeError).toBeUndefined()
  })

  test('T12 — CommandDialog shadcn primitive is wrapped in Command @p0', async () => {
    const palettePath = path.resolve(process.cwd(), 'src/components/command-palette.tsx')
    const source = fs.readFileSync(palettePath, 'utf8')
    // The palette file should import `Command` from ui/command (not just sub-components).
    expect(source).toMatch(/import\s+\{[^}]*\bCommand\b[^}]*\}\s+from\s+['"]@\/components\/ui\/command['"]/)
    // And render it wrapping the input + list
    expect(source).toMatch(/<Command\b/)
  })
})
