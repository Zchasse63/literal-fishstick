# Testing Quality Audit Report

**Agent**: testing-quality
**Model**: claude-sonnet-4-6
**Timestamp**: 2026-04-02T00:00:00Z

---

## Scope

- **Test files examined**: 27 Vitest files (21 unit, 6 integration) + 10 Playwright E2E specs + 2 integration helper files
- **Source context**: 148 API routes, 57 pages, 391 TypeScript files
- **Frameworks in use**: Vitest 4.1 (unit + integration), Playwright 1.58 (E2E), Testing Library 16.3
- **Coverage tool**: v8 (configured, not enforced)

---

## Executive Summary

Meridian has a well-structured test architecture with meaningful test coverage of its highest-risk areas — bookings, check-in, Stripe webhooks, auth, and the rate limiter. The test quality is genuinely high where tests exist: mocks are purposeful, edge cases like trainer bonuses and capacity races are exercised, and the integration suite hits a real Supabase instance with proper factory teardown. However, 122 of 148 API routes (82%) have no unit test coverage at all, the E2E suite covers page loads but avoids all mutations, and zero component or hook tests exist. The gap between ambition and coverage is wide.

The most urgent finding is a credential hygiene issue: `e2e/.auth/admin.json` and `e2e/.auth/employee.json` contain full Supabase JWT access tokens and refresh tokens in plaintext. These files are excluded from git via `apps/web/.gitignore` but the files physically exist on disk and were found in the working tree, which the project-structure audit flagged. The token contents include the Supabase project ref, user UUIDs, and refresh tokens redeemable against the live project.

---

## Test Inventory

### Test File Count

| Layer | Files | Test Cases (approx) |
|-------|-------|---------------------|
| Unit - API route handlers | 14 files | ~152 |
| Unit - lib modules | 6 files (in 3 dirs) | ~86 |
| Integration - live Supabase | 5 files | ~63 |
| Integration - live Anthropic | 1 file | 7 |
| E2E - Playwright | 10 spec files | ~34 |
| **Total** | **36 files** | **~342** |

### By Type

| Type | Count | % of Total |
|------|-------|-----------|
| Unit (mocked dependencies) | ~238 | 70% |
| Integration (live DB + APIs) | ~70 | 20% |
| E2E (browser, full stack) | ~34 | 10% |

### E2E Test Distribution

| Spec File | Tests | Focus |
|-----------|-------|-------|
| `login.spec.ts` | 4 | Auth page rendering, magic link flow |
| `command-center.spec.ts` | 4 | Dashboard load, nav, metrics presence |
| `members.spec.ts` | 4 | Directory load, search, row click |
| `schedule.spec.ts` | 3 | Calendar load, class card presence |
| `revenue.spec.ts` | 3 | Revenue page load, charts presence |
| `analytics.spec.ts` | 4 | Sub-page loads (reports, insights, trainers) |
| `employee-portal.spec.ts` | 4 | Employee pages load |
| `marketing.spec.ts` | 4 | Marketing sub-pages load |
| `corporate.spec.ts` | 2 | Corporate page load |
| `auth.setup.ts` | 2 setups | Session creation (not a test file) |

---

## Test-to-Code Ratio

### API Route Coverage

