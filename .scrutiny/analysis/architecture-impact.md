# Architecture Impact Analysis
**Agent:** architecture-impact
**Plan:** Meridian Phase 3 — Analytics & Intelligence
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

Phase 3 makes sound architectural choices (materialized snapshots, RLS-everywhere, incremental AI) but introduces two structural patterns that will create long-term maintenance friction: the dual cron infrastructure (Netlify + Inngest) and the widget data resolver (an ad-hoc query builder that will grow uncontrolled). The plan also does not address how the `daily_metrics` table stays consistent if the cron fails silently — a data gap risk with no recovery plan. These are fixable before Sprint 1 with minor additions to the design.

---

## Architecture Assessment

### 1. Materialized Snapshot Tables: Sound Design

The decision to use pre-computed snapshot tables (`daily_metrics`, `cohort_snapshots`, `trainer_metric_snapshots`) instead of aggregating on every chart render is the correct architectural choice. It follows the same pattern as the existing revenue API, which already caches period aggregates. The daily cron populates rows once; reads are O(1) per row.

**Validation:** The plan correctly identifies that this eliminates expensive GROUP BY queries on every page load. The `UNIQUE(studio_id, metric_date)` constraint prevents duplicate rows from cron re-runs.

**Gap:** No recovery plan for missed cron runs. If the `cron/daily-metrics` job fails on March 5th, the `daily_metrics` table will have a gap for that date. Charts will show discontinuous lines or missing data points. The plan mentions a manual trigger API (`POST /api/analytics/snapshot`) but does not describe how gaps are detected or alerted. A silent cron failure will produce a misleading analytics page.

**Fix:** Add a gap detection query to the `cron/daily-metrics` job: before inserting yesterday's metrics, check if any of the last 7 days is missing and backfill those gaps. Log warnings when gaps older than 48 hours are detected.

---

### 2. Dual Cron Infrastructure: Architectural Smell

The plan routes 6 scheduled jobs through Netlify Scheduled Functions and batch churn prediction through Inngest. This creates two separate background job systems:

- Netlify Scheduled Functions: simple, but no retry logic, no execution history UI, execution timeouts (10 sec on free/pro, 26 sec on Business), no step-based execution for long jobs
- Inngest: retry logic, step execution, execution history dashboard, event replay, already integrated

Using both in the same codebase means: two monitoring surfaces, two debugging paths, two configuration formats, and two potential failure modes.

**Recommendation:** Move all 6 cron jobs to Inngest. Inngest supports cron syntax natively (`{ cron: "0 2 * * *" }`). The daily metrics aggregation job, cohort refresh, and trainer metrics jobs are ideal candidates for Inngest's step-based execution pattern — they can be broken into `step.run()` chunks (validate, aggregate, insert) with automatic retry on any step failure.

**Impact on plan:** No feature change. Minor implementation change — write Inngest functions instead of Netlify functions for the 6 cron jobs. Net result: one monitoring surface, retry logic on all cron jobs.

---

### 3. Widget Data Resolver: An Ad-Hoc Query Compiler

The plan's Sprint 4 includes: "Widget data resolver: given a widget config, fetch the right data and format for the right chart type."

This is the most architecturally risky component in the phase. It is a mini query compiler that:
- Takes a `dashboard_widgets` row as input
- Looks at `data_source`, `metric_key`, `aggregation`, `time_range`, `group_by`, `filters`
- Dynamically constructs a Supabase query
- Returns data formatted for the specified chart type (different schemas for line charts vs. heatmaps vs. pie charts vs. tables)

12 widget types × 10 data sources × 6 aggregation types = 720 combinations to handle. In practice, not all combinations are valid, but the resolver must handle invalid combinations gracefully (e.g., "gauge" widget type with "cohort_snapshots" data source makes no sense).

If this is built as a large `switch` statement, it becomes unmaintainable quickly. If the schema is insufficiently constrained, users will create widget configurations that produce nonsensical charts.

**Recommended design:** Define a strict capability matrix at the data model level — which aggregation types are valid for which data sources, which chart types are valid for which data shapes. Reject invalid combinations at widget creation time (API validation) rather than at render time. The resolver then handles only valid combinations, reducing its complexity significantly.

---

### 4. `ai_insights` Table vs. `ai_cache` Table: Two AI Storage Systems

The plan introduces `ai_insights` as a "curated, reviewable" table distinct from `ai_cache`. This is the right distinction. `ai_cache` is for transient memoization (avoid re-calling Claude for the same input). `ai_insights` is for persisted, lifecycle-managed insights that users can dismiss and act on.

**Potential confusion:** The `cron/ai-insights` job generates insights and writes to `ai_insights`. The existing AI routes (`/api/ai/churn-prediction`, `/api/ai/revenue-anomaly`) write to `ai_cache`. Some Phase 3 features (revenue anomaly detection → auto-persist as AI insight) bridge both systems. This bridge must be explicit: when `revenue-anomaly` detects an anomaly, it should write to `ai_insights` (not `ai_cache`) using the same lifecycle and deduplication logic.

The plan mentions this in section 6.2: "Revenue Anomaly — integrate with `ai_insights` table: when an anomaly is detected, persist it as an insight." Good. But this requires refactoring the existing `/api/ai/revenue-anomaly` route, which is not called out as a task in any sprint checklist. Add it to Sprint 3, task 6.

---

### 5. `dashboard_widgets.data_source` Column: Multi-Tenant Safety

The `dashboard_widgets` table stores `data_source` as a text field with a CHECK constraint listing valid source names. The widget data resolver will use this to dynamically fetch data from the named table.

