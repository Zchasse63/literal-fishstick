# Meridian Codebase Audit — Executive Summary

**Date:** 2026-04-08
**Audited Project:** Meridian Fitness Studio OS (`literal-fishstick`)
**Auditor:** Codebase Cartographer (multi-agent audit system)
**Agents Executed:** 10 (project-structure, data-model, api-surface, testing-quality, ui-ux, user-flow, ai-layer, integration, security, performance-infra) + synthesizer

---

## Project Overview

Meridian is a custom fitness studio management OS built as a Turborepo monorepo with a single Next.js 16 application. It replaces Glofox as the operational backbone for The Sauna Guys (Tampa, FL) and is designed for future SaaS expansion. The codebase is in Phase 2 of a 5-phase roadmap, with Phase 1 (core platform) complete and Phase 2 (marketing & engagement) underway.

**Scale:** 466 TypeScript source files, ~105,000 lines, 159 API route handlers, 23 AI modules, 14+ Inngest background functions, 50+ data entities, 3 shared packages.

---

## Architecture Health Score: 7.5 / 10

| Dimension | Score | Notes |
|-----------|-------|-------|
| Project Structure | 8/10 | Clean feature-based organization, strong type discipline |
| Data Model | 7/10 | Comprehensive schema, missing critical indexes |
| API Surface | 7/10 | Well-structured, inconsistent auth patterns |
| Testing Quality | 6/10 | Good infrastructure, significant coverage gaps |
| UI/UX | 7/10 | Consistent design system, accessibility gaps |
| User Flow | 7/10 | Core flows complete, orphaned pages and dead ends |
| AI Layer | 8/10 | Exemplary AI integration with fallbacks, one critical risk |
| Integration | 7/10 | Clean patterns, missing circuit breakers |
| Security | 7/10 | Good baseline, two critical issues |
| Performance/Infra | 6/10 | No observability, no migration runner, no CDN caching |

---

## Finding Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 10 |
| MEDIUM | 15 |
| LOW | 16 |
| INFO | 12 |
| **Total** | **55** |

---

## Critical Findings (Fix Before Phase 3)

### CRIT-1: Events API Uses Hardcoded DEFAULT_STUDIO_ID
**Files:** `apps/web/src/app/api/events/route.ts`, `apps/web/src/app/api/events/[id]/route.ts`

All event queries use `DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'` instead of the authenticated user's `studio_id`. This is a multi-tenancy isolation breach — when a second studio is onboarded, their users can access or modify the first studio's event data.

**Immediate fix:** Replace all `DEFAULT_STUDIO_ID` references in event routes with `profile.studio_id` sourced from `requireRole()`. Also migrate event routes from inline auth to the canonical `requireRole()` pattern.

---

### CRIT-2: LLM-Generated SQL Executed Without Server-Side Validation
**Files:** `apps/web/src/app/api/ai/search/route.ts`, `apps/web/src/lib/ai/nl-search.ts`

The natural language search feature generates SQL via Claude and executes it against the production database via a Supabase RPC. No server-side parse validates the LLM output before execution. A prompt injection attack could generate SQL that exfiltrates sensitive data or degrades the database.

**Immediate fix:** Before passing the LLM-generated SQL to the RPC, validate it server-side: (1) Parse to confirm it's a single SELECT statement with no semicolons, (2) reject any query containing DDL/DML keywords (DROP, INSERT, UPDATE, DELETE, ALTER, TRUNCATE), (3) add a `statement_timeout` via SET LOCAL.

---

## Top 5 High-Priority Issues

### H-1: Missing index on bookings(class_id, studio_id, status)
Every booking creation runs an unindexed COUNT query across the bookings table. This is the highest-traffic query in the system and will degrade sharply as bookings grow.
```sql
CREATE INDEX idx_bookings_class_status ON bookings(class_id, studio_id, status);
```

### H-2: No database migration runner
SQL migration files are applied manually with no history tracking. One missed migration causes schema drift. Adopt Supabase CLI migrations or Flyway before Phase 3.

### H-3: execute-flow automation function has zero unit tests
The most complex background function — handling email sends, waits, and conditional branching — has no tests. A bug silently affects all marketing automation enrollees.

