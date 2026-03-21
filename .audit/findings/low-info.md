# Low and Info Findings

---

## LOW Findings

**LOW-001** — Sidebar keyboard shortcut collision: both Analytics and Segments assigned shortcut `8`.
**LOW-002** — No `middleware.ts` auth gate; `scripts/` SQL files not tracked in migration framework.
**LOW-003** — Turborepo lint task has no `outputs`, so lint results are never cached.
**LOW-004** — Missing Astro landing page app in monorepo (referenced but absent).
**LOW-005** — No Stripe idempotency keys on payment intent creation (duplicate charge risk on retry).
**LOW-006** — `canEnrollMember()` blocks re-enrollment for failed enrollment status (members who had a failed enrollment can never re-enroll).
**LOW-007** — `GET /api/openapi` publicly exposes full API schema without authentication.
**LOW-008** — Handlebars `{{{triple-brace}}}` XSS risk in email template rendering (usage not verified).
**LOW-009** — `GET /api/cron/waitlist-promote` uses GET method for a state-mutating operation (should be POST).
**LOW-010** — No request body validation with Zod on most POST endpoints (Zod is installed but unused in route handlers).
**LOW-011** — AI gradient border treatment (indigo-to-violet) not implemented on AI insight cards.
**LOW-012** — framer-motion `layoutId="employee-nav-pill"` conflict: both main nav and trainer nav sections share the same `layoutId`.
**LOW-013** — `GDPR delete_member_phase2_data()` sets `author_id = NULL` but `content_posts.author_id` is `NOT NULL` — function will fail.
**LOW-014** — No Next.js image optimization configuration in `next.config.ts`.
**LOW-015** — pgvector embedding generation flow not verified — semantic search may return empty results.

---

## INFO Findings

**INFO-001** — All 13 AI functions use `claude-sonnet-4-6` uniformly — consistent and appropriate.
**INFO-002** — Service-role Supabase key is correctly server-side only (never in `NEXT_PUBLIC_*` vars).
**INFO-003** — Turborepo `type-check` task exists but is not in the `build` pipeline's `dependsOn`.
**INFO-004** — `reactflow` + `recharts` + `swagger-ui-react` are heavy dependencies; code splitting not explicitly confirmed.
**INFO-005** — 5 AI library modules (`cross-sell.ts`, `pricing-analyzer.ts`, `report-narrative.ts`, `seasonal-predictor.ts`, `trainer-comparison.ts`) are implemented but not yet wired to API routes.
**INFO-006** — `use-command-center-data.ts` content not reviewed — primary data hook for Command Center.
