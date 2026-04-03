# High Findings

Generated: 2026-04-02
Deduplicated and cross-referenced from 10 layer audit reports.

---

## HIGH-01: Hardcoded Studio ID in 218 Locations Blocks Multi-Tenancy

**Root cause**: `'11111111-1111-1111-1111-111111111111'` hardcoded across 179 files (43 API routes, 104 pages, 7 AI routes, 10 Inngest cron jobs, Stripe metadata, email templates).
**Corroboration**: 8 layers. Most corroborated finding after the rate limiter.
**Impact**: Zero impact for current single-tenant deployment. Total blocker for SaaS. A second studio onboarded would receive The Sauna Guys' data from every hardcoded route.
**Effort**: Medium-High (systematic migration of all 218 occurrences to `getStudioId(profile)` or `requireRole()`)
**Sources**: project-structure HIGH-002, data-model H-001, api-surface H-3, ui-ux M-4, ai-layer H-01, integration I-M2/M5/M6, security SEC-M5

---

## HIGH-02: E2E Auth Tokens on Disk with Valid Refresh Token

**Root cause**: Playwright auth setup generates `.auth/admin.json` and `.auth/employee.json` containing full JWT access tokens and refresh tokens. Files exist on disk; correctly gitignored at `apps/web/` level.
**Corroboration**: 3 layers (project-structure, testing-quality, security). Note: contradiction resolved -- files are gitignored and were never committed, reducing severity from CRITICAL to HIGH.
**Impact**: Working-directory exposure risk. Refresh token `iealmrlfxkby` may still be valid. Cookie attributes show `httpOnly: false`, `secure: false` (expected for localhost).
**Effort**: Minutes (rotate credentials via Supabase Auth dashboard; regenerate via `auth.setup.ts`)
**Sources**: project-structure CRIT-002, testing-quality C1, security SEC-C1

---

## HIGH-03: 82% of API Routes (122 of 148) Have Zero Test Coverage

**Root cause**: Test effort concentrated on booking, check-in, and auth flows. Revenue, payroll, AI, analytics, campaigns, migration, and 15 other domains are completely untested.
**Corroboration**: 1 layer directly (testing-quality C2), supported by testing-quality's comprehensive route inventory.
**Impact**: High-criticality untested routes include member upgrade/downgrade (revenue impact), campaign send (irreversible mass email), payroll calculation/approval (financial record), and all 17 AI routes.
**Effort**: High (writing tests for 122 routes is a multi-sprint effort; prioritize by business risk)
**Source**: testing-quality C2

---

## HIGH-04: Webhook Signature Verification Bypassed When Env Vars Absent (EasyPost, Twilio)

**Root cause**: Both handlers gate verification on whether the env var is set; if absent, they process unauthenticated payloads.
**Corroboration**: 3 layers (api-surface H-1, integration I-H2/I-H3, security SEC-H1)
**Impact**: In preview/staging deployments or misconfigured production, attackers can forge delivery notifications (EasyPost) or inbound SMS events (Twilio).
**Effort**: Low (require env vars; fail hard if absent)
**Sources**: api-surface H-1, integration I-H2/I-H3, security SEC-H1

---

## HIGH-05: Inngest Signing Key Not Enforced -- Background Jobs Triggerable Externally

**Root cause**: No `INNGEST_SIGNING_KEY` found in config; `serve()` call does not validate its presence.
**Corroboration**: 3 layers (api-surface H-2, integration I-L5, security SEC-H2)
**Impact**: All 19 Inngest functions (backfills, automation enrollment, campaign sending, AI insights, Glofox sync) can be triggered by anyone who discovers the `/api/inngest` endpoint URL.
**Effort**: Low (set env var in Netlify; add startup assertion for production)
**Sources**: api-surface H-2, integration I-L5, security SEC-H2

---

## HIGH-06: No Phase 1 Schema DDL in Source Control

**Root cause**: ~40 Phase 1 tables (studios, profiles, members, classes, bookings, transactions, etc.) exist only in the live Supabase instance. No DDL file was ever committed.
**Corroboration**: 2 layers (data-model H-002, project-structure indirectly)
**Impact**: No disaster recovery. No staging environment setup. No schema review process. Index existence for Phase 1 tables is unknown.
**Effort**: Low (run `pg_dump --schema-only` and commit)
**Source**: data-model H-002

---

## HIGH-07: Employee Clock Page Buttons Use Local State Only -- No API Calls

**Root cause**: `/employee/clock` page's handleClockIn/Out/Break buttons only update React state; no `fetch` to `/api/clock/*`.
**Corroboration**: 1 layer (user-flow UF-H-4)
**Impact**: Employees who use the dedicated clock page (instead of the home page widget) will appear to clock in/out but no record is written to the database. Timesheets will show gaps.
**Effort**: Low (replace local state mutations with `useClockAction` hook calls, matching the home page pattern)
**Source**: user-flow UF-H-4

---

## HIGH-08: Dark Mode is Non-Functional Across All Page Content

**Root cause**: Toggle and CSS tokens work correctly, but all 57 admin/employee pages use hardcoded `bg-white`/`bg-gray-*` classes with zero `dark:` variants.
**Corroboration**: 1 layer (ui-ux C-1) -- exhaustive evidence across 57 pages.
**Impact**: The dark mode toggle is prominently surfaced in both sidebars. Activating it produces a partially-inverted state where shadcn dropdowns invert but the page content stays white. Users will perceive this as broken.
**Effort**: High (systematic replacement of hardcoded color classes across all pages)
**Source**: ui-ux C-1

