# Implementation Plan — Login Test Suite

**Spec input:** `specs/features/login-spec.md`

## 1. Spec summary

Analyst produced an 8-scenario spec (5 P0, 2 P1, 1 P2) for Meridian's `/login` page covering password authentication for admin and employee users, the magic link mode toggle, the sent confirmation panel, and form validation guards. No DB writes involved, no fixture seeding needed beyond the existing `ADMIN_USER` and `EMPLOYEE_USER` constants.

## 2. Architectural decisions

| Decision | Choice | Rationale |
|---|---|---|
| POM strategy | New `LoginPage extends BasePage` | Login has no overlap with any existing POM |
| Fixture scope | None — use pre-seeded `ADMIN_USER` / `EMPLOYEE_USER` constants | Auth test users are seeded by `auth.setup.ts` and reused across the suite |
| Auth project | New `anonymous` project (no storage state) | Login tests must start unauthenticated; storage state would short-circuit the flow |
| Isolation strategy | Each test does `page.goto('/login')` fresh | No state leakage between tests; Playwright gives each test a clean browser context when `storageState` is not set |
| Parallelism | Serial (`workers: 1` — config default) | No reason to deviate; Supabase rate limits could trip on parallel signIns |
| DB assertions | None — auth sessions live in Supabase-managed tables, not Meridian tables | Login doesn't write `profiles`, `members`, `transactions`, etc. URL change is the contract |

## 3. Files to create

| Path | Purpose |
|---|---|
| `apps/web/e2e/pages/LoginPage.ts` | POM. Methods: `goto`, `fillEmail`, `fillPassword`, `submit`, `toggleMode`, `expectError`, `expectSentPanel`, `clickUseDifferentEmail`, `expectSubmitDisabled`, `expectSubmitEnabled` |
| `apps/web/e2e/login.spec.ts` | 8 scenarios tagged `@p0`/`@p1`/`@p2` |
| `specs/bugs/revenue-default-studio-coupling.md` | Documents the 43-file `DEFAULT_STUDIO_ID` hardcoding finding from the Analyst's CL-1 |

## 4. Files to modify

| Path | Change |
|---|---|
| `apps/web/src/app/(auth)/login/page.tsx` | Add 7 `data-testid` attributes (see §6). No logic changes. |
| `apps/web/playwright.config.ts` | Add `anonymous` project (no storage state, no `auth-setup` dependency). Add `testIgnore: /login.*\.spec\.ts/` to `admin` project so login tests don't run under the admin project. |

**Not modified:**
- `apps/web/e2e/pages/BasePage.ts` — the sonner-based toast helpers are broken but the pilot doesn't need them. Flagged in `specs/bugs/toast-helper-mismatch.md` as follow-up.
- `apps/web/e2e/fixtures/db.ts` — login writes nothing. Seeding helpers untouched.

## 5. POM skeleton

```typescript
// apps/web/e2e/pages/LoginPage.ts
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export class LoginPage extends BasePage {
  /** Navigate to /login and wait for the Sign In card to render. */
  async goto(): Promise<void>

  /** Type into the email field. */
  async fillEmail(email: string): Promise<void>

  /** Type into the password field. Throws if password field is not visible (e.g., in magic-link mode). */
  async fillPassword(password: string): Promise<void>

  /** Click the primary submit button. Does NOT wait for navigation — callers assert the outcome. */
  async submit(): Promise<void>

  /** Full password-auth flow: fillEmail + fillPassword + submit + wait for URL change. */
  async signInWithPassword(email: string, password: string): Promise<void>

  /** Click the magic link / password toggle button. */
  async toggleMode(): Promise<void>

  /** Click the "Use a different email" button in the sent-confirmation panel. */
  async clickUseDifferentEmail(): Promise<void>

  /** Assert the inline error message is visible with optional text match. */
  async expectError(text?: string | RegExp): Promise<void>

  /** Assert the "Check your email" confirmation panel is visible. */
  async expectSentPanel(email?: string): Promise<void>

  /** Assert the submit button is disabled. */
  async expectSubmitDisabled(): Promise<void>

  /** Assert the submit button is enabled. */
  async expectSubmitEnabled(): Promise<void>

  /** Return the password input locator (used to assert visibility in magic-link mode scenarios). */
  passwordInput(): Locator
}
```

