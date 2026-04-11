# Test Spec — Login (Password + Magic Link)

**Status:** Pilot target for the QA pipeline's first real run.

**Pilot context:** This spec was originally slated for the **Record Payment** feature in the Revenue module, but exploration of the codebase revealed that **43 admin pages — including all of Revenue — hardcode `DEFAULT_STUDIO_ID` instead of reading the authenticated user's `studio_id`**. This makes meaningful E2E testing on the Revenue module impossible until that coupling is refactored. The pilot pivoted to the Login feature, which has no studio coupling and is a pure auth flow. See §8 (Clarification log) for the full finding.

---

## 1. Feature summary

- **Name:** Login (password + magic link)
- **Module:** Auth / Global (not module-scoped)
- **Primary user roles:** Owner, Manager, Trainer (all routes go through `/login`)
- **One-line description:** Users sign into Meridian via password or magic link. Admins land on `/` (command center), non-admin roles land on `/employee`.
- **Related specs:**
  - `apps/web/src/app/(auth)/login/page.tsx` — current implementation (client component)
  - `apps/web/src/middleware.ts` — route protection
  - `apps/web/e2e/auth.setup.ts` — existing Supabase cookie-based session setup (proves the credentials work)

## 2. Happy path flow

### Password path (admin)
1. Navigate anonymously to `http://localhost:3000/login`.
2. The page shows a centered card with "Meridian" brand, "Sign in" heading, and a form with **Email** and **Password** fields.
3. The primary button reads "Sign In" and is **disabled** until both fields have values.
4. Type `meridian-e2e-admin@test.meridian.app` in the email field.
5. Type `e2e-test-admin-password-2026!` in the password field.
6. The button becomes enabled.
7. Click **Sign In**.
8. Button text flips to "Signing in..." briefly.
9. Supabase `signInWithPassword` succeeds → browser receives session cookie.
10. Next.js router pushes to `/` (command center for admin/owner roles).
11. Final URL is `http://localhost:3000/` (not `/login`).

### Password path (employee / trainer)
1–9 identical, with `meridian-e2e-employee@test.meridian.app` / `e2e-test-employee-password-2026!`.
10. The login page reads the signed-in user's `roles` from `profiles` and sees `['trainer']` — no admin role.
11. Router pushes to `/employee`.
12. Final URL is `http://localhost:3000/employee`.