**Security concern:** If the resolver constructs queries using `data_source` directly in SQL without strict mapping (e.g., `SELECT * FROM ${data_source}`), it creates a SQL injection vector. Even though `data_source` values come from a CHECK constraint on insert, a future code change that relaxes the constraint or builds queries differently could introduce the vulnerability.

**Fix:** The resolver must use a hardcoded mapping object — not dynamic table names:
```typescript
const DATA_SOURCE_MAP = {
  'daily_metrics': () => supabase.from('daily_metrics'),
  'cohort_snapshots': () => supabase.from('cohort_snapshots'),
  // ...
} as const;
```

This pattern is safe regardless of what the `data_source` column contains.

---

### 6. Report Export Storage Architecture: Missing from Schema

The plan references Supabase Storage for report exports but the schema section only adds a `file_url TEXT` column to `report_exports`. It does not specify:
- Bucket name and structure
- RLS policies on the storage bucket (currently Supabase Storage has separate bucket-level policies from table RLS)
- Signed URL TTL (the plan says "signed, time-limited" but no duration)
- What happens when a signed URL expires but `report_exports.file_url` still holds the path

The `expires_at` column in `report_exports` triggers a cleanup cron, but if a user clicks "Download" after expiry, they get a broken link. The UI must check `expires_at` before showing the download button and display "Expired — regenerate" instead.

**Add to schema section:** A `storage_bucket` constant, RLS on the bucket, signed URL TTL definition (recommend: 1 hour for download links), and UI handling for expired exports.

---

### 7. Migration Job Rollback SQL Storage: Will Hit Row Size Limits

The `migration_jobs.rollback_sql TEXT` column stores DELETE statements for a full import batch. For a 1,000-row batch, this generates a `DELETE FROM profiles WHERE id IN (uuid1, uuid2, ..., uuid1000)` string that is approximately 40 KB. Postgres has a 1 GB row size limit, so this technically works, but:

- Storing 40 KB of SQL per job in a TEXT column is inefficient
- It cannot be indexed or queried efficiently if you need partial rollback
- For the classes CSV (7 chunk files × potentially thousands of rows), rollback SQL could be hundreds of KB

**Better approach:** Store only the job ID and use a consistent naming pattern for row tracking. After migration, if rollback is needed, construct the DELETE query on-the-fly using `WHERE migration_job_id = $1` — which requires adding a `migration_job_id` foreign key to every inserted row, or tracking IDs in a separate `migration_row_ids` table.

**Recommendation:** Add `migration_job_id UUID REFERENCES migration_jobs(id)` to the tables that receive migrated data (profiles, bookings, transactions, etc.), or create a lightweight `migration_row_ids(job_id UUID, table_name TEXT, row_id UUID)` junction table. This is cleaner than storing raw SQL.

---

### 8. RLS on `dashboard_widgets`: Missing `studio_id` Enforcement

The `dashboard_widgets` table has `studio_id UUID NOT NULL` but does not have a `REFERENCES studios(id)` foreign key. The plan notes RLS on `dashboard_widgets` but only shows it for `daily_metrics` as an example. The `dashboard_widgets` RLS policy must be: `studio_id IN (SELECT studio_id FROM profiles WHERE id = auth.uid())`. If this check is omitted or delegated only to `dashboards` (parent table), a user who has the `dashboard_id` UUID could potentially add widgets to dashboards from other studios.

**Fix:** Ensure `dashboard_widgets` has its own RLS `INSERT` and `UPDATE` policies that verify `studio_id`, not just `dashboard_id`.

---

### 9. Inngest Batch Churn Prediction: No Rate Limiting Design

The plan mentions "Batch churn prediction: Inngest job — process all active members" in Sprint 3. For 1,103 active members, this means 1,103 calls to the churn prediction logic, each of which may call the Anthropic Claude API.

At 1,103 members × ~1,000 input tokens/member = ~1.1M tokens per batch run. At Claude Sonnet pricing ($3/MTok input), that is ~$3.30 per monthly batch run. Acceptable cost. But if rate limiting is not implemented, Inngest will attempt to call Claude 1,103 times concurrently, hitting Anthropic's rate limits (tokens-per-minute TPM limits) and causing errors.

**Fix:** Use Inngest's `concurrency` configuration to throttle the batch: `concurrency: { limit: 10 }` limits concurrent Claude calls to 10 at any time. This is a one-line addition to the Inngest function definition.

---

## Architecture Verdict Summary

| Area | Assessment |
|------|------------|
| Snapshot tables design | Sound — correct pattern for analytics performance |
| Cron gap recovery | Gap — add gap detection to daily cron |
| Dual cron infrastructure | Smell — consolidate to Inngest |
| Widget data resolver | Risk — needs capability matrix and safe table mapping |
| ai_insights vs ai_cache bridge | Underspecified — add revenue anomaly bridge to Sprint 3 |
| Dashboard widget multi-tenant safety | Risk — resolver must use hardcoded table map |
| Report export storage | Missing from schema — add bucket + RLS + TTL design |
| Migration rollback SQL storage | Anti-pattern — use junction table or foreign key instead |
| dashboard_widgets RLS | Gap — needs own INSERT/UPDATE policy |
| Batch churn Inngest concurrency | Missing — add concurrency limit to Anthropic calls |

**Overall architectural assessment:** The foundation is sound. The materialized snapshot design, RLS everywhere, and incremental AI integration are the right approaches. The gaps are in operational details (gap recovery, rollback storage, export storage) and in the widget resolver (which needs a formal capability matrix). None of these are architectural blockers — they are design decisions that must be made explicitly before the relevant sprint.
