# Performance & Infrastructure Audit Report

**Agent**: performance-infra
**Model**: claude-sonnet-4-6
**Timestamp**: 2026-04-02T00:00:00Z

---

## Scope

- **Files examined**: `next.config.ts`, `turbo.json`, `netlify.toml`, `package.json` (root + apps/web), `.github/workflows/ci.yml`, `playwright.config.ts`, `vitest.integration.config.ts`, all 148 API route files, 13 Inngest function files, all 13 hooks, `lib/rate-limit.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/auth/require-role.ts`, `lib/inngest/helpers.ts`, `scripts/phase2-migration.sql`, `scripts/audit-fixes-migration.sql`
- **Focus areas**: Build config, caching, DB query patterns, CI/CD pipeline, serverless behavior, polling, asset optimization, observability

---

## Executive Summary

Meridian is a rapidly maturing platform with solid bones: TypeScript strict mode, SWC compilation, Inngest for background jobs, DB-level AI caching, and a working CI pipeline. However, the architecture carries several performance debts that will become painful at production load. The three most urgent issues are: (1) confirmed N+1 query patterns in two frequently-called routes that issue 3+ queries per trainer in a loop; (2) an in-memory rate limiter that provides zero protection on Netlify's serverless functions; and (3) a Node version mismatch between CI (22) and Netlify (20) that will silently produce divergent build artifacts. There is also a systemic pattern of all 63 admin pages and 9 employee pages being marked `'use client'` with no React Server Component utilization, meaning the entire application payload is sent as client JavaScript rather than pre-rendered HTML — this directly inflates cold-start latency and first-paint times for what is predominantly static UI chrome.

---

## Findings by Severity

---

### CRITICAL

#### PERF-01: In-Memory Rate Limiter is Non-Functional in Serverless

**File**: `apps/web/src/lib/rate-limit.ts`

The rate limiter uses a module-level `Map` and a module-level `lastCleanup` timestamp. On Netlify, each function invocation runs in an isolated execution context. Two back-to-back requests from the same user will hit different instances; neither will have the other's state. The `rateLimitMap` is reset to empty on every cold start.

This means all 13 AI endpoints (briefing, health-score, churn-prediction, campaign-copy, etc.) that rely on `rateLimit()` have no effective protection against runaway Claude API calls. A single user can make unlimited requests to `/api/ai/churn-prediction` — which queries 10+ Supabase tables and calls Anthropic — burning unbounded API credits.

**Evidence**: The file's own comment acknowledges this: `"Suitable for single-instance deployments. For multi-instance / serverless, replace with a Redis-backed implementation."`

**Fix**: Replace with a Supabase-backed rate limit table (`rate_limits (key, count, reset_at)`) using a single `upsert` + conditional check, or add Upstash Redis. The Supabase approach requires no new infrastructure.

---

#### PERF-02: N+1 Query Pattern — Trainer Performance Route

**Files**: `apps/web/src/app/api/trainers/performance/route.ts` (lines 102–188), `apps/web/src/app/api/trainers/leaderboard/route.ts` (lines 108–139)

`GET /api/trainers/performance` fetches all trainers in one query, then loops over them issuing **3 sequential Supabase calls per trainer**: one for classes in the period, one for revenue attributed, one for the latest snapshot. With 3 trainers this is 10 queries; with 10 trainers it is 31 queries. This is a textbook N+1.

`GET /api/trainers/leaderboard` has the same pattern in its RPC fallback path: it fetches trainers, then loops issuing one classes query per trainer.

```typescript
// trainers/performance/route.ts — executed inside for (const trainer of trainers)
const { data: classes } = await supabase.from("classes").select(...)...
const { data: revenueData } = await supabase.from("transactions").select(...)...
const { data: snapshot } = await supabase.from("trainer_metric_snapshots").select(...)...
```

**Fix**: Use a single SQL join or RPC. The `get_trainer_leaderboard` RPC already exists — wire `trainers/performance` to use the same or an equivalent RPC. Alternatively, do three bulk queries (all classes for all trainers for the period, all revenue, all snapshots) and join in application code using a Map, which is what `cron-trainer-metrics.ts` correctly does.

---

#### PERF-03: N+1 Pattern in Inngest Trainer Metrics Cron

**File**: `apps/web/src/lib/inngest/functions/cron-trainer-metrics.ts` (lines 118–130)

The monthly trainer metrics job correctly loads all trainers and all classes in two bulk queries. However, it then iterates over every class for every trainer and issues **one `bookings` count query per class** to exclude the trainer's own attendance:

