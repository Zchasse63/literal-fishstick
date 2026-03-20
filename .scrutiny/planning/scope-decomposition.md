# Scope Decomposition — Phase 3 Analytics & Intelligence
**Date:** 2026-03-20

---

## Tier 1: Must Ship (High Value, Well-Scoped)

### Database + Metric Pipeline (Sprint 1)
- [ ] 10 new database tables with indexes and RLS
- [ ] Modify `profiles` table (glofox_id, migration_wave, migrated_at)
- [ ] 6 cron jobs via Inngest (daily-metrics, cohort-refresh, trainer-metrics, ai-insights, report-scheduler, export-cleanup)
- [ ] Analytics data API routes (7 routes)
- [ ] Analytics overview page — live data replacing mock
- [ ] Backfill script + validation step (spot-check 5 dates)
- [ ] **Fix:** Rewrite heatmap and leaderboard RPC functions with CTEs (no correlated subqueries)
- [ ] **Fix:** Verify trainer self-exclusion uses correct column name (`profile_id` not `trainer_id`)
- [ ] **Fix:** Pin "active member" definition for cohort calculations

### Reports Engine (Sprint 2, 3 weeks)
- [ ] **Spike (Week 1, Day 1–2):** Validate `@react-pdf/renderer` on Netlify Node.js function
- [ ] Supabase Storage bucket for exports (bucket config, RLS, signed URL TTL)
- [ ] Saved reports CRUD API (10 routes)
- [ ] Report query builder (translates config to Supabase queries for 13 report types)
- [ ] CSV export with cursor-based streaming (priority over PDF)
- [ ] 13 pre-built report templates (configuration objects)
- [ ] PDF export (if spike passes; else schedule for Sprint 5)
- [ ] Inngest job: `cron/report-scheduler` — email scheduled reports via Resend
- [ ] Inngest job: `cron/export-cleanup` — delete expired export files
- [ ] Report library page (`analytics/reports/page.tsx`)
- [ ] Report viewer page (`analytics/reports/[id]/page.tsx`) — with data freshness indicator
- [ ] Report builder page (`analytics/reports/new/page.tsx`) — 4-step wizard
- [ ] AI report narrative function (`src/lib/ai/report-narrative.ts`)
- [ ] Async export path for large reports (>500 rows → Inngest job + status polling)

### AI Hub + Trainer Dashboards (Sprint 3)
- [ ] AI Insight Generator function (`src/lib/ai/insights-generator.ts`)
- [ ] AI Trainer Comparison function (`src/lib/ai/trainer-comparison.ts`)
- [ ] AI Report Narrative function (`src/lib/ai/report-narrative.ts`)
- [ ] Batch churn prediction Inngest job (with `concurrency: { limit: 10 }`)
- [ ] Revenue anomaly → auto-persist as `ai_insights` row (bridge refactor)
- [ ] AI Insights API routes (5 routes)
- [ ] Trainer performance API routes (5 routes)
- [ ] AI Insights hub page (`analytics/insights/page.tsx`)
- [ ] Trainer performance overview (`analytics/trainers/page.tsx`)
- [ ] Trainer deep-dive (`analytics/trainers/[id]/page.tsx`)

### Pricing Simulator (Sprint 4)
- [ ] **Design:** Stripe price update flow (create new price, update default, migration modal) before coding
- [ ] Pricing simulator API routes (7 routes)
- [ ] AI Pricing Analysis function (`src/lib/ai/pricing-analyzer.ts`)
- [ ] Pricing simulator list page (`analytics/pricing/page.tsx`)
- [ ] Pricing simulator detail page (`analytics/pricing/[id]/page.tsx`)
- [ ] Stripe Apply flow: new price creation + subscriber migration toggle
- [ ] Stripe Revert flow: `previous_price_id` stored, revert button in UI
- [ ] 3 pre-seeded dashboards (Executive Overview, Daily Operations, Growth & Retention) — static builds, no builder

