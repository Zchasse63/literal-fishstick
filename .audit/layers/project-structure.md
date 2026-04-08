# Layer Report: Project Structure

**Agent:** project-structure
**Date:** 2026-04-08
**Status:** Complete

---

## Executive Summary

Meridian is a Turborepo monorepo hosting a single Next.js 16 application (`apps/web`) backed by Supabase (Postgres + Auth + Realtime). The architecture is a **feature-based vertical slice** pattern within the Next.js App Router, organized by business domain (members, revenue, marketing, corporate, analytics, operations). Three shared packages (`@meridian/types`, `@meridian/utils`, `@meridian/supabase`) provide cross-app primitives. The platform is a fitness-studio OS replacing Glofox, currently in Phase 2 of a 5-phase roadmap.

---

## Directory Tree (Top 3 Levels)

```
literal-fishstick/
├── apps/
│   └── web/                         # Next.js 16 admin dashboard + employee portal
│       ├── src/
│       │   ├── app/                 # Next.js App Router (route tree)
│       │   │   ├── (admin)/         # Admin route group (8 modules)
│       │   │   ├── (auth)/          # Auth routes (login, callback)
│       │   │   ├── (employee)/      # Employee portal routes
│       │   │   └── api/             # API route handlers (~120+ routes)
│       │   ├── components/          # Shared UI components
│       │   │   ├── ui/              # shadcn/ui primitives (29 components)
│       │   │   ├── layout/          # Admin shell, sidebar, header
│       │   │   └── glofox/          # Glofox-specific components
│       │   ├── hooks/               # React hooks (17 hooks, many AI-powered)
│       │   ├── lib/                 # Business logic & service clients
│       │   │   ├── ai/              # 23 AI modules (Claude integrations)
│       │   │   ├── auth/            # Auth helpers
│       │   │   ├── glofox/          # Glofox API client + transformers
│       │   │   ├── inngest/         # Background job functions (14 crons + events)
│       │   │   ├── reports/         # PDF/CSV export engine
│       │   │   ├── sms/             # Provider-agnostic SMS (Twilio impl)
│       │   │   └── supabase/        # Supabase client/server/middleware
│       │   └── __tests__/           # Unit + integration tests
│       ├── e2e/                     # Playwright E2E tests
│       └── netlify/                 # Netlify function overrides
├── packages/
│   ├── types/                       # @meridian/types — shared TypeScript types (13 modules)
│   ├── utils/                       # @meridian/utils — shared utilities
│   └── supabase/                    # @meridian/supabase — shared Supabase client
├── scripts/                         # DB seed scripts, migration SQL, data import scripts
├── docs/                            # Product docs, PRD, design guides, research
└── turbo.json                       # Turborepo pipeline config
```

---

## Architectural Pattern

**Pattern:** Feature-based vertical slice + domain-grouped API

The Next.js App Router uses **route groups** to organize three distinct user-facing surfaces:
- `(admin)` — Admin dashboard (8 domain modules)
- `(employee)` — Employee portal (clock-in, pay, performance, schedule)
- `(auth)` — Authentication (login, magic link callback)

Within `(admin)`, each module (analytics, corporate, marketing, members, operations, revenue, schedule, settings) owns its own:
- Page components (`page.tsx`, `layout.tsx`)
- Collocated client components (`_components/`)
- Data fetching via API calls to `/api/*`

This is a **"server page + client component"** hybrid pattern: page.tsx files are server components that pass data to `*Client.tsx` components which handle interactivity.

---

## Module Boundaries

### Admin Modules (8 domains)
| Module | Path | Purpose |
|--------|------|---------|
| Command Center | `(admin)/page.tsx` | Daily briefing, live metrics, facility map |
| Schedule | `(admin)/schedule/` | Class calendar, waitlists, class management |
| Members | `(admin)/members/` | Member directory, profiles, segments |
| Revenue | `(admin)/revenue/` | MRR/churn metrics, transactions, products |
| Marketing | `(admin)/marketing/` | Campaigns, automations, leads, content hub |
| Corporate | `(admin)/corporate/` | Company accounts, event management |
| Operations | `(admin)/operations/` | Staff directory, payroll, permissions |
| Analytics | `(admin)/analytics/` | Dashboards, AI insights, reports, pricing simulator, trainer performance, migration |
| Settings | `(admin)/settings/` | Studio settings, geofencing, SMS config |