```typescript
for (const cls of trainerClasses) {
  const { count } = await db
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', cls.id)
    .neq('member_id', trainer.profile_id);
```

For a studio with 3 trainers each teaching 20 classes per month, this is 60 sequential DB queries just for this step. The Inngest `step.run` wrapper serializes each iteration, making this the slowest step in the chain.

**Fix**: Issue one bulk query — all bookings for all trainer class IDs with `NOT IN (trainer_profile_ids)` — and aggregate in-memory. The `classes.checked_in_count` column already exists on the `classes` table and could be used directly if the trainer exclusion logic is applied as a DB trigger at check-in time instead.

---

#### PERF-04: Node Version Mismatch — CI vs Netlify

**Files**: `package.json` (`"engines": {"node": ">=22.0.0"}`), `netlify.toml` (`NODE_VERSION = "20"`)

CI uses Node 22 (`.github/workflows/ci.yml` line 26: `node-version: 22`). Netlify builds using Node 20. This means:

- The build passes CI on Node 22 and deploys to Netlify on Node 20.
- Any syntax or API that exists in Node 22 but not 20 will silently fail in production builds (Node 20 is LTS but pre-dates several `--experimental-require-module` stabilizations and `crypto.getRandomValues()` behavior differences used by Next.js 16).
- The `package.json` engines field exists precisely to prevent this, but Netlify ignores it.
- `@types/node` in `apps/web/package.json` is `^20` while the engine requirement is `>=22`, adding a third inconsistent version.

**Fix**: Set `NODE_VERSION = "22"` in `netlify.toml`. Update `@types/node` to `^22`.

---

### HIGH

#### PERF-05: Unbounded Transaction Query — Revenue Endpoint

**File**: `apps/web/src/app/api/revenue/route.ts` (line 71–77)

The revenue API fetches all completed transactions in a time period with no row limit:

```typescript
const { data: transactions, error } = await supabase
  .from("transactions")
  .select("id, amount, type, created_at")
  .eq("studio_id", studioId)
  .eq("status", "completed")
  .gte("created_at", startDate.toISOString())
  // no .limit() — returns all rows in the period
```

For `period=12m` at a busy studio this could return thousands of rows, loaded entirely into memory in the serverless function, then iterated multiple times for aggregation. The aggregation (by type, by day/month) should be done in Postgres.

**Fix**: Replace with a `GROUP BY type, date_trunc(...)` SQL aggregate via Supabase RPC, or use Postgres window functions. The existing `daily_metrics` table is already designed for this — the revenue breakdown endpoint should query it instead of raw transactions.

---

#### PERF-06: Sequential Waitlist-Promote Cron Issues Multiple Queries Per Entry

**File**: `apps/web/src/app/api/cron/waitlist-promote/route.ts` (lines 112–245)

The waitlist promotion job runs correctly at a structural level, but for each waitlist entry it issues: (1) a duplicate booking check, (2) a booking insert, (3) a waitlist update, (4) an activity log insert — all as sequential individual awaits. For N classes with M waitlist entries, this is O(N × M × 4) round trips. The cron also has no CRON_SECRET validation header documented in `netlify.toml`, meaning it can be called unauthenticated — the implementation checks `x-cron-secret` but Netlify's scheduled functions don't send this header by default.

**Fix**: The booking+waitlist-update should be wrapped in a Postgres transaction via RPC to reduce round trips and ensure atomicity (the current trigger in `audit-fixes-migration.sql` covers capacity enforcement but not the waitlist promotion update). Document the cron secret setup in `netlify.toml`.

---

#### PERF-07: All Pages Are `'use client'` — Zero RSC Utilization

**Files**: All files under `apps/web/src/app/(admin)/` and `apps/web/src/app/(employee)/`

Every page in the application (63 admin, 9 employee) is marked `'use client'`. Even the root `layout.tsx` for the admin group is `'use client'`, which forces the entire subtree to hydrate on the client. The `use-command-center-data.ts` hook is `'use client'` and lives inside the `app/` directory.

In Next.js App Router, pages default to Server Components. Converting even static UI shells (sidebars, headers, breadcrumbs) to RSC would eliminate their JavaScript from the client bundle and reduce time-to-interactive. The `Sidebar`, `Header`, and `CommandPalette` components are prime candidates since they contain no client-only APIs.

This has two direct performance consequences: larger initial JavaScript payload, and no pre-rendered HTML skeleton for the admin shell — users see nothing until JS loads and runs.

**Fix**: Audit each page component and identify the minimal set that require client state. Mark only those `'use client'`. The admin layout's `useState(false)` for sidebar toggle is the only client-side state in `layout.tsx` — this can be extracted into a `SidebarToggle` client component while keeping the layout itself as a Server Component.

