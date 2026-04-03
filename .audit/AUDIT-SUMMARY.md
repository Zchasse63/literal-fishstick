# Meridian -- Full Codebase Audit

**Date**: 2026-04-02
**Layers audited**: 10 of 10 (project-structure, data-model, api-surface, testing-quality, ui-ux, user-flow, ai-layer, integration, security, performance-infra)
**Model**: claude-sonnet-4-6 (layer agents), claude-opus-4-6 (synthesis)

| Metric | Value |
|--------|-------|
| Total findings (deduplicated) | 83 |
| Critical | 8 |
| High | 17 |
| Medium | 30 |
| Low | 28 |
| Files examined | 533 tracked files across 391 TS, 17 SQL, 94 TSX, 2 Python |
| API routes | 148 |
| Pages | 60 (48 admin, 9 employee, 2 auth, 1 public) |
| Test files | 36 (27 Vitest + 10 Playwright) |

---

## Health Score

### Overall: 38/100 (Grade: D+)

The platform has strong architectural bones -- a clean monorepo structure, comprehensive AI integration with universal fallbacks, solid booking/check-in logic, and a well-designed Inngest background job system. However, the surface has expanded much faster than its safety infrastructure. Eight critical findings include a non-functional rate limiter in production, broken authorization for the highest-privilege role, two completely dead feature builders (campaigns, automations), and a schema mismatch that makes the automation cooldown system inert. The codebase works for a single studio with trusted internal users. It is not ready for a second tenant or for untrusted users without addressing the critical and high-priority findings.

```
Base score:                         100
Critical findings (8 x -15):        -120  (floored contribution)
High findings (17 x -8):            -136  (floored contribution)
Medium findings (30 x -3):           -90
Low findings (28 x -1):              -28
---
Subtotal before bonuses:             -174  (floored at 0)

Bonuses:
  CI/CD pipeline present:             +3
  Test coverage exists (ratio < 0.5): +0
  API documentation present (partial):+1
  No CRITICAL findings:               +0
---
Adjusted base:                        4

Manual adjustment:
  Strong AI fallback architecture:   +10
  DB-level booking capacity trigger:  +5
  Well-designed Inngest system:       +5
  Clean monorepo structure:           +5
  Good Stripe/Resend webhook auth:    +4
  Comprehensive Phase 2 schema:       +5
---
Final:                                38
```

### Sub-Scores

| Domain | Score | Key Issue |
|--------|-------|-----------|
| Structure and Organization | 55/100 | Clean architecture, but 3 unused packages, 218 hardcoded IDs, 1699-line monolith file |
| Data Layer | 35/100 | No Phase 1 DDL, column name mismatch, cooldown schema drift, FK ambiguity |
| API Design | 30/100 | 90 routes with ad-hoc auth, role alias bug, conditional webhook bypasses |
| Test Coverage | 25/100 | 82% of routes untested, E2E smoke-only, zero component/hook tests |
| Security Posture | 30/100 | Rate limiter broken, role bypass, RLS unset, webhook bypasses |
| UI/UX Cohesion | 40/100 | Visually polished but dark mode broken, no accessibility, dead buttons |
| AI Integration | 60/100 | Best-designed subsystem; universal fallbacks, but 5 dead modules, stale model IDs |
| Performance | 35/100 | N+1 queries, no RSC, no timeouts, Node version mismatch |
| Integration Health | 40/100 | Solid Glofox retry logic, but cooldown broken, webhook bypasses, no idempotency |
| User Flow Completeness | 35/100 | Core flows work, but campaign/automation builders dead, clock page broken |

---

## Top 10 Findings (Ranked by Impact)

### 1. Rate Limiter Non-Functional in Production
**Severity**: CRITICAL | **Corroboration**: 7/10 layers | **Effort**: Medium
The in-memory rate limiter resets on every Netlify cold start. All 13 AI endpoints have zero throttling. A single user can invoke Anthropic thousands of times, creating unbounded cost exposure.
**Fix**: Replace `lib/rate-limit.ts` with Upstash Redis or Supabase-backed counters.

