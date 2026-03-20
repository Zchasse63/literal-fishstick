# Phase 3: Analytics & Intelligence -- Implementation Plan

**Version:** 2.0 FINAL (Post-Scrutiny)
**Date:** March 20, 2026
**Status:** APPROVED — Ready for implementation

---

## 1. Executive Summary

Phase 3 transforms Meridian's analytics/page.tsx stub (mock data, hardcoded charts) into a fully functional analytics engine with custom dashboards, AI-powered insights surfacing, advanced reporting with CSV/PDF export, trainer performance dashboards, a pricing simulator, and Glofox data migration tooling (Waves 1-3). The foundation exists: 12 AI API routes, 7 AI lib modules (churn prediction, booking patterns, revenue anomaly detection, trainer summaries), the `ai_cache` table, Recharts charting library, and real data from Glofox seed imports (1,103 members, 1,393 bookings, 2,015 transactions).

**Build order:** Database schema (materialized metrics + report config tables) -> RPC functions for aggregation -> API routes -> UI pages (reports first, then dashboards, then AI insights, then pricing simulator, then Glofox migration tooling).

**Estimated scope:** ~11 weeks for a single developer, broken into 5 sprints built sequentially.

**Key architectural decisions:**
- **Materialized views + scheduled refresh** for analytics aggregation (not computed on every read)
- **All cron jobs via Inngest** (not Netlify Scheduled Functions — Inngest provides retries, monitoring, and >10s timeout)
- **CSV export first, PDF after validation spike** — `@react-pdf/renderer` needs Netlify validation before committing
- **3 pre-built dashboards only** — custom drag-and-drop dashboard builder deferred to Phase 4 (see `docs/future-plans.md`)
- **No new charting library** -- continue with Recharts (already installed, used on analytics and revenue pages)
- **Stripe price immutability handled** — pricing simulator creates new Price objects, not updates (Stripe Prices are immutable)
- **Glofox migration: admin UI + CLI scripts** -- not a public endpoint. Admin-triggered with progress tracking. Concurrent migration prevention via 409 Conflict.
- **pgvector** deferred -- natural language analytics queries require embedding infrastructure that adds scope. Stub the UI, build in Phase 4.

**Post-scrutiny changes (v2.0):**
- ❌ Cut: Custom dashboard builder (react-grid-layout) → deferred to Phase 4
- ❌ Cut: Dashboard Export as PDF → use browser print
- ✅ Keep: Seasonal Predictor AI (12+ months of Glofox historical data available)
- ✅ Keep: Cross-sell Detection AI
- 🔧 Fix: RPC correlated subquery bugs → rewritten with CTEs
- 🔧 Fix: All crons consolidated to Inngest (no Netlify Scheduled Functions)
- 🔧 Fix: Stripe price immutability flow designed upfront
- 🔧 Fix: Migration rollback_sql → migration_row_ids junction table
- 🔧 Add: Cron gap recovery, empty state handling, concurrent migration prevention, async export for large reports, batch AI concurrency limits

---

## 2. What Already Exists (Phase 1-2 Foundation)

| Component | Status | Location |
|---|---|---|
| AI Briefing generator (Claude) | Complete | `src/lib/anthropic.ts` -> `generateBriefing()` |
| AI Recommendations generator (4 types) | Complete | `src/lib/anthropic.ts` -> `generateRecommendations()` |
| AI Churn Prediction (per-member) | Complete | `src/lib/ai/churn-prediction.ts` |
| AI Booking Pattern Analysis (90-day) | Complete | `src/lib/ai/booking-patterns.ts` |
| AI Revenue Anomaly Detection (8-week trailing) | Complete | `src/lib/ai/revenue-anomaly.ts` |
| AI Trainer Summary (per-trainer narrative) | Complete | `src/lib/ai/trainer-summary.ts` |
| AI Intake Enrichment | Complete | `src/lib/ai/intake-enrichment.ts` |
| AI Auto-Reply | Complete | `src/lib/ai/auto-reply.ts` |
| AI Waitlist Messaging | Complete | `src/lib/ai/waitlist-messaging.ts` |
| AI Campaign Copy Generator | Complete | `src/lib/anthropic.ts` -> `generateCampaignCopy()` |
| AI Cache table (`ai_cache`) | Complete | Supabase, used by all AI routes |
| Analytics page (mock data, 5 widgets) | Stub | `(admin)/analytics/page.tsx` |
| Revenue page (live data, charts) | Complete | `(admin)/revenue/page.tsx` |
| Revenue API (7d/30d/90d/12m periods) | Complete | `api/revenue/route.ts` |
| Members API with segments | Complete | `api/members/route.ts`, `api/segments/route.ts` |
| Staff API | Complete | `api/staff/route.ts` |
| Recharts library | Installed | Used in analytics + revenue pages |
| Framer Motion | Installed | Used in all admin pages |
| Glofox member import (1,103 profiles) | Complete | `scripts/seed-members.sql` |
| Glofox booking import (1,393 bookings) | Complete | `scripts/seed-bookings-transactions-v2.sql` |
| Glofox transaction import (2,015 transactions) | Complete | `scripts/seed-bookings-transactions-v2.sql` |
| Glofox class import (7 chunk files) | Complete | `scripts/classes_chunk_0.sql` through `classes_chunk_6.sql` |
| TypeScript types (Trainer, Revenue, Member) | Complete | `packages/types/src/trainers.ts`, `revenue.ts`, `members.ts` |
| Inngest infrastructure | Complete | `src/lib/inngest/` |

**Gap analysis:** Analytics page is entirely mock data. No materialized metrics tables. No report generation (CSV or PDF). No dashboard widget builder. No trainer performance sub-page. No pricing simulator. No migration admin UI (scripts exist but run manually via psql). Existing AI features are per-route and not surfaced in a unified insights hub.

---

## 3. Database Schema (New Tables & Modifications)

### 3.1 New Tables