---

#### PERF-08: `transpilePackages` Missing for Workspace Packages

**File**: `apps/web/next.config.ts`

The monorepo has three workspace packages (`@meridian/types`, `@meridian/utils`, `@meridian/supabase`). None are listed in `transpilePackages` in `next.config.ts`. This can cause runtime errors if any workspace package ships TypeScript or ESM-only code, since Next.js's SWC pipeline won't process it by default. The current behavior may work incidentally because the packages are consumed as raw TypeScript source, but it is fragile and can break with any bundler optimization pass.

```typescript
// next.config.ts — missing:
transpilePackages: ['@meridian/types', '@meridian/utils', '@meridian/supabase'],
```

---

#### PERF-09: Playwright E2E Tests Not in CI Pipeline

**File**: `.github/workflows/ci.yml`

The CI workflow runs `npm test` (which executes `vitest run` — unit tests only). The `test:e2e` script and the `test:all` script that includes E2E are not invoked. The Playwright config (`playwright.config.ts`) runs with `workers: 1` (fully serial) and targets `localhost:3000`. E2E tests are only run manually.

There is also no Playwright browser installation step in the CI workflow (it would need `npx playwright install --with-deps chromium`), meaning even adding the E2E step without this would fail immediately.

---

#### PERF-10: `turbo.json` Forces type-check Before Every Build

**File**: `turbo.json`

```json
"build": {
  "dependsOn": ["^build", "type-check"],
```

Every build task depends on `type-check` completing first. On CI this means the type-check runs, then the build runs — two passes of the TypeScript compiler. Since `tsc --noEmit` does not produce any output artifacts, Turborepo cannot cache it effectively across runs. The `type-check` task has `"dependsOn": ["^build"]`, which means it also waits for workspace package builds. This creates a sequential chain that blocks parallel execution.

**Fix**: Separate the `type-check` into an independent CI step (which already exists) and remove it from `build.dependsOn`. The CI job already runs them sequentially.

---

### MEDIUM

#### PERF-11: HTTP Cache Headers Only on 4 of 148+ API Routes

Of all API routes examined, only 4 set meaningful `Cache-Control` headers:
- `/api/analytics/heatmap` — `s-maxage=60, stale-while-revalidate=300`
- `/api/analytics/cohorts` — `s-maxage=3600, stale-while-revalidate=300`
- `/api/analytics/revenue-breakdown` — `s-maxage=300, stale-while-revalidate=300`
- `/api/analytics/summary` — `s-maxage=60, stale-while-revalidate=300`

Routes like `/api/classes`, `/api/members`, `/api/trainers/leaderboard`, `/api/revenue`, and the 13 AI endpoints (which have their own DB-level cache) return no cache headers and will be re-fetched on every poll cycle with no CDN acceleration.

The `netlify.toml` security headers block has no cache directives for static assets (e.g., `/_next/static/*`), though the `@netlify/plugin-nextjs` should handle this automatically.

---

#### PERF-12: 27 Routes Use `SELECT *`

**Files**: Found via grep across API routes and hooks

27 uses of `.select("*")` were found across API routes and Inngest functions. Notable cases:
- `apps/web/src/app/api/analytics/cohorts/route.ts` — `cohort_snapshots.select("*")`
- `apps/web/src/app/api/check-in/qr/route.ts` — wide select on a hot path
- `apps/web/src/app/api/campaigns/process-scheduled/route.ts` — `campaigns.select("*")` before sending
- `apps/web/src/lib/inngest/helpers.ts` — `select('*', { count: 'exact' })` in exit condition checks (this is a count-only query, so SELECT * is harmless but still worth noting)

Over-selecting wastes bandwidth from Supabase to the function, inflates serverless function memory, and prevents Postgres from using index-only scans.

---

#### PERF-13: Revenue Route Duplicates Auth Pattern Without `requireRole`

**File**: `apps/web/src/app/api/revenue/route.ts`

This route manually calls `supabase.auth.getUser()`, queries `profiles` for `studio_id` and `roles`, and performs a role check — the same 2-query sequence that `requireRole()` already encapsulates. The pattern is duplicated in at least 4 routes: `/api/revenue`, `/api/transactions`, `/api/trainers/performance`, `/api/trainers/leaderboard`. Each of these performs an extra `profiles` query that is already done inside `requireRole`, meaning callers of `requireRole` make one auth round trip while these manual routes make two.

---

#### PERF-14: TanStack Query Installed but Not Used

