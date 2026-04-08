# High Findings

**Date:** 2026-04-08

---

## HIGH-1: Missing Index on bookings(class_id, studio_id, status)
**Source:** data-model, performance-infra | Corroborated: CR-003

Every booking creation triggers `SELECT COUNT(*) FROM bookings WHERE class_id = ? AND studio_id = ? AND status IN (...)`. Without a composite index, this is a full table scan. As bookings grow to tens of thousands, this query degrades to 100ms+, directly impacting booking response time.

**Fix:** `CREATE INDEX idx_bookings_class_status ON bookings(class_id, studio_id, status);`

---

## HIGH-2: No Database Migration Runner
**Source:** performance-infra, data-model, project-structure | Corroborated: CR-005

SQL migration files in `scripts/` are applied manually with no runner, no migration history table, and no ordering guarantee. `audit-fixes-migration.sql` must run after `phase2-migration.sql` but this is enforced only by documentation.

**Fix:** Adopt a migration runner (Supabase CLI migrations or Flyway) with a `schema_migrations` table. Convert all SQL files to numbered migrations (e.g., `001_phase2_tables.sql`, `002_audit_fixes.sql`).

---

## HIGH-3: No Automated Type Generation from Database Schema
**Source:** data-model

TypeScript types in `packages/types/src/` are hand-maintained and can drift from the live Supabase schema. A column rename, type change, or missing field in production won't be caught until runtime.

**Fix:** Add `supabase gen types typescript --project-id YOUR_PROJECT > packages/types/src/database.types.ts` to CI. Use generated types as the source of truth and re-export domain-specific types built on top of them.

---

## HIGH-4: execute-flow Automation Function Has No Unit Tests
**Source:** testing-quality, user-flow | Corroborated: CR-007

The `execute-flow.ts` Inngest function processes all automation step executions: email sends, waits, conditional branching, and field updates. It's the highest-complexity background function with the most user-visible impact and has zero unit tests.

**Fix:** Write unit tests covering: (1) email step execution, (2) wait step handling, (3) condition branching (true/false), (4) enrollment completion, (5) error handling and retry.

---

## HIGH-5: Inconsistent API Auth Patterns — Corporate/Invoice Routes
**Source:** api-surface, security | Corroborated: CR-004

Corporate and Invoice routes use inline manual auth instead of `requireRole()`, which means they don't benefit from centralized improvements (role aliases, studio_id resolution) and create maintenance divergence. Additionally, some corporate routes may not consistently apply `profile.studio_id` filtering.

**Fix:** Migrate all inline auth routes to use `requireRole()`. Audit each corporate/invoice route to verify `studio_id` is always sourced from `profile.studio_id`, not `DEFAULT_STUDIO_ID`.

---

## HIGH-6: Rate Limiting Only on AI + SMS — Missing on Expensive Operations
**Source:** api-surface, integration | Corroborated: CR-008

Campaign send, report generation, payroll calculation, and AI insight generation have no rate limiting. An authenticated user can trigger CPU/memory-intensive operations in rapid succession, potentially degrading the service for all users.

**Fix:** Add `rateLimit()` calls to: `/api/campaigns/send` (3/min), `/api/reports/[id]/generate` (5/min), `/api/payroll/periods/[id]/calculate` (10/min), and `/api/ai/insights/generate` (10/min). Verify the rate-limit RPC exists in the database.

---

## HIGH-7: No Observability / Error Tracking in Production
**Source:** ai-layer, integration, performance-infra | Corroborated: CR-006

All production errors rely on `console.error`. Netlify function logs are not searchable, aggregatable, or alertable. Silent AI fallbacks, database errors, and external API failures go undetected until a user reports a problem.

**Fix:** Add Sentry (or equivalent) with: (1) `Sentry.captureException` for all AI fallbacks, (2) integration-level error capture for Stripe/Resend/Glofox failures, (3) custom alerts for `status=failed` automation enrollments.

---

## HIGH-8: Glofox Sync Needs to Move to Inngest
**Source:** performance-infra, integration | Corroborated: partial CR-003

Glofox sync runs as an HTTP endpoint with a 60-second Netlify function timeout. NDJSON streaming is used to work around the timeout. As the Glofox dataset grows, even streaming won't prevent timeout failures. Additionally, there's no circuit breaker to prevent repeated failures when Glofox is down.

**Fix:** Move Glofox sync logic to an Inngest function with Inngest's built-in cron scheduling. Inngest functions have no timeout limits and have built-in retry, backoff, and failure handling.

---

## HIGH-9: Next.js 16.2.0 Version Risk
**Source:** project-structure

Next.js 16.2.0 is a very recent version; the AGENTS.md explicitly warns "APIs, conventions, and file structure may all differ from training data." If this is a pre-release or RC build, there may be undocumented breaking changes or instability.

**Fix:** Verify `16.2.0` is a stable release (not RC/canary). Monitor the Next.js changelog for breaking changes affecting the app's patterns.

---

## HIGH-10: EasyPost Webhook Has No Verified Signature Check
**Source:** integration, security

The `/api/webhooks/easypost` endpoint processes shipping events without confirmed webhook signature verification. An attacker could POST fake shipping events to mark unshipped orders as delivered.

**Fix:** Implement EasyPost webhook signature verification using their HMAC signature scheme before the shipping feature is activated.

