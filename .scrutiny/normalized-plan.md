# Normalized Plan: Meridian Phase 3 — Analytics & Intelligence

**Scrutiny ID:** phase-3-analytics
**Input Source:** `/Users/zach/Desktop/literal-fishstick/docs/phase-3-plan.md`
**Normalized:** 2026-03-20
**Complexity Class:** SIGNIFICANT (Deep mode — all 7 agents)

---

## 1. Plan Summary

Phase 3 transforms Meridian's analytics stub page (currently mock data) into a fully functional analytics engine. This is the third phase of a fitness studio operating system built for The Sauna Guys (Tampa) and designed to be sold as SaaS to other studios.

**Claimed scope:** 9–10 weeks, single developer, 5 sequential sprints.

**Core deliverables:**
1. Custom drag-and-drop dashboard builder (`react-grid-layout`)
2. Advanced reporting engine: 13 report templates, CSV and PDF export, scheduled email delivery
3. AI Insights Hub: unified feed of AI-generated insights (6 new AI functions)
4. Trainer performance dashboards with AI narratives
5. Pricing simulator with AI revenue impact projections
6. Glofox data migration tooling (Waves 1–3, admin UI + CSV parsers)
7. Materialized metrics pipeline (daily cron jobs, Netlify Scheduled Functions)

---

## 2. What This Replaces / Extends

- **Replaces:** `(admin)/analytics/page.tsx` (hardcoded mock data, no live queries)
- **Extends:** 12 existing AI API routes, 7 AI lib modules, `ai_cache` table, Recharts library, Glofox seed data (1,103 members, 1,393 bookings, 2,015 transactions)
- **New surface area:** ~15 new pages/routes, 10 new DB tables, 6 new AI functions, 6 cron jobs

---

## 3. Technical Approach

### Stack
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Recharts, Framer Motion
- **New libraries:** `react-grid-layout` (drag-and-drop), `@react-pdf/renderer` (PDF export)
- **Backend:** Supabase (Postgres + RLS + Supabase Storage), Supabase RPC functions
- **Scheduled jobs:** Netlify Scheduled Functions (6 cron jobs)
- **AI:** Anthropic Claude via `@anthropic-ai/sdk` (already integrated)
- **Existing infra:** Inngest (batch jobs), Resend (email delivery), Stripe (pricing apply)

### Key Architectural Decisions
- **Materialized snapshot tables** (not computed on every read): `daily_metrics`, `cohort_snapshots`, `trainer_metric_snapshots`
- **pgvector deferred** — natural language analytics queries stubbed, deferred to Phase 4
- **Glofox migration:** admin UI + manual admin trigger (not a public endpoint)
- **PDF capped at 10,000 rows** with truncation notice
- **AI insight deduplication** via `fingerprint` column (same type + title within 7 days = skip)
- **Dashboard widget data** fetched in parallel (client-side Promise.all)

### New Database Tables (10)
1. `daily_metrics` — pre-aggregated daily attendance + revenue + member metrics
2. `cohort_snapshots` — monthly retention cohorts
3. `trainer_metric_snapshots` — monthly trainer performance with cached AI output
4. `dashboards` — user-created dashboard configs
5. `dashboard_widgets` — individual widget configs per dashboard
6. `saved_reports` — report configurations with scheduling support
7. `report_exports` — history of generated export files
8. `ai_insights` — persisted AI-generated insights (separate from `ai_cache`)
9. `pricing_simulations` — saved what-if pricing scenarios
10. `migration_jobs` — Glofox import job tracking

### New API Routes (35+)
- `/api/analytics/*` (7 routes)
- `/api/dashboards/*` (9 routes)
- `/api/reports/*` (10 routes)
- `/api/ai/insights/*` (5 routes)
- `/api/trainers/*` (5 routes)
- `/api/pricing-simulator/*` (7 routes)
- `/api/migration/*` (7 routes)

### New AI Functions (6)
1. `generateInsights()` — 3–8 prioritized insights from 30-day metrics snapshot
2. `analyzePricingScenario()` — revenue impact + churn risk projections
3. `generateReportNarrative()` — 3–5 sentence natural language report summary
4. `compareTrainers()` — team-level narrative + scheduling suggestions
5. `detectCrossSellOpportunities()` — member segment cross-sell matrix
6. `predictSeasonalTrends()` — 90-day booking/revenue forecast

### New Cron Jobs (6)
1. `cron/daily-metrics` — daily at 2 AM ET
2. `cron/cohort-refresh` — 1st of month, 3 AM ET
3. `cron/trainer-metrics` — 1st of month, 4 AM ET
4. `cron/ai-insights` — daily at 6 AM ET
5. `cron/report-scheduler` — daily at 7 AM ET
6. `cron/export-cleanup` — weekly Sunday, 3 AM ET

### New Pages (10)
- Analytics Overview (live data, replaces mock)
- Dashboard List
- Custom Dashboard Builder (drag-and-drop)
- Report Library
- Report Viewer
- Report Builder (4-step wizard)
- AI Insights Hub
- Trainer Performance Overview
- Trainer Deep-Dive
- Pricing Simulator List + Detail
- Glofox Migration Admin