**File**: `apps/web/package.json` — `@tanstack/react-query: ^5.72.0`

TanStack Query is listed as a dependency but no usage was found across the entire codebase. The polling strategy is implemented manually via `setInterval` + `useCallback` in individual hooks and pages. TanStack Query provides automatic deduplication, stale-while-revalidate semantics, request cancellation, background refetching, and a devtools panel — all of which are currently missing from the manual polling implementation.

The current polling approach has a subtle bug risk: if two components independently mount the same data hook (e.g., `useCommandCenterData` on the admin layout and in a sub-page), they both start 60-second intervals that issue redundant parallel requests.

---

#### PERF-15: No `maxDuration` Export on Long-Running AI Routes

**Files**: All `apps/web/src/app/api/ai/*/route.ts`

None of the AI route handlers export `export const maxDuration`. On Netlify Functions (not Edge), the default timeout is 10 seconds. Claude Sonnet responses (especially for `churn-prediction` and `health-score` which make 10+ DB queries before calling the model) can easily exceed this. There is no evidence of timeout handling in the route handlers either — if the Anthropic SDK call times out, the serverless function will terminate mid-response with a 504 that is not caught by the `catch` block.

The `GET /api/ai/health-score` batch endpoint (BATCH_LIMIT=50, sequential) is especially risky: 50 members × (10 DB queries + 1 Claude call) is well over any reasonable serverless timeout.

---

#### PERF-16: Sequential Worker Count in Playwright (workers: 1)

**File**: `apps/web/playwright.config.ts`

```typescript
workers: 1,
fullyParallel: false,
```

All E2E tests run in a single worker. The `admin` and `employee` project suites could run in parallel after `auth-setup` since they use separate auth state files. At `workers: 1`, the total E2E runtime is the sum of all tests rather than the maximum.

---

#### PERF-17: Command Center Makes Sequential Class + Attendee Query

**File**: `apps/web/src/app/(admin)/use-command-center-data.ts` (lines 197–222)

The Command Center hook runs 7 queries in `Promise.allSettled`, which is correct. However, after the parallel phase resolves, it issues an additional sequential Supabase query to fetch attendees for today's classes, using the class IDs obtained from the first query. This creates a waterfall: 7 parallel → 1 serial. The attendee query could be moved into the parallel batch (filtering by today's date range) if the class IDs are not needed to scope it, or eliminated by including bookings in the initial classes query via a join.

---

### LOW

#### PERF-18: `@types/node` Version Mismatch with Engine Requirement

**File**: `apps/web/package.json`

`@types/node: ^20` while `engines.node: ">=22.0.0"` (root `package.json`). TypeScript may infer Node 20 API availability and miss Node 22-specific APIs or incorrectly type Node 22 behavior changes.

---

#### PERF-19: No Structured Logging

No structured logging library (pino, winston, etc.) is used. All logging is `console.error(...)` and `console.log(...)` in catch blocks. On Netlify, these appear as plain text in function logs with no severity field, request ID, or trace context. Correlation across function invocations (e.g., tracing a single AI health-score batch job through 50 member iterations) requires manually parsing log text.

---

#### PERF-20: No Health Check Endpoint

There is no `/api/health` or `/api/status` route. Netlify does not require one, but monitoring tools (Uptime Robot, Better Uptime, Datadog Synthetics) use health check endpoints to verify application liveness without triggering business logic. The closest equivalent is `/api/glofox/status`, which is domain-specific.

---

#### PERF-21: No Error Tracking Integration

No Sentry, Datadog APM, or equivalent error tracking package is installed. Production errors surface only in Netlify function logs, which have limited retention and no alerting. The existing `console.error` calls in catch blocks will produce unstructured text that is difficult to aggregate.

---

#### PERF-22: `next/image` Not Used for Any Images

No usage of `next/image` was found in the codebase. Avatar URLs from Supabase (e.g., `avatar_url` from profiles) are referenced in the data layer but do not appear to be rendered with Next.js Image Optimization, which would provide automatic WebP conversion, lazy loading, and size hints. `next.config.ts` does configure `remotePatterns` for `*.supabase.co`, indicating intent but no actual `<Image>` component usage was found in rendered pages.

---

#### PERF-23: Dual Tailwind Animation Libraries

**File**: `apps/web/package.json`

Both `tw-animate-css` (`^1.4.0`) and `tailwindcss-animate` (`^1.0.7`) are installed. These serve overlapping purposes (CSS animation utilities for Tailwind). Both ship CSS that gets bundled into the output. One should be removed.

---

#### PERF-24: Build Cache Not Shared Between CI Jobs