Implementation notes:
- `signInWithPassword` should `await Promise.all([this.page.waitForURL(url => !url.pathname.includes('/login'), { timeout: ANIM_TIMEOUT }), this.submit()])` to avoid a race between the click and the navigation.
- `expectError` uses `getByTestId('login-error-message')` — the error element is only present in the DOM when `error !== null`, so visibility + optional text assertions work out of the box.
- `expectSentPanel` uses `getByTestId('login-sent-confirmation')` + `getByText(email)` within it.

## 6. Test file outline

```typescript
// apps/web/e2e/login.spec.ts
import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'
import { ADMIN_USER, EMPLOYEE_USER } from './fixtures/test-data'

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    // No DB setup needed. Anonymous project ensures no storage state leaks in.
  })

  // --- P0 (5) ----------------------------------------------------

  test('P0 — admin password login redirects to / @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.signInWithPassword(ADMIN_USER.email, ADMIN_USER.password)
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/)
  })

  test('P0 — employee password login redirects to /employee @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.signInWithPassword(EMPLOYEE_USER.email, EMPLOYEE_USER.password)
    await expect(page).toHaveURL(/\/employee/)
  })

  test('P0 — invalid credentials show error message @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.fillEmail(ADMIN_USER.email)
    await login.fillPassword('definitely-wrong-password-2026')
    await login.submit()
    await login.expectError(/invalid email or password/i)
    await expect(page).toHaveURL(/\/login/)
  })

  test('P0 — submit button disabled when form is empty @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.expectSubmitDisabled()
  })

  test('P0 — submit button disabled with email only @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.fillEmail(ADMIN_USER.email)
    await login.expectSubmitDisabled()
  })

  // --- P1 (2) ----------------------------------------------------

  test('P1 — toggle to magic link mode hides password field @p1', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.toggleMode()
    await expect(login.passwordInput()).toBeHidden()
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible()
  })

  test('P1 — magic link submit shows "Check your email" confirmation @p1', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.toggleMode()
    await login.fillEmail(ADMIN_USER.email)
    await login.submit()
    await login.expectSentPanel(ADMIN_USER.email)
  })

  // --- P2 (1) ----------------------------------------------------

  test('P2 — "Use a different email" returns from sent panel to form @p2', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.toggleMode()
    await login.fillEmail(ADMIN_USER.email)
    await login.submit()
    await login.expectSentPanel(ADMIN_USER.email)
    await login.clickUseDifferentEmail()
    await expect(page.getByTestId('login-email-input')).toHaveValue('')
  })
})
```

## 7. Seeding & cleanup plan

**No seeding, no cleanup.** Auth test users are created once by `auth.setup.ts` (which runs via dependency from the `admin` and `employee` projects — since this spec lives in a new `anonymous` project, it does NOT depend on auth-setup directly). The test users already exist from previous runs.

**Important:** The `anonymous` project MUST NOT depend on `auth-setup`. If it did, the first invocation would create session files that aren't needed. It's fine for `auth-setup` to have run before (the users exist in Supabase regardless of which project invokes it).

However, the test users must exist. Include a pre-flight check in the spec file's `test.beforeAll` that calls `testDb.auth.admin.listUsers()` and verifies the two accounts exist — if not, fail fast with a clear error directing the user to run `npx playwright test --project=auth-setup`.

Actually, simpler: trust the user to have run auth-setup. A failing sign-in will be obvious enough.