| Domain | Total Routes | Routes with Unit Tests | Coverage |
|--------|-------------|----------------------|---------|
| bookings | 2 | 2 | 100% |
| check-in | 2 | 2 | 100% |
| classes | 2 | 2 | 100% |
| clock | 1 | 1 | 100% |
| members | 4 | 2 | 50% |
| campaigns | 9 | 1 | 11% |
| corporate | 6 | 2 | 33% |
| invoices | 5 | 1 | 20% |
| leads | 5 | 2 | 40% |
| staff | 2 | 2 | 100% |
| settings | 1 | 1 | 100% |
| pricing-simulator | 3 | 1 | 33% |
| webhooks | 4 | 1 (stripe only) | 25% |
| **ai/** | **17** | **0** | **0%** |
| **analytics/** | **7** | **0** | **0%** |
| **automations/** | **6** | **0** | **0%** |
| **content/** | **4** | **0** | **0%** |
| **events/** | **6** | **0** | **0%** |
| **geofence/** | **2** | **0** | **0%** |
| **glofox/** | **3** | **0** | **0%** |
| **migration/** | **7** | **0** | **0%** |
| **orders/** | **4** | **0** | **0%** |
| **payroll/** | **6** | **0** | **0%** |
| **products/** | **2** | **0** | **0%** |
| **qr/** | **2** | **0** | **0%** |
| **reports/** | **7** | **0** | **0%** |
| **revenue/** | **1** | **0** | **0%** |
| **segments/** | **2** | **0** | **0%** |
| **trainers/** | **5** | **0** | **0%** |
| **transactions/** | **1** | **0** | **0%** |
| **unsubscribe/** | **1** | **0** | **0%** |
| **sms/, email-***, etc. | **7** | **0** | **0%** |

**Overall API route unit test coverage: 26 of 148 routes = 17.6%**

### Library Module Coverage

| Module | Source Files | Test Files | Status |
|--------|-------------|-----------|--------|
| `lib/auth/` | 2 | 2 | Covered |
| `lib/rate-limit.ts` | 1 | 1 | Covered |
| `lib/validation.ts` | 1 | 1 | Covered |
| `lib/resend.ts` | 1 | 1 | Covered |
| `lib/inngest/helpers.ts` | 1 (+ functions/) | 1 unit + 1 integration | Covered |
| `lib/ai/` | 14 files | 0 unit | Gap |
| `lib/anthropic.ts` | 1 (1,699 lines) | 0 unit | Gap |
| `lib/stripe.ts` | 1 | 0 unit | Gap |
| `lib/reports/` | 4 | 0 | Gap |
| `lib/sms/` | 2 | 0 | Gap |
| `lib/glofox/` | 6 | 0 | Gap |
| `lib/email-templates.ts` | 1 | 0 | Gap |

### Hook Coverage

- `hooks/` contains 13 React hooks (AI + Supabase data access)
- **Zero hook tests exist**
- No component tests at all despite Testing Library being installed

---

## Findings by Severity

---

### CRITICAL

#### C1: Committed Supabase JWT Tokens in .auth Files

**File**: `apps/web/e2e/.auth/admin.json`, `apps/web/e2e/.auth/employee.json`

The `.auth/` directory is correctly listed in `apps/web/.gitignore` (line 17: `e2e/.auth/`) and does not appear in git history. However, the files exist on disk with full JWT access tokens and refresh tokens:

- Cookie name reveals the Supabase project ref: `sb-rhdmiyttafsbfuflnjza-auth-token`
- Contains a full `access_token` JWT (ES256 signed), `refresh_token` (`iealmrlfxkby`), and full user object including email `meridian-e2e-admin@test.meridian.app`
- Token `expires_at: 1774185553` (a future timestamp as of 2026) — token may still be valid

**Risk**: If these files were ever committed (check git log for pre-.gitignore history) or if the working directory is accessible to other processes, these tokens could be used to authenticate against the live Supabase project as the E2E admin user. The refresh token is particularly dangerous as it does not expire on the schedule.

**Immediate action**: Rotate both user passwords for `meridian-e2e-admin@test.meridian.app` and `meridian-e2e-employee@test.meridian.app` via Supabase Auth admin. The refresh token `iealmrlfxkby` should be revoked. After rotation, `auth.setup.ts` will re-generate new session files on next run.

**Note on git history**: `git log --all --full-history -- apps/web/e2e/.auth/admin.json` returned no commits, meaning these files have not been committed to any branch. The risk is a working-directory exposure only. Still warrants credential rotation as a precaution.

---

#### C2: 82% of API Routes Have Zero Test Coverage

Of 148 API routes, only 26 have corresponding unit tests. The untested 122 routes include several categories of high business risk:

**High-criticality untested routes:**

| Route | Risk |
|-------|------|
| `POST /api/members/[id]/upgrade` | Subscription plan change — revenue impact |
| `POST /api/members/[id]/downgrade` | Subscription plan change — revenue impact |
| `POST /api/sms/send` | External SMS cost, message delivery |
| `POST /api/campaigns/send` | Mass email delivery — unrecoverable action |
| `POST /api/campaigns/process-scheduled` | Scheduled mass send trigger |
| `POST /api/payroll/periods/[id]/approve` | Payroll approval — financial record |
| `POST /api/payroll/periods/[id]/calculate` | Payroll calculation logic |
| `GET/POST /api/revenue` | Core revenue metrics calculation |
| `GET/POST /api/transactions` | Transaction record management |
| `GET/POST /api/segments` | Smart segment logic |
| `POST /api/migration/import` | Data import — irreversible data changes |
| `POST /api/webhooks/easypost` | Shipping webhook — untested handler |
| `POST /api/webhooks/resend` | Email event tracking |
| `POST /api/webhooks/twilio` | SMS webhook |
| All 17 `/api/ai/*` routes | AI prompt construction, cost, response handling |
| All 7 `/api/analytics/*` routes | Business intelligence calculations |

The member upgrade/downgrade routes are particularly high risk: they integrate with Stripe proration and are explicitly listed in the CLAUDE.md as a differentiating feature. None of these are tested.

---

### HIGH

#### H1: No Coverage Thresholds Enforced

The Vitest unit config specifies `coverage.provider: 'v8'` with `reporter: ['text', 'text-summary', 'lcov']` but no `thresholds` block. Coverage is measured when running `test:coverage` but there is no enforced minimum. If coverage drops to 0%, CI still passes.

The CI workflow (`ci.yml`) runs `npm test` which maps to `vitest run` — this runs tests but does NOT generate coverage. The `test:coverage` command is a separate script not invoked in CI. Coverage data is never collected in the automated pipeline.

**Impact**: The team has no automated signal when coverage regresses. Adding a threshold of 60% for the currently-covered routes would catch accidental deletions.

#### H2: Integration Tests Require Live Credentials Not Present in CI

`apps/web/src/__tests__/integration/setup.ts` loads `.env.local` and throws if `SUPABASE_SERVICE_ROLE_KEY` is missing. The CI workflow (`ci.yml`) injects only fake values:

```yaml
SUPABASE_SERVICE_ROLE_KEY: test-service-role-key
```

This means the integration test suite (`test:integration`) cannot run in CI at all — it would fail at the setup phase before any test executes. There is no separate CI job for integration tests, and `npm test` only runs `vitest run` (unit tests only). The integration and E2E suites are entirely manual-run, developer-local tests.

**Impact**: The 70 live integration tests and all 10 E2E specs are never automatically validated. A regression in live Supabase schema, RLS policy, or Inngest helper behavior would not surface in CI.

#### H3: AI Integration Tests Hit Real Anthropic API (Cost + Flakiness Risk)

`apps/web/src/__tests__/integration/ai-endpoints.test.ts` calls the live Anthropic API with no mocks. Each test run costs real money (estimated $0.01–0.05 per run per the file's own comment). The 7 AI tests call `generateBriefing` twice and `generateRecommendations` 5 times.

Beyond cost, these tests are inherently flaky: AI responses are non-deterministic, the Anthropic API has latency variability, and token budget exhaustion would cause failures. The tests guard against this by testing only structure (type = string, length > 50), but API availability and cost remain concerns.

**The test file documents this explicitly** — it should be tagged or grouped separately from the standard integration suite and excluded from any future CI integration test job.

#### H4: E2E Tests Are Smoke Tests Only — No Mutations Tested

All 9 content spec files (excluding auth.setup) test only page load and presence of DOM elements. Not a single E2E test performs:

- Creating a booking
- Checking in a member
- Sending a campaign
- Clocking in/out
- Creating a class
- Any form submission that persists data

The E2E assertions are extremely lenient — most use fallback chains: "if this locator exists, check it; otherwise, just verify body.length > 50." This pattern means tests pass even when the feature is completely broken as long as the page renders any HTML.

**Example of the anti-pattern** (from `command-center.spec.ts`):
```typescript
// If no metric elements found, fall back to just checking page has content
const body = await page.textContent('body')
expect(body!.length).toBeGreaterThan(100)
```

A completely blank page with "Loading..." would pass this test.

#### H5: No Component or Hook Tests Despite Testing Library Installation

`@testing-library/react` and `@testing-library/jest-dom` are installed but no component or hook test files exist anywhere in the codebase. The 13 React hooks in `hooks/` — including AI-powered hooks that manage polling, caching, and streaming — have zero test coverage.

Hooks of particular concern:
- AI-related hooks that call Claude API endpoints
- Data polling hooks with 60-second intervals
- `auth-context.tsx` (single context powering the entire auth system)

---

### MEDIUM

#### M1: Chainable Mock Duplication Across 14 Test Files

Every unit API test file (all 14) defines its own local `createChainableMock()` function. This is identical or nearly-identical logic duplicated 14 times. The shared `helpers/mock-supabase.ts` exports `createMockQueryBuilder()` which serves the same purpose, but 13 of 14 API test files ignore it and inline their own version.

The local versions differ in subtle ways (some have `maybeSingle` as `Promise.resolve()`, some as chain return), making the mock behavior inconsistent between test files. This is a test maintenance risk: fixing a bug in the Supabase mock API requires 14 individual edits.

**Pattern found**: `apps/web/src/__tests__/unit/api/bookings.test.ts`, `check-in.test.ts`, `clock.test.ts`, `classes.test.ts`, `members.test.ts`, `staff.test.ts`, `leads.test.ts`, `campaigns.test.ts`, `invoices.test.ts`, `corporate.test.ts`, `pricing-simulator.test.ts`, `settings.test.ts`, `check-in-qr.test.ts`, and the webhooks/stripe test — all independently define chainable mocks.

#### M2: Stripe Webhook Tests Do Not Verify Signature Against Real Stripe Library

`apps/web/src/__tests__/unit/api/webhooks/stripe.test.ts` mocks `constructWebhookEvent` at the module level, which means the actual Stripe signature verification logic (`stripe.webhooks.constructEvent`) is never exercised. The test verifies that when signature validation passes/fails, the correct HTTP status is returned — but it does not test the cryptographic verification path.

For a webhook handler that processes subscription events, payment success, and credit pack creation, the untested path is: what happens if a malformed but correctly-signed payload arrives? What if the metadata fields (`meridian_member_id`, `meridian_studio_id`) are missing from a real Stripe event?

**Partial mitigation**: The integration tests in `stripe-webhook-effects.test.ts` cover the database side effects but not the HTTP handler itself.

#### M3: Flaky Test Risk in Trainer Bonus Check-In Test

`apps/web/src/__tests__/unit/api/check-in.test.ts` test "does not duplicate bonus when one already exists" asserts that `trainer_bonuses` was called only once:

```typescript
const bonusCalls = mockSupabase.from.mock.calls.filter(
  (c: string[]) => c[0] === "trainer_bonuses"
);
expect(bonusCalls.length).toBe(1);
```

This assertion is fragile: if the route implementation changes to make an additional read to `trainer_bonuses` for any reason (e.g., logging, audit), this test breaks without the actual bug being present. The assertion should be on the insert call count, not the from() call count.

#### M4: Integration Test Studio ID Collision Risk

The integration tests use a hardcoded studio ID `'00000000-0000-4000-a000-000000000000'` shared by both the integration test suite (`setup.ts`) and the E2E auth setup (`auth.setup.ts`). Both suites write data to the same studio. If integration tests and E2E tests run concurrently, or if the test studio has pre-existing data from a previous failed cleanup, test results can be non-deterministic.

The `TestDataFactory.cleanup()` properly deletes records in reverse order, but a test run interrupted mid-execution (Ctrl+C) leaves orphan records in the test studio permanently.

#### M5: No Test for Middleware Auth Guard

`apps/web/src/middleware.ts` is the auth guard protecting all `/admin` and `/employee` routes. It is not tested anywhere — not in unit tests (middleware is difficult to unit test in Next.js App Router), not in E2E tests (E2E tests start authenticated, never testing the unauthenticated redirect path), and not in integration tests.

A bug in middleware could expose all admin routes to unauthenticated users. The only implicit test is the E2E auth.setup.ts which verifies the session cookie allows access, but the negative case (no cookie → redirect to /login) is not explicitly tested.

#### M6: No Tests for 19 Inngest Function Definitions

`apps/web/src/lib/inngest/functions/` contains 19 Inngest background job function definitions. Only the helper utilities in `lib/inngest/helpers.ts` are tested. The function definitions themselves — which define triggers, retry logic, step execution, and error handling — have no tests.

This is particularly notable because Inngest functions execute asynchronously outside the request/response cycle. A broken Inngest function fails silently; there is no HTTP 500 to observe in the app.

---

### LOW

#### L1: `bookings-cancel.test.ts` Exists as a Separate File vs Route Structure

The cancel endpoint (`/api/bookings/[id]/cancel`) has its own test file (`bookings-cancel.test.ts`) separate from `bookings.test.ts`. This is a reasonable organizational choice, but the naming doesn't align with the route hierarchy — a reader looking for booking tests must check two files.

#### L2: E2E Auth State Snapshots Are Time-Bounded

The Playwright `storageState` files store session cookies with `expires: -1` (session cookies) but the JWT `expires_at: 1774185553` (approximately 1 hour from token generation). Each E2E test run that reuses an existing `storageState` without re-running `auth.setup.ts` will fail if the token has expired. The `playwright.config.ts` sets `reuseExistingServer: true` but does not re-run auth setup — the auth setup only runs if the `auth-setup` project dependencies are met.

In practice, developers must run `test:e2e` fresh (which triggers auth.setup first) or manually delete `.auth/*.json` to force re-auth.

#### L3: `vitest.config.ts` Has No Coverage Thresholds

The coverage include paths (`src/lib/**/*.ts`, `src/app/api/**/*.ts`) are well-targeted. However:
- No `thresholds` block
- No `all: true` setting (files with zero tests don't appear in coverage)
- The `lcov` reporter output is never consumed (no coveralls/codecov integration)

#### L4: One test.skip() in E2E Members Spec

`apps/web/e2e/members.spec.ts:70` contains `test.skip()` inside a conditional:

```typescript
} else {
  // No member rows — acceptable if test studio has no members yet
  test.skip()
}
```

This is a legitimate guard (test data may not exist), but it means the "click member row" test never runs in CI or on a fresh test environment. The test relies on pre-existing member data in the E2E test studio rather than creating its own.

---

## Test Quality Assessment

### Strengths

**Bookings test quality is high.** `bookings.test.ts` tests 15 distinct scenarios including capacity enforcement, duplicate booking detection, activity log side effects, and error conditions. The test that verifies the activity log payload structure is particularly valuable:

```typescript
expect(activityLogPayload).toMatchObject({
  studio_id: TEST_STUDIO_ID,
  actor_id: TEST_USER_ID,
  type: "booking_created",
  ...
})
```

**Check-in trainer bonus logic is thoroughly exercised.** The trainer bonus threshold, deduplication, and Glofox Inngest trigger are all tested as separate cases.

**Rate limiter tests are excellent.** Fake timers, window expiry, key isolation, and cleanup logic are all covered. The test that verifies entries are NOT cleaned up before the cleanup interval is particularly careful about testing the boundary condition.

**`require-role.ts` is the best-tested lib module.** 12 test cases covering null user, missing profile, wrong role, multi-role intersection, empty roles array, and studioId fallback behavior. The test that verifies the supabase client is returned even in 401/403 cases tests an important contract.

**Integration test factory is production-quality.** `TestDataFactory` handles all CHECK constraint values, FK dependencies (especially the `automation_enrollments.member_id → profiles(id)` non-obvious relationship), and cleanup in reverse order. The factory pattern is solid infrastructure.

**Validation schema tests verify behavioral contracts.** The test that verifies extra fields are stripped (`sneaky_extra` test in validation.test.ts) catches schema configuration issues that would otherwise be silent security holes.

### Weaknesses

**AI endpoint tests test structure, not behavior.** The 7 integration tests for `generateBriefing` and `generateRecommendations` verify only that the return value is a non-empty string or non-empty array. They do not test:
- That specific fields in the context affect the output
- That error cases (API quota exceeded, malformed response) are handled
- That the fallback rules-based path works when Claude is unavailable

**Stripe webhook tests verify call patterns, not data correctness.** Most webhook assertions check that `queryBuilder.update` was called with `{ membership_status: 'active' }`, but they do not verify that the correct `member_id` is targeted. A bug that updates all members' statuses would pass these tests.

**E2E tests are effectively smoke tests.** The lenient assertion pattern (body.length > 50 as fallback) means the tests catch 404 errors and crashes but not data display bugs, broken UI components, or incorrect query results.

---

## Test Infrastructure Assessment

### CI Integration

The GitHub Actions workflow (`ci.yml`) runs on push and PR to main:
- Lint + type-check + unit tests: one job (15 min timeout)
- Build: separate job, depends on first

**What CI validates**: ESLint, TypeScript, 26 API route unit tests + 6 lib unit test files

**What CI does NOT validate**: Integration tests, E2E tests, coverage metrics, actual build output against live services

### Coverage Configuration

```
provider: v8
reporter: ['text', 'text-summary', 'lcov']
include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts']
thresholds: (none configured)
```

Coverage is not run in CI (`npm test` != `npm run test:coverage`). When run locally, the `all: false` default means untested files are invisible in the report.

### Test Isolation

Unit tests: Excellent. `vi.clearAllMocks()` in `beforeEach`, environment variables set in `setup.ts`, module-level mocks properly hoisted.

Integration tests: Good. `afterAll` cleanup via factory. The serial execution config (`fileParallelism: false`, `concurrent: false`) prevents DB races.

E2E tests: Adequate. `storageState` per project correctly isolates admin vs employee sessions. `workers: 1` prevents parallelism issues.

### Pre-Commit Hooks

No Husky or pre-commit configuration. Tests are not enforced before commits.

---

## Coverage Heatmap

The Mermaid diagram below represents test coverage density per domain:
- Green: well-tested
- Yellow: partial coverage
- Red: minimal/single test
- Gray dashed: zero test coverage
<br/>

See `.audit/diagrams/testing-quality.mmd` for the visual diagram.

---

## Missing Critical Test Paths (Priority Order)

### Priority 1 — Revenue/Payment Impact

1. `POST /api/members/[id]/upgrade` — Stripe subscription change, proration
2. `POST /api/members/[id]/downgrade` — Subscription downgrade at period end
3. `POST /api/revenue` — MRR/ARPM/churn calculation correctness
4. `GET /api/transactions` — Transaction listing and filtering
5. `POST /api/payroll/periods/[id]/calculate` — Payroll calculation
6. `POST /api/payroll/periods/[id]/approve` — Payroll approval and lock

### Priority 2 — External Integration Impact

7. `POST /api/campaigns/send` — Mass email delivery (Resend)
8. `POST /api/campaigns/process-scheduled` — Scheduled send trigger
9. `POST /api/sms/send` — SMS delivery (Twilio cost)
10. `POST /api/webhooks/resend` — Email event tracking handler
11. `POST /api/webhooks/twilio` — SMS event handler
12. `POST /api/webhooks/easypost` — Shipping event handler

### Priority 3 — Business Logic

13. `GET/POST /api/segments` — Smart segment query logic
14. `GET /api/analytics/*` — All 7 analytics calculation endpoints
15. All 17 `api/ai/*` routes — Rate limiting, prompt construction, fallback behavior
16. `POST /api/migration/import` — Data import validation and processing
17. 19 Inngest function definitions — Background job logic

### Priority 4 — Component and Hook Testing

18. `useClasses`, `useMembers`, `useBookings` hooks — data access correctness
19. `auth-context.tsx` — session management, role checking
20. `CommandPalette` component — keyboard navigation
21. Login page form validation — client-side behavior

---

## Recommendations

### Immediate Actions

1. **Rotate E2E test user credentials** — The refresh token in `.auth/admin.json` (`iealmrlfxkby`) should be revoked via Supabase Auth admin dashboard, and both test users' passwords reset. Run `auth.setup.ts` after to regenerate. Document this in the E2E README.

2. **Consolidate chainable mock into shared helper** — Move the chainable Supabase mock into `helpers/mock-supabase.ts` (which already exists but is underused) and remove the 14 inline duplicates. This is a one-time refactor that prevents divergent mock behavior.

3. **Add coverage thresholds to `vitest.config.ts`** — Add `thresholds: { lines: 50, functions: 50 }` as a floor. At current coverage levels this won't block CI but will catch regressions.

4. **Run coverage in CI** — Change `npm test` in `ci.yml` to `vitest run --coverage` so coverage data is always generated.

### Short-Term (Next Sprint)

5. **Add tests for member upgrade/downgrade routes** — These are revenue-critical. Mock Stripe SDK alongside the Supabase mock.

6. **Add tests for campaign send routes** — These trigger irreversible external actions. Test that the email is not sent when authentication fails.

7. **Tag AI integration tests to skip in CI** — Add a custom condition or environment variable guard so the live Anthropic tests only run when `ANTHROPIC_API_KEY` is a real key, not the CI fake value.

8. **Add middleware auth guard E2E test** — One negative-path test: navigate to `/` without auth cookies and verify redirect to `/login`.

### Medium-Term

9. **Hook tests for data access hooks** — Use Vitest with mock fetch to test that polling hooks update state correctly and handle error conditions.

10. **Mutation E2E tests** — At minimum, one happy-path E2E that creates a booking, checks in the member, and verifies the booking appears in the member's history.

11. **Inngest function tests** — Use the `@inngest/test` package or simulate the Inngest execution model to test function logic without triggering real jobs.

12. **Analytics endpoint tests** — The 7 analytics routes perform complex aggregation queries. Test that filters, date ranges, and grouping produce expected shapes.

---

## Appendix: Untested Route List (122 routes)

Routes with zero corresponding unit test files:

**ai/** (17): auto-reply, booking-patterns, briefing, campaign-copy, churn-prediction, health-score, insights, insights/[id]/action, insights/[id]/dismiss, insights/generate, insights/history, intake-enrichment, recommendations, revenue-anomaly, search, trainer-summary, waitlist-message

**analytics/** (7): cohorts, daily-metrics, heatmap, member-movement, revenue-breakdown, snapshot, summary

**auth/** (1): profile

**automations/** (6): index, [id], [id]/activate, [id]/deactivate, [id]/enrollments, [id]/enrollments/[eid]/exit

**campaigns/** (8): [id]/duplicate, [id]/pause, [id]/recipients, [id]/schedule, [id]/select-winner, process-scheduled, send, send-test

**content/** (4): index, [id], [id]/comment, [id]/like

**corporate/** (4): [id]/credits, [id]/invoices, [id]/members, [id]/members/[mid], dashboard

**cron/** (1): waitlist-promote

**email-preferences/** (1): [memberId]

**email-templates/** (1): index

**employees/** (2): [id]/documents, [id]/documents/[did]

**events/** (6): index, [id], [id]/confirm, [id]/guests, [id]/guests/[gid], [id]/quote

**geofence/** (2): index, [id]

**glofox/** (3): backfill, status, sync

**invoices/** (4): [id]/pdf, [id]/record-payment, [id]/send, [id]/void

**leads/** (4): [id]/activity, [id]/convert, capture, score

**members/** (3): [id]/downgrade, [id]/tags, [id]/upgrade

**migration/** (7): import, jobs, jobs/[id], jobs/[id]/rollback, status, upload, validate, wave-assign

**openapi/** (1): index

**orders/** (4): index, [id], [id]/ship, [id]/status, [id]/tracking

**payroll/** (6): periods, periods/[id], periods/[id]/approve, periods/[id]/calculate, periods/[id]/export, periods/[id]/reopen

**pricing/** (1): index

**products/** (2): index, [id]

**qr/** (2): member/[id], promo/[code]

**reports/** (7): index, [id], [id]/export, [id]/exports, [id]/generate, exports/[exportId]/download, templates

**revenue/** (1): index

**segments/** (2): index, [id]

**shipping/** (1): rates

**sms/** (1): send

**trainers/** (5): [id]/performance, [id]/performance/history, [id]/performance/summary, leaderboard, performance

**transactions/** (1): index

**unsubscribe/** (1): [token]

**webhooks/** (3): easypost, resend, twilio