**File**: `.github/workflows/ci.yml`

The workflow has two jobs: `lint-typecheck-test` and `build`. Both jobs run `npm ci` independently and neither caches the `.next/cache` directory between runs. The `next build` in the `build` job starts without any Turborepo remote cache, so every build on `main` starts from scratch. The `cache: npm` on `setup-node` only caches `node_modules`, not the Next.js compilation cache.

**Fix**: Add `actions/cache` for `.next/cache` in the build job, keyed on the branch and `package-lock.json` hash.

---

#### PERF-25: Glofox Sync Button Polls Every 15 Seconds

**File**: `apps/web/src/components/glofox/DataSyncButton.tsx` (line 101)

```typescript
const interval = setInterval(fetchStatus, 15_000);
```

The sync status button polls every 15 seconds while active. During a Glofox backfill (which can process thousands of records), this generates continuous traffic to `/api/glofox/status`. This should use Supabase Realtime subscription on the `glofox_sync_jobs` table instead, with a fallback to 30-second polling.

---

## Positive Findings

The following infrastructure decisions are well-implemented and worth preserving:

- **AI result caching in Supabase** (`ai_cache` table with TTL): The health-score and briefing routes correctly check the DB cache before calling Claude. Cache TTLs (24h for health scores, 30min for briefings) are appropriate.
- **Inngest for background jobs**: All long-running jobs (daily metrics, trainer metrics, cohort refresh, Glofox sync) are correctly moved off the HTTP request path into Inngest with retry configuration and concurrency limits.
- **TypeScript strict mode**: `"strict": true` in `tsconfig.json` is active and catches real bugs.
- **Incremental TypeScript compilation**: `"incremental": true` in `tsconfig.json` speeds up repeated type-check runs.
- **Booking capacity DB trigger**: `audit-fixes-migration.sql` adds a Postgres trigger to enforce capacity at the DB level, preventing race conditions that a check-then-insert pattern would allow.
- **Supabase RPC usage for analytics**: Most analytics endpoints call `supabase.rpc()` with set-returning Postgres functions rather than pulling raw rows and aggregating in JavaScript.
- **Phase 2 indexes**: `phase2-migration.sql` creates composite indexes on all high-frequency query patterns (`studio_id + status`, `studio_id + score`, `campaign_id + status`).
- **Polling cleanup**: All `setInterval` calls correctly return `clearInterval` in their `useEffect` cleanup functions, preventing memory leaks on component unmount.
- **CI concurrency group**: The `concurrency.cancel-in-progress: true` setting correctly cancels in-progress CI runs when a new push arrives.
- **SSE streaming for campaign send**: The campaign send route uses a `ReadableStream` with SSE to stream progress to the client rather than holding the HTTP connection open synchronously.
- **`stale-while-revalidate` on analytics routes**: The 4 analytics routes that set cache headers use `stale-while-revalidate` correctly, allowing Netlify's CDN to serve stale data while refreshing in the background.

---

## Remediation Priority

| Priority | Finding | Effort | Impact |
|---|---|---|---|
| P0 | PERF-01: Rate limiter broken in serverless | Medium | Runaway AI costs |
| P0 | PERF-04: Node version mismatch CI vs Netlify | Low | Build divergence |
| P1 | PERF-02: N+1 in trainer performance route | Medium | Slow page loads |
| P1 | PERF-03: N+1 in trainer metrics cron | Medium | Slow monthly job |
| P1 | PERF-05: Unbounded transaction query | Low | Memory + latency |
| P1 | PERF-15: No maxDuration on AI routes | Low | Silent 504s |
| P2 | PERF-07: All pages are `use client` | High | Bundle size, TTFB |
| P2 | PERF-08: transpilePackages missing | Low | Runtime errors |
| P2 | PERF-09: E2E not in CI | Medium | Regression risk |
| P2 | PERF-14: TanStack Query unused | Low | Redundant dep |
| P3 | PERF-11: Cache headers on 4/148 routes | Medium | Bandwidth cost |
| P3 | PERF-12: SELECT * in 27 routes | Low | Over-fetching |
| P3 | PERF-19: No structured logging | Medium | Ops visibility |
| P3 | PERF-21: No error tracking | Medium | Production blind |
| P4 | PERF-18: @types/node version | Low | Type accuracy |
| P4 | PERF-23: Dual animation libraries | Low | Bundle bloat |
| P4 | PERF-24: Build cache not shared in CI | Low | Build speed |

---

## Infrastructure Diagram

See `/Users/zach/Desktop/literal-fishstick/.audit/diagrams/performance-infra.mmd`
