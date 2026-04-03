# Low and Informational Findings

Generated: 2026-04-02
Deduplicated from 10 layer audit reports.

---

## LOW Findings

### LOW-01: No Structured Logging or Error Tracking
All logging is `console.error`/`console.log`. No Sentry, Datadog, or pino. Netlify function logs are ephemeral with no alerting.
**Sources**: performance-infra PERF-19/PERF-21, integration I-L7

### LOW-02: No Health Check Endpoint
No `/api/health` endpoint for monitoring tools to verify application liveness.
**Sources**: performance-infra PERF-20, integration I-L6

### LOW-03: No Dependency Vulnerability Scanning in CI
No `npm audit`, no Dependabot, no Snyk. Handlebars ^4.7.8 noted for historical CVEs.
**Source**: security SEC-L1

### LOW-04: Raw Database Error Messages Returned to API Clients
Multiple routes return `error.message` from Supabase, leaking table/column/constraint names.
**Source**: security SEC-L3

### LOW-05: Phone Numbers Stored in Inconsistent Formats
Seed data includes mixed formats: `'9739432222'`, `'850-591-0208'`. No normalization at API layer.
**Source**: data-model L-001

### LOW-06: Duplicate Tailwind Animation Libraries
Both `tw-animate-css` and `tailwindcss-animate` installed. Only `tw-animate-css` is used.
**Sources**: project-structure MED-004, performance-infra PERF-23

### LOW-07: TanStack Query Installed But Not Used
`@tanstack/react-query ^5.72.0` in dependencies with zero usage. Manual polling via `setInterval` throughout.
**Source**: performance-infra PERF-14

### LOW-08: Duplicate ReactFlow Packages
Both `reactflow` (monolith) and `@reactflow/*` sub-packages installed. Only the monolith is imported.
**Source**: project-structure MED-003

### LOW-09: `shadcn` CLI in Runtime Dependencies
Code-generation CLI tool listed under `dependencies` instead of `devDependencies`.
**Source**: project-structure MED-005

### LOW-10: Seven Empty Orphaned Directories in Employee Route Group
Leftover scaffolding from route restructuring. No page.tsx files; would serve 404 if accessed directly.
**Sources**: project-structure MED-006, user-flow (orphaned pages section)

### LOW-11: `use-command-center-data.ts` Placed in `app/` Instead of `hooks/`
Breaks the project's own convention. 399-line file with business logic, types, and formatting utilities.
**Source**: project-structure MED-007

### LOW-12: Login Page Uses Hardcoded Hex Instead of CSS Variables
`bg-[#4F46E5]`, `text-[#4F46E5]`, `focus:ring-[#4F46E5]` instead of semantic token classes.
**Source**: ui-ux L-1

### LOW-13: 27 Routes Use `SELECT *`
Over-selecting wastes bandwidth and prevents index-only scans.
**Source**: performance-infra PERF-12

### LOW-14: HTTP Cache Headers on Only 4 of 148 API Routes
Only analytics endpoints set `Cache-Control`. All other routes re-fetched on every poll with no CDN acceleration.
**Source**: performance-infra PERF-11

### LOW-15: `turbo.json` Forces Type-Check Before Every Build
Creates a sequential chain that blocks parallel execution. Type-check already runs as separate CI step.
**Source**: performance-infra PERF-10

### LOW-16: Build Cache Not Shared Between CI Jobs
No `.next/cache` persistence between workflow runs. Every build starts from scratch.
**Source**: performance-infra PERF-24

### LOW-17: Cron Secret Header Format Inconsistency
Some cron routes use `x-cron-secret`, one uses `Authorization: Bearer`. Same variable, different header.
**Sources**: api-surface M-3, security SEC-M7

### LOW-18: `GET /api/cron/waitlist-promote` Is a GET with Side Effects
Violates REST semantics. CDNs and browsers may cache or prefetch GET responses.
**Source**: api-surface L-5

### LOW-19: Geofence Verification is Entirely Simulated
`navigator.geolocation.getCurrentPosition()` never called. Distance always reads 0m. Any employee can clock in from anywhere.
**Source**: user-flow UF-L-5

### LOW-20: Promo Page QR Code is a Placeholder
QR code package installed and API route exists, but promo page never calls it. Shows a static icon instead.
**Source**: user-flow UF-L-6

### LOW-21: No `viewport` Export in Root Layout
Next.js App Router convention; default viewport tag injected but explicit control recommended for mobile employee portal.
**Source**: ui-ux L-5

### LOW-22: Settings Sub-Pages Not Linked from Settings Page
`/settings/sms` and `/settings/geofence` only accessible via direct URL.
**Source**: user-flow UF-M-2

### LOW-23: Trainer Link in Analytics Report Points to Wrong Page
Links to `/members/{trainerId}` instead of `/analytics/trainers/{trainerId}`.
**Source**: user-flow UF-M-3

### LOW-24: Lead Conversion Missing Membership Assignment Step
New member created with no plan assigned. Shows as "at-risk" immediately.
**Source**: user-flow UF-M-4

### LOW-25: Resend `sendBatchEmails` Aborts Entire Batch on First Chunk Error
Chunks 3+ abandoned with no retry. No record of skipped members.
**Source**: integration I-L2

### LOW-26: `@base-ui/react` Dependency Listed But Not Imported
Leftover evaluation dependency.
**Source**: project-structure LOW-005

### LOW-27: Stripe `payment_method_types` Hardcoded to `['card']`
Apple Pay and Google Pay will not appear at checkout despite being documented features.
**Source**: integration (missing integrations table)

### LOW-28: `SCHEMA_CONTEXT` References `leads` Table Without Defining Its Columns
AI search queries against `leads` will produce hallucinated or failing SQL.
**Source**: ai-layer M-04

---

## INFORMATIONAL Findings

### INFO-01: Booking Capacity Enforced at DB Level via Trigger
`audit-fixes-migration.sql` adds `enforce_booking_capacity` trigger. Race conditions in check-then-insert patterns are properly prevented.
**Source**: data-model

### INFO-02: All 19 AI Features Have Rules-Based Fallbacks
Every Claude call has a complete fallback path. AI unavailability degrades quality but never breaks functionality.
**Source**: ai-layer

### INFO-03: Stripe and Resend Webhook Verification is Always Enforced
Unlike EasyPost/Twilio, the Stripe and Resend handlers never skip signature verification.
**Sources**: api-surface, integration, security

### INFO-04: Inngest Background Job Architecture is Well-Designed
19 functions with retry configuration, step isolation, and proper error handling via onFailure hooks.
**Sources**: project-structure, integration

### INFO-05: Test Infrastructure Quality is High Where Tests Exist
Booking tests (15 scenarios), rate limiter tests (boundary conditions), and require-role tests (12 cases) are production-quality.
**Source**: testing-quality

### INFO-06: Phase 2 Database Indexes Are Properly Defined
`phase2-migration.sql` creates composite indexes on all high-frequency query patterns.
**Source**: data-model

### INFO-07: SSE Streaming Used for Campaign Send Progress
Campaign send route uses `ReadableStream` with Server-Sent Events rather than blocking HTTP.
**Source**: performance-infra

### INFO-08: Incremental TypeScript Compilation Enabled
`"incremental": true` in tsconfig speeds up repeated type-check runs.
**Source**: performance-infra
