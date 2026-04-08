# Low and Info Findings

**Date:** 2026-04-08

---

## LOW FINDINGS

**LOW-1:** Admin dashboard has no mobile-responsive layout. Fixed pixel sidebar widths will break on mobile/tablet. (ui-ux)

**LOW-2:** Employee portal trainer nav section visible to non-trainer employees leads to dead-end pages. (user-flow)

**LOW-3:** SMS campaign channel appears in campaign builder UI but may be non-functional (Twilio stub). (user-flow)

**LOW-4:** `(employee)/classes/`, `(employee)/pay/` etc. are orphaned route stubs that duplicate `/employee/*` routes. (user-flow, project-structure)

**LOW-5:** Heavy client libraries (Framer Motion, ReactFlow, Recharts) loaded on all pages without lazy loading. (performance-infra)

**LOW-6:** No E2E tests in CI pipeline. Playwright suite implemented but no CI step. (testing-quality, performance-infra)

**LOW-7:** Analytics API routes have no HTTP `Cache-Control` headers — data is re-fetched fresh even for daily metrics. (performance-infra)

**LOW-8:** API routes return generic "Internal server error" without logging the underlying Supabase error. (api-surface)

**LOW-9:** No CORS headers on API routes — will be required for iOS app and web booking portal (Phase 5). (api-surface)

**LOW-10:** `search` parameter in list endpoints has no length limit — could degrade DB with large strings. (security)

**LOW-11:** No API versioning strategy — all 159 routes are unversioned, creating a Phase 5 migration risk. (api-surface)

**LOW-12:** `automation_enrollments` stores full `flow_snapshot` JSON on every row — significant storage overhead at scale. (data-model)

**LOW-13:** `twilio` is a production dependency but SMS is a stub — adds bundle weight unnecessarily. (project-structure, integration)

**LOW-14:** `INNGEST_SIGNING_KEY` missing in production only logs a console.error — doesn't prevent server startup. (integration)

**LOW-15:** Duplicate security headers between `netlify.toml` and `next.config.ts` may cause unexpected browser behavior. (security)

**LOW-16:** Only 1 component test (MemberProfilePanel) among ~100+ React components. (testing-quality)

---

## INFO FINDINGS

**INFO-1:** 466 TypeScript source files, ~105K lines for Phase 1+2 — substantial codebase with thorough domain coverage.

**INFO-2:** 23 AI modules with rules-based fallbacks is an exemplary pattern for production AI resilience.

**INFO-3:** All monetary values stored as integer cents throughout — correct, avoids floating point issues.

**INFO-4:** Turborepo `LOW-014` governance comment in turbo.json shows code-level architecture documentation.

**INFO-5:** The `exclude_from_analytics` flag on members elegantly solves the comped-member-skews-data business problem.

**INFO-6:** Magic link / passwordless auth eliminates credential stuffing, brute force, and weak password attack vectors.

**INFO-7:** CI runs `npm audit --audit-level=high` on every push — automated dependency vulnerability scanning.

**INFO-8:** Inngest event types are fully typed via `MeridianEvents` — TypeScript catches incorrect event payloads at compile time.

**INFO-9:** `RESEND_DRY_RUN=true` pattern is a well-designed safety valve for staging email environments.

**INFO-10:** `automation_enrollments.flow_snapshot` stores an immutable copy of the flow at enrollment — prevents flow edits from breaking active enrollments.

**INFO-11:** The data model is forward-looking: shipping infrastructure, glofox_id columns, multi-tenant fields — Phase 5 prep is visible in Phase 1+2 code.

**INFO-12:** The docs/ tree is extensive and well-organized — PRD, phase plans, research, design guides all present.