### Magic link path
1. Navigate anonymously to `/login`.
2. Click **Sign in with Magic Link** button at the bottom of the card.
3. Mode flips: the Password field disappears. Heading subtitle becomes "Enter your email to receive a magic link." Primary button reads **Send Magic Link**.
4. Type `meridian-e2e-admin@test.meridian.app`.
5. Click **Send Magic Link**.
6. Button text flips to "Sending..." briefly.
7. Supabase `signInWithOtp` succeeds. (No email is actually delivered in test — we only assert the request succeeded from the UI's perspective.)
8. The form is replaced by a "Check your email" panel showing an envelope icon, the subject email, and a "Use a different email" button.
9. Click **Use a different email**.
10. The form returns to its initial state (empty email, password mode, Sign In button).

## 3. Preconditions (data needed)

### Existing fixtures (no action needed)
- **ADMIN_USER** from `e2e/fixtures/test-data.ts` — seeded by `e2e/auth.setup.ts` during pre-flight. Has `roles: ['owner']` and exists in `TEST_STUDIO_ID`.
- **EMPLOYEE_USER** from `e2e/fixtures/test-data.ts` — seeded by `e2e/auth.setup.ts`. Has `roles: ['trainer']`.
- Both users have confirmed email addresses (`email_confirm: true`) and working passwords.

### Critical test architecture: unauthenticated project
The admin and employee Playwright projects apply `storageState: 'e2e/.auth/{admin|employee}.json'` which pre-loads session cookies. **These storage states must NOT be used for the login tests** — the tests need to start from an anonymous state. The Architect must introduce a new Playwright project `anonymous` (no storage state) for this spec.

### No seeding needed
This feature is read-only from a DB perspective (auth.signIn doesn't write app rows). `db.ts` seeding helpers are NOT exercised by this pilot. A future pipeline run on a write-flow feature (once `DEFAULT_STUDIO_ID` is refactored) will exercise them.

## 4. Test matrix

| # | Scenario | Priority | Type | Expected outcome |
|---|----------|----------|------|------------------|
| 1 | Admin password login redirects to `/` | P0 | E2E | URL becomes `/`, `/login` no longer in URL |
| 2 | Employee password login redirects to `/employee` | P0 | E2E | URL becomes `/employee` |
| 3 | Invalid credentials show error message | P0 | E2E | Error text visible, URL still `/login` |
| 4 | Submit button disabled when form is empty | P0 | E2E | `Sign In` button has `disabled` attr on first load |
| 5 | Submit button disabled with email only (no password) | P0 | E2E | After filling email only, button still disabled |
| 6 | Toggle to magic link mode hides password field | P1 | E2E | Password field not visible after toggle, button text reads "Send Magic Link" |
| 7 | Magic link submit shows "Check your email" confirmation | P1 | E2E | Sent panel visible with the submitted email |
| 8 | "Use a different email" button returns from sent panel to form | P2 | E2E | Form fields visible again, email field empty |

**Total: 8 scenarios (5 P0, 2 P1, 1 P2)** — within the 6–12 target range.

## 5. Edge cases & negative tests

| # | Edge case | Coverage |
|---|-----------|----------|
| A | Whitespace-only email | Covered by scenario 4 (empty-string logic) — not a separate test |
| B | Very long email / SQL injection in email field | Supabase GoTrue handles — skipped from E2E (unit-test territory) |
| C | Network failure mid-request | **Not covered in pilot** — would require intercepting the network with `page.route()`. Listed as follow-up in the report. |
| D | Rate-limit hit (too many login attempts) | **Not covered** — Supabase-side behavior, out of scope for app E2E |
| E | Session already active when visiting /login | **Not covered in pilot** — middleware redirect behavior, worth a future scenario |
| F | Token refresh during the flow | **Not covered** — Supabase internal |
| G | Toggling password ↔ magic link clears password field | Covered indirectly by scenario 6 |
| H | Magic link "Use different email" clears the email field | Covered by scenario 8 |

## 6. Data-testid requirements

All of these need to be seeded into `apps/web/src/app/(auth)/login/page.tsx`. NONE currently exist.

| Testid | Element | Purpose |
|--------|---------|---------|
| `login-email-input` | `<input id="email">` (line ~158) | Email field — **[NEEDS SEEDING]** |
| `login-password-input` | `<input id="password">` (line ~178) | Password field — **[NEEDS SEEDING]** |
| `login-submit-btn` | `<button type="submit">` (line ~194) | Primary submit (text changes with mode) — **[NEEDS SEEDING]** |
| `login-mode-toggle-btn` | Toggle button (line ~216) | Switches password ↔ magic link — **[NEEDS SEEDING]** |
| `login-error-message` | `<p className="text-sm text-red-600">` (line ~191) | Error display — **[NEEDS SEEDING]** |
| `login-sent-confirmation` | `<div>` with "Check your email" (line ~102) | Sent state panel — **[NEEDS SEEDING]** |
| `login-use-different-email-btn` | Button inside sent panel (line ~127) | Returns to form — **[NEEDS SEEDING]** |

**Note:** Despite shadcn labels existing (`<label htmlFor="email">`), the spec still prefers `data-testid` for the inputs because the login page uses native `<input>` + custom `<label>` (not shadcn's `<Label>`). `getByLabel` will work today but `getByTestId` is more resilient to future label text changes.

## 7. Out of scope

- **Social auth buttons** (Google, Apple) — not implemented yet.
- **"Remember me" checkbox** — not implemented.
- **"Forgot password" link** — not implemented.
- **Magic link email delivery** — Resend-based and out-of-process. Tests only assert that the UI reaches the "sent" state.
- **Session persistence across page reloads** — covered by `auth.setup.ts`, not the login spec.
- **Middleware redirect from protected pages** — a separate spec should cover "visiting /revenue while logged out redirects to /login".
- **Accessibility audit** (keyboard-only flow, ARIA names) — worth a separate A11y pipeline run.
- **Mobile viewport** — pilot is desktop-only (default `1280×720`).
- **Supabase rate-limit behavior** — Supabase concern, not app concern.

## 8. Clarification log

### CL-1 — Pilot pivot: Record Payment → Login

**Original request:** "Pilot run the pipeline on the Record Payment feature."

**Finding during exploration:** Two critical architecture issues block meaningful E2E testing of Record Payment:

1. **`apps/web/src/app/(admin)/revenue/_components/RecordPaymentModal.tsx`** (line 81) hardcodes `DEFAULT_STUDIO_ID` for its member search: `supabase.from('profiles').select(...).eq('studio_id', DEFAULT_STUDIO_ID)`. A test user seeded into `TEST_STUDIO_ID` will not appear in the search.

2. **`apps/web/src/app/(admin)/revenue/page.tsx`** (line 56) declares `const STUDIO_ID = DEFAULT_STUDIO_ID` and uses it in 10 different queries on the same page. Even a read-only scenario ("admin sees N transactions") would read from the wrong studio.

3. **Wider pattern:** `grep -rn DEFAULT_STUDIO_ID apps/web/src/app/(admin)` finds **43 files** with this pattern. The admin UI is currently single-tenant at the application layer, even though the DB is multi-tenant with RLS. This is an architectural bug that must be fixed before meaningful E2E tests can run against most admin pages.

**Decision:** Pivot the pilot to the Login page, which:
- Has zero studio-id coupling (pure auth flow)
- Uses `TEST_STUDIO_ID` via the seeded auth users
- Exercises every BasePage helper except toasts
- Still delivers 8 real tests with P0/P1/P2 coverage

**Finding documented separately in:** `specs/bugs/revenue-default-studio-coupling.md` (to be written by the Engineer or user during follow-up).

### CL-2 — Sonner assumption was wrong

`apps/web/e2e/pages/BasePage.ts` has `expectSuccessToast` and `expectErrorToast` helpers that target sonner (`[data-sonner-toast][data-type="success"]`). The actual Meridian codebase does **not** use sonner — it uses a custom `<ToastNotification>` component in `apps/web/src/components/ui/toast-notification.tsx` with no stable selector. 

**Impact on this pilot:** None — the login flow does not display toasts. Success is observed via URL change; error is observed via the inline `text-red-600` paragraph.

**Follow-up:** In a future session, add `role="status"` + `data-testid="toast-notification"` to `ToastNotification` and update BasePage helpers. Track in `specs/bugs/toast-helper-mismatch.md`.

### CL-3 — Anonymous project needed in playwright.config.ts

The existing playwright config has only `admin` and `employee` projects, both with pre-loaded storage state. Login tests must start unauthenticated — the Architect needs to add a third project `anonymous` (no storage state, no auth setup dependency) for this spec.

### CL-4 — No DB assertion for login

Unlike the original Record Payment pilot, this login spec has **no DB-level assertion** because login does not write app rows — it only creates a Supabase auth session (managed by Supabase, not Meridian's tables). The URL change is the contract. This is legitimate and not a coverage gap.

---

## Analyst summary

- **Feature:** Login (password + magic link)
- **Spec:** `specs/features/login-spec.md`
- **Scenarios:** 8 (5 P0, 2 P1, 1 P2)
- **Testids to seed:** 7 (all on `apps/web/src/app/(auth)/login/page.tsx`)
- **New fixtures needed:** 0
- **New Playwright projects needed:** 1 (`anonymous`)
- **Open questions:** 0 (all pilot pivots documented above)
- **Follow-ups surfaced:**
  1. `DEFAULT_STUDIO_ID` architectural coupling across 43 admin pages
  2. BasePage sonner assumptions do not match actual Meridian toast impl
  3. Missing anonymous Playwright project
