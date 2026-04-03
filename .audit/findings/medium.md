# Medium Findings

Generated: 2026-04-02
Deduplicated and cross-referenced from 10 layer audit reports.

---

## MED-01: `@meridian/supabase` and `@meridian/utils` Packages Are Entirely Unused

Both shared monorepo packages have zero imports from `apps/web`. `@meridian/types` has only 2 imports out of 391 TypeScript files. The packages provide false confidence about code sharing.
**Sources**: project-structure HIGH-001/MED-001/MED-002, data-model M-004
**Effort**: Low-Medium (consolidate or remove)

---

## MED-02: No `.env.example` File -- Required Secrets Undocumented

27+ environment variables are required across Supabase, Stripe, Anthropic, Resend, Twilio, EasyPost, Inngest, and Glofox. No documentation exists. New developers or deployments cannot self-configure.
**Sources**: integration I-M3, security SEC-H6
**Effort**: Low

---

## MED-03: Missing CSP and HSTS Security Headers

`netlify.toml` sets X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Missing: Content-Security-Policy (XSS mitigation), Strict-Transport-Security (HTTPS enforcement).
**Sources**: api-surface M-5, security SEC-M3
**Effort**: Low

---

## MED-04: Six AI Modules Hardcode Stale Model Identifier

Six modules use `"claude-sonnet-4-20250514"` instead of the centralized `AI_MODEL` constant. If the model is upgraded, these modules silently continue calling the old model.
**Source**: ai-layer C-02
**Effort**: Low (replace strings with `AI_MODEL` import)

---

## MED-05: Five AI Modules Are Complete But Unreachable Dead Code

`cross-sell.ts`, `pricing-analyzer.ts`, `seasonal-predictor.ts`, `report-narrative.ts`, `trainer-comparison.ts` have full implementations but no API routes.
**Sources**: ai-layer C-01, project-structure HIGH-004
**Effort**: Medium (create API routes or mark as Phase 3)

---

## MED-06: Churn Prediction Email Query Uses `full_name` Instead of Email Address

`churn-prediction/route.ts` filters `email_send_log` by `recipient_email` using `profile.full_name`. Always returns zero results, silently degrading every churn prediction score.
**Source**: ai-layer C-03
**Effort**: Low (fix the column reference)

---

## MED-07: `bookings.member_id` FK Join Hint May Reference Wrong Parent Table

API query uses `profiles!bookings_member_id_fkey` but the FK may point to `members.id`, not `profiles.id`. Could cause booking list to display with null member names.
**Source**: data-model C-003
**Effort**: Low (verify FK in Supabase and fix join hint)

---

## MED-08: `memberships` Table Join in Member Detail Route -- Likely Non-Existent Table

`/api/members/[id]` selects `memberships(id, type, status, started_at, expires_at)` but no DDL, type, or seed data for a `memberships` table exists.
**Source**: data-model H-004
**Effort**: Low (verify table existence; replace with actual member/membership_plan fields)

---

## MED-09: `lib/anthropic.ts` at 1,699 Lines Needs Decomposition

11 distinct AI features in one file. A purpose-built `lib/ai/` directory exists for exactly this purpose.
**Sources**: project-structure HIGH-005, ai-layer H-04
**Effort**: Medium (refactoring with no behavior change)

---

## MED-10: Campaign Send Route Uses Hardcoded Studio ID

`/api/campaigns/send` hardcodes the studio ID. Mass emails to real members via Resend would query/write to the test studio for any non-default tenant.
**Source**: integration I-M6
**Effort**: Low

---

## MED-11: Stripe `studio_id` Metadata Key Name Mismatch

`lib/stripe.ts` writes `studio_id` in metadata. Webhook handler reads `meridian_studio_id`. Fallback lookup always invoked.
**Source**: integration I-M2
**Effort**: Low

---

## MED-12: No Exponential Backoff on Anthropic 429/529 Errors

All AI modules catch errors and immediately fall back to rules-based output. Transient 429s (which resolve in 1-2 seconds) consistently produce lower-quality output when a brief retry would succeed.
**Source**: ai-layer M-01
**Effort**: Low

---

## MED-13: NL Search Executes AI-Generated SQL Without Enforced LIMIT

Prompt instructs Claude to limit to 50 rows, but no code-level enforcement. A query returning thousands of rows could exhaust serverless memory.
**Sources**: ai-layer M-03, security SEC-C3 (related)
**Effort**: Low

---

## MED-14: `fadeInUp` Animation Variant Duplicated 55 Times

