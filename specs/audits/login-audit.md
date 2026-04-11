# QA Audit — Login (pilot)

**Reviewer:** QA Sentinel
**Reviewed:** 2026-04-09 14:25
**Spec input:** `specs/features/login-spec.md`
**Plan input:** `specs/plans/login-plan.md`
**Engineer output:**
- `apps/web/e2e/pages/LoginPage.ts` (164 lines, 13 methods)
- `apps/web/e2e/login.spec.ts` (109 lines, 8 scenarios)
- `apps/web/src/app/(auth)/login/page.tsx` (+7 `data-testid` attributes, +1 comment line)
- `apps/web/playwright.config.ts` (+1 project, +1 `testIgnore`)
- `specs/bugs/revenue-default-studio-coupling.md` (new bug doc, 113 lines)

---

## 1. Verdict

**✅ PASS WITH NOTES**

The suite is shippable. All 8 scenarios pass, all 24/24 repeat-each=3 iterations pass, zero flake, zero forbidden patterns, zero coverage gaps versus the spec. The Engineer correctly pivoted when the live Supabase OTP endpoint hit rate limits, adding a `mockMagicLinkSuccess` route interceptor that cleanly isolates the tests from Supabase's hourly email cap — the right boundary per the spec's "real email delivery is out of scope" directive. The notes below are all minor: things worth logging as follow-ups rather than blocks.

## 2. Summary

- **Covers:** Password auth for admin and employee users (URL-based routing verification), invalid-credential error display, submit-button gating (empty form, email-only), magic-link mode toggle (password field disappears, button text flips), magic-link sent panel, and the "Use a different email" return path. 5 P0 + 2 P1 + 1 P2 = 8 scenarios, 1-for-1 with the spec's test matrix.
- **Strong:** POM strictly uses `byTestId()` throughout — zero raw CSS selectors. `signInWithPassword()` uses `Promise.all([waitForURL, submit])` correctly to avoid the click/navigation race. OTP mocking is scoped to the two tests that need it (test 7 and test 8), not applied globally — read tests still exercise real DOM state. The new `anonymous` Playwright project is correctly partitioned: it only picks up `login.*\.spec\.ts` via `testMatch`, and the `admin` project ignores the same pattern via `testIgnore`, so there is no double-execution and no accidental cross-project pollution. All 7 testids follow a consistent `login-{component}-{action-or-role}` shape.
- **Weak:** (1) The `login` prefix on testids isn't explicitly listed as a valid module in `apps/web/AGENTS.md` §naming-convention (that list only includes revenue/schedule/etc.) — a very minor convention doc drift. (2) The admin URL regex `/^http:\/\/localhost:3000\/?$/` is overly strict and will break if `router.push('/')` ever gains a query param. (3) The `goto(path: string = '/login')` signature exists only to stay type-compatible with `BasePage.goto(path: string)` — it works, but the optional parameter is visible to callers and could be confusing (a cleaner fix would be to loosen `BasePage.goto` to accept a default path too, or to rename this method, but neither is worth doing now).

## 3. Critical issues (blocker-level)

**None.**

All forbidden patterns are clean:

| Check | Result |
|---|---|
| `waitForTimeout` in login spec or POM | 0 matches |
| Raw CSS class selectors (`locator('.`) in login code | 0 matches |
| `force: true` clicks | 0 matches |
| `networkidle` used as primary wait (not just BasePage safety net) | 0 matches |
| TypeScript errors in `e2e/` | 0 |
| Missing spec scenarios (vs. spec matrix) | 0 |
| Cross-test dependencies (P0-in-isolation run) | 0 |

Flake check: `--repeat-each=3` → **24/24 passing** in 35.0s, zero retries.

## 4. Non-critical observations

