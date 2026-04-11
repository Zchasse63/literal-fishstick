# QA Pipeline Report — Login (Password + Magic Link)

**Date:** 2026-04-09 14:29
**Status:** ⚠ Ready with notes
**Pipeline duration:** ~6 phases across one session (pilot run — first real execution of the QA council)
**Module:** Auth / Global

## Summary (TL;DR)

Tested Meridian's `/login` page (password auth + magic link mode) as the pilot run for the multi-agent QA pipeline. Added 8 Playwright tests (5 P0, 2 P1, 1 P2), all passing in 17.2s with 24/24 green on flake check (`--repeat-each=3`). Required seeding 7 `data-testid` attributes in `login/page.tsx`, creating a new `LoginPage` POM, and introducing a brand-new `anonymous` Playwright project (no storage state) alongside the existing `admin`/`employee` projects.

## What was tested

**P0 (critical — 5 tests):**
- Admin password login → redirects to `/` (command center)
- Employee (trainer role) password login → redirects to `/employee`
- Invalid credentials → inline error visible, URL stays on `/login`
- Empty form → submit button disabled
- Email-only (no password) → submit button still disabled

**P1 (important — 2 tests):**
- Toggle to magic-link mode → password field hidden, button text changes to "Send Magic Link"
- Magic link submit → "Check your email" confirmation panel shown with submitted email (Supabase GoTrue endpoint mocked via `page.route()`)

**P2 (polish — 1 test):**
- "Use a different email" button from sent panel → returns form to initial state, email field cleared

## What was NOT tested (and why)

Copied from spec §7 "Out of scope":
- **Social auth buttons** (Google, Apple) — not implemented in the feature yet
- **"Remember me" checkbox** — not implemented
- **"Forgot password" link** — not implemented
- **Magic link email delivery** — Resend is out-of-process; tests only assert the UI reaches the "sent" state (and intercept the GoTrue call so no real email is requested)
- **Session persistence across page reloads** — already covered by `auth.setup.ts`, not the login spec
- **Middleware redirect from protected pages** (e.g., visiting `/revenue` while logged out) — belongs in a separate auth-middleware spec
- **Accessibility audit** (keyboard-only, ARIA) — worth a dedicated A11y pipeline run
- **Mobile viewport** — pilot is desktop only (1280×720 default)
- **Supabase rate-limit behavior** — Supabase concern, not app concern
- **Network failure / offline mode** — noted in spec §5 as a future follow-up
- **Session-already-active when visiting `/login`** — spec §5 edge case E, future work

## Files changed

### New files
- `apps/web/e2e/pages/LoginPage.ts` (164 lines) — POM with 14 methods including `signInWithPassword`, `mockMagicLinkSuccess`, `expectSentPanel`, `expectError`, `toggleMode`, etc.
- `apps/web/e2e/login.spec.ts` (109 lines, 8 tests) — overwrote pre-existing stub that violated forbidden-pattern rules (`waitForTimeout`, raw CSS selectors)
- `specs/bugs/revenue-default-studio-coupling.md` (113 lines) — documents the 43-file `DEFAULT_STUDIO_ID` hardcoding architectural bug discovered during Analyst exploration (blocks meaningful E2E testing of Revenue, Members, Schedule write flows until refactored)

### Modified files
- `apps/web/src/app/(auth)/login/page.tsx` — added 7 `data-testid` attributes (`login-email-input`, `login-password-input`, `login-submit-btn`, `login-mode-toggle-btn`, `login-error-message`, `login-sent-confirmation`, `login-use-different-email-btn`). No logic changes.
- `apps/web/playwright.config.ts` — added new `anonymous` project (no storage state, no `auth-setup` dependency, `testMatch: /login.*\.spec\.ts/`) and added `testIgnore: /login.*\.spec\.ts/` to the existing `admin` project to prevent double execution.

## Test run

Last run command:
```bash
npx playwright test e2e/login.spec.ts --project=anonymous --reporter=list
```

Result: **8 passed, 0 failed, 0 skipped** (17.2s)

Flake check (`--repeat-each=3`): **24/24 passing** (35.0s during Engineer phase; reconfirmed 8/8 at Scribe phase)

Admin suite regression check: **6/6 command-center tests passing** — no regression from the config split or the new project.

TypeScript check: `cd apps/web && npx tsc --noEmit` — **0 errors in `e2e/`**.

## Coverage

- Spec scenarios: **8**
- Tests written: **8**
- P0 coverage: **100%** (5/5)
- P1 coverage: **100%** (2/2)
- P2 coverage: **100%** (1/1)
- DB-level assertions: **0/8** — legitimate per spec CL-4 (login does not write Meridian app rows; the Supabase auth session is the ground truth and the URL change is the user-observable contract)
- Cleanup: **N/A** — login flow has no residual state. Each test starts with a fresh browser context (anonymous project has no storage state).

