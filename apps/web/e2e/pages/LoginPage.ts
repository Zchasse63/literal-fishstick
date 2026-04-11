/**
 * LoginPage — POM for /login (password + magic-link auth).
 *
 * Used by tests in the `anonymous` Playwright project. Each test should start
 * with a fresh browser context (no storage state) so the login flow actually
 * runs. The happy path asserts the URL changes away from /login — that is the
 * observable contract, since Supabase manages the auth session outside the
 * Meridian app's tables.
 *
 * Testids seeded on apps/web/src/app/(auth)/login/page.tsx:
 *   - login-email-input
 *   - login-password-input
 *   - login-submit-btn
 *   - login-mode-toggle-btn
 *   - login-error-message
 *   - login-sent-confirmation
 *   - login-use-different-email-btn
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export class LoginPage extends BasePage {
  /**
   * Navigate to /login and wait for the Sign In card to render.
   *
   * The optional `path` parameter exists only to remain type-compatible with
   * `BasePage.goto(path: string)`. Defaults to `/login` — callers should invoke
   * `new LoginPage(page).goto()` with no arguments.
   */
  async goto(path: string = '/login'): Promise<void> {
    await super.goto(path)
    // Wait for the Sign In heading so subsequent locators don't race hydration.
    await expect(this.page.getByRole('heading', { name: /sign in/i })).toBeVisible({
      timeout: ANIM_TIMEOUT,
    })
  }

  /** Type into the email field. `fill()` clears the field first, so autofocus keystrokes are safe. */
  async fillEmail(email: string): Promise<void> {
    await this.byTestId('login-email-input').fill(email)
  }

  /**
   * Type into the password field.
   * Throws if the password field is not visible (e.g., in magic-link mode).
   */
  async fillPassword(password: string): Promise<void> {
    const input = this.byTestId('login-password-input')
    await expect(input).toBeVisible({ timeout: ANIM_TIMEOUT })
    await input.fill(password)
  }

  /**
   * Click the primary submit button.
   * Does NOT wait for navigation — callers assert the outcome themselves
   * (URL change, error message, or sent panel).
   */
  async submit(): Promise<void> {
    await this.byTestId('login-submit-btn').click()
  }

  /**
   * Full password-auth flow: fillEmail + fillPassword + submit + wait for URL change.
   *
   * Uses `Promise.all` so the URL-watcher is armed before the click, avoiding a
   * race between the navigation and the assertion. The predicate matches any
   * URL whose pathname is not `/login`, which is the real contract.
   */
  async signInWithPassword(email: string, password: string): Promise<void> {
    await this.fillEmail(email)
    await this.fillPassword(password)
    await Promise.all([
      this.page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: ANIM_TIMEOUT,
      }),
      this.submit(),
    ])
  }

  /** Click the magic link / password mode toggle button. */
  async toggleMode(): Promise<void> {
    await this.byTestId('login-mode-toggle-btn').click()
  }

  /** Click the "Use a different email" button inside the sent-confirmation panel. */
  async clickUseDifferentEmail(): Promise<void> {
    await this.byTestId('login-use-different-email-btn').click()
  }

  /**
   * Assert the inline error message is visible with optional text/regex match.
   * The error `<p>` is only rendered when `error !== null`, so the visibility
   * check implicitly asserts that an error exists.
   */
  async expectError(text?: string | RegExp): Promise<void> {
    const error = this.byTestId('login-error-message')
    await expect(error).toBeVisible({ timeout: ANIM_TIMEOUT })
    if (text !== undefined) {
      await expect(error).toHaveText(text)
    }
  }

  /**
   * Assert the "Check your email" confirmation panel is visible.
   * If `email` is provided, also asserts that the panel contains that email.
   */
  async expectSentPanel(email?: string): Promise<void> {
    const panel = this.byTestId('login-sent-confirmation')
    await expect(panel).toBeVisible({ timeout: ANIM_TIMEOUT })
    if (email !== undefined) {
      await expect(panel).toContainText(email)
    }
  }

  /** Assert the submit button is disabled. */
  async expectSubmitDisabled(): Promise<void> {
    await expect(this.byTestId('login-submit-btn')).toBeDisabled()
  }

  /** Assert the submit button is enabled. */
  async expectSubmitEnabled(): Promise<void> {
    await expect(this.byTestId('login-submit-btn')).toBeEnabled()
  }

  /** Return the password input locator (for scenario-level visibility assertions). */
  passwordInput(): Locator {
    return this.byTestId('login-password-input')
  }

  /** Return the email input locator (for scenario-level value assertions). */
  emailInput(): Locator {
    return this.byTestId('login-email-input')
  }

  /**
   * Intercept Supabase's `signInWithOtp` endpoint and return a synthetic
   * success response. Use this in magic-link tests so the UI flips to the
   * "sent" state without actually contacting Supabase.
   *
   * Supabase enforces two OTP rate limits on live traffic:
   *   1. Per-email: ~1 request / 60 seconds per address
   *   2. Global hourly email cap: 3 / hour on the default SMTP
   * Both are hit almost immediately when running magic-link tests in a loop.
   * Since the spec's contract for these scenarios is "UI shows sent panel"
   * and NOT "Supabase delivers an email", mocking the endpoint is the correct
   * boundary.
   *
   * Must be called BEFORE `goto()` so the route is registered before any
   * network traffic fires. Matches the GoTrue OTP endpoint regardless of the
   * Supabase project ref in the URL.
   */
  async mockMagicLinkSuccess(): Promise<void> {
    await this.page.route('**/auth/v1/otp**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        // GoTrue returns an empty-ish body on success; the JS SDK constructs
        // `{ data: { user: null, session: null }, error: null }` from that.
        body: JSON.stringify({}),
      })
    })
  }

  /**
   * Intercept Supabase's global `signOut` endpoint and return a synthetic 204.
   *
   * Why this is needed: Supabase's `auth.signOut()` defaults to
   * `scope: 'global'`, which calls `POST /auth/v1/logout` to invalidate the
   * refresh token SERVER-SIDE for all sessions — not just the current browser.
   * This is destructive for E2E runs because:
   *
   *   1. The `admin` Playwright project loads its storage state from
   *      `e2e/.auth/admin.json` once per test. The file contains the admin's
   *      access + refresh tokens.
   *   2. If test N performs a real `signOut()`, the refresh token saved in
   *      admin.json becomes invalid server-side.
   *   3. Test N+1 loads admin.json, tries to refresh, and Supabase rejects
   *      the refresh. Middleware then bounces test N+1 to /login — so tests
   *      N+1 onward can't find the sidebar "Sign out" button and everything
   *      cascade-fails.
   *
   * The fix is to mock the server-side logout endpoint so the refresh token
   * is preserved across tests. The Supabase JS SDK clears local cookies
   * regardless of whether the server call succeeded, so the client-side
   * contract this spec actually cares about (cookies gone from the browser
   * context, middleware re-enforces on subsequent navigation) is still
   * exercised for real.
   *
   * Must be called BEFORE `goto()` so the route is registered before any
   * network traffic fires. Matches the GoTrue logout endpoint regardless of
   * the Supabase project ref in the URL.
   */
  async mockLogoutServerCall(): Promise<void> {
    await this.page.route('**/auth/v1/logout**', async (route) => {
      await route.fulfill({
        status: 204,
        contentType: 'application/json',
        body: '',
      })
    })
  }

  /**
   * Remove all Supabase auth cookies from the current browser context.
   *
   * Supabase SSR stores the session in cookies named `sb-<project-ref>-auth-token`.
   * Large sessions are chunked into `.0`, `.1`, etc., so we match the prefix
   * `sb-` AND the suffix `-auth-token` (with optional chunk index) to avoid
   * touching unrelated cookies (feature flags, analytics, etc.).
   *
   * After calling this, the next navigation through middleware will see no
   * session cookies → `getUser()` returns null → protected routes bounce to
   * `/login?redirect=<path>`.
   *
   * Safe vs. `context.clearCookies()` (no args): that would nuke EVERYTHING
   * including any fixture cookies a future test might rely on. This method
   * only clears the auth-scoped ones.
   */
  async clearAuthCookies(): Promise<string[]> {
    const context = this.page.context()
    const cookies = await context.cookies()
    const authCookies = cookies.filter((c) =>
      /^sb-.+-auth-token(\.\d+)?$/.test(c.name),
    )
    // Playwright's `clearCookies({ name })` removes by exact name.
    for (const cookie of authCookies) {
      await context.clearCookies({ name: cookie.name })
    }
    return authCookies.map((c) => c.name)
  }

  /**
   * Replace the Supabase auth cookie values with garbage so the middleware's
   * cookie parser sees something it cannot decode as a JWT session.
   *
   * Implementation: find all `sb-*-auth-token*` cookies, delete them, then
   * re-add cookies with the same name/domain/path but value set to
   * `"tampered-not-a-valid-jwt"`. Supabase's `getUser()` will treat this as
   * "no session" and return `{ user: null }`.
   *
   * The purpose is the defensive-path test (scenario 3 in session-refresh-spec.md):
   * confirm middleware handles parse failures as "no session" (→ 307 redirect)
   * rather than letting an exception propagate into a 500.
   *
   * Why not construct a valid-looking-but-expired JWT? That requires knowing
   * Supabase's signing key format and performing an HMAC. Garbage achieves the
   * same "parser fails" outcome with no crypto dependency.
   *
   * NOTE: If zero auth cookies exist to begin with, this is a no-op. Tests
   * should call it AFTER the browser has loaded a page and thus received the
   * storage-state cookies.
   */
  async tamperAuthCookie(): Promise<string[]> {
    const context = this.page.context()
    const cookies = await context.cookies()
    const authCookies = cookies.filter((c) =>
      /^sb-.+-auth-token(\.\d+)?$/.test(c.name),
    )
    if (authCookies.length === 0) return []

    // Delete then re-add — Playwright doesn't have an "update cookie" API.
    for (const cookie of authCookies) {
      await context.clearCookies({ name: cookie.name })
    }
    await context.addCookies(
      authCookies.map((c) => ({
        name: c.name,
        value: 'tampered-not-a-valid-jwt',
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
        // Omit expires/expiration deliberately — a session cookie is fine.
      })),
    )
    return authCookies.map((c) => c.name)
  }

  /**
   * Log the current user out via the admin sidebar's "Sign out" button.
   *
   * Precondition: the page must currently be on an admin route where
   * `apps/web/src/components/layout/sidebar.tsx` is rendered with the sidebar
   * expanded (default state). If the sidebar has been collapsed, the button
   * is conditionally hidden — callers must expand it first.
   *
   * The button's onClick handler (sidebar.tsx lines 138–151) awaits
   * `supabase.auth.signOut()` and then does `window.location.href = '/login'`.
   * That is a HARD navigation — the entire browser document is torn down.
   * Playwright's `waitForLoadState('networkidle')` is unreliable across the
   * unload boundary, so we use `waitForURL` as the reliable signal and
   * additionally assert the login form is visible to prove the new document
   * actually rendered.
   *
   * Targets `getByRole('button', { name: 'Sign out' })` because the sidebar
   * button already exposes `aria-label="Sign out"` — no testid is required.
   * See `specs/features/logout-spec.md` §6 for the selector rationale.
   */
  async logout(): Promise<void> {
    const signOutBtn = this.page.getByRole('button', { name: 'Sign out' })
    await expect(signOutBtn).toBeVisible({ timeout: ANIM_TIMEOUT })
    await signOutBtn.click()
    // Use polling-based `toHaveURL` instead of `waitForURL` here.
    //
    // `window.location.href = '/login'` fires a hard navigation, and
    // in-flight data fetches on the command center (e.g. KPI hook on line
    // 170 of `src/hooks/use-kpi-data.ts`) get aborted as part of the unload.
    // `waitForURL` listens to the navigation event stream and surfaces those
    // aborts as `ERR_ABORTED; maybe frame was detached?` — even though the
    // user-observable outcome is correct.
    //
    // `expect(page).toHaveURL()` polls instead, so it's tolerant to any
    // transient aborts during unload. Eventually the URL settles on /login.
    await expect(this.page).toHaveURL(/\/login/, { timeout: ANIM_TIMEOUT })
    await expect(this.byTestId('login-email-input')).toBeVisible({
      timeout: ANIM_TIMEOUT,
    })
  }
}