### API Domains (~120+ route handlers)
| Domain | Route Prefix | Notes |
|--------|-------------|-------|
| AI Features | `/api/ai/*` | 14 endpoints (briefing, churn, health-score, campaign-copy, etc.) |
| Analytics | `/api/analytics/*` | 8 endpoints |
| Automations | `/api/automations/*` | Full CRUD + enrollment management |
| Bookings | `/api/bookings/*` | Create, cancel |
| Campaigns | `/api/campaigns/*` | Full lifecycle (create, send, schedule, A/B winner) |
| Check-in | `/api/check-in/*` | QR-based and direct check-in |
| Classes | `/api/classes/*` | Class management + reminders |
| Corporate | `/api/corporate/*` | Accounts, members, credits, invoices |
| Employees | `/api/employees/*` | Staff CRUD, documents |
| Events | `/api/events/*` | Event management |
| Glofox | `/api/glofox/*` | Sync, backfill (background functions) |
| Inngest | `/api/inngest` | Background job webhook |
| Members | `/api/members/*` | Member CRUD, pause |
| Payroll | `/api/payroll/*` | Periods, approve, calculate, export |
| Pricing Simulator | `/api/pricing-simulator/*` | Simulate, analyze, apply |
| Products | `/api/products/*` | Merchandise CRUD |
| Promo Codes | `/api/promo-codes/*` | Trainer promo codes |
| Reports | `/api/reports/*` | Report builder, generate, export |
| Segments | `/api/segments/*` | Smart member segments |
| Staff | `/api/staff/*` | Staff management |
| Trainers | `/api/trainers/*` | Performance, leaderboard, summaries |
| Webhooks | `/api/webhooks/*` | Stripe, Resend, EasyPost, Twilio |
| Cron | `/api/cron/*` | Waitlist promotion |

### Background Jobs (Inngest — 14 functions)
- `cron-ai-insights` — AI insight generation
- `cron-cohort-refresh` — Cohort analytics refresh
- `cron-contract-expiry` — Contract expiry notifications
- `cron-corporate-credits` — Corporate credit allocation
- `cron-daily-metrics` — Daily KPI snapshots
- `cron-export-cleanup` — Cleanup exported files
- `cron-invoice-overdue` — Invoice overdue alerts
- `cron-member-enrichment` — AI member enrichment
- `cron-payroll-reminder` — Payroll reminder notifications
- `cron-report-scheduler` — Scheduled report delivery
- `cron-trainer-metrics` — Trainer performance metrics
- `evaluate-triggers` — Automation trigger evaluation
- `execute-flow` — Automation step execution
- `glofox-backfill/sync/create-booking/cancel-booking/mark-attendance` — Glofox integration jobs

### Shared Packages
| Package | Exports |
|---------|---------|
| `@meridian/types` | 13 domain type modules (auth, members, classes, bookings, revenue, trainers, employees, merch, marketing, guests, analytics, corporate) |
| `@meridian/utils` | currency.ts, dates.ts, constants.ts |
| `@meridian/supabase` | Supabase client/server factories |

---

## Dependency Graph

### Critical Dependencies
```
apps/web
  → @meridian/types (shared types — monorepo workspace)
  → @anthropic-ai/sdk ^0.80.0 (Claude AI)
  → @supabase/ssr + supabase-js (database + auth)
  → stripe ^20.4.1 (payments)
  → inngest ^4.0.2 (background jobs)
  → resend ^6.9.4 (email)
  → twilio ^5.13.0 (SMS)
  → next 16.2.0 (framework)
  → react ^19.2.4 (UI)
  → zod ^3.24.0 (validation)
  → recharts ^2.15.4 (charts)
  → framer-motion ^12.4.10 (animations)
  → reactflow ^11.11.4 (flow diagrams)
  → handlebars ^4.7.8 (email templates)
  → svix ^1.89.0 (webhook verification)
  → @react-pdf/renderer ^4.3.2 (PDF export)
  → @dnd-kit/* (drag-and-drop)
  → cmdk ^1.1.1 (command palette)
```