```sql
-- ============================================================================
-- Meridian Phase 3: Analytics & Intelligence -- Database Migration
-- ============================================================================

BEGIN;

-- ==========================================
-- DAILY METRIC SNAPSHOTS
-- Pre-aggregated daily metrics for fast chart rendering.
-- Populated by Netlify Scheduled Function (daily at 2am studio time).
-- ==========================================
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  metric_date DATE NOT NULL,

  -- Attendance
  total_bookings INT DEFAULT 0,
  total_check_ins INT DEFAULT 0,
  total_no_shows INT DEFAULT 0,
  total_late_cancellations INT DEFAULT 0,
  total_walk_ins INT DEFAULT 0,
  unique_members_visited INT DEFAULT 0,
  avg_class_fill_rate DECIMAL(5,2) DEFAULT 0, -- percentage
  classes_held INT DEFAULT 0,
  total_capacity INT DEFAULT 0,

  -- Revenue (cents)
  revenue_total INT DEFAULT 0,
  revenue_memberships INT DEFAULT 0,
  revenue_credit_packs INT DEFAULT 0,
  revenue_drop_ins INT DEFAULT 0,
  revenue_merch INT DEFAULT 0,
  revenue_gift_cards INT DEFAULT 0,
  revenue_corporate INT DEFAULT 0,
  revenue_events INT DEFAULT 0,
  refunds_total INT DEFAULT 0,

  -- Members
  active_members INT DEFAULT 0,
  new_members INT DEFAULT 0,
  churned_members INT DEFAULT 0,
  paused_members INT DEFAULT 0,
  at_risk_members INT DEFAULT 0,

  -- Financials
  mrr INT DEFAULT 0, -- monthly recurring revenue (cents)
  arpm INT DEFAULT 0, -- average revenue per member (cents)

  -- Trainer
  trainer_classes_led INT DEFAULT 0,
  trainer_bonus_classes INT DEFAULT 0, -- classes exceeding bonus threshold

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(studio_id, metric_date)
);

-- ==========================================
-- MONTHLY COHORT SNAPSHOTS
-- One row per signup-month cohort per measurement month.
-- Used for cohort retention charts.
-- ==========================================
CREATE TABLE cohort_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  cohort_month DATE NOT NULL, -- first of month when members signed up
  measurement_month DATE NOT NULL, -- first of month being measured
  months_since_signup INT NOT NULL, -- 0, 1, 2, ...
  cohort_size INT NOT NULL, -- members who signed up in cohort_month
  retained_count INT NOT NULL, -- members still active in measurement_month
  retention_rate DECIMAL(5,2) NOT NULL, -- percentage

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(studio_id, cohort_month, measurement_month)
);

-- ==========================================
-- TRAINER METRIC SNAPSHOTS
-- Monthly aggregated trainer performance.
-- Populated by Netlify Scheduled Function (1st of each month for prior month).
-- ==========================================
CREATE TABLE trainer_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  trainer_id UUID NOT NULL REFERENCES profiles(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Performance
  total_classes INT DEFAULT 0,
  total_check_ins INT DEFAULT 0,
  avg_attendance DECIMAL(5,2) DEFAULT 0,
  avg_capacity_utilization DECIMAL(5,2) DEFAULT 0,
  classes_above_bonus_threshold INT DEFAULT 0,
  unique_members_served INT DEFAULT 0,
  repeat_member_rate DECIMAL(5,2) DEFAULT 0,

  -- Revenue attribution (cents)
  promo_code_conversions INT DEFAULT 0,
  revenue_attributed INT DEFAULT 0,

  -- Compensation (cents)
  base_pay INT DEFAULT 0,
  bonus_pay INT DEFAULT 0,
  promo_commission INT DEFAULT 0,
  total_compensation INT DEFAULT 0,

  -- AI summary (cached)
  ai_narrative TEXT,
  ai_highlights JSONB, -- string[]
  ai_growth_areas JSONB, -- string[]
  ai_overall_rating TEXT,
  ai_generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(studio_id, trainer_id, period_start)
);

-- ==========================================
-- NOTE: Custom dashboard builder (dashboards + dashboard_widgets tables)
-- DEFERRED to Phase 4. Phase 3 ships 3 pre-built dashboard pages
-- (Executive Overview, Daily Operations, Growth & Retention) as
-- hardcoded React components consuming analytics API routes.
-- See docs/future-plans.md for the full dashboard builder spec.
-- ==========================================

-- ==========================================
-- SAVED REPORTS
-- Report configurations that can be re-run and scheduled.
-- ==========================================
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),

  report_type TEXT NOT NULL CHECK (report_type IN (
    'attendance', 'revenue', 'membership', 'trainer_payroll',
    'trainer_performance', 'churn_risk', 'class_performance',
    'credit_pack_usage', 'transaction_log', 'failed_payments',
    'member_movement', 'campaign_performance', 'lead_pipeline',
    'custom'
  )),

  -- Configuration
  columns JSONB NOT NULL DEFAULT '[]', -- selected columns to include
  filters JSONB DEFAULT '{}', -- filter conditions
  sort_by TEXT,
  sort_direction TEXT DEFAULT 'desc' CHECK (sort_direction IN ('asc', 'desc')),
  time_range TEXT DEFAULT '30d',
  custom_start DATE,
  custom_end DATE,
  group_by TEXT,

  -- Scheduling (optional)
  schedule_frequency TEXT CHECK (schedule_frequency IN ('daily', 'weekly', 'monthly', NULL)),
  schedule_day INT, -- day of week (0-6) or day of month (1-31)
  schedule_recipients TEXT[] DEFAULT '{}', -- email addresses
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,

  -- Export defaults
  default_format TEXT DEFAULT 'csv' CHECK (default_format IN ('csv', 'pdf')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- REPORT EXPORTS (history of generated reports)
-- ==========================================
CREATE TABLE report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES saved_reports(id) ON DELETE SET NULL,
  studio_id UUID NOT NULL,
  generated_by UUID REFERENCES profiles(id),

  report_type TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('csv', 'pdf')),
  file_url TEXT, -- Supabase Storage URL
  file_size_bytes INT,
  row_count INT,

  -- Snapshot of config at generation time
  config_snapshot JSONB NOT NULL,

  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- auto-cleanup old exports
);

-- ==========================================
-- AI INSIGHTS LOG
-- Persisted AI-generated insights for the insights hub.
-- Different from ai_cache: these are curated, reviewable insights.
-- ==========================================
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),

  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'scheduling', 'pricing', 'retention', 'revenue',
    'trainer', 'growth', 'anomaly', 'seasonal', 'cross_sell'
  )),

  title TEXT NOT NULL,
  summary TEXT NOT NULL, -- 1-3 sentence summary
  detail TEXT, -- longer explanation
  data_points JSONB, -- supporting data

  -- Actionability
  recommended_action TEXT,
  action_url TEXT, -- deep link to relevant page
  urgency TEXT DEFAULT 'info' CHECK (urgency IN ('info', 'suggestion', 'attention', 'urgent')),

  -- Lifecycle
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'actioned', 'expired')),
  dismissed_by UUID REFERENCES profiles(id),
  dismissed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,

  -- Deduplication: same insight_type + same title within 7 days = skip
  fingerprint TEXT, -- hash of key data points for dedup

  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- auto-expire stale insights
);

-- ==========================================
-- PRICING SIMULATIONS
-- Saved what-if pricing scenarios.
-- ==========================================
CREATE TABLE pricing_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  created_by UUID NOT NULL REFERENCES profiles(id),

  name TEXT NOT NULL,
  description TEXT,

  -- Scenario definition
  changes JSONB NOT NULL,
  -- [{ "plan_id": "uuid", "plan_name": "Unlimited", "current_price": 14900, "new_price": 16900 }]

  -- AI-generated projections
  projections JSONB,
  -- { "revenue_impact_monthly": 2400, "churn_risk_increase": 3.2, "upgrade_probability": ... }
  ai_narrative TEXT,

  -- Metadata
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'analyzed', 'applied', 'reverted')),
  applied_at TIMESTAMPTZ, -- if the admin actually changed prices
  previous_price_ids JSONB, -- [{ "plan_id": "uuid", "old_stripe_price_id": "price_xxx", "new_stripe_price_id": "price_yyy" }] for revert

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- GLOFOX MIGRATION JOBS
-- Tracks migration progress per wave.
-- ==========================================
CREATE TABLE migration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  triggered_by UUID NOT NULL REFERENCES profiles(id),

  wave INT NOT NULL CHECK (wave IN (1, 2, 3)),
  data_type TEXT NOT NULL CHECK (data_type IN (
    'members', 'bookings', 'transactions', 'classes',
    'credit_balances', 'memberships', 'promo_codes'
  )),

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'validating', 'importing', 'completed', 'failed', 'rolled_back'
  )),

  -- File reference
  source_file_url TEXT, -- Supabase Storage URL of uploaded CSV
  source_row_count INT,

  -- Progress
  processed_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  skip_count INT DEFAULT 0, -- duplicates, already-imported rows

  -- Error log
  errors JSONB DEFAULT '[]',
  -- [{ "row": 42, "email": "x@y.com", "error": "duplicate profile", "severity": "skip" }]

  -- Validation results (pre-import check)
  validation_results JSONB,
  -- { "valid_rows": 1050, "invalid_rows": 53, "issues": [...] }

  -- Rollback support (uses migration_job_id on target tables, not stored SQL)
  rolled_back_at TIMESTAMPTZ,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Indexes

```sql
-- Daily metrics: fast range queries by studio + date
CREATE INDEX idx_daily_metrics_studio_date ON daily_metrics(studio_id, metric_date DESC);

