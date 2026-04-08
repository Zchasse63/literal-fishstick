# Layer Report: Performance & Infrastructure

**Agent:** performance-infra
**Date:** 2026-04-08
**Status:** Complete

---

## Executive Summary

Meridian's infrastructure is appropriately lean for a Phase 1+2 single-studio system hosted on Netlify with a Supabase backend. Key performance strengths: Turbo build caching, parallel query patterns in AI briefing, pagination on all list endpoints (max 100), and a 30-minute cache for AI briefings. Key weaknesses: no CDN-level or application-level caching for analytics queries, the Netlify function timeout is 60 seconds (a hard ceiling that several complex operations approach), and the NDJSON streaming pattern for Glofox sync is a workaround for the timeout limit rather than a proper solution. The CI/CD pipeline is solid: lint + typecheck + unit tests + build on every PR, with Next.js build caching.

---

## Build & Bundling

### Build System
- **Framework:** Next.js 16.2.0 via `@netlify/plugin-nextjs`
- **Turborepo:** Manages build pipeline; `"build": { "dependsOn": ["^build"] }` ensures packages build before apps
- **Transpilation:** `transpilePackages: ['@meridian/types']` in `next.config.ts` — correct for monorepo workspaces
- **External packages:** `serverExternalPackages: ['@react-pdf/renderer']` — prevents server-side bundle issues with PDF generation

### Bundle Observations
- No explicit bundle analysis configured (webpack-bundle-analyzer or similar)
- No code splitting configuration observed beyond Next.js defaults
- `framer-motion ^12.4.10` — large animation library (~120KB gzip) loaded on all admin pages
- `reactflow ^11.11.4` — large flow diagram library loaded for automation builder; no confirmed lazy loading
- `recharts ^2.15.4` — chart library; Next.js dynamic imports would help on non-chart pages
- `@react-pdf/renderer` — marked as external for server, but PDF generation is synchronous and memory-intensive
- `@anthropic-ai/sdk` — heavy SDK loaded server-side only (not included in client bundle) — correct

### Code Splitting
- Next.js App Router provides automatic route-level code splitting
- Client components are split per route boundary
- No observed use of `dynamic(() => import(...))` for heavy client components like ReactFlow or Recharts

---

## Caching Strategy

### Application-Level Caching
| Resource | Cache Strategy | TTL |
|----------|---------------|-----|
| AI briefing | Database (`ai_briefings` table) | 30 min |
| AI insights | Database (`ai_insights` table) | 7 days (fingerprint dedup) |
| Daily metrics | Database (`daily_metrics` table) | Daily cron refresh |
| Cohort snapshots | Database (`cohort_snapshots`) | Monthly cron refresh |
| Rate limit counters | Database (`rate_limit_entries`) | Window-based expiry |

**No HTTP caching** observed:
- Analytics API routes have no `Cache-Control` headers
- Admin dashboard data is fetched fresh on every page load
- No React Query, SWR, or similar client-side cache layer
- 60-second polling mentioned in CLAUDE.md but no polling implementation found — page data is only fetched on load/navigation

### CDN Caching
- Static assets served by Netlify CDN with default caching
- No `stale-while-revalidate` or `s-maxage` headers on API responses
- Next.js static generation (`generateStaticParams`) not used — all admin pages are server-side rendered

---

## Database Query Performance

### Confirmed Missing Indexes (from data-model layer)
- `bookings(class_id, studio_id, status)` — capacity checks unindexed
- `members(studio_id, membership_status)` — member directory filter unindexed
- `daily_metrics(studio_id, metric_date)` — analytics queries unindexed
- `activity_log(studio_id, created_at)` — activity feed unindexed

### Query Patterns
- All list endpoints paginate with `limit` (max 100) and `offset` — no unbounded queries observed
- AI briefing gathers metrics in parallel: 7 `Promise.all` branches — good for latency
- Booking creation: 4 sequential DB round-trips (class fetch, capacity count, duplicate check, insert)
- Member directory search uses `.ilike()` on joined `profiles` table — cross-table fuzzy search will be slow at scale
- Cohort analytics involves complex date math — appropriate to precompute via cron

### N+1 Risks
- Supabase `.select("*, related(*)")` pattern used extensively — these are single JOINs, not N+1
- Campaign recipient processing: batch insertion — needs verification but pattern suggests bulk insert

---

## Infrastructure Configuration

### Netlify Setup
```toml
[build]
  base = "apps/web"
  command = "npm run build"
  publish = ".next"

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["@supabase/supabase-js"]

[functions."___netlify-server-handler"]
  timeout = 60  # Hard ceiling for Netlify Pro plan
```