## 8. Risk register

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Supabase rate-limits login attempts during rapid test runs | Medium | Use `workers: 1` (already default). Consider `test.slow()` if flake appears. |
| `router.push('/')` races with Playwright's URL assertion | Medium | Use `page.waitForURL()` in `signInWithPassword` wrapper, not a bare `toHaveURL` after `.submit()` |
| Error message text is localized in the future | Low | Use a regex (`/invalid email or password/i`) instead of exact text match |
| Invalid credentials case hits Supabase rate-limit | Low-Med | Single test, single attempt per run. Rate limit is > 10/min. |
| Next.js 16 middleware redirect interferes with unauthenticated `/login` load | Low | Middleware allows `/login` without auth. Verified in Phase 1 pre-flight. |
| `anonymous` project picks up non-login specs | High if misconfigured | Use `testMatch: /login.*\.spec\.ts/` to scope strictly |
| Admin project accidentally runs `login.spec.ts` (would fail — already authenticated) | High if not excluded | Add `testIgnore: /login.*\.spec\.ts/` to admin project |
| `autoFocus` on the email input causes stray keystrokes | Low | Playwright's `fill()` clears before typing |
| Test 7 triggers an actual email send to ADMIN_USER.email | N/A | `meridian-e2e-admin@test.meridian.app` is a fake domain — Resend will fail delivery silently; the UI state flip happens regardless |

## 9. Execution order for the Engineer

1. **Add 7 `data-testid` attributes** to `apps/web/src/app/(auth)/login/page.tsx`. Minimal diff — one attribute per element, no restructuring.
2. **Update `apps/web/playwright.config.ts`** — add `anonymous` project, add `testIgnore` on `admin` project.
3. **Create `apps/web/e2e/pages/LoginPage.ts`** from the skeleton in §5. Implement all 11 methods.
4. **Create `apps/web/e2e/login.spec.ts`** with all 8 scenarios from §6.
5. **Type-check:** `cd apps/web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "e2e/"` — should print nothing.
6. **Run the suite:** `npx playwright test apps/web/e2e/login.spec.ts --project=anonymous --reporter=list` — all 8 must pass.
7. **Confirm admin suite still green:** `npx playwright test --project=admin --reporter=list` — nothing should regress.
8. **Write `specs/bugs/revenue-default-studio-coupling.md`** capturing the 43-file finding from the Analyst's CL-1.
9. **Hand off to Sentinel** via `/qa-sentinel login`.

## 10. Hand-off note

- The spec is deliberately minimal on DB assertions because this is a pure auth flow. Do not force-fit a Supabase query for "verify session exists" — Playwright's cookie is the ground truth, and the URL change is the user-observable outcome. Sentinel should not flag this as a gap.
- The toggle-to-magic-link scenario touches the password field visibility. The current implementation conditionally renders the password input (`{mode === "password" && ...}`). `expect(locator).toBeHidden()` handles both "not present" and "present but hidden", so the test works either way.
- The error-text assertion uses a regex (`/invalid email or password/i`) because the exact string is `"Invalid email or password. Try again or use a magic link."` — brittle if reworded. Stick with the regex.
- Test 7 (magic link sent panel) doesn't actually deliver an email because the address domain is fake. The UI transitions to sent state regardless because `signInWithOtp` returns OK from Supabase's perspective even for unknown domains. This is not a security issue — it's Supabase's design.
- Document the Record Payment pivot findings carefully in the bugs doc. Include file paths, line numbers, a suggested fix (use auth user's `studio_id` from session instead of hardcoded constant), and a note that the fix is out of pipeline scope.

## Architect summary

- **Feature:** Login (pilot)
- **Plan:** `specs/plans/login-plan.md`
- **New POMs:** 1 (`LoginPage.ts`)
- **New fixtures:** 0
- **Source files to touch (testid seeding):** 1 (`login/page.tsx` — 7 attributes)
- **Config changes:** 1 (`playwright.config.ts` — new anonymous project)
- **Bugs docs to write:** 1 (`specs/bugs/revenue-default-studio-coupling.md`)
- **Risks identified:** 9
- **Ready for Engineer:** Yes