-- Cohort snapshots: fast cohort lookups
CREATE INDEX idx_cohort_snapshots_studio ON cohort_snapshots(studio_id, cohort_month, measurement_month);

-- Trainer snapshots: fast trainer + period lookups
CREATE INDEX idx_trainer_metrics_studio_trainer ON trainer_metric_snapshots(studio_id, trainer_id, period_start DESC);

-- Saved reports: per-studio, scheduled reports
CREATE INDEX idx_saved_reports_studio ON saved_reports(studio_id);
CREATE INDEX idx_saved_reports_scheduled ON saved_reports(studio_id, next_send_at) WHERE schedule_frequency IS NOT NULL;

-- Report exports: per-studio, cleanup by expiry
CREATE INDEX idx_report_exports_studio ON report_exports(studio_id, generated_at DESC);
CREATE INDEX idx_report_exports_expiry ON report_exports(expires_at) WHERE expires_at IS NOT NULL;

-- AI insights: per-studio, active only
CREATE INDEX idx_ai_insights_studio_active ON ai_insights(studio_id, status, generated_at DESC) WHERE status = 'active';
CREATE INDEX idx_ai_insights_fingerprint ON ai_insights(studio_id, fingerprint);

-- Pricing simulations: per-studio
CREATE INDEX idx_pricing_sims_studio ON pricing_simulations(studio_id, created_at DESC);

-- Migration jobs: per-studio
CREATE INDEX idx_migration_jobs_studio ON migration_jobs(studio_id, wave, data_type);
```

### 3.3 RLS Policies

```sql
-- All Phase 3 tables follow the same pattern: studio_id must match the user's studio
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_jobs ENABLE ROW LEVEL SECURITY;

-- Pattern for each table (example: daily_metrics)
CREATE POLICY "Studio members can view their studio metrics"
  ON daily_metrics FOR SELECT
  USING (studio_id IN (
    SELECT studio_id FROM profiles WHERE id = auth.uid()
  ));

-- Only owners/managers can create dashboards, reports, simulations, migration jobs
-- Trainers can view dashboards and their own trainer metrics
-- (Same RLS pattern as Phase 2 -- role check via profiles.roles)
```

### 3.4 RPC Functions (Supabase Edge)

```sql
-- ==========================================
-- Aggregate daily metrics for a date range
-- Returns the data needed for line/area charts
-- ==========================================
CREATE OR REPLACE FUNCTION get_daily_metrics(
  p_studio_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  metric_date DATE,
  total_bookings INT,
  total_check_ins INT,
  unique_members_visited INT,
  avg_class_fill_rate DECIMAL,
  revenue_total INT,
  revenue_memberships INT,
  revenue_credit_packs INT,
  revenue_drop_ins INT,
  active_members INT,
  new_members INT,
  churned_members INT,
  mrr INT,
  arpm INT
) LANGUAGE sql STABLE AS $$
  SELECT
    dm.metric_date,
    dm.total_bookings,
    dm.total_check_ins,
    dm.unique_members_visited,
    dm.avg_class_fill_rate,
    dm.revenue_total,
    dm.revenue_memberships,
    dm.revenue_credit_packs,
    dm.revenue_drop_ins,
    dm.active_members,
    dm.new_members,
    dm.churned_members,
    dm.mrr,
    dm.arpm
  FROM daily_metrics dm
  WHERE dm.studio_id = p_studio_id
    AND dm.metric_date BETWEEN p_start_date AND p_end_date
  ORDER BY dm.metric_date ASC;
$$;