### Function Timeout (60s)
The 60-second function timeout affects:
- **Glofox sync** (`/api/glofox/sync`) — uses NDJSON streaming response to avoid timeout; sync sends progress updates every 10 minutes of data processed
- **Report generation** (`/api/reports/[id]/generate`) — generates PDFs synchronously; large datasets may exceed 60s
- **Payroll calculation** (`/api/payroll/periods/[id]/calculate`) — aggregates multiple employees; could approach timeout for large teams
- **Batch AI operations** — if multiple AI calls fire sequentially, 30s timeout × N calls could exceed 60s

### CI/CD Pipeline
```
Push/PR to main:
  1. lint-typecheck-test:
     → npm ci
     → tsc --noEmit
     → eslint
     → vitest run (unit tests only)
     → npm audit --audit-level=high
  2. build (depends on lint-typecheck-test):
     → npm ci
     → next build (with cache)
```

**What runs in CI:**
- Type checking ✓
- Linting ✓
- Unit tests ✓ (40 files)
- Dependency security audit ✓
- Build verification ✓

**What doesn't run in CI:**
- Integration tests (commented out — requires separate Supabase test instance)
- E2E tests (no step added)
- Coverage threshold enforcement (not in CI command)
- Bundle size checking

### Missing Infrastructure
1. **Error tracking:** No Sentry, Datadog, or equivalent. Only `console.error` logs.
2. **APM/Monitoring:** No Application Performance Monitoring configured.
3. **Log aggregation:** Netlify provides basic function logs but no structured log aggregation.
4. **Database migrations:** No migration runner. SQL files in `scripts/` are applied manually.
5. **Preview deployments:** Netlify supports preview deployments per PR — not confirmed as configured.

---

## Findings

### CRITICAL
None.

### HIGH
- **HIGH-PI-001:** No database migration runner or migration history table. SQL migration files (`phase2-migration.sql`, `audit-fixes-migration.sql`) must be applied manually in the correct order. There is no record of which migrations have been applied to production. This will cause critical issues as the codebase scales: a missed migration causes schema drift, and there's no way to detect it automatically.
- **HIGH-PI-002:** Glofox sync uses NDJSON streaming as a workaround for the 60-second Netlify function timeout. This is a band-aid fix. As the Glofox dataset grows (more members, more bookings), even the streaming approach may not prevent the sync from hitting the timeout. A proper solution would be to move the sync to Inngest background functions where it can run without timeouts.

### MEDIUM
- **MED-PI-001:** No client-side caching layer (React Query, SWR, or similar). Every page navigation re-fetches data from the server. On slow connections or with complex analytics queries, this creates a noticeable loading experience. Adding a caching layer would significantly improve perceived performance.
- **MED-PI-002:** Heavy client-side libraries (`framer-motion`, `reactflow`, `recharts`) are not lazily loaded. These libraries add significant bundle weight to every page even when not used. Use `dynamic(() => import(...), { ssr: false })` for route-specific heavy dependencies.
- **MED-PI-003:** No error tracking or APM configured. In production, errors (`console.error` calls) are only visible in Netlify's basic function logs, which are not searchable or alertable. Add Sentry or similar for error tracking before Phase 3 launch.
- **MED-PI-004:** E2E tests not running in CI. The Playwright test suite covers 9 major user journeys but has no CI step. E2E regressions won't be caught automatically.

### LOW
- **LOW-PI-001:** Analytics API routes have no `Cache-Control` headers. Daily metrics, cohort data, and revenue breakdown queries return fresh data on every API call even though the underlying data only changes daily. Adding `Cache-Control: private, max-age=300` (5 minutes) would reduce database load with no user-visible impact.
- **LOW-PI-002:** No bundle size tracking. As new features are added, the JavaScript bundle could grow significantly without any automated alerting.
- **LOW-PI-003:** Integration tests are commented out in CI (`# Requires a dedicated Supabase test instance`). These tests have been written but aren't running anywhere. A dedicated test Supabase project should be provisioned to enable them.
- **LOW-PI-004:** `@react-pdf/renderer` generates PDFs synchronously on the server. For large reports, this could cause memory pressure. Consider moving PDF generation to Inngest background jobs.

### INFO
- **INFO-PI-001:** Turborepo caching with `dependsOn: ["^build"]` is correctly configured — shared packages are built before the web app, and outputs are cached by Turborepo.
- **INFO-PI-002:** CI uses Next.js build cache keyed on `package-lock.json` + `src/**` hash — incremental builds will be fast for code-only changes.
- **INFO-PI-003:** The `npm audit --audit-level=high` step in CI provides automated dependency vulnerability scanning.
- **INFO-PI-004:** Pagination with `Math.min(parseInt(limit), 100)` prevents unbounded query results on all list endpoints — this is consistently applied across the API surface.