1. **Testid module prefix `login` not in AGENTS.md convention list** — `apps/web/AGENTS.md` lists `revenue, schedule, members, marketing, operations, command, analytics, corporate, employee` as valid module prefixes. "login" (or "auth") isn't on that list. The convention is flexible enough that the testids still read naturally, but the doc should grow a new `auth` / `login` entry so future specs have a clear precedent. **Action:** add to AGENTS.md in a follow-up PR.
2. **Admin URL regex is overly strict** — `apps/web/e2e/login.spec.ts:27` uses `/^http:\/\/localhost:3000\/?$/`. If `router.push('/')` ever appends a query string, hash, or the baseURL changes, this breaks. A more resilient check would be `expect(new URL(page.url()).pathname).toBe('/')`. Not urgent — today's code renders a bare `/` — but worth noting.
3. **`goto(path: string = '/login')` leaks an optional parameter to callers** — the LoginPage POM's `goto` method accepts an optional path only to satisfy TypeScript's override contract with `BasePage.goto(path: string)`. Today's tests all call `login.goto()` with no args, which is the intended usage, but a reader could be confused by the parameter. Options for a future cleanup: (a) loosen `BasePage.goto` to accept an optional default, or (b) rename LoginPage's method to `open()` to avoid the override entirely. Not worth doing now — the current shape is documented with a JSDoc note.
4. **Minor dev-server hiccup during Engineer phase** — Turbopack's HMR did not pick up the testid additions on first run (the dev server was running since 11:13AM, and the file edits happened at 14:21). A manual restart was required (8 tests went from all-failing to 7-passing on the second run). This is a Turbopack idiosyncrasy, not a test-code issue, but worth documenting as a Meridian pipeline quirk for future runs. **Action:** the `/qa-council` orchestrator should probably kick the dev server on pipeline start — or at least curl-check for the presence of a known testid before running the Engineer step.
5. **Supabase OTP rate limit is a known trap for magic-link E2E** — the Engineer correctly discovered and fixed this via route mocking. The plan's §8 risk register already called this out as "Medium likelihood, mitigation: workers=1", but the plan's mitigation was insufficient (the global hourly cap of 3 emails/hour can't be beaten by serial execution alone). The fix — mocking the `**/auth/v1/otp**` endpoint — is the correct pattern and should be the default for any future magic-link spec. **Action:** update the plan's risk register with the resolved mitigation.

## 5. Coverage gap analysis

Spec test matrix (`specs/features/login-spec.md` §4) has 8 rows. Every row has a 1-for-1 test in `login.spec.ts`:

| Row # | Spec scenario | Test location | Priority tag |
|---|---|---|---|
| 1 | Admin password login redirects to `/` | `login.spec.ts:22` | `@p0` ✓ |
| 2 | Employee password login redirects to `/employee` | `login.spec.ts:30` | `@p0` ✓ |
| 3 | Invalid credentials show error message | `login.spec.ts:38` | `@p0` ✓ |
| 4 | Submit button disabled when form is empty | `login.spec.ts:50` | `@p0` ✓ |
| 5 | Submit button disabled with email only | `login.spec.ts:57` | `@p0` ✓ |
| 6 | Toggle to magic link mode hides password field | `login.spec.ts:67` | `@p1` ✓ |
| 7 | Magic link submit shows "Check your email" | `login.spec.ts:79` | `@p1` ✓ |
| 8 | "Use a different email" returns from sent panel | `login.spec.ts:94` | `@p2` ✓ |

**Coverage: 8/8 (100%).** Priority tagging is consistent with the spec.

Out-of-scope items (spec §5 and §7) are correctly omitted:
- Social auth buttons (not implemented)
- "Remember me" / "Forgot password" (not implemented)
- Real email delivery (Resend, out-of-process)
- Session persistence across reloads (covered by `auth.setup.ts`, not login spec)
- Middleware redirect from protected pages (separate spec)
- A11y, mobile viewport, SQL injection, network failure mid-request (future specs)

No gaps to flag.

## 6. Flake risk assessment

| # | Test | Risk | Rationale |
|---|---|---|---|
| 1 | admin password login redirects to / | **LOW** | Uses `Promise.all([waitForURL, submit])` pattern — the URL watcher is armed before the click, no race. Final regex is strict but today's code produces a clean `/`. |
| 2 | employee password login redirects to /employee | **LOW** | Same `Promise.all` pattern. Regex is loose enough to absorb future path tweaks. |
| 3 | invalid credentials show error | **LOW** | Pure DOM state check after a single failing call. No navigation. Uses regex for resilience. |
| 4 | submit disabled on empty form | **LOW** | First-paint DOM state; no async operations after `goto`. |
| 5 | submit disabled with email only | **LOW** | Single fill + DOM check, no async after. |
| 6 | toggle hides password field | **LOW** | Post-toggle DOM check; `toBeHidden()` handles both "missing" and "present-but-hidden". |
| 7 | magic link sent panel | **LOW** | Network mocked via `page.route()`, so no Supabase rate-limit dependency. |
| 8 | use different email resets form | **LOW** | Same mocking as #7; all assertions are local DOM state. |

**Summary:** LOW=8 MEDIUM=0 HIGH=0. Backed by empirical data (`--repeat-each=3` → 24/24 passing, 35.0s total).

## 7. Meridian-specific checks

| Concern | Status | Notes |
|---|---|---|
| Framer Motion waits use observable state, not `waitForTimeout` | ✅ | Login page has no Framer Motion. N/A. |
| Sonner toasts via `expectSuccessToast`/`expectErrorToast` | ✅ N/A | Login page does not use toasts — uses an inline `<p data-testid="login-error-message">` and a dedicated sent-confirmation panel. The spec was deliberate about this (see `specs/features/login-spec.md` §8 CL-2). |
| Radix dialogs via `getByRole('dialog', { name })` | ✅ N/A | Login is a plain form card, no Radix dialog. |
| Money flow uses cents + DB assertion | ✅ N/A | Auth only. No money flow. |
| Studio isolation: queries filter by `TEST_STUDIO_ID` | ✅ N/A | No DB queries from this spec. |
| Cleanup: every `seed*` has a matching `delete*`/`resetStudioTestData` | ✅ N/A | No seeding (auth users are reused from `auth.setup.ts`). |
| Correct Playwright project | ✅ | `anonymous` project (no storageState) — correctly partitioned via `testMatch` / `testIgnore`. |
| TypeScript strict: no `any`, typed params | ✅ | `npx tsc --noEmit` → zero e2e errors. POM method signatures all typed. |
| Turbopack/middleware quirks | ⚠ Note 4 | Dev-server HMR did not pick up the testid additions without a manual restart. Not a test-code issue, documented as observation. |
| Testid naming: `{module}-{component}-{action-or-role}` | ⚠ Note 1 | Convention followed, but the `login` module isn't in AGENTS.md's explicit list. Minor drift. |

## 8. Recommended fixes

**None required to pass.** The following are optional follow-ups, ordered by impact:

1. **`apps/web/AGENTS.md` §naming-convention** — Add `auth` / `login` to the explicit list of module prefixes so future spec authors have clear precedent. One-line addition to the bulleted module list. (Fixes Note 1.)
2. **`specs/plans/login-plan.md` §8 risk register** — Update the Supabase rate-limit row to reference the `mockMagicLinkSuccess` pattern as the resolved mitigation, not just `workers=1`. (Fixes Note 5.)
3. **`apps/web/e2e/login.spec.ts:27`** — Consider migrating the admin URL assertion from `expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/)` to `expect(new URL(page.url()).pathname).toBe('/')` for resilience against future query-param additions. (Fixes Note 2.)
4. **`.claude/commands/qa-council.md` pre-flight checks** — Add a step that curl-checks for the presence of a known spec's testid in the served HTML before running Engineer. This catches the Turbopack HMR miss before tests start failing. (Fixes Note 4.)
5. **`apps/web/e2e/pages/BasePage.ts`** — Consider changing `goto(path: string)` to `goto(path?: string)` so subclasses don't need the optional-parameter workaround. Low priority, purely cosmetic. (Fixes Note 3.)

None of the above block the pipeline — they're all backlog items.

## 9. Sign-off

`Reviewed: 2026-04-09 14:25  |  Verdict: ✅ PASS WITH NOTES  |  Next phase: Scribe (skip Healer)`