Same Framer Motion animation object defined in 55 page files instead of shared from a `lib/motion.ts` module.
**Sources**: ui-ux M-1, C-3 (mega-pages)
**Effort**: Low

---

## MED-15: No Form State Management -- Inconsistent Validation

Forms use three different patterns (uncontrolled FormData, controlled state, onClick). Zod installed but not used for form validation. Error messages not associated with inputs via `aria-describedby`.
**Source**: ui-ux M-2
**Effort**: Medium

---

## MED-16: Employee Portal Layout Not Mobile-Responsive

Sidebar occupies 72px on all viewports with no mobile drawer or collapse. Employee portal designed for field use (clock in/out on phones) but has no mobile accommodation.
**Source**: ui-ux M-3
**Effort**: Medium

---

## MED-17: Hardcoded `thesaunaguys.com` URLs in Email Templates

Unsubscribe links, booking CTAs, and privacy policy links in the shared email layout all point to `https://thesaunaguys.com/`. Other studios would send emails with wrong links.
**Source**: integration I-L4
**Effort**: Low

---

## MED-18: Hardcoded Glofox Namespace `'thesaunaguys'` in Sync Functions

All three Glofox sync functions hardcode the namespace string. Multi-tenant Glofox sync impossible.
**Source**: integration I-M1
**Effort**: Low

---

## MED-19: EasyPost `from_address` Uses Placeholder Data (`123 Main St`)

Shipping rate requests use a placeholder address. Live EasyPost API calls will produce inaccurate rates.
**Source**: integration I-M7
**Effort**: Low

---

## MED-20: Duplicate GDPR Deletion Functions with Conflicting Behavior

Two Postgres functions for Phase 2 member deletion: one sets `author_id = NULL`, other sets to placeholder UUID that likely violates FK constraint.
**Sources**: data-model M-001, M-007
**Effort**: Low

---

## MED-21: Chainable Mock Duplication in 14 Test Files

Every unit test file defines its own `createChainableMock()`. A shared helper exists but is ignored by 13 of 14 files.
**Source**: testing-quality M1
**Effort**: Low

---

## MED-22: 14 Admin Pages Exceed 700 Lines (Largest: 1,562)

Business logic, types, utilities, and sub-components all coexist in single files. Prevents component testing and increases refactoring risk.
**Sources**: ui-ux C-3
**Effort**: High (systematic extraction)

---

## MED-23: Keyboard Shortcuts Displayed But Not Implemented

Sidebar shows Cmd+1 through Cmd+0 shortcuts. Only Cmd+K is wired. Shortcut numbers inconsistent between sidebar and command palette.
**Source**: ui-ux H-2
**Effort**: Low

---

## MED-24: Auth Context Uses `getSession()` Instead of `getUser()`

Client-side auth context reads from local storage without server revalidation. Revoked tokens continue to show user as authenticated.
**Source**: security SEC-H5
**Effort**: Low

---

## MED-25: Unsubscribe HMAC Token Has No Expiration Check

Once issued, unsubscribe links are valid forever. No rotation path for the signing secret.
**Source**: security SEC-H7
**Effort**: Low

---

## MED-26: No Coverage Thresholds Enforced in CI

Vitest coverage configured but no thresholds block. `npm test` in CI does not generate coverage. Coverage can drop to 0% without CI failure.
**Source**: testing-quality H1
**Effort**: Low

---

## MED-27: Integration and E2E Tests Cannot Run in CI

Integration tests require live Supabase credentials not present in CI. E2E tests require browser installation not in the workflow. Both suites are manual-run only.
**Sources**: testing-quality H2, performance-infra PERF-09
**Effort**: Medium

---

## MED-28: Engagement Page Leaderboard Shows 0 for All Streaks and Referrals

`currentStreak: 0` and `referrals: 0` are hardcoded with comments noting they are "not tracked." Achievements and Challenges tabs are fully static placeholder data.
**Sources**: user-flow UF-H-5, UF-M-7
**Effort**: Medium (requires new data tracking or removing misleading displays)

---

## MED-29: Notification Bell is Non-Functional

Header bell icon has no click handler, no state, no dropdown. Purely decorative with a hardcoded orange dot.
**Source**: ui-ux M-5
**Effort**: Low (implement or remove)

---

## MED-30: `transpilePackages` Missing for Workspace Packages in Next.js Config

Monorepo packages not listed in `transpilePackages`. Works incidentally but fragile.
**Source**: performance-infra PERF-08
**Effort**: Low
