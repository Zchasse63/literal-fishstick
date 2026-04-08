# Layer Report: Testing Quality

**Agent:** testing-quality
**Date:** 2026-04-08
**Status:** Complete

---

## Executive Summary

Meridian has a well-structured three-tier testing approach: unit tests (Vitest), integration tests (Vitest + real Supabase), and E2E tests (Playwright). The test infrastructure is mature with custom Supabase mock builders, Inngest mocks, and test data factories. Coverage thresholds are set at 50% for branches/functions/lines/statements — a reasonable floor for a Phase 1+2 system. The total unit test file count is 40 test files covering API handlers, library functions, and components. E2E specs cover 9 major user journeys. Key gaps: no tests for AI layer functions directly, no component-level tests beyond MemberProfilePanel, coverage thresholds at 50% may allow significant untested paths through complex logic like the Stripe webhook handler and automation flow executor.

---

## Test Inventory

### Unit Tests (`src/__tests__/unit/`) — 40 files

**API Handler Tests (27 files):**
| Test File | Covers |
|-----------|--------|
| bookings.test.ts | GET + POST /api/bookings |
| bookings-cancel.test.ts | POST /api/bookings/[id]/cancel |
| campaigns.test.ts | Campaign CRUD |
| check-in.test.ts | POST /api/check-in |
| check-in-qr.test.ts | GET /api/check-in/qr |
| check-in-visits.test.ts | Visit tracking |
| classes.test.ts | Class management |
| clock.test.ts | Employee clock-in/out |
| corporate.test.ts | Corporate accounts |
| invoices.test.ts | Invoice operations |
| lead-convert.test.ts | Lead conversion flow |
| leads.test.ts | Lead pipeline CRUD |
| members.test.ts | Member CRUD |
| phone-normalization-integration.test.ts | Phone normalization |
| pricing-simulator.test.ts | Pricing simulation |
| settings.test.ts | Studio settings |
| staff.test.ts | Staff management |
| waitlist-promote.test.ts | Waitlist promotion |
| ai-search.test.ts | AI search endpoint |
| automation-templates.test.ts | Automation templates |
| webhooks/stripe.test.ts | Stripe webhook handler |

**Library Tests (12 files):**
| Test File | Covers |
|-----------|--------|
| auth/get-studio-id.test.ts | Studio ID resolution |
| auth/require-role.test.ts | Role auth helper |
| automation-templates.test.ts | Automation template logic |
| glofox-client.test.ts | Glofox API client |
| inngest/cron-member-enrichment.test.ts | AI enrichment cron |
| inngest/evaluate-triggers.test.ts | Automation trigger evaluation |
| inngest/glofox-sync-enrichment.test.ts | Glofox sync enrichment |
| inngest/helpers.test.ts | Inngest helper utilities |
| member-360.test.ts | Member 360 view |
| rate-limit.test.ts | Rate limiter |
| resend.test.ts | Email delivery |
| validation.test.ts | Zod validation helpers |

**Component Tests (1 file):**
| Test File | Covers |
|-----------|--------|
| member-profile-panel.test.tsx | MemberProfilePanel component |

### Integration Tests (`src/__tests__/integration/`) — 6 files
| Test File | Covers |
|-----------|--------|
| ai-endpoints.test.ts | AI API integration |
| api-bookings.test.ts | Full booking flow with real DB |
| auth-flow.test.ts | Authentication end-to-end |
| inngest-helpers.test.ts | Inngest function helpers |
| stripe-webhook-effects.test.ts | Stripe webhook DB effects |
| supabase-crud.test.ts | Generic Supabase CRUD |

### E2E Tests (`e2e/`) — 10 files
| Spec File | Coverage |
|-----------|----------|
| analytics.spec.ts | Analytics dashboard |
| auth.setup.ts | Auth state setup |
| command-center.spec.ts | Command Center page |
| corporate.spec.ts | Corporate module |
| employee-portal.spec.ts | Employee portal |
| login.spec.ts | Authentication flow |
| marketing.spec.ts | Marketing module |
| members.spec.ts | Member directory |
| revenue.spec.ts | Revenue module |
| schedule.spec.ts | Schedule module |

---

## Test Infrastructure

### Mock Architecture (Vitest)

The unit test mock system is sophisticated:

1. **`mock-chainable.ts`** — Creates a chainable Supabase client mock that simulates the `.from().select().eq().order()...` builder pattern. This is the correct approach for Supabase testing.

2. **`mock-supabase.ts`** — Per-table response configuration with call-index tracking for sequential calls (e.g., first `from('bookings')` returns count, second returns data).

3. **`mock-inngest.ts`** — Mocks Inngest event dispatch so background job firing doesn't require a real Inngest connection.

4. **`mock-glofox.ts`** — Mocks the Glofox API client for Glofox integration tests.

5. **`mock-next.ts`** — Next.js server mocks.

### E2E Auth Setup
E2E tests use a sophisticated auth setup (`auth.setup.ts`) that:
- Creates real Supabase test users via service-role API
- Signs users in via password auth
- Stores browser session state in `e2e/.auth/admin.json` and `e2e/.auth/employee.json`
- Creates a test studio with known `TEST_STUDIO_ID = '00000000-0000-4000-a000-000000000000'`