### Key Technical Observations
1. **Next.js 16.2.0** — This is a very recent/leading-edge version that may have breaking changes from well-known Next.js 14/15 patterns. The AGENTS.md explicitly warns about this.
2. **React 19** — Latest React version with concurrent features; some third-party libraries may not be compatible.
3. **Vitest 4.1.0** — Very recent major version.
4. **Twilio imported as a production dependency** but SMS is described as "stub" — the library is bundled but the feature may be partially implemented.

---

## Infrastructure

### Deployment
- **Hosting:** Netlify with `@netlify/plugin-nextjs`
- **Build:** `apps/web` as Netlify base directory
- **Functions timeout:** 60s (extended for Glofox sync)
- **Node version:** 22

### Middleware Architecture
The single `middleware.ts` handles:
1. **Session refresh** via `updateSession()` on every request
2. **Public route allowlist** — leads/capture, unsubscribe, webhook endpoints, Inngest, health check, Glofox sync (secured by `CRON_SECRET`)
3. **Auth enforcement** — redirect to `/login` for pages, JSON 401 for API routes
4. **Note:** Uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (non-standard name for anon key)

### CI/CD
- GitHub Actions workflow at `.github/workflows/ci.yml`
- Netlify for deployment

---

## Findings

### CRITICAL
None identified in project structure.

### HIGH
- **HIGH-PS-001:** Next.js 16.2.0 is an extremely recent/possibly pre-release version. The codebase's AGENTS.md explicitly warns that "APIs, conventions, and file structure may all differ from training data." This creates risk for all future development and makes community support harder. Verify this is a stable release, not an RC or canary build.

### MEDIUM
- **MED-PS-001:** The `/api/glofox/sync` and `/api/glofox/backfill` endpoints are listed as PUBLIC_API_ROUTES in middleware (secured by `CRON_SECRET`), but there is no dedicated Netlify scheduled function implemented at `netlify/functions/glofox-sync.mts` — the `netlify.toml` only has commented-out instructions for this. This means the hourly Glofox sync must be triggered by an external cron service, which is not configured in the repo.
- **MED-PS-002:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` is used in middleware as the Supabase anon key. This is a non-standard environment variable name (typical is `NEXT_PUBLIC_SUPABASE_ANON_KEY`). If `.env.local` uses the wrong key name, auth will silently fail.
- **MED-PS-003:** `twilio` is a production dependency despite SMS being described as "stub" and provider-agnostic. Twilio SDK adds bundle weight and if `TWILIO_*` env vars are absent, runtime errors may occur on SMS-related code paths.

### LOW
- **LOW-PS-001:** The `netlify/` directory exists but contains only function infrastructure — no Glofox scheduled function is implemented (per netlify.toml comments). This is a documentation/implementation gap.
- **LOW-PS-002:** The `scripts/` directory contains raw Python and SQL migration files that are not integrated into any automated pipeline — they appear to be one-off data import scripts. They should be documented or archived.
- **LOW-PS-003:** The `(employee)/classes/` and `(employee)/pay/` etc. paths appear to exist as empty/redirect stubs alongside the real `/employee/` routes — both `(employee)/classes` and `(employee)/employee/classes` exist, suggesting routing duplication.

### INFO
- **INFO-PS-001:** 466 TypeScript source files, ~104,986 total lines — this is a large codebase for a Phase 1+2 system.
- **INFO-PS-002:** Turborepo `LOW-014` comment in turbo.json explicitly instructs all packages to use `@meridian/types` — good governance marker.
- **INFO-PS-003:** The `docs/` tree is extensive (PRD, phase plans, research, design guides) and well-organized, indicating disciplined documentation practices.
- **INFO-PS-004:** The middleware RLS comment (`// RLS STATUS: 11 Phase 2 tables...`) is a useful inline architecture note about which tables use `app.studio_id` setting vs. manual studio_id filtering.

---

## Architecture Health Score: 8/10

**Strengths:** Clean feature-based organization, strong shared type discipline, clear module boundaries, well-documented codebase, comprehensive background job infrastructure, thoughtful middleware design.

**Weaknesses:** Very bleeding-edge dependency versions (Next.js 16, React 19, Vitest 4) introduce risk; Glofox cron scheduling is incomplete in infrastructure; minor route duplication in employee portal.