### 2. "owner" Role Silently Denied by ~20 Routes
**Severity**: CRITICAL | **Corroboration**: 3/10 layers | **Effort**: Low
The canonical `requireRole()` treats "owner" and "admin" as equivalent. But ~20 routes use ad-hoc auth checking `["admin", "manager"]`, excluding the canonical "owner" role from leads, content, automations, reports, payroll, and SMS.
**Fix**: Replace `["admin", "manager"]` with `["owner", "manager"]` in all ad-hoc routes, or migrate to `requireRole()`.

### 3. Campaign and Automation Builders Cannot Save or Send
**Severity**: CRITICAL | **Corroboration**: 1/10 layers | **Effort**: Low
Both the campaign builder (1,354 lines) and automation builder have fully-built UIs with no backend wiring. The "Send Campaign," "Save as Draft," "Save & Activate" buttons have no `onClick` handlers. The API endpoints exist and work -- the gap is purely in the frontend.
**Fix**: Add `onClick` handlers that call the existing `POST /api/campaigns` and `POST /api/automations` endpoints.

### 4. Hardcoded Studio ID in 218 Locations
**Severity**: HIGH | **Corroboration**: 8/10 layers | **Effort**: High
`'11111111-1111-1111-1111-111111111111'` appears in 179 files. A `getStudioId()` utility exists but only 10 files have been migrated. This is the number one blocker for the SaaS goal.
**Fix**: Systematic migration of all occurrences to use `requireRole()` (which handles studio ID automatically).

### 5. Automation Cooldown System Non-Functional (Schema/Code Mismatch)
**Severity**: CRITICAL | **Corroboration**: 2/10 layers | **Effort**: Low
`helpers.ts` queries a `channel` column that does not exist in the `automation_cooldowns` table. Every automation enrollment sends messages on every evaluation cycle with no throttling.
**Fix**: Align the schema with the code (add `channel` column) or rewrite the code to use existing columns.

### 6. 82% of API Routes Have Zero Test Coverage
**Severity**: HIGH | **Corroboration**: 1/10 layers | **Effort**: High
122 of 148 routes are untested, including member upgrade/downgrade (revenue), campaign send (irreversible), payroll approval (financial), and all 17 AI routes.
**Fix**: Prioritize tests for revenue-critical routes (upgrade/downgrade, payroll) and external integration routes (campaign send, SMS).

### 7. Class Creation API Writes to Wrong Column Names
**Severity**: CRITICAL | **Corroboration**: 1/10 layers | **Effort**: Low
The `/api/classes` route writes `start_time`/`end_time` but the DB columns are `starts_at`/`ends_at`. New classes created through the admin UI will have NULL timestamps.
**Fix**: Rename column references in 2 route files.

### 8. Node Version Mismatch (CI: 22, Netlify: 20)
**Severity**: CRITICAL | **Corroboration**: 2/10 layers | **Effort**: Minutes
Code that passes CI on Node 22 deploys to Node 20 on Netlify. Next.js 16 may use Node 22 APIs.
**Fix**: Change `NODE_VERSION = "22"` in `netlify.toml`.

### 9. Dark Mode Toggle Exists But Nothing Changes
**Severity**: HIGH | **Corroboration**: 1/10 layers | **Effort**: High
Toggle and CSS tokens are correctly implemented. But all 57 pages use hardcoded `bg-white`/`bg-gray-*` with zero `dark:` variants. Activating dark mode produces a partially-inverted state.
**Fix**: Replace hardcoded color classes with semantic tokens across all pages.

### 10. No Phase 1 Schema DDL in Source Control
**Severity**: HIGH | **Corroboration**: 2/10 layers | **Effort**: Minutes
~40 Phase 1 tables exist only in the live Supabase instance. No disaster recovery path, no staging environment setup, no schema review process.
**Fix**: `pg_dump --schema-only` and commit as `scripts/phase1-schema.sql`.

---

## Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["Browser (React 19 + Next.js 16)"]
        Admin["Admin Dashboard<br/>48 pages<br/>Status: YELLOW"]
        Employee["Employee Portal<br/>9 pages<br/>Status: YELLOW"]
        Auth["Auth Flow<br/>Status: GREEN"]
    end

    subgraph API["Next.js API Routes (148 total)"]
        AuthRoutes["Auth (1)<br/>GREEN"]
        CoreRoutes["Core CRUD (45)<br/>26 use requireRole<br/>YELLOW"]
        AIRoutes["AI Endpoints (17)<br/>No timeouts, no rate limit<br/>RED"]
        WebhookRoutes["Webhooks (4)<br/>Stripe/Resend: GREEN<br/>EasyPost/Twilio: RED"]
        CronRoutes["Cron (3)<br/>YELLOW"]
        MarketingRoutes["Marketing (25)<br/>Role alias bug<br/>RED"]
        FinanceRoutes["Revenue/Payroll (15)<br/>Role alias bug<br/>RED"]
    end

    subgraph Background["Inngest Background Jobs"]
        CronJobs["10 Cron Functions<br/>Hardcoded studio ID<br/>YELLOW"]
        EventJobs["9 Event Functions<br/>Glofox write-back active<br/>RED"]
    end

    subgraph External["External Services"]
        Supabase["Supabase (PostgreSQL)<br/>Phase 1: No DDL<br/>Phase 2: RLS unset<br/>YELLOW"]
        Stripe["Stripe<br/>No idempotency guard<br/>YELLOW"]
        Anthropic["Anthropic (Claude)<br/>No timeout, no rate limit<br/>RED"]
        Resend["Resend<br/>Batch abort on error<br/>YELLOW"]
        Twilio["Twilio<br/>Stub provider active<br/>YELLOW"]
        Glofox["Glofox API<br/>Write-back policy violation<br/>RED"]
        Inngest["Inngest Platform<br/>No signing key verified<br/>RED"]
    end

    subgraph Hosting["Deployment"]
        Netlify["Netlify<br/>Node 20 (should be 22)<br/>No CSP/HSTS<br/>YELLOW"]
    end

    Client -->|All pages use client| API
    API --> Supabase
    API --> Stripe
    API --> Anthropic
    API --> Resend
    API --> Twilio
    API -->|serve()| Inngest
    Inngest --> Background
    Background --> Supabase
    Background --> Glofox
    Background --> Anthropic
    API --> Netlify