### H-4: No production observability (errors, performance, AI failures)
All errors log to `console.error`. No Sentry, no APM, no structured logging. Silent AI fallbacks, DB errors, and external API failures go undetected. Add error tracking before Phase 3.

### H-5: Glofox sync should move to Inngest
The current HTTP endpoint with NDJSON streaming is a workaround for the 60-second Netlify function timeout. As data volume grows, this will fail. Moving to an Inngest function (no timeout, built-in retry/cron) is the correct solution.

---

## Layer-by-Layer Summary

### Project Structure
Well-organized Turborepo monorepo with clean feature-based architecture. The `@meridian/types` shared package enforces type consistency. Main concerns: Next.js 16.2.0 is bleeding-edge (verify it's a stable release), and the Glofox cron scheduling infrastructure is incomplete (no scheduled function configured).

### Data Model
Comprehensive 50+ entity schema with correct UUID PKs, integer cents for money, and multi-tenant `studio_id` on every table. The `audit-fixes-migration.sql` file shows proactive schema correction (capacity trigger, partial reenrollment index, email_hash column). Key gaps: missing indexes on high-traffic queries, no automated type generation from the live schema, and no migration runner.

### API Surface
159 route handlers organized by domain with good consistency. The `requireRole()` helper is the canonical auth pattern (~75% of routes). Corporate and Events routes deviate with inline auth — these need migration to `requireRole()`. The Events API's `DEFAULT_STUDIO_ID` usage is a critical multi-tenancy breach.

### Testing Quality
Mature three-tier test infrastructure (Vitest unit + integration, Playwright E2E). 40 unit test files, 6 integration tests, 10 E2E specs. Custom Supabase mock builder is a quality abstraction. Key gaps: execute-flow has no tests, 22/23 AI modules untested, coverage threshold at 50% is too low for a payment/booking system, E2E tests not running in CI.

### UI/UX
Consistent Meridian design system (indigo-600 primary, emerald/amber accents, framer-motion animations). Both admin dashboard and employee portal share the design language. The command palette (Cmd+K) is a power-user feature worth highlighting. Accessibility gaps: `text-[10px] gray-400` fails WCAG contrast, no mobile responsive layout for admin, dark mode preference not persisted.

### User Flow
10 major user flows identified. 8 are fully implemented (auth, member management, bookings, campaigns, employee clock-in, lead pipeline, automation enrollment, AI insights). 2 are partially complete (command palette quick actions, SMS campaigns). Orphaned pages: `/segments` and `/engagement` are not in the primary navigation despite being implemented.

### AI Layer
The AI integration is Meridian's strongest technical differentiator. 23 focused modules, all with rules-based fallbacks, a singleton Anthropic client with retry logic, and a centralised `AI_MODEL` constant. The critical risk is the NL-to-SQL search feature, which executes LLM-generated queries without server-side validation. The `lib/anthropic.ts` barrel file should be formally deprecated.

### Integration
8 external services with clean integration patterns: lazy-init singletons, server-side only, retry where needed (Anthropic, Glofox). Webhook signature verification is correct for Stripe and Resend. Gaps: EasyPost webhook has no verified signature check, the rate-limit RPC may not be deployed, and `DEFAULT_STUDIO_ID` appears in Stripe customer creation metadata.

### Security
Solid baseline: passwordless auth, RLS + manual `studio_id` filtering (defense-in-depth), Zod validation on write endpoints. The two critical issues (NL SQL, Events multi-tenancy) need immediate attention. CSP `unsafe-inline/unsafe-eval` is tracked technical debt with a Phase 5 remediation plan. No hardcoded secrets found.

### Performance & Infrastructure
Build pipeline is efficient (Turborepo + Next.js cache). CI covers lint, typecheck, unit tests, dependency audit, and build verification. Significant gaps: no observability/APM, no migration runner, no HTTP caching on analytics endpoints, no bundle size tracking, heavy client libraries not lazily loaded, and E2E/integration tests not running in CI.

---

## Recommended Fix Priority

### Immediate (Before Phase 3 Launch)
1. Fix Events API: replace `DEFAULT_STUDIO_ID` with `profile.studio_id`, migrate to `requireRole()`
2. Fix NL SQL: add server-side SQL validation before execution
3. Add missing booking index: `CREATE INDEX idx_bookings_class_status ON bookings(class_id, studio_id, status)`
4. Set up Sentry or equivalent error tracking
5. Write unit tests for `execute-flow.ts`
6. Provision Supabase test instance and enable integration tests in CI

### Phase 3 Prerequisites
7. Adopt database migration runner (Supabase CLI migrations)
8. Add `supabase gen types typescript` to CI pipeline
9. Move Glofox sync to Inngest background function
10. Add `DEFAULT_STUDIO_ID` audit across all files that reference it (Stripe, reports, etc.)
11. Raise coverage thresholds for `src/app/api/webhooks/` and `src/lib/inngest/functions/`
12. Add rate limiting to campaign send, payroll calculate, report generate

### Before Phase 5 (Member-Facing)
13. Add CORS headers to API routes
14. Implement API versioning (`/api/v1/`)
15. Replace CSP `unsafe-inline/unsafe-eval` with nonce-based CSP
16. Verify Twilio and EasyPost webhook signature verification
17. Add mobile-responsive layout to admin dashboard (or confirm admin stays desktop-only)
18. Add React Query / SWR client-side caching layer

---

## Strengths Worth Preserving

1. **AI fallback pattern** — Every AI module has a rules-based fallback. This is production-grade and should never be removed.
2. **Integer cents for money** — Consistent throughout all 50+ entities. Never introduce floating-point money.
3. **`requireRole()` canonical auth helper** — The role alias support and studioId resolution are valuable. Migrate all inline auth routes to use this.
4. **`@meridian/types` discipline** — The Turborepo `LOW-014` governance comment and type discipline should be enforced as new packages/modules are added.
5. **Inngest event type definitions** — Fully typed `MeridianEvents` prevents runtime event payload errors. Maintain this as new events are added.
6. **Multi-layer security** — RLS + manual `studio_id` + auth middleware is the correct defense-in-depth pattern. Don't simplify this away.

---

## File Locations

| Report | Path |
|--------|------|
| This summary | `/Users/zach/Desktop/literal-fishstick/.audit/AUDIT-SUMMARY.md` |
| Project Structure | `/Users/zach/Desktop/literal-fishstick/.audit/layers/project-structure.md` |
| Data Model | `/Users/zach/Desktop/literal-fishstick/.audit/layers/data-model.md` |
| API Surface | `/Users/zach/Desktop/literal-fishstick/.audit/layers/api-surface.md` |
| Testing Quality | `/Users/zach/Desktop/literal-fishstick/.audit/layers/testing-quality.md` |
| UI/UX | `/Users/zach/Desktop/literal-fishstick/.audit/layers/ui-ux.md` |
| User Flow | `/Users/zach/Desktop/literal-fishstick/.audit/layers/user-flow.md` |
| AI Layer | `/Users/zach/Desktop/literal-fishstick/.audit/layers/ai-layer.md` |
| Integration | `/Users/zach/Desktop/literal-fishstick/.audit/layers/integration.md` |
| Security | `/Users/zach/Desktop/literal-fishstick/.audit/layers/security.md` |
| Performance & Infra | `/Users/zach/Desktop/literal-fishstick/.audit/layers/performance-infra.md` |
| Critical Findings | `/Users/zach/Desktop/literal-fishstick/.audit/findings/critical.md` |
| High Findings | `/Users/zach/Desktop/literal-fishstick/.audit/findings/high.md` |
| Medium Findings | `/Users/zach/Desktop/literal-fishstick/.audit/findings/medium.md` |
| Low/Info Findings | `/Users/zach/Desktop/literal-fishstick/.audit/findings/low-info.md` |
| Cross-References | `/Users/zach/Desktop/literal-fishstick/.audit/synthesis/cross-references.md` |
| Contradictions | `/Users/zach/Desktop/literal-fishstick/.audit/synthesis/contradictions.md` |
| Coverage Gaps | `/Users/zach/Desktop/literal-fishstick/.audit/synthesis/gaps.md` |