## Healing summary

**No healing required** — Sentinel passed on first review with the ⚠ PASS WITH NOTES verdict. 0 critical issues, 5 non-critical observations (see Follow-up work below).

## Bugs found

**BUG-001: `DEFAULT_STUDIO_ID` hardcoded across 43 admin files.**
The admin UI currently reads `DEFAULT_STUDIO_ID` from `apps/web/src/lib/constants.ts` (line 10) instead of the authenticated user's `studio_id` from the session. Affected files include `revenue/page.tsx` (12 references), `RecordPaymentModal.tsx` (line 81 hardcodes the constant on the member search query), and 41 others across Revenue, Members, Schedule, Marketing, Operations, Analytics. This is both a multi-tenancy bug AND the direct reason the pilot pivoted away from Record Payment: test users seeded into `TEST_STUDIO_ID` are invisible to the UI's queries. Full file list, evidence, and a suggested fix (StudioContext provider in admin layout + `getCurrentStudioId()` helper) are documented in `specs/bugs/revenue-default-studio-coupling.md`. No tests were parked with `test.fixme` because the pilot pivoted entirely — the bug is tracked as follow-up dev work, not a pipeline regression.

## Follow-up work

Items surfaced by this pipeline run that are outside its scope:

1. **[APP BUG] Refactor 43 admin pages to read `studio_id` from session, not `DEFAULT_STUDIO_ID`** — `specs/bugs/revenue-default-studio-coupling.md`. This blocks future E2E runs on Revenue / Members / Schedule write flows. Suggested approach: `StudioContext` in admin layout + `getCurrentStudioId()` helper used by every admin page and modal.
2. **[TOOLING] BasePage sonner assumption mismatch** — `apps/web/e2e/pages/BasePage.ts` has `expectSuccessToast`/`expectErrorToast` helpers targeting sonner selectors, but Meridian uses a custom `ToastNotification` component with no stable selector. Add `role="status"` + `data-testid="toast-notification"` and update the BasePage helpers before the first revenue/member pipeline run. Track in `specs/bugs/toast-helper-mismatch.md` (not yet written).
3. **[DOC] Update `apps/web/AGENTS.md` data-testid convention** — the naming convention section doesn't list `login-*` as a recognized module prefix. Add it (and note that auth-flow testids live under `login-` even though auth is technically global, not module-scoped).
4. **[TEST POM] `LoginPage.goto(path: string = '/login')` signature** — the optional parameter exists purely to satisfy TypeScript's override contract with `BasePage.goto(path: string)`. Callers always use the default and passing anything else would make the wait-for-heading assertion wrong. Either tighten `BasePage.goto` to accept a subclass-specific signature OR document this quirk in `LoginPage.ts`. Cosmetic.
5. **[TEST COVERAGE] Magic-link rate-limit / network-failure scenarios** — spec §5 edge cases C (network failure) and D (rate limit) were deferred. A future run could add `page.route()`-based scenarios for `signInWithOtp` returning 429 and for the request aborting mid-flight.
6. **[INFRA] Turbopack HMR stale bug** — during Engineer phase, Turbopack dev server silently stopped picking up file edits. Required a manual dev server restart to surface the new testids. If this recurs, investigate Turbopack's file watcher behavior on macOS 25.3 (Darwin). Non-blocking for this pipeline.

## How to run these tests

```bash
# Full login suite (from apps/web/)
npx playwright test e2e/login.spec.ts --project=anonymous --reporter=list

# P0 only (for quick gate checks)
npx playwright test e2e/login.spec.ts -g "@p0" --project=anonymous

# Flake check
npx playwright test e2e/login.spec.ts --project=anonymous --repeat-each=3

# Debug a single test
npx playwright test e2e/login.spec.ts -g "admin password login" --project=anonymous --debug

# Regression check (admin suite — should stay green after config changes)
npx playwright test --project=admin --reporter=list
```

## Agent trail

- **Analyst** (`/qa-analyst login`) → `specs/features/login-spec.md` (8 scenarios, 7 testids identified, pilot pivot documented in CL-1)
- **Architect** (`/qa-architect login`) → `specs/plans/login-plan.md` (LoginPage POM designed, anonymous project planned, 9 risks identified)
- **Engineer** (`/qa-engineer login`) → `apps/web/e2e/pages/LoginPage.ts` + `apps/web/e2e/login.spec.ts` + `specs/bugs/revenue-default-studio-coupling.md` + testid seeding + config changes
- **Sentinel** (`/qa-sentinel login`) → `specs/audits/login-audit.md` (⚠ PASS WITH NOTES — 0 critical, 5 non-critical observations)
- **Healer** — skipped (not required; Sentinel passed on first review)
- **Scribe** (`/qa-scribe login`) → this file + updated `specs/pipeline-log.md`