This is the correct pattern for E2E testing with Supabase SSR auth.

### Coverage Configuration
```
Provider: V8
Targets: src/lib/**/*.ts, src/app/api/**/*.ts
Thresholds: branches=50%, functions=50%, lines=50%, statements=50%
```

The 50% threshold is conservative — it means up to half of all code paths can be untested. For a financial system handling payments and bookings, critical paths like the Stripe webhook handler and booking capacity logic warrant higher thresholds.

---

## Untested Critical Paths

### High-Risk Untested Areas
1. **AI library functions** (`src/lib/ai/*.ts` — 23 modules) — No direct unit tests for `churn-prediction.ts`, `health-score.ts`, `briefing.ts`, etc. These are tested only indirectly via API endpoint tests or not at all.
2. **Inngest background functions** — Only 4 Inngest function files have unit tests (`cron-member-enrichment`, `evaluate-triggers`, `glofox-sync-enrichment`, `helpers`). Untested: `execute-flow.ts` (automation execution), `cron-daily-metrics.ts`, `cron-payroll-reminder.ts`, `glofox-create-booking.ts`, `glofox-mark-attendance.ts`.
3. **Report generation engine** (`src/lib/reports/engine.ts`, `pdf-export.ts`, `csv-export.ts`) — No unit tests found for the report engine.
4. **SMS library** (`src/lib/sms/`) — No unit tests for the Twilio SMS provider implementation.
5. **Email templates** (`src/lib/email-templates.ts`) — No tests for template rendering.
6. **Component tests** — Only 1 of ~100+ React components has a test. The command palette, campaign builder, member profile modal, and other complex UI components have no tests.
7. **Automation execute-flow** — The automation flow executor (`execute-flow.ts`) implements complex branching logic but has no dedicated test.

---

## Test Anti-Patterns Identified

### Anti-Patterns Present
1. **Mock over-reliance in unit tests** — Unit tests mock the entire Supabase client. This is appropriate but means no actual query construction is validated — a change in query structure (wrong column name, wrong table) would not be caught until integration tests run.
2. **E2E test resilience over precision** — E2E specs use broad selectors (`table, [class*="table" i], [class*="list" i]`) and accept any matching element. This makes tests stable but doesn't validate specific data or correct rendering.
3. **Generic "Internal server error" in production code** — Test assertions for 500 errors verify the error message but the production routes swallow the underlying Supabase error, making production debugging harder.

### Anti-Patterns NOT Present (Good Signs)
- No commented-out tests observed
- No `.only()` or `.skip()` observed
- Tests use `beforeEach(() => vi.clearAllMocks())` — proper reset between tests
- Chainable mock builder is a proper abstraction (no copy-paste mock setup)

---

## Findings

### CRITICAL
None identified.

### HIGH
- **HIGH-TQ-001:** The `execute-flow.ts` Inngest function — which runs automation step execution including email sends, waits, and conditional branching — has no unit tests. This is the highest-value background function and the most complex branching logic in the codebase. A bug here silently affects all marketing automation enrollees.
- **HIGH-TQ-002:** Coverage threshold of 50% is too low for a payment and booking system. The Stripe webhook handler, booking capacity logic, and dunning system should be at 80%+. Recommend raising thresholds selectively for `src/app/api/webhooks/`, `src/lib/ai/`, and `src/lib/inngest/functions/`.

### MEDIUM
- **MED-TQ-001:** 22 of 23 AI library modules have no direct unit tests. These modules build complex prompts, parse structured JSON from Claude responses, and implement business logic (churn scoring, health scoring). They should each have at least one happy-path + one error-handling test.
- **MED-TQ-002:** Report engine (`src/lib/reports/engine.ts`) and PDF/CSV exporters have no tests. Report generation involves data transformation, date formatting, and file creation — all error-prone.
- **MED-TQ-003:** E2E tests run against localhost:3000 and require a real running dev server. The Playwright config reuses existing server (`reuseExistingServer: true`) but CI won't have a server running — E2E tests may not be running in CI.

### LOW
- **LOW-TQ-001:** Only 1 component test (`MemberProfilePanel`). Complex UI components like `CampaignsClient`, `AutomationsClient`, and `CommandPalette` (command palette with 20+ actions) have no tests.
- **LOW-TQ-002:** The Vitest integration config (`vitest.integration.config.ts`) exists but its contents weren't read — verify it correctly targets `src/__tests__/integration/` and connects to a test Supabase instance.
- **LOW-TQ-003:** E2E tests check for element visibility with broad selectors — they don't validate specific data values. A data fetching bug that returns empty data would pass the E2E tests as long as the page renders any element matching the selector.

### INFO
- **INFO-TQ-001:** Test setup mocks environment variables correctly including `DEFAULT_STUDIO_ID`. This prevents tests from accidentally hitting production.
- **INFO-TQ-002:** 40 unit test files + 6 integration test files + 10 E2E specs = 56 total test files for 466 source files — a 12% test-to-source ratio. The ratio improves when considering that many source files are thin route handlers that delegate to lib functions which are tested.
- **INFO-TQ-003:** Integration tests use a real Supabase connection with `test-data-factory.ts` for reproducible test data. This is the correct approach for validating database queries.
