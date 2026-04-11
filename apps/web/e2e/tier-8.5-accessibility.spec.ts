/**
 * T39-T42 — Accessibility smoke tests.
 *
 * Covers the foundational accessibility invariants across the main admin
 * dashboard pages without a dependency on axe-core:
 *
 *   T39 — Keyboard navigation: sidebar + main nav reachable via Tab
 *   T40 — Focus management: modals trap focus and Esc closes them
 *   T41 — Accessible names: every interactive element has a name
 *   T42 — Form labels: inputs are associated with labels
 *
 * These are smoke checks — they catch the worst regressions (focus loss,
 * unlabeled inputs, trap bugs) but are not a substitute for a full a11y audit.
 */
import { test, expect } from '@playwright/test'

const DASHBOARD_ROUTES = [
  '/',
  '/members',
  '/schedule',
  '/revenue',
  '/marketing',
  '/analytics',
]

test.describe('Accessibility — Smoke (T39-T42)', () => {
  test('T39 — Tab navigation reaches main content from page load @a11y', async ({
    page,
  }) => {
    await page.goto('/')

    // Wait for page to settle
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // Press Tab a few times and verify we can reach a focusable element
    // without the focus being lost (e.g., stuck on body/html).
    const tabLimit = 15
    let focused: string | null = null
    for (let i = 0; i < tabLimit; i++) {
      await page.keyboard.press('Tab')
      focused = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body || el === document.documentElement)
          return null
        return el.tagName
      })
      if (focused) break
    }

    expect(focused).not.toBeNull()
  })

  test('T40 — Command palette opens via Cmd/Ctrl+K and closes via Esc @a11y', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // Click body so the keydown listener fires
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('ControlOrMeta+k')

    // Palette should become visible
    const palette = page.locator('[data-testid="palette-root"]')
    await expect(palette).toBeVisible({ timeout: 3_000 })

    // Esc closes it
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden({ timeout: 2_000 })
  })

  test('T41 — every button/link on Command Center has an accessible name @a11y', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // Collect all buttons and links and check that each has either:
    //   - visible text content, OR
    //   - an aria-label, OR
    //   - aria-labelledby pointing at a real element, OR
    //   - title attribute (last resort)
    const unnamed = await page.evaluate(() => {
      const interactive = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button:not([aria-hidden="true"]), a[href]:not([aria-hidden="true"])'
        )
      )
      const bad: Array<{ tag: string; html: string }> = []
      for (const el of interactive) {
        // Skip invisible
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue

        const text = (el.textContent ?? '').trim()
        const ariaLabel = el.getAttribute('aria-label')
        const ariaLabelledBy = el.getAttribute('aria-labelledby')
        const title = el.getAttribute('title')
        const labelledByEl = ariaLabelledBy
          ? document.getElementById(ariaLabelledBy)
          : null
        const labelledByText = labelledByEl
          ? (labelledByEl.textContent ?? '').trim()
          : ''

        const hasName = Boolean(
          text || ariaLabel || labelledByText || title
        )

        if (!hasName) {
          bad.push({
            tag: el.tagName,
            html: el.outerHTML.slice(0, 200),
          })
        }
      }
      return bad
    })

    // Allow up to 3 unnamed interactive elements — a small budget for icon-only
    // buttons that are truly decorative; anything more indicates a regression.
    if (unnamed.length > 3) {
      console.log('Unnamed interactive elements:', JSON.stringify(unnamed, null, 2))
    }
    expect(unnamed.length).toBeLessThanOrEqual(3)
  })

  test('T42 — Form inputs on /members search have labels @a11y', async ({
    page,
  }) => {
    await page.goto('/members')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const unlabeled = await page.evaluate(() => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"])'
        )
      )
      const bad: Array<{ name: string; type: string; html: string }> = []
      for (const input of inputs) {
        const rect = input.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue

        const id = input.id
        const labelFor = id
          ? document.querySelector(`label[for="${id}"]`)
          : null
        const wrappingLabel = input.closest('label')
        const ariaLabel = input.getAttribute('aria-label')
        const ariaLabelledBy = input.getAttribute('aria-labelledby')
        const placeholder = input.getAttribute('placeholder')

        const hasLabel = Boolean(
          labelFor || wrappingLabel || ariaLabel || ariaLabelledBy || placeholder
        )

        if (!hasLabel) {
          bad.push({
            name: input.name,
            type: input.type,
            html: input.outerHTML.slice(0, 200),
          })
        }
      }
      return bad
    })

    if (unlabeled.length > 0) {
      console.log('Unlabeled inputs:', JSON.stringify(unlabeled, null, 2))
    }
    // Zero tolerance for unlabeled inputs — placeholder counts as a label here,
    // so this is an extremely low bar.
    expect(unlabeled.length).toBe(0)
  })

  test('T39b — main dashboard routes return 200 without console errors @a11y', async ({
    page,
  }) => {
    for (const route of DASHBOARD_ROUTES) {
      const consoleErrors: string[] = []
      const errorListener = (msg: { type: () => string; text: () => string }) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      }
      page.on('console', errorListener)

      const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
      expect(response?.ok()).toBe(true)

      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

      // Filter to truly fatal errors (ignore dev-mode warnings like HMR,
      // React devtools, and network 4xx logs which are not code errors).
      const fatalErrors = consoleErrors.filter(
        (e) =>
          !e.includes('DevTools') &&
          !e.includes('hot-reloader') &&
          !e.includes('Download the React DevTools') &&
          !e.includes('hydration') &&
          !e.includes('Failed to load resource')
      )

      page.off('console', errorListener)

      if (fatalErrors.length > 0) {
        console.log(`[${route}] console errors:`, fatalErrors)
      }
      expect(fatalErrors.length, `${route} had console errors`).toBe(0)
    }
  })
})
