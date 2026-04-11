/**
 * BasePage — shared Page Object base class for all Meridian POMs.
 *
 * Extend this class for each feature's POM. All helpers here are framework-
 * agnostic wrappers around Playwright primitives and Meridian's specific UI
 * patterns (shadcn/ui components, sonner toasts, Framer Motion animations).
 */
import type { Page, Locator } from '@playwright/test'
import { expect } from '@playwright/test'

/** Default timeout for Framer Motion animations + Supabase realtime lag. */
export const ANIM_TIMEOUT = 10_000

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Navigate to a path within the Meridian app.
   * Always waits for networkidle so Supabase queries resolve before assertions run.
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path)
    await this.waitForLoaded()
  }

  /** Wait for React hydration + initial data fetches. */
  async waitForLoaded(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
  }

  /** Canonical selector helper — prefer this over raw locators in subclasses. */
  byTestId(id: string): Locator {
    return this.page.getByTestId(id)
  }

  /** Fallback when data-testid isn't available. Subclasses should migrate away from this. */
  byRole(role: Parameters<Page['getByRole']>[0], options?: Parameters<Page['getByRole']>[1]): Locator {
    return this.page.getByRole(role, options)
  }

  /**
   * Wait for Meridian's custom ToastNotification to appear.
   *
   * Meridian does NOT use sonner — it uses a single-message ToastNotification
   * component (`src/components/ui/toast-notification.tsx`) driven by page-level
   * state. There is no built-in success/error distinction; the toast type is
   * conveyed by message text only. Use `expectToast(/saved/i)` or
   * `expectToast(/failed/i)` etc.
   */
  async expectToast(message?: string | RegExp): Promise<void> {
    const toast = this.byTestId('toast-notification').first()
    await expect(toast).toBeVisible({ timeout: ANIM_TIMEOUT })
    if (message) {
      await expect(toast).toContainText(message)
    }
  }

  /** @deprecated Meridian toast has no type distinction. Use {@link expectToast}. */
  async expectSuccessToast(message?: string | RegExp): Promise<void> {
    await this.expectToast(message)
  }

  /** @deprecated Meridian toast has no type distinction. Use {@link expectToast}. */
  async expectErrorToast(message?: string | RegExp): Promise<void> {
    await this.expectToast(message)
  }

  /** Wait for the toast to disappear (exit animation complete). */
  async waitForToastDismissed(): Promise<void> {
    await expect(this.byTestId('toast-notification')).toBeHidden({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Wait for a shadcn dialog to open (Radix UI exposes [role="dialog"]).
   * Pass the dialog's accessible name for more specific targeting.
   */
  async waitForDialog(name?: string): Promise<Locator> {
    const dialog = name
      ? this.page.getByRole('dialog', { name })
      : this.page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: ANIM_TIMEOUT })
    return dialog
  }

  /** Wait for a dialog to close — useful after submit. */
  async waitForDialogClosed(): Promise<void> {
    await expect(this.page.getByRole('dialog')).toBeHidden({ timeout: ANIM_TIMEOUT })
  }

  /** Assert the current URL matches a pattern (used for tab navigation checks). */
  async expectUrl(pattern: string | RegExp): Promise<void> {
    if (typeof pattern === 'string') {
      expect(this.page.url()).toContain(pattern)
    } else {
      expect(this.page.url()).toMatch(pattern)
    }
  }

  /**
   * Assert that the current URL is `/login` with a `redirect` query param equal
   * to the given original pathname. Used by middleware-redirect tests and any
   * flow that exercises the protected-route → login bounce (e.g., session
   * expiry).
   *
   * The middleware uses `url.searchParams.set("redirect", pathname)`, which
   * URL-encodes the path on serialization. Playwright's `page.url()` returns
   * the serialized form, so we parse it with `URL` and compare the decoded
   * `redirect` param to the expected pathname. This avoids brittle exact
   * string comparison against percent-encoded URLs.
   *
   * @param originalPath - the pre-redirect pathname (e.g., `/members`)
   */
  async expectRedirectToLogin(originalPath: string): Promise<void> {
    await expect(this.page).toHaveURL(/\/login(\?|$)/, { timeout: ANIM_TIMEOUT })
    const url = new URL(this.page.url())
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('redirect')).toBe(originalPath)
  }

  /**
   * Stable landmark for any admin page — the sidebar "Sign out" button.
   *
   * This is the universal "admin shell mounted correctly" signal used by every
   * Tier 2 smoke spec. It proves:
   *   1. Middleware allowed the request (no /login bounce)
   *   2. AdminShell layout rendered without crashing
   *   3. Supabase client-side profile load succeeded enough to render the sidebar
   *
   * Uses `aria-label="Sign out"` set in `src/components/layout/sidebar.tsx:146`.
   * See `specs/features/logout-spec.md` §6 for the selector rationale.
   */
  adminShellLandmark(): Locator {
    return this.page.getByRole('button', { name: 'Sign out' })
  }

  /**
   * Stable landmark for any employee portal page — the "Employee Portal" label.
   *
   * Used by Tier 2.11 (employee smoke) instead of the admin shell landmark.
   * Lives in the employee layout header at `(employee)/layout.tsx:226`.
   *
   * CAVEAT: the employee portal currently has NO sign-out button (BUG-003), so
   * we can't use the same landmark as admin. When BUG-003 is fixed, this
   * helper can be deleted and employee smokes can use `adminShellLandmark()`.
   */
  employeeShellLandmark(): Locator {
    return this.page.getByText('Employee Portal').first()
  }

  /**
   * Shared smoke-test helper used by all Tier 2 smoke specs.
   *
   * Navigates to `url`, asserts the given `landmark` becomes visible within
   * the animation timeout, asserts the final URL pathname is `url` (or
   * `expectedPath` if supplied), and asserts ZERO uncaught `pageerror` events
   * fired during the mount.
   *
   * What counts as "mounted" for Meridian smokes:
   *   1. Final pathname is the expected one (no redirect to /login or 404)
   *   2. The landmark locator is visible (proves the shell/layout rendered)
   *   3. No `page.on('pageerror')` events fired during navigation + mount
   *
   * We intentionally DO NOT:
   *   - Filter or count `console.error` — too noisy in dev mode (hydration
   *     warnings, KPI fetch failures, rate-limit RPC missing, etc.)
   *   - Wait for `networkidle` — some pages have background polling that
   *     never idles (the command center hero metrics, for example)
   *   - Assert data loaded — skeletons are OK for smokes; data assertions
   *     belong in Tier 3+ write/read specs
   *
   * The `pageerror` event fires on uncaught JavaScript exceptions that reach
   * the top of the event loop. React's error boundaries catch most of these
   * and turn them into UI, but the underlying throw still fires `pageerror`
   * first. So this helper catches: (a) non-React async crashes,
   * (b) errors thrown during render before an error boundary exists,
   * (c) errors in code that runs outside React's tree (global handlers, etc.).
   *
   * Usage:
   *   await pom.expectSmokeMount('/members', pom.adminShellLandmark())
   *
   * @param url - path to navigate to (relative to baseURL)
   * @param landmark - a Locator that proves the page shell rendered
   * @param expectedPath - optional override if the URL redirects to a
   *                       canonical form (e.g., `/settings` → `/settings/account`)
   */
  async expectSmokeMount(
    url: string,
    landmark: Locator,
    expectedPath?: string,
  ): Promise<void> {
    const pageErrors: Error[] = []
    const errorListener = (err: Error) => pageErrors.push(err)
    this.page.on('pageerror', errorListener)
    try {
      await this.page.goto(url)
      await expect(landmark).toBeVisible({ timeout: ANIM_TIMEOUT })
      // Pathname check — independent of query strings or trailing slashes.
      const currentPath = new URL(this.page.url()).pathname
      expect(currentPath, `expected no redirect from ${url}`).toBe(expectedPath ?? url)
      // Guard against middleware bouncing us to login (double-check).
      expect(currentPath).not.toBe('/login')
      // Assert no uncaught errors during mount.
      const errorMessages = pageErrors.map((e) => e.message)
      expect(
        errorMessages,
        `Uncaught page errors on ${url}: ${errorMessages.join('; ')}`,
      ).toEqual([])
    } finally {
      this.page.off('pageerror', errorListener)
    }
  }

  /** Click a submit button and wait for its loading spinner to disappear. */
  async clickAndWait(locator: Locator): Promise<void> {
    await locator.click()
    // Meridian buttons show a Loader2 spinner inside during async ops.
    // Wait for it to disappear. If there's no spinner, this is a no-op.
    const spinner = locator.locator('.lucide-loader-2, [data-loading="true"]').first()
    if (await spinner.count() > 0) {
      await expect(spinner).toBeHidden({ timeout: ANIM_TIMEOUT })
    }
  }
}