---

## 4. Sprint Plan

| Sprint | Weeks | Theme | Key Deliverables |
|--------|-------|-------|------------------|
| 1 | 1–2 | DB + Metric Pipeline | 10 tables, 6 cron jobs, analytics overview live |
| 2 | 3–4.5 | Reports Engine | CSV/PDF export, 13 templates, scheduled email |
| 3 | 5–6.5 | AI Hub + Trainer Dashboards | 6 AI functions, insights hub, trainer pages |
| 4 | 7–8.5 | Dashboards + Pricing Simulator | react-grid-layout, drag-and-drop, Stripe apply |
| 5 | 9–10 | Migration + Polish + Tests | Glofox CSV parsers, validation, rollback |

---

## 5. Dependencies

### Hard Dependencies (all met — Phase 1 complete)
- `profiles`, `members`, `bookings`, `classes`, `transactions`, `staff` tables with live data
- `ai_cache` table
- Supabase Auth + RLS
- Anthropic SDK integration
- Recharts, Revenue API, Member/Staff APIs

### Soft Dependencies (Phase 2)
- `campaigns` table — required by Campaign Performance Report template (graceful degradation if absent)
- `leads` table — required by Lead Pipeline Report template (graceful degradation)
- Inngest infrastructure — already built in Phase 2, used for batch churn prediction
- Resend — already complete from Phase 1

---

## 6. Existing System Context

### Codebase State (scanned 2026-03-20)

**Repo structure:** Turborepo monorepo (`apps/web`, `apps/supabase`, `packages/types`, `packages/utils`)

**Web app:** Next.js 16.2.0, React 19.2.4, TypeScript 5, Tailwind CSS v4

**Key existing dependencies relevant to Phase 3:**
- `recharts ^2.15.4` — already installed, used in analytics + revenue pages
- `@anthropic-ai/sdk ^0.80.0` — already integrated, 12 AI routes exist
- `inngest ^4.0.2` — already integrated
- `resend ^6.9.4` — already integrated, email delivery working
- `stripe ^20.4.1` — already integrated
- `framer-motion ^12.4.10` — used throughout admin pages
- `@tanstack/react-query ^5.72.0` — available for data fetching
- `zod ^3.24.0` — used for validation

**NOT yet installed (required by Phase 3 plan):**
- `react-grid-layout` — drag-and-drop dashboard builder
- `@react-pdf/renderer` — server-side PDF generation

**Existing AI lib modules:**
- `churn-prediction.ts`, `booking-patterns.ts`, `revenue-anomaly.ts`, `trainer-summary.ts`, `intake-enrichment.ts`, `auto-reply.ts`, `waitlist-messaging.ts`

**Existing AI API routes (12):**
- `/api/ai/briefing`, `/api/ai/recommendations`, `/api/ai/churn-prediction`, `/api/ai/booking-patterns`, `/api/ai/revenue-anomaly`, `/api/ai/trainer-summary`, `/api/ai/intake-enrichment`, `/api/ai/auto-reply`, `/api/ai/waitlist-message`, `/api/ai/campaign-copy`, `/api/ai/health-score`, `/api/ai/search`

**Existing admin pages:** analytics (mock), revenue (live), members, schedule, operations, marketing, engagement, segments, settings

**Scripts directory:** Glofox seed SQL files already imported (members, bookings, transactions, classes). `phase2-migration.sql` and `phase2-rpc-functions.sql` exist as format references.

**Analytics page status:** `(admin)/analytics/page.tsx` — stub with hardcoded mock data. No live queries.

**DB pattern:** Every table has `studio_id` + RLS. Phase 2 migration SQL exists as reference. RPC functions in separate file (`phase2-rpc-functions.sql`).

**Netlify functions:** Plan references Netlify Scheduled Functions for cron jobs. Inngest is also available and already integrated. Plan uses both (Netlify for simple metric snapshots, Inngest for complex batch jobs).

**Stripe integration:** `stripe ^20.4.1` installed. Pricing simulator "Apply Changes" flow will call Stripe to update price objects — this touches live billing infrastructure.

---

## 7. Stated Risks / Open Questions (from plan)

1. **pgvector deferred** — natural language queries stubbed
2. **Phase 2 dependency** — 2 of 13 report templates depend on campaigns/leads tables
3. **Backfill script** — historical `daily_metrics` rows must be generated from existing seed data before analytics overview can show meaningful charts
4. **Double-billing guard** — Glofox renewal date tracking is a manual workflow risk (not automated)
5. **PDF size cap** — 10,000 row cap; no strategy for notifying users before they hit the cap

---

## 8. Success Criteria (as stated in plan)

- Analytics overview page live with real data (Sprint 1)
- Full report engine with CSV + PDF export and scheduled delivery (Sprint 2)
- AI insights surfaced in unified hub (Sprint 3)
- Drag-and-drop dashboards operational (Sprint 4)
- Glofox migration tooling ready for Wave 1 execution (Sprint 5)