### Glofox Migration + Polish (Sprint 5)
- [ ] Glofox CSV parsers (6 data types) with UTF-8 encoding detection
- [ ] Validation engine (7+ validation rules with detailed error reporting)
- [ ] Import engine with progress tracking
- [ ] **Fix:** Replace rollback SQL column with `migration_row_ids` junction table or `migration_job_id` FK on target tables
- [ ] **Fix:** Add concurrent migration prevention (HTTP 409 check in import route)
- [ ] Migration API routes (7 routes)
- [ ] Migration admin page (`analytics/migration/page.tsx`)
- [ ] Member wave assignment UI + double-billing guard
- [ ] Integration testing: report lifecycle, dashboard data accuracy, AI insight dedup
- [ ] Sidebar navigation updates (Analytics sub-items)
- [ ] Command Palette updates

---

## Tier 2: Deferred to Phase 4 (Low Near-Term Value or Data Problems)

### Custom Dashboard Builder
- [ ] react-grid-layout install and React 19 compatibility check (do in Phase 4)
- [ ] Widget data resolver with capability matrix
- [ ] Dashboard builder UI with drag-and-drop
- [ ] Per-widget configuration panel (12 widget types)
- [ ] Auto-save on drag/resize
- [ ] Dashboard CRUD API (9 routes)
- **Reason:** 2–3 weeks for a feature used infrequently by a 1–2 person admin team. Pre-built dashboards deliver 90% of value. Competes poorly with free BI tools (Metabase).

### Seasonal Predictor AI Function
- [ ] `predictSeasonalTrends()` — 90-day forecast
- **Reason:** Requires 12+ months of live data. Glofox seed data may not span 12 months. Low-confidence output at current data volume.

### Cross-Sell Detection AI Function
- [ ] `detectCrossSellOpportunities()` — member segment cross-sell matrix
- **Reason:** Thin output at 1,103 members with 2 primary product types. Build after Phase 4 adds corporate/events product surface.

---

## Tier 3: Cut (High Cost, Low Value)

### Dashboard Export as PDF
- **Reason:** Requires server-side rendering of arbitrary React component tree. Disproportionate implementation complexity for a very low-frequency use case. Use browser print (`window.print()`) as the alternative.

---

## Edge Cases — Implementation Checklist

- [ ] EC-1: Empty/first-run state on all analytics charts and KPI strip
- [ ] EC-2: Cron gap recovery — `cron/daily-metrics` checks and backfills missing days on startup
- [ ] EC-3: Trainer self-exclusion column name verified against actual `staff` schema
- [ ] EC-4: Concurrent migration prevention (409 Conflict check)
- [ ] EC-5: Pricing Apply rollback path (store `previous_price_id`, add Revert button)
- [ ] EC-6: Stale snapshot data indicator in reports (`data_freshness` field)
- [ ] EC-7: Async export path for large reports
- [ ] EC-8: Cohort chart empty state for <1 month of data
- [ ] EC-9: CSV UTF-8 encoding detection in Glofox parsers
- [ ] EC-10: AI insights skip generation on closed/no-activity days
- [ ] EC-11: Widget resolver handles deleted/unavailable data source gracefully

---

## Architecture — Implementation Checklist

- [ ] All 6 cron jobs use Inngest (not Netlify Scheduled Functions)
- [ ] Inngest batch churn prediction: `concurrency: { limit: 10 }`
- [ ] Widget data resolver uses hardcoded `DATA_SOURCE_MAP` (no dynamic table names)
- [ ] `dashboard_widgets` has own RLS INSERT/UPDATE policies (not delegated to `dashboards`)
- [ ] Revenue anomaly bridge: anomaly detection writes to `ai_insights`, not just `ai_cache`
- [ ] Supabase Storage: bucket `report-exports`, RLS policy, 1-hour signed URL TTL
- [ ] Migration rollback: replace `rollback_sql TEXT` with `migration_row_ids` table