-- ==========================================
-- Compute class fill rate heatmap from live data
-- Returns fill rate by day-of-week x time-slot
-- FIXED: Uses CTE instead of correlated subqueries (scrutiny finding #1)
-- ==========================================
CREATE OR REPLACE FUNCTION get_attendance_heatmap(
  p_studio_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_class_type TEXT DEFAULT NULL -- NULL = all, 'open', 'guided'
) RETURNS TABLE (
  day_of_week INT, -- 0=Mon, 6=Sun
  hour_of_day INT,
  avg_fill_rate DECIMAL,
  total_classes INT,
  total_check_ins INT,
  total_capacity INT
) LANGUAGE sql STABLE AS $$
  WITH class_checkins AS (
    SELECT b.class_id, COUNT(*) AS checkin_count
    FROM bookings b
    WHERE b.status = 'checked_in'
    GROUP BY b.class_id
  )
  SELECT
    EXTRACT(ISODOW FROM c.starts_at)::INT - 1 AS day_of_week,
    EXTRACT(HOUR FROM c.starts_at)::INT AS hour_of_day,
    CASE WHEN SUM(c.capacity) > 0
      THEN ROUND(SUM(COALESCE(cc.checkin_count, 0))::DECIMAL / SUM(c.capacity) * 100, 1)
      ELSE 0 END AS avg_fill_rate,
    COUNT(*)::INT AS total_classes,
    SUM(COALESCE(cc.checkin_count, 0))::INT AS total_check_ins,
    SUM(c.capacity)::INT AS total_capacity
  FROM classes c
  LEFT JOIN class_checkins cc ON cc.class_id = c.id
  WHERE c.studio_id = p_studio_id
    AND c.starts_at::DATE BETWEEN p_start_date AND p_end_date
    AND (p_class_type IS NULL OR c.class_type = p_class_type)
  GROUP BY day_of_week, hour_of_day
  ORDER BY day_of_week, hour_of_day;
$$;

-- ==========================================
-- Compute trainer leaderboard for a period
-- FIXED: Uses CTE instead of correlated subqueries (scrutiny finding #1)
-- FIXED: Uses t.profile_id not t.trainer_id (scrutiny finding #2)
-- ==========================================
CREATE OR REPLACE FUNCTION get_trainer_leaderboard(
  p_studio_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  trainer_id UUID,
  trainer_name TEXT,
  total_classes INT,
  total_check_ins INT,
  avg_attendance DECIMAL,
  bonus_classes INT,
  revenue_attributed INT,
  promo_conversions INT
) LANGUAGE sql STABLE AS $$
  WITH class_checkins AS (
    SELECT
      b.class_id,
      COUNT(*) FILTER (WHERE b.status = 'checked_in') AS checkin_count,
      b.member_id
    FROM bookings b
    WHERE b.status = 'checked_in'
    GROUP BY b.class_id, b.member_id
  ),
  class_stats AS (
    SELECT
      c.id AS class_id,
      c.trainer_id AS staff_id,
      COALESCE(SUM(cc.checkin_count) FILTER (WHERE cc.member_id != s.profile_id), 0) AS non_trainer_checkins
    FROM classes c
    JOIN staff s ON c.trainer_id = s.id
    LEFT JOIN class_checkins cc ON cc.class_id = c.id
    WHERE c.studio_id = p_studio_id
      AND c.starts_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY c.id, c.trainer_id, s.profile_id
  )
  SELECT
    t.profile_id AS trainer_id,
    p.full_name AS trainer_name,
    COUNT(DISTINCT cs.class_id)::INT AS total_classes,
    SUM(cs.non_trainer_checkins)::INT AS total_check_ins,
    CASE WHEN COUNT(DISTINCT cs.class_id) > 0
      THEN ROUND(SUM(cs.non_trainer_checkins)::DECIMAL / COUNT(DISTINCT cs.class_id), 1)
      ELSE 0 END AS avg_attendance,
    SUM(CASE WHEN cs.non_trainer_checkins >= 7 THEN 1 ELSE 0 END)::INT AS bonus_classes,
    COALESCE(tms.revenue_attributed, 0)::INT AS revenue_attributed,
    COALESCE(tms.promo_code_conversions, 0)::INT AS promo_conversions
  FROM class_stats cs
  JOIN staff t ON cs.staff_id = t.id
  JOIN profiles p ON t.profile_id = p.id
  LEFT JOIN trainer_metric_snapshots tms
    ON tms.trainer_id = t.profile_id
    AND tms.period_start = p_start_date
    AND tms.studio_id = p_studio_id
  GROUP BY t.profile_id, p.full_name, tms.revenue_attributed, tms.promo_code_conversions
  ORDER BY total_check_ins DESC;
$$;
```

### 3.5 Modifications to Existing Tables

```sql
-- Add Glofox tracking fields to profiles for migration wave management
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS glofox_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS glofox_renewal_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS migration_wave INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;

-- Index for migration lookups
CREATE INDEX IF NOT EXISTS idx_profiles_glofox_id ON profiles(glofox_id) WHERE glofox_id IS NOT NULL;

-- Add last_report_sent tracking to studios for cron management
ALTER TABLE studios ADD COLUMN IF NOT EXISTS daily_metrics_last_run TIMESTAMPTZ;

-- Migration rollback tracking: add migration_job_id to tables receiving imported data
-- Used for rollback instead of storing DELETE SQL strings (scrutiny fix)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS migration_job_id UUID REFERENCES migration_jobs(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS migration_job_id UUID REFERENCES migration_jobs(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS migration_job_id UUID REFERENCES migration_jobs(id);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS migration_job_id UUID REFERENCES migration_jobs(id);

CREATE INDEX IF NOT EXISTS idx_profiles_migration_job ON profiles(migration_job_id) WHERE migration_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_migration_job ON bookings(migration_job_id) WHERE migration_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_migration_job ON transactions(migration_job_id) WHERE migration_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classes_migration_job ON classes(migration_job_id) WHERE migration_job_id IS NOT NULL;
```

---

## 4. API Routes

### 4.1 Analytics Data

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/analytics/daily-metrics` | Get daily metric snapshots (query: start_date, end_date) |
| GET | `/api/analytics/cohorts` | Get cohort retention data (query: months_back) |
| GET | `/api/analytics/heatmap` | Get attendance heatmap (query: start_date, end_date, class_type) |
| GET | `/api/analytics/summary` | Get KPI summary cards (MRR, ARPM, churn rate, fill rate, etc.) |
| GET | `/api/analytics/revenue-breakdown` | Revenue by source for a period |
| GET | `/api/analytics/member-movement` | New, churned, net change over time |
| POST | `/api/analytics/snapshot` | Trigger manual metric snapshot (admin only) |

### 4.2 Dashboards

**DEFERRED to Phase 4.** Phase 3 ships 3 pre-built dashboard pages as hardcoded React components. No dashboard CRUD API needed.

### 4.3 Reports

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/reports` | List saved reports |
| POST | `/api/reports` | Create saved report configuration |
| GET | `/api/reports/[id]` | Get report config |
| PUT | `/api/reports/[id]` | Update report config |
| DELETE | `/api/reports/[id]` | Delete saved report |
| POST | `/api/reports/[id]/generate` | Generate report (returns data or triggers file creation) |
| POST | `/api/reports/[id]/export` | Export report as CSV or PDF (returns Supabase Storage URL) |
| GET | `/api/reports/[id]/exports` | List past exports for this report |
| GET | `/api/reports/exports/[exportId]/download` | Download a generated file |
| POST | `/api/reports/templates` | List pre-built report templates |

**Pre-built report templates** (returned by `/api/reports/templates`):

1. **Attendance Report** -- Daily/weekly attendance with fill rates, no-show rates, walk-in counts
2. **Revenue Report** -- Revenue by source, day, week, or month with totals and trends
3. **Membership Report** -- Active, paused, cancelled, new, churned members with movement
4. **Trainer Payroll Report** -- Per-trainer: classes led, check-ins, base pay, bonuses, promo commissions, total compensation
5. **Trainer Performance Report** -- Per-trainer: avg attendance, fill rate, bonus hit rate, member satisfaction
6. **Churn Risk Report** -- Members ranked by churn probability with contributing factors
7. **Class Performance Report** -- Per-class: avg attendance, revenue generated, fill rate trends
8. **Credit Pack Usage Report** -- Active packs, usage rates, expiring soon, expired unused
9. **Transaction Log** -- All transactions with filters (date, type, member, amount)
10. **Failed Payments Report** -- Overdue payments with dunning status, days overdue, amount
11. **Member Movement Report** -- Net member change over time (new - churned) with sources
12. **Campaign Performance Report** -- Campaign metrics with open/click/conversion rates (requires Phase 2)
13. **Lead Pipeline Report** -- Lead counts by stage, conversion rates, source attribution (requires Phase 2)

### 4.4 AI Insights

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/ai/insights` | List active AI insights for the studio |
| POST | `/api/ai/insights/generate` | Trigger full insight generation cycle |
| PUT | `/api/ai/insights/[id]/dismiss` | Dismiss an insight |
| PUT | `/api/ai/insights/[id]/action` | Mark insight as actioned |
| GET | `/api/ai/insights/history` | Historical insights (including dismissed/actioned) |

### 4.5 Trainer Performance

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/trainers/performance` | List all trainers with current-period metrics |
| GET | `/api/trainers/[id]/performance` | Single trainer detailed performance |
| GET | `/api/trainers/[id]/performance/history` | Trainer metric snapshots over time |
| POST | `/api/trainers/[id]/performance/summary` | Generate/refresh AI trainer summary |
| GET | `/api/trainers/leaderboard` | Trainer leaderboard for a period |

### 4.6 Pricing Simulator

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/pricing-simulator` | List saved simulations |
| POST | `/api/pricing-simulator` | Create new simulation |
| GET | `/api/pricing-simulator/[id]` | Get simulation detail |
| PUT | `/api/pricing-simulator/[id]` | Update simulation parameters |
| DELETE | `/api/pricing-simulator/[id]` | Delete simulation |
| POST | `/api/pricing-simulator/[id]/analyze` | Run AI analysis on the scenario |
| GET | `/api/pricing-simulator/current-plans` | Get current pricing plans with subscriber counts |

### 4.7 Glofox Migration

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/migration/jobs` | List all migration jobs |
| POST | `/api/migration/upload` | Upload a Glofox CSV export file (Supabase Storage) |
| POST | `/api/migration/validate` | Validate uploaded CSV (dry run -- parse, deduplicate, show issues) |
| POST | `/api/migration/import` | Start import job (creates migration_job, processes rows) |
| GET | `/api/migration/jobs/[id]` | Get job progress + error log |
| POST | `/api/migration/jobs/[id]/rollback` | Rollback a completed import |
| GET | `/api/migration/status` | Overview: what has been imported, what hasn't, member wave assignments |

### 4.8 Scheduled Functions (All Inngest — No Netlify Scheduled Functions)

All cron jobs run via Inngest for retries, monitoring, and no 10-second timeout constraint.

| Inngest Function | Cron Schedule | Purpose |
|---|---|---|
| `cron/daily-metrics` | `0 7 * * *` (2 AM ET / 7 AM UTC) | Aggregate previous day's metrics into `daily_metrics`. **Must check `MAX(metric_date)` and backfill gaps.** |
| `cron/cohort-refresh` | `0 8 1 * *` (1st of month, 3 AM ET) | Refresh all cohort retention snapshots |
| `cron/trainer-metrics` | `0 9 1 * *` (1st of month, 4 AM ET) | Aggregate prior month trainer performance |
| `cron/ai-insights` | `0 11 * * *` (6 AM ET / 11 AM UTC) | Generate AI insights from recent data. **Concurrency limit: 10** (Anthropic rate limits) |
| `cron/report-scheduler` | `0 12 * * *` (7 AM ET / 12 PM UTC) | Send scheduled reports via Resend |
| `cron/export-cleanup` | `0 8 * * 0` (Sunday 3 AM ET) | Delete expired report export files from Supabase Storage |

**Cron gap recovery (daily-metrics):** On startup, checks `MAX(metric_date)` in `daily_metrics`. If there are missing days between that date and yesterday, backfills all gaps before processing the current day. This prevents permanent data holes from silent failures.

---

## 5. UI Pages

### 5.1 Page Structure

```
(admin)/analytics/
├── page.tsx                          # Analytics overview (replaces current mock page)
├── dashboards/
│   ├── page.tsx                      # Dashboard selector (3 pre-built dashboards)
│   ├── executive/page.tsx            # Executive Overview dashboard
│   ├── operations/page.tsx           # Daily Operations dashboard
│   └── growth/page.tsx               # Growth & Retention dashboard
├── reports/
│   ├── page.tsx                      # Report library (templates + saved)
│   ├── [id]/page.tsx                 # Report viewer with live data
│   └── new/page.tsx                  # Report builder
├── insights/
│   └── page.tsx                      # AI Insights hub (unified feed)
├── trainers/
│   ├── page.tsx                      # Trainer performance overview + leaderboard
│   └── [id]/page.tsx                 # Individual trainer deep-dive
├── pricing/
│   ├── page.tsx                      # Pricing simulator list
│   └── [id]/page.tsx                 # Simulation detail + AI analysis
└── migration/
    └── page.tsx                      # Glofox data migration admin
```

### 5.2 Breadcrumb Updates (layout.tsx)

Add the following entries to the `breadcrumbs` record in `/apps/web/src/app/(admin)/layout.tsx`:

```typescript
'/analytics': 'Analytics > Overview',
'/analytics/dashboards': 'Analytics > Dashboards',
'/analytics/dashboards/executive': 'Analytics > Dashboards > Executive Overview',
'/analytics/dashboards/operations': 'Analytics > Dashboards > Daily Operations',
'/analytics/dashboards/growth': 'Analytics > Dashboards > Growth & Retention',
'/analytics/reports': 'Analytics > Reports',
'/analytics/reports/new': 'Analytics > Reports > New',
'/analytics/insights': 'Analytics > AI Insights',
'/analytics/trainers': 'Analytics > Trainer Performance',
'/analytics/pricing': 'Analytics > Pricing Simulator',
'/analytics/migration': 'Analytics > Data Migration',
```

### 5.3 Page Specifications

#### Analytics Overview (`analytics/page.tsx`) -- Replace Current Mock

Replace the existing mock-data analytics page with a live dashboard. This is the default landing page for the Analytics module.

**Components:**
- **KPI strip (top):** MRR, ARPM, Active Members, Monthly Churn Rate, Avg Fill Rate, Revenue MTD. Each with trend badge (up/down % vs previous period). Every number clickable to drill into the relevant report.
- **AI Recommendations strip** -- Keep the current design pattern (dismissible cards with indigo-violet gradient border) but fetch from `/api/ai/insights` instead of hardcoded data.
- **Attendance heatmap** -- Same design as current but powered by `/api/analytics/heatmap` RPC. Keep the All/Open/Guided filter.
- **Revenue by source donut** -- Same design but powered by `/api/analytics/revenue-breakdown`.
- **Cohort retention chart** -- Same design but powered by `/api/analytics/cohorts`.
- **Trainer leaderboard** -- Same design but powered by `/api/trainers/leaderboard`. "View All" link to `analytics/trainers`.
- **Trending insights** -- Powered by `/api/ai/insights` with `urgency` filter.
- **Time range selector** -- Global period selector (7d, 30d, 90d, 12m) that applies to all widgets on this page.

#### Dashboard Selector (`analytics/dashboards/page.tsx`)

- 3 dashboard cards: "Executive Overview", "Daily Operations", "Growth & Retention".
- Each card shows a description and preview of key metrics.
- Click to navigate to the specific dashboard page.
- Note at bottom: "Custom dashboards coming soon" (Phase 4 teaser).

#### Executive Overview Dashboard (`analytics/dashboards/executive/page.tsx`)

- **KPI strip:** MRR, ARPM, Active Members, Monthly Churn Rate, Revenue MTD. Each with trend badge.
- **Revenue trend line chart** (30d/90d/12m toggle).
- **Revenue by source donut chart.**
- **Cohort retention heatmap.**
- **AI Insights strip** — top 3 active insights with urgency badges.

#### Daily Operations Dashboard (`analytics/dashboards/operations/page.tsx`)

- **Today's KPIs:** Bookings, Check-ins, Walk-ins, No-shows, Fill Rate.
- **Attendance heatmap** (day-of-week x time-slot).
- **Today's class schedule** with fill rates per slot.
- **Upcoming classes** needing attention (low bookings, waitlisted).
- **Recent activity feed** (last 20 events).

#### Growth & Retention Dashboard (`analytics/dashboards/growth/page.tsx`)

- **Member movement chart:** New vs Churned vs Net over time.
- **Cohort retention chart** with month-over-month comparison.
- **At-risk members list** (top 10 by churn score).
- **Lead pipeline funnel** (from Phase 2 leads table).
- **Trainer leaderboard** (top 5 by avg attendance).

#### Report Library (`analytics/reports/page.tsx`)

- **Two sections:**
  1. **Templates** (13 pre-built report types) -- click to preview, click "Create from Template" to customize.
  2. **Saved Reports** -- previously configured reports with last-run date, schedule status.
- Each report card shows: name, type badge, last generated, schedule (if any), quick actions (run, export CSV, export PDF, edit, delete).

#### Report Viewer (`analytics/reports/[id]/page.tsx`)

- **Top bar:** Report name, time range selector, "Export CSV" button, "Export PDF" button, "Schedule" button, "Edit" button.
- **Data table** with sortable columns, pagination (50 rows per page), search/filter.
- **Summary row** at top of table (totals, averages as appropriate).
- **Chart visualization** above the table (auto-selected based on report type: line chart for time series, bar chart for categorical, etc.).
- Clicking a member name navigates to their profile. Clicking a class navigates to the schedule.

#### Report Builder (`analytics/reports/new/page.tsx`)

- **Step 1: Choose type** -- Select from 13 templates or start custom.
- **Step 2: Configure** -- Select columns (checkbox list), set filters (visual rule builder similar to segments), choose time range, set grouping.
- **Step 3: Preview** -- Live data preview (first 10 rows).
- **Step 4: Save & Schedule** -- Name the report, optionally set email schedule (daily/weekly/monthly) with recipients.

#### AI Insights Hub (`analytics/insights/page.tsx`)

- **Feed view** of all AI-generated insights, most recent first.
- **Filter tabs:** All, Scheduling, Pricing, Retention, Revenue, Trainer, Growth.
- **Urgency badges:** Info (gray), Suggestion (blue), Attention (amber), Urgent (red).
- Each insight card: icon (by type), title, summary, recommended action with deep-link button, "Dismiss" and "Mark as Done" actions.
- **"Generate New Insights" button** -- triggers `/api/ai/insights/generate`.
- **History tab** -- view dismissed and actioned insights.

#### Trainer Performance Overview (`analytics/trainers/page.tsx`)

- **Leaderboard table:** Rank, avatar, name, classes led, avg attendance, bonus hit rate, revenue attributed, promo conversions. Click row to drill into individual trainer.
- **Period selector:** This month, last month, last 3 months, custom range.
- **Comparison chart:** Bar chart comparing trainers on selected metric.
- **AI-generated "Coach's Notes"** strip at top -- one-sentence insights about the team (powered by batch trainer summary AI).

#### Trainer Deep-Dive (`analytics/trainers/[id]/page.tsx`)

- **Profile header:** Avatar, name, role, classes per week, members served.
- **AI Narrative card** (indigo-violet gradient border) -- 4-6 sentence performance narrative from `trainer_metric_snapshots.ai_narrative`. "Refresh" button to regenerate.
- **KPI cards:** Avg Attendance, Bonus Hit Rate, Revenue Attributed, Promo Conversions, Repeat Member Rate.
- **Performance over time:** Line chart showing avg attendance and fill rate over the last 6 months.
- **Class breakdown table:** Each class this trainer leads, with avg attendance, fill rate, trending.
- **Highlights & Growth Areas:** Bullet point lists from AI analysis.
- **Payroll summary:** Base pay + bonuses + promo commission = total compensation for the period. Link to full payroll report.

#### Pricing Simulator List (`analytics/pricing/page.tsx`)

- List of saved simulations with name, date, status (draft/analyzed/applied), projected revenue impact.
- "New Simulation" button.
- Applied simulations are locked (read-only with "applied on" badge).

#### Pricing Simulator Detail (`analytics/pricing/[id]/page.tsx`)

- **Left panel: Price adjustments**
  - List of current membership plans with current price and subscriber count.
  - Editable "New Price" field for each plan.
  - "Add Credit Pack" adjustment section (same pattern).
- **Right panel: AI Projections** (populated after clicking "Analyze")
  - **Revenue impact card:** Projected monthly revenue change (+ or -)
  - **Churn risk card:** Estimated % increase in churn
  - **Upgrade probability:** How many members on lower tiers might upgrade/downgrade
  - **AI narrative:** 3-5 sentence analysis of the scenario
  - **Sensitivity chart:** Revenue impact at -20%, -10%, proposed, +10%, +20% price points
- **"Apply Changes" button** -- confirms via modal showing affected subscriber count, then:
  1. Creates a **new** Stripe Price object (Stripe Prices are immutable — `unit_amount` cannot be updated)
  2. Updates the Product's `default_price` to the new Price
  3. Offers toggle: "Migrate existing subscribers to new price?" (pro-rates via Stripe)
  4. Stores `previous_price_id` in `pricing_simulations` for revert capability
  5. Sets `applied_at`

#### Glofox Migration Admin (`analytics/migration/page.tsx`)

- **Wave progress tracker** (visual stepper: Wave 1, Wave 2, Wave 3, with checkmarks for completed waves).
- **Import section per data type:** Members, Bookings, Transactions, Classes, Credit Balances, Memberships.
- **Upload flow:** Drag-and-drop CSV upload -> Validate (shows row counts, errors, duplicates) -> Import (progress bar) -> Complete (summary).
- **Migration job history table:** Each job with status, row counts, errors, timestamps, rollback button (if applicable).
- **Member wave assignment panel:** Assign members to Wave 2 (pilot) or Wave 3 (general) groups. Track Glofox renewal dates for billing cutover.
- **Double-billing guard:** Visual indicator per member showing their Glofox renewal date and whether Meridian billing should be activated.

---

## 6. AI Features (New)

### 6.1 New AI Functions

| Feature | Function Signature | Input | Output | Location |
|---|---|---|---|---|
| **Insight Generator** | `generateInsights(studioMetrics: StudioMetricsContext): Promise<AIInsight[]>` | 30-day metrics snapshot, member movement, revenue trends, class performance | Array of 3-8 prioritized insights with titles, summaries, actions, urgency | `src/lib/ai/insights-generator.ts` |
| **Pricing Impact Analysis** | `analyzePricingScenario(scenario: PricingScenarioInput): Promise<PricingAnalysis>` | Current plans + prices + subscriber counts + proposed changes + 12-month revenue history | Revenue impact projection, churn risk estimate, upgrade/downgrade predictions, narrative | `src/lib/ai/pricing-analyzer.ts` |
| **Report Narrative** | `generateReportNarrative(reportData: ReportDataInput): Promise<string>` | Report type + aggregated data rows + time period | 3-5 sentence natural language summary of the report | `src/lib/ai/report-narrative.ts` |
| **Trainer Comparison** | `compareTrainers(trainers: TrainerMetrics[]): Promise<TeamInsight>` | Array of trainer metric snapshots | Team-level narrative, standout performers, areas to develop, scheduling suggestions | `src/lib/ai/trainer-comparison.ts` |
| **Cross-Sell Detection** | `detectCrossSellOpportunities(memberData: CrossSellInput): Promise<CrossSellResult>` | Member segments, product usage patterns, revenue by member | "Members using A but never B" opportunity matrix with estimated revenue | `src/lib/ai/cross-sell.ts` |
| **Seasonal Predictor** | `predictSeasonalTrends(historicalData: SeasonalInput): Promise<SeasonalPrediction>` | 12+ months of daily_metrics | Next 90-day forecast for bookings and revenue with confidence intervals | `src/lib/ai/seasonal-predictor.ts` |

All follow the established pattern: Anthropic Claude API call with rules-based fallback if `ANTHROPIC_API_KEY` is not set.

### 6.2 Enhanced Existing AI

- **Churn Prediction** -- batch mode: process all active members and produce a ranked list (not just per-member API calls). Inngest-powered background job.
- **Booking Patterns** -- extend to include day-of-week and time-of-day granularity for the heatmap data source.
- **Revenue Anomaly** -- integrate with `ai_insights` table: when an anomaly is detected, persist it as an insight instead of only returning it via API.
- **Trainer Summary** -- persist results in `trainer_metric_snapshots.ai_*` columns. Only regenerate when explicitly requested or on monthly snapshot.

---

## 7. Glofox Migration Tooling

### 7.1 Migration Architecture

The Glofox migration follows the 5-wave plan defined in `docs/edge-case-policies.md` (Edge Case 16). Phase 3 covers Waves 1-3.

**Wave 1: Data Import** (admin-triggered via migration UI)
- Import all member profiles (deduplicated against existing)
- Import all booking history (for wellness tracking)
- Import all transaction history
- Import credit balances as-is
- Import class schedule history

**Wave 2: Internal Testing** (manual -- owners + close friends test Meridian)
- Assign pilot members via migration UI
- No automated processes -- just tagging

**Wave 3: Pilot Group** (20-30 members invited to Meridian)
- Assign pilot members via migration UI
- Track Glofox renewal dates
- No billing activation until current Glofox cycle ends

### 7.2 CSV Parsers

Each Glofox export type needs a dedicated parser. Based on the existing seed scripts, we know the data shapes:

| Glofox Export | Meridian Table | Key Mapping |
|---|---|---|
| Members CSV | `profiles` + `members` | email -> dedup key, full_name, phone, membership_type |
| Bookings/Attendance CSV | `bookings` | class date+time -> class_id lookup, member email -> member_id lookup |
| Transactions CSV | `transactions` | amount, date, type, member email -> member_id |
| Classes/Schedule CSV | `classes` | title, starts_at, capacity, trainer assignment |
| Credit Balances | `credit_packs` | member email -> member_id, balance, expiry |
| Memberships | `memberships` | member email -> member_id, plan type, renewal date |

### 7.3 Validation Rules

Pre-import validation checks (run before any data touches the database):

1. Email format validation
2. Duplicate detection (against existing profiles AND within the CSV)
3. Required field check (email + full_name minimum for members)
4. Date format normalization (Glofox exports use various formats)
5. Amount format normalization (dollars to cents)
6. Class cross-reference check (bookings reference classes that must exist)
7. Referential integrity check (transactions reference members that must exist)

### 7.4 Rollback Strategy

Each imported row is tagged with `migration_job_id` on the target table (profiles, bookings, transactions, classes). Rollback is admin-triggered and deletes all rows matching the job's ID across all affected tables. This is more reliable than storing DELETE SQL strings (which hit size limits at scale) and allows precise per-batch rollback.

---

## 8. Sprint Breakdown

### Sprint 1 (Week 1-2): Database + Metric Aggregation Pipeline

1. Database migration: 8 new tables (daily_metrics, cohort_snapshots, trainer_metric_snapshots, saved_reports, report_exports, ai_insights, pricing_simulations, migration_jobs), indexes, RLS policies, RPC functions (with CTE-based heatmap + leaderboard)
2. Modify `profiles` table (add `glofox_id`, `glofox_renewal_date`, `migration_wave`, `migrated_at`, `migration_job_id`)
3. Add `migration_job_id` to bookings, transactions, classes tables for rollback tracking
4. Inngest cron: `cron/daily-metrics` — aggregates prior day's data into `daily_metrics`. **Includes gap recovery: backfills missing days on startup.**
5. Inngest cron: `cron/cohort-refresh` — builds cohort retention snapshots. **Define "active member" = any booking or check-in in measurement month OR active paid membership.**
6. Inngest cron: `cron/trainer-metrics` — aggregates monthly trainer performance
7. Manual snapshot API route: `POST /api/analytics/snapshot` — backfill historical data
8. Backfill script: generate `daily_metrics` rows for all historical data (from Glofox seed imports)
9. Analytics data API routes: `/api/analytics/daily-metrics`, `/api/analytics/cohorts`, `/api/analytics/heatmap`, `/api/analytics/summary`, `/api/analytics/revenue-breakdown`, `/api/analytics/member-movement`
10. Replace analytics/page.tsx mock data with live API calls. **All charts must handle empty state gracefully (distinguish "no data yet" from "loading").**

**Deliverable:** Analytics overview page is fully live with real data. Metric pipeline running via Inngest.

### Sprint 2 (Week 3-5): Reports Engine

1. **PDF spike (timebox: 2 days):** Validate `@react-pdf/renderer` on Netlify with `export const runtime = 'nodejs'`. If fails → switch to `pdfmake`.
2. Create Supabase Storage bucket `report-exports` with RLS policy and 1-hour signed URL TTL
3. Saved reports CRUD API routes
4. Report generation engine: query builder translating report config into Supabase queries
5. **CSV export first** (priority over PDF): stream rows with proper headers, cursor-based for large datasets. Sanitize output to prevent formula injection.
6. PDF export: render report data into branded PDF template (if spike passed). **For reports >500 rows, generate asynchronously via Inngest job.**
7. 13 pre-built report templates (configuration objects, not separate code per template)
8. AI report narrative function (`src/lib/ai/report-narrative.ts`)
9. Inngest cron: `cron/report-scheduler` — sends scheduled reports via Resend
10. Inngest cron: `cron/export-cleanup` — delete expired export files (30-day default expiry)
11. Report library page (`analytics/reports/page.tsx`)
12. Report viewer page (`analytics/reports/[id]/page.tsx`)
13. Report builder page (`analytics/reports/new/page.tsx`)

**Deliverable:** Full report engine with CSV + PDF export, 13 templates, scheduled email delivery.

### Sprint 3 (Week 6-8): AI Insights Hub + Trainer Performance

1. AI Insight Generator function (`src/lib/ai/insights-generator.ts`)
2. AI Cross-Sell Detection function (`src/lib/ai/cross-sell.ts`)
3. AI Seasonal Predictor function (`src/lib/ai/seasonal-predictor.ts`) — uses 12+ months of Glofox historical data
4. AI Trainer Comparison function (`src/lib/ai/trainer-comparison.ts`)
5. Batch churn prediction (Inngest job: process all members, persist results). **Concurrency limit: 10** to avoid Anthropic rate limits.
6. Integration: revenue anomaly detection → auto-persist as AI insight
7. Inngest cron: `cron/ai-insights` (daily generation cycle, concurrency: 10)
8. AI Insights API routes (list, generate, dismiss, action, history)
9. Trainer performance API routes (list, detail, history, leaderboard)
10. AI Insights hub page (`analytics/insights/page.tsx`)
11. Trainer performance overview page (`analytics/trainers/page.tsx`)
12. Trainer deep-dive page (`analytics/trainers/[id]/page.tsx`)

**Deliverable:** AI insights surfaced in a unified hub. Trainer dashboards with AI narratives. Seasonal predictions and cross-sell opportunities.

### Sprint 4 (Week 9-10): Pre-Built Dashboards + Pricing Simulator

1. Dashboard selector page (`analytics/dashboards/page.tsx`)
2. Executive Overview dashboard (`analytics/dashboards/executive/page.tsx`) — KPIs, revenue trend, revenue donut, cohort retention, AI insights
3. Daily Operations dashboard (`analytics/dashboards/operations/page.tsx`) — today's KPIs, heatmap, schedule, activity feed
4. Growth & Retention dashboard (`analytics/dashboards/growth/page.tsx`) — member movement, cohort comparison, at-risk members, lead funnel, leaderboard
5. AI Pricing Analysis function (`src/lib/ai/pricing-analyzer.ts`)
6. Pricing simulator API routes (CRUD + analyze + current plans)
7. Pricing simulator list page (`analytics/pricing/page.tsx`)
8. Pricing simulator detail page (`analytics/pricing/[id]/page.tsx`)
9. **Stripe integration: "Apply Changes" creates new Price object** (not update), updates Product default_price, offers subscriber migration toggle, stores `previous_price_id` for revert

**Deliverable:** 3 pre-built dashboards with live data. Pricing what-if simulator with AI projections and proper Stripe flow.

### Sprint 5 (Week 11): Glofox Migration + Polish + Testing

1. Glofox CSV parsers (6 data types: members, bookings, transactions, classes, credit balances, memberships)
2. Validation engine (8 validation rules with detailed error reporting)
3. Import engine with progress tracking and `migration_job_id` tagging for rollback
4. **Concurrent migration prevention:** `POST /api/migration/import` returns 409 if active job exists for same studio + data_type
5. Migration API routes (upload, validate, import, job status, rollback, overview)
6. Migration admin page (`analytics/migration/page.tsx`)
7. Member wave assignment UI
8. Double-billing guard: visual indicator per member for Glofox renewal date
9. Integration testing: full report lifecycle (create → generate → export CSV → export PDF → email)
10. Integration testing: AI insight generation and deduplication
11. Performance optimization: pagination on all list views, index tuning
12. Update sidebar navigation + Command Palette for new analytics pages

**Deliverable:** Glofox migration tooling ready for Wave 1 execution. All Phase 3 features integration-tested.

---

## 9. Dependencies on Phase 1 and Phase 2

### Hard Dependencies (Phase 1 -- all met)
- `profiles`, `members`, `bookings`, `classes`, `transactions`, `staff` tables with live data
- `ai_cache` table for caching AI results
- Supabase Auth + RLS infrastructure
- Anthropic SDK integration (`src/lib/anthropic.ts`, `src/lib/ai/*.ts`)
- Recharts charting library
- Revenue API (`/api/revenue`)
- Member and staff APIs

### Soft Dependencies (Phase 2 -- partial)
- **Campaigns table** -- needed for Campaign Performance Report template. If Phase 2 is not complete, this report template returns empty / is disabled with "Requires Marketing module" badge.
- **Leads table** -- needed for Lead Pipeline Report template. Same graceful degradation.
- **Inngest infrastructure** -- already built in Phase 2. Phase 3 uses it for batch churn prediction.
- **Resend integration** -- needed for scheduled report email delivery. Already complete from Phase 1.

Phase 3 is designed to be buildable even if Phase 2 is still in progress. The 2 report templates that depend on Phase 2 tables will gracefully degrade. All other functionality is self-contained.

---

## 10. Performance Considerations

- **Daily metrics table** eliminates the need to run aggregate queries on every page load. Chart rendering reads pre-computed rows (O(1) per day in range).
- **Cohort snapshots** are computed monthly, not on-demand. Cohort charts read directly from the table.
- **Report generation** uses cursor-based pagination for large datasets. CSV streaming avoids loading all rows into memory. PDFs are capped at 10,000 rows (with a "data truncated" notice).
- **AI insight generation** runs on cron (daily), not on page load. Deduplication via `fingerprint` column prevents insight spam.
- **Pre-built dashboards** each make parallel API calls (client-side Promise.all) for their fixed widget set.
- **Trainer leaderboard** RPC function uses indexed columns and GROUP BY. For studios with many trainers (unlikely in Phase 1 target), add LIMIT.
- **Migration imports** process in batches of 100 rows with UPSERT (ON CONFLICT DO NOTHING for dedup). Progress updates stored in `migration_jobs.processed_count`.
- **Export file cleanup** runs weekly to prevent Supabase Storage bloat. Default expiry: 30 days.
- **Empty state handling:** Every chart component handles empty result sets gracefully. Analytics overview distinguishes "no data yet" from "loading." New SaaS customers see onboarding prompts, not broken charts.
- **Large report async export:** Reports exceeding 500 rows generate asynchronously via Inngest job. User receives email with download link when ready.
- **Batch AI concurrency:** Churn prediction and AI insight generation jobs use `concurrency: { limit: 10 }` to avoid Anthropic rate limits.

---

## 11. Security

- **Migration upload:** Only owners/managers can trigger. Files validated server-side before any import.
- **Pricing simulator "Apply":** Only owners can apply pricing changes (role check on the API route).
- **Report exports:** Stored in Supabase Storage with RLS. Download URLs are signed (time-limited).
- **AI insights:** Studio-scoped via RLS. No cross-studio data leakage.
- **Dashboards:** Pre-built only in Phase 3; visible to all studio staff (owners, managers, trainers).
- **CSV export:** Sanitize all output to prevent formula injection (prefix `=`, `+`, `-`, `@` with single quote).

---

## 12. Testing Strategy

### Unit Tests
- Daily metric aggregation logic: verify sums match raw data
- CSV parser: handle edge cases (quoted commas, Unicode names, empty fields, date format variations)
- Report query builder: verify generated SQL for each template type
- PDF renderer: generate test PDFs for each report template
- AI insight deduplication: verify fingerprint matching prevents duplicates within 7-day window
- Pricing scenario analysis: verify rules-based fallback produces reasonable projections

### Integration Tests (Sprint 5)
- Full report lifecycle: create from template -> customize -> generate -> export CSV -> export PDF -> schedule -> receive email
- Pre-built dashboards: verify all 3 dashboards load with correct live data, time range selectors work
- AI insights: trigger generation -> verify insights created -> dismiss -> verify not regenerated within 7 days
- Migration: upload CSV -> validate -> review errors -> import -> verify row counts -> rollback -> verify cleanup
- Trainer performance: verify snapshot aggregation matches raw booking data

### E2E Tests (Sprint 5)
- Analytics overview: verify all widgets load with real data, time range selector updates all widgets
- Report builder: complete wizard flow, generate, export
- Pre-built dashboards: verify all widgets render with real data on all 3 dashboard pages
- Pricing simulator: adjust prices, run analysis, verify AI narrative appears

---

### Critical Files for Implementation
- `/Users/zach/Desktop/literal-fishstick/apps/web/src/app/(admin)/analytics/page.tsx` - Current mock analytics page to replace with live data
- `/Users/zach/Desktop/literal-fishstick/apps/web/src/lib/ai/churn-prediction.ts` - Pattern to follow for all new AI functions (Claude API + rules-based fallback + typed input/output)
- `/Users/zach/Desktop/literal-fishstick/scripts/phase2-migration.sql` - Pattern to follow for Phase 3 migration SQL (table creation, indexes, RLS)
- `/Users/zach/Desktop/literal-fishstick/apps/web/src/app/(admin)/layout.tsx` - Must update breadcrumbs for all new analytics sub-pages
- `/Users/zach/Desktop/literal-fishstick/docs/phase-2-plan.md` - Format reference for this plan; also defines Phase 2 tables (campaigns, leads) that Phase 3 report templates reference