---

## HIGH-09: 11 Custom Modals Lack Accessibility -- No Focus Trap, No ARIA, No Keyboard Support

**Root cause**: 11 pages build modals from `fixed inset-0` divs instead of using the installed shadcn `Dialog` component.
**Corroboration**: 1 layer (ui-ux C-2)
**Impact**: WCAG 2.1 Level A failure. Keyboard users cannot interact with modals. Screen readers do not announce modals. The shadcn Dialog component (Radix-based, fully accessible) is installed but used in zero pages.
**Effort**: Medium (replace bespoke modals with Dialog/Sheet component usage)
**Source**: ui-ux C-2

---

## HIGH-10: Phase 2 RLS Policies Depend on Unset Session Variable

**Root cause**: Phase 2 tables use `current_setting('app.studio_id')` in RLS policies, but no API route or middleware sets this session variable. All routes use service-role client that bypasses RLS entirely.
**Corroboration**: 2 layers (data-model H-003, security SEC-M1)
**Impact**: Phase 2 RLS policies provide zero protection. All tenant isolation relies on application-level `.eq("studio_id")` filters. If any route omits the filter, data leaks.
**Effort**: Medium (either set session variable in server client or rewrite policies to use `auth.uid()`)
**Sources**: data-model H-003, security SEC-M1

---

## HIGH-11: Anthropic API Calls Have No Timeout Configuration

**Root cause**: No timeout option on any `anthropic.messages.create()` call. SDK default is 600 seconds.
**Corroboration**: 2 layers (ai-layer H-02, integration I-M4)
**Impact**: A slow Claude response holds a Netlify function open for up to 10 minutes, blocking the client and consuming execution time. The rules-based fallback (which exists for every AI feature) is never triggered because the call hangs instead of failing.
**Effort**: Low (add `timeout: 30_000` to all `anthropic.messages.create()` calls)
**Sources**: ai-layer H-02, integration I-M4

---

## HIGH-12: No Role-Based Post-Login Routing

**Root cause**: Password sign-in always redirects to `/`. Magic link callback does the same. No role check routes trainers to `/employee`.
**Corroboration**: 1 layer (user-flow UF-H-3)
**Impact**: Trainers logging in land on the admin Command Center instead of the employee portal. Confusing for non-admin staff.
**Effort**: Low (check `profile.roles` after sign-in and route accordingly)
**Source**: user-flow UF-H-3

---

## HIGH-13: Stripe Webhook Has No Idempotency Guard -- Duplicate Events Create Duplicate Records

**Root cause**: No check for previously-processed Stripe event IDs. `invoice.payment_succeeded` inserts a new `transactions` row per delivery. `checkout.session.completed` inserts new `credit_packs` or `gift_cards` rows.
**Corroboration**: 1 layer (integration I-H4)
**Impact**: Stripe guarantees at-least-once delivery. Duplicate deliveries will create duplicate financial records, potentially crediting members twice.
**Effort**: Low-Medium (add `processed_stripe_events` table or check existing transaction by `stripe_payment_intent_id`)
**Source**: integration I-H4

---

## HIGH-14: N+1 Query Pattern in Trainer Performance Route

**Root cause**: `GET /api/trainers/performance` loops over trainers issuing 3 sequential Supabase calls per trainer (classes, revenue, snapshot).
**Corroboration**: 2 layers (data-model, performance-infra PERF-02/PERF-03)
**Impact**: With 10 trainers: 31 sequential queries per request. The `cron-trainer-metrics.ts` Inngest function has a similar pattern with 1 booking count query per class.
**Effort**: Medium (use bulk queries or existing RPCs)
**Sources**: data-model (N+1 section), performance-infra PERF-02, PERF-03

---

## HIGH-15: Glofox Write-Back Functions Active Despite Read-Only Policy

**Root cause**: Three Inngest functions (`glofox-create-booking`, `glofox-cancel-booking`, `glofox-mark-attendance`) write to the live Glofox API. Project policy (MEMORY.md) says "reads only until explicitly approved."
**Corroboration**: 1 layer (integration I-H5). Contradicted by project-structure which characterized write-backs as "correct."
**Impact**: Booking and check-in actions in Meridian may create duplicates in Glofox. Resolution requires human decision on whether write-back is approved.
**Effort**: Low (gate behind `GLOFOX_WRITE_BACK_ENABLED` env var)
**Source**: integration I-H5

---

## HIGH-16: All 57 Pages Are `'use client'` -- Zero React Server Component Utilization

**Root cause**: Every page including the admin layout is marked `'use client'`, forcing the entire application to hydrate on the client.
**Corroboration**: 2 layers (project-structure LOW-001, performance-infra PERF-07)
**Impact**: Larger initial JavaScript payload, no pre-rendered HTML skeleton, slower time-to-interactive. The admin layout's sidebar, header, and breadcrumbs could be Server Components.
**Effort**: High (requires page-by-page evaluation and extraction of client state into client components)
**Sources**: project-structure LOW-001, performance-infra PERF-07

---

## HIGH-17: Two "New" Pages Linked But Do Not Exist (404 Dead Links)

**Root cause**: `/revenue/products/new` and `/analytics/pricing/new` are linked from their parent pages but have no `page.tsx` files.
**Corroboration**: 1 layer (user-flow UF-H-1)
**Impact**: Product creation and new pricing simulation flows are completely broken. Users land on a 404 with no recovery navigation.
**Effort**: Low (create the pages with forms calling existing API endpoints)
**Source**: user-flow UF-H-1