```

**Legend**: GREEN = adequately protected, YELLOW = partial issues, RED = protection gap identified

---

## Findings by Category

### Data Integrity (7 findings)
| ID | Severity | Finding |
|----|----------|---------|
| CRIT-04 | Critical | `classes` API writes to non-existent columns (`start_time` vs `starts_at`) |
| CRIT-03 | Critical | Automation cooldown schema/code mismatch -- cooldowns never enforced |
| MED-07 | Medium | `bookings.member_id` FK join hint may reference wrong parent table |
| MED-08 | Medium | `memberships` table join in member detail -- likely non-existent table |
| MED-06 | Medium | Churn prediction email query uses `full_name` instead of email |
| MED-20 | Medium | Duplicate GDPR functions with conflicting behavior |
| LOW-05 | Low | Phone numbers stored in inconsistent formats |

### Security (11 findings)
| ID | Severity | Finding |
|----|----------|---------|
| CRIT-01 | Critical | Rate limiter non-functional (cost/abuse exposure) |
| CRIT-02 | Critical | Role alias mismatch -- "owner" denied by ~20 routes |
| CRIT-08 | Critical | AI-generated SQL has bypassable studio isolation |
| HIGH-02 | High | E2E auth tokens on disk with valid refresh token |
| HIGH-04 | High | Webhook verification bypassed when env vars absent |
| HIGH-05 | High | Inngest signing key not enforced |
| HIGH-10 | High | Phase 2 RLS policies depend on unset session variable |
| MED-03 | Medium | Missing CSP and HSTS headers |
| MED-24 | Medium | Auth context uses `getSession()` instead of `getUser()` |
| MED-25 | Medium | Unsubscribe token has no expiration check |
| LOW-04 | Low | Raw database error messages returned to clients |

### UI/UX Cohesion (9 findings)
| ID | Severity | Finding |
|----|----------|---------|
| HIGH-08 | High | Dark mode non-functional across all page content |
| HIGH-09 | High | 11 modals lack accessibility (no focus trap, ARIA, keyboard) |
| MED-14 | Medium | `fadeInUp` animation duplicated 55 times |
| MED-15 | Medium | No form state management; inconsistent validation |
| MED-22 | Medium | 14 mega-page files exceed 700 lines |
| MED-23 | Medium | Keyboard shortcuts displayed but not implemented |
| MED-29 | Medium | Notification bell non-functional |
| LOW-12 | Low | Login page uses hardcoded hex instead of CSS variables |
| LOW-21 | Low | No viewport export in root layout |

### Integration Health (8 findings)
| ID | Severity | Finding |
|----|----------|---------|
| CRIT-03 | Critical | Automation cooldown mismatch (cross-ref with Data Integrity) |
| HIGH-13 | High | Stripe webhook has no idempotency guard |
| HIGH-15 | High | Glofox write-back active despite read-only policy |
| MED-10 | Medium | Campaign send route hardcodes studio ID |
| MED-11 | Medium | Stripe metadata key name mismatch |
| MED-17 | Medium | Email templates hardcode `thesaunaguys.com` URLs |
| MED-18 | Medium | Glofox sync hardcodes `'thesaunaguys'` namespace |
| MED-19 | Medium | EasyPost from_address uses placeholder data |

### Performance (6 findings)
| ID | Severity | Finding |
|----|----------|---------|
| CRIT-07 | Critical | Node version mismatch CI vs Netlify |
| HIGH-11 | High | No timeout on Anthropic API calls |
| HIGH-14 | High | N+1 query pattern in trainer performance route |
| HIGH-16 | High | All 57 pages are `'use client'` -- zero RSC utilization |
| LOW-13 | Low | 27 routes use SELECT * |
| LOW-14 | Low | Cache headers on only 4 of 148 routes |

### Test Coverage (4 findings)
| ID | Severity | Finding |
|----|----------|---------|
| HIGH-03 | High | 82% of API routes have zero test coverage |
| MED-26 | Medium | No coverage thresholds enforced in CI |
| MED-27 | Medium | Integration and E2E tests cannot run in CI |
| MED-21 | Medium | Chainable mock duplication across 14 test files |

### Multi-Tenancy Readiness (4 findings)
| ID | Severity | Finding |
|----|----------|---------|
| HIGH-01 | High | Hardcoded studio ID in 218 locations |
| HIGH-10 | High | Phase 2 RLS policies depend on unset session variable |
| CRIT-08 | Critical | AI search has bypassable studio isolation |
| MED-10 | Medium | Campaign send route hardcodes studio ID |

### Dead Code / Unused Dependencies (6 findings)
| ID | Severity | Finding |
|----|----------|---------|
| MED-01 | Medium | `@meridian/supabase` and `@meridian/utils` entirely unused |
| MED-05 | Medium | 5 AI modules complete but unreachable (no API routes) |
| LOW-06 | Low | Duplicate Tailwind animation libraries |
| LOW-07 | Low | TanStack Query installed but not used |
| LOW-08 | Low | Duplicate ReactFlow packages |
| LOW-26 | Low | `@base-ui/react` listed but not imported |

---

## Remediation Roadmap

### Immediate (Do This Week)

These items are either minutes of work or prevent real damage:

| Priority | Finding | Effort | Why Now |
|----------|---------|--------|---------|
| 1 | CRIT-07: Fix Node version in `netlify.toml` | Minutes | Prevents silent build divergence |
| 2 | HIGH-06: Export Phase 1 schema DDL | Minutes | Disaster recovery prerequisite |
| 3 | HIGH-02: Rotate E2E test credentials | Minutes | Credential hygiene |
| 4 | CRIT-02: Fix role alias mismatch in ~20 routes | 1-2 hours | Owners locked out of critical features |
| 5 | CRIT-04: Fix `start_time` -> `starts_at` in classes API | 15 minutes | Class creation is broken |
| 6 | CRIT-03: Fix automation cooldown schema/code mismatch | 30 minutes | Automation sends unbounded |
| 7 | MED-04: Replace 6 stale model IDs with `AI_MODEL` | 15 minutes | Model upgrade will miss these |
| 8 | HIGH-05: Set `INNGEST_SIGNING_KEY` in Netlify | Minutes | Background jobs externally triggerable |
| 9 | MED-02: Create `.env.example` file | 30 minutes | Enables safe deployments |

### Short-Term (Next 2 Sprints)

| Priority | Finding | Effort | Why Soon |
|----------|---------|--------|----------|
| 10 | CRIT-01: Replace rate limiter with Redis/Supabase | Medium | AI cost exposure in production |
| 11 | CRIT-05/06: Wire campaign and automation save buttons | Low | Marketing module is a prototype without this |
| 12 | HIGH-04: Make webhook secrets required (EasyPost, Twilio) | Low | Security bypass in staging |
| 13 | HIGH-07: Fix clock page to use API calls | Low | Employee timesheets have gaps |
| 14 | HIGH-13: Add Stripe webhook idempotency guard | Low-Med | Duplicate financial records |
| 15 | HIGH-11: Add timeouts to Anthropic API calls | Low | Functions hang for 10 minutes on slow responses |
| 16 | HIGH-17: Create missing `/revenue/products/new` and `/analytics/pricing/new` pages | Low | 404 dead links |
| 17 | HIGH-12: Add role-based post-login routing | Low | Trainers confused by landing on admin dashboard |
| 18 | MED-06: Fix churn prediction email query | Low | Every churn score is slightly wrong |

### Medium-Term (Phase 2 Completion)

| Priority | Finding | Effort | Why |
|----------|---------|--------|-----|
| 19 | HIGH-01: Migrate 218 hardcoded studio IDs | High | SaaS blocker |
| 20 | HIGH-10: Fix Phase 2 RLS policies | Medium | Multi-tenant security |
| 21 | HIGH-09: Replace bespoke modals with shadcn Dialog/Sheet | Medium | Accessibility compliance |
| 22 | HIGH-03: Add tests for revenue-critical routes | High | Untested payment logic |
| 23 | MED-09: Decompose `lib/anthropic.ts` into `lib/ai/` modules | Medium | Code organization |
| 24 | HIGH-08: Implement dark mode on page content | High | Feature advertised but broken |
| 25 | MED-16: Make employee portal mobile-responsive | Medium | Clock-in used on phones |
| 26 | HIGH-15: Gate Glofox write-back behind feature flag | Low | Policy compliance |
| 27 | LOW-01: Install Sentry for error tracking | Low | Production observability |
| 28 | MED-22: Extract sub-components from mega-page files | High | Testability |

### Long-Term (Phase 3+)

| Priority | Finding | Effort | Why |
|----------|---------|--------|-----|
| 29 | HIGH-16: Convert static pages to React Server Components | High | Bundle size, TTFB |
| 30 | CRIT-08: Harden AI SQL execution with server-enforced studio_id | Medium | Multi-tenant security |
| 31 | MED-05: Wire up 5 dead AI modules or mark Phase 3 | Medium | Feature completeness |
| 32 | MED-27: Add E2E tests to CI pipeline | Medium | Regression prevention |
| 33 | MED-15: Add React Hook Form with Zod resolver | Medium | Form consistency |

---

## What is Working Well

These are genuine strengths identified across multiple auditors that should be preserved:

1. **AI Fallback Architecture**: Every single Claude call (19 features) has a complete rules-based fallback. AI unavailability degrades quality but never breaks functionality. This is production-grade resilience that most AI integrations lack.

2. **Booking Capacity Enforcement**: The database-level `enforce_booking_capacity` trigger prevents race conditions in concurrent booking scenarios. The booking test suite (15 scenarios including capacity, duplicates, and activity log verification) is one of the strongest in the codebase.

3. **Inngest Background Job System**: 19 functions with proper step isolation, retry configuration, concurrency limits, and onFailure hooks. The Glofox sync backfill processes entities in FK dependency order. The daily metrics cron correctly handles backfill gaps.

4. **Stripe and Resend Webhook Verification**: Unlike EasyPost/Twilio, the Stripe handler always verifies `stripe-signature` and the Resend handler always verifies via Svix. No conditional bypass.

5. **Clean Monorepo Structure**: Turborepo with clear separation: route groups by user role, shared `lib/` layer, dedicated packages for types/utils/supabase. No circular dependencies detected.

6. **Design Token System**: `globals.css` defines a complete light/dark token set with chart palette, AI gradient treatment, and consistent typographic conventions. The foundation is correct -- the gap is in page-level adoption.

7. **`requireRole()` Helper**: Where used, it provides consistent auth with role alias normalization, studio ID resolution, and clean error responses. The 58 routes using it have stronger security guarantees than the 90 that do not.

8. **Phase 2 Schema Quality**: `phase2-migration.sql` is well-structured with CHECK constraints, composite indexes, RLS policies, and proper FK relationships. The schema design is ahead of the application code that consumes it.

9. **SSE Campaign Send Streaming**: The campaign send route uses `ReadableStream` with Server-Sent Events to stream progress, avoiding long HTTP connection holds.

10. **Unsubscribe HMAC Token**: Uses `crypto.timingSafeEqual` with a well-formed token structure. One of the few places where security was implemented to a high standard from the start.

---

## Appendix: Layer Report Index

| Layer | File | Findings | Top Issue |
|-------|------|----------|-----------|
| Project Structure | `.audit/layers/project-structure.md` | 2C, 5H, 10M, 7L, 6I | Node version mismatch, unused packages |
| Data Model | `.audit/layers/data-model.md` | 3C, 5H, 7M, 6L | Classes column mismatch, cooldown drift |
| API Surface | `.audit/layers/api-surface.md` | 2C, 4H, 7M, 5L | Role alias bug, ad-hoc auth in 90+ routes |
| Testing Quality | `.audit/layers/testing-quality.md` | 2C, 5H, 6M, 4L | 82% routes untested, E2E smoke-only |
| UI/UX | `.audit/layers/ui-ux.md` | 3C, 5H, 7M, 5L | Dark mode broken, no accessibility |
| User Flow | `.audit/layers/user-flow.md` | 2C, 5H, 7M, 7L | Campaign/automation builders dead |
| AI Layer | `.audit/layers/ai-layer.md` | 3C, 4H, 6M, 5L | Dead modules, stale model IDs |
| Integration | `.audit/layers/integration.md` | 1C, 5H, 7M, 7L | Cooldown mismatch, webhook bypasses |
| Security | `.audit/layers/security.md` | 3C, 7H, 8M, 4L | Role bypass, JWT exposure, RLS unset |
| Performance/Infra | `.audit/layers/performance-infra.md` | 4C, 6H, 7M, 8L | Rate limiter, N+1 queries, Node mismatch |

### Synthesis Files

| File | Purpose |
|------|---------|
| `.audit/synthesis/cross-references.md` | Findings corroborated by multiple layers |
| `.audit/synthesis/contradictions.md` | Disagreements between auditors |
| `.audit/synthesis/gaps.md` | Areas no auditor adequately covered |
| `.audit/findings/critical.md` | 8 critical findings, deduplicated |
| `.audit/findings/high.md` | 17 high findings, deduplicated |
| `.audit/findings/medium.md` | 30 medium findings, deduplicated |
| `.audit/findings/low-info.md` | 28 low + 8 informational findings |
