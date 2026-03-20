# Edge Cases Analysis
**Agent:** edge-cases
**Plan:** Meridian Phase 3 — Analytics & Intelligence
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

Phase 3 has handled several edge cases well (deduplication fingerprint, backfill trigger, rollback SQL, graceful degradation for Phase 2 tables). But five failure modes are unaddressed: cron data gaps, the "zero data" analytics state, trainer self-exclusion in count logic, concurrent migration job prevention, and the pricing "Apply" rollback path. These are not hypothetical — they will occur in production use.

---

## Edge Case Findings

### EC-1: First-Run State — Analytics Page With No Historical Data (HIGH)

**Scenario:** A new SaaS customer installs Meridian. They have no Glofox import, no seed data, and no historical bookings. They navigate to the Analytics Overview page.

**What happens with the current plan:** Every chart makes an API call to `daily_metrics`, `cohort_snapshots`, etc. All queries return empty result sets. Recharts renders empty charts (or throws if the component expects non-empty data arrays). The KPI strip shows zeros or NaN. The cohort chart renders nothing. The page looks broken.

**Required handling:**
- Each chart component must handle empty data gracefully: show a "No data yet — check back after your first classes" empty state with appropriate iconography
- The KPI strip must show "$0 / 0 members" states cleanly, not NaN or undefined
- The AI Insights Hub must show "Generating first insights..." if `ai_insights` is empty rather than an empty feed

**Added complexity:** The backfill script is designed for The Sauna Guys (existing seed data). For a new SaaS customer, there is no backfill — the `daily_metrics` table starts populating from day one. The analytics overview must distinguish between "no data yet" and "data loading" states.

---

### EC-2: Cron Job Failure Creates Silent Data Gaps (HIGH)

**Scenario:** The `cron/daily-metrics` job fails silently on March 5th (Inngest error, Supabase timeout, or a bug in the aggregation query). No row is inserted for March 5th in `daily_metrics`.

**What happens:** Charts showing the last 30 days will have a gap on March 5th. Depending on how the chart interpolates missing dates, this either shows a missing point, a line drop to zero, or appears to be normal (if the date is simply absent from the response and the chart plots only returned dates).

**Failure modes:**
1. If the chart assumes continuous daily rows: the gap produces a misleading drop or spike on adjacent days
2. If the analytics "summary" endpoint calculates trends by comparing current period to previous period using daily_metrics totals, a missed day means the "trend" is wrong for any period including that day
3. Silent failure means the owner does not know data is missing

**Required handling:**
- The `cron/daily-metrics` job must check for gaps on startup: query `MAX(metric_date)` from `daily_metrics` for each `studio_id`. If the last recorded date is more than 1 day ago, backfill the missing days before processing today
- Alert on gap detection: write to a `cron_health_log` table or send an admin email if gaps older than 2 days are found
- The analytics API response should include a `data_quality` field indicating if any dates in the requested range are missing

---

### EC-3: Trainer Self-Exclusion Logic Has a Schema Assumption (HIGH)

The `get_trainer_leaderboard` RPC excludes the trainer's own bookings:

```sql
AND b.member_id != t.trainer_id
```

This assumes `bookings.member_id` is the same UUID as `staff.trainer_id` (which maps to `profiles.id`). However, the CLAUDE.md explicitly calls out a dual-role problem: "Owners are also members who book classes. Trainers have the same problem — they may not have multiple emails." The solution is "a single account with multiple roles."

If a trainer's booking is recorded under their `profiles.id` (which doubles as their member ID), and `staff.trainer_id` is also `profiles.id`, the exclusion `b.member_id != t.trainer_id` works. But if `staff` stores a separate `trainer_id` that is NOT equal to `profiles.id` (e.g., a separate staff record ID), the exclusion will fail to exclude the trainer's own check-in.

**Required verification:** Confirm the exact join path:
- `classes.trainer_id` → is this `staff.id` or `profiles.id`?
- `bookings.member_id` → is this `profiles.id` or `members.id`?
- `staff.trainer_id` → is this `profiles.id` or a separate UUID?

The RPC join uses `JOIN staff t ON c.trainer_id = t.id` (so `classes.trainer_id = staff.id`), then `p ON t.profile_id = p.id`. The exclusion then uses `b.member_id != t.trainer_id`. But the `staff` table column is `profile_id`, not `trainer_id`. The RPC has an alias collision — `t.trainer_id` does not exist if the column is `t.profile_id`. This will cause a Postgres error on execution.

**Fix:** Change `b.member_id != t.trainer_id` to `b.member_id != t.profile_id` (assuming that is the actual column name). Verify against the actual `staff` table schema.

---

### EC-4: Concurrent Migration Job Prevention (HIGH)

**Scenario:** An admin starts a Wave 1 members import. While it is running (status: `importing`), another admin user clicks "Import" again for the same data type.

**What happens:** Two concurrent import jobs both start processing the same CSV. The `ON CONFLICT DO NOTHING` deduplication should prevent duplicate rows being inserted for members (email is the dedup key). But:
- Two rows will be created in `migration_jobs` with different IDs, both in `importing` status
- The progress bars in the UI will show two jobs both making progress, confusing the admin
- If the dedup logic has any bugs, rows could be partially duplicated
- The rollback SQL for both jobs will overlap — rolling back one may partially undo the other

**Required handling:**
- The `POST /api/migration/import` route must check for any active (`importing` or `validating`) migration jobs for the same `studio_id` and `data_type` before creating a new job. Return HTTP 409 Conflict if one exists.
- Add a unique constraint or advisory lock: `UNIQUE(studio_id, data_type)` WHERE status IN ('importing', 'validating') — this is not a simple SQL constraint, but an application-level check in the API route is sufficient.

---

### EC-5: Pricing Simulator "Apply" With No Rollback Path (HIGH)

**Scenario:** An admin runs a pricing scenario, clicks "Apply Changes," and Stripe creates a new price for the Unlimited membership at $169/month (up from $149). Three days later, the change causes more churn than the AI projected. The admin wants to revert.

**What happens:** There is no "undo" for the pricing Apply action. The `applied_at` timestamp records when it was applied, but the plan has no "revert to previous price" flow. In Stripe, the old price still exists (immutable) and its ID is presumably stored in the `memberships` table. Reverting would require:
1. Creating a new price at the old amount (or using the existing old price ID)
2. Updating the Stripe Product's default price back to the old ID
3. Migrating any subscribers who were moved to the new price back to the old price

This is the same complexity as the forward Apply but in reverse, and there is no design for it.

**Required additions:**
- `pricing_simulations` must store `previous_price_id` for each plan change so Stripe rollback is possible
- The UI should show "Applied on [date]" with a "Revert Pricing" button that walks through the same confirmation flow in reverse
- Alternatively, make Apply a two-stage process: "Activate New Price" (new subscribers only) and "Migrate Existing Subscribers" (separate, destructive action) — this limits the blast radius

---

### EC-6: Report Generation With Stale daily_metrics (MODERATE)

**Scenario:** A report is configured to show "Revenue MTD" using the `daily_metrics` table. The `cron/daily-metrics` job last ran 2 days ago (due to a failure). The report exports data that is 2 days behind but does not indicate this to the user.

**Required handling:** Reports that read from snapshot tables should display a "Data current as of [last_snapshot_date]" notice. The report API response should include a `data_freshness` field with the latest `metric_date` in the queried range.

---

### EC-7: PDF Export of Large Reports Times Out (MODERATE)

**Scenario:** A user generates a Transaction Log PDF for the last 12 months: 2,015 transactions. The PDF renderer must paginate this into pages, render table rows, embed fonts, and write the output to Supabase Storage. This entire operation is synchronous in the current plan (the API route generates the file and returns a URL).

For 2,015 rows, PDF generation could take 10–30 seconds. Next.js API route default timeout is 60 seconds on Netlify functions. If any step (Claude narrative, PDF rendering, storage upload) is slow, the request times out and the user gets a blank error.

**Required handling:** For exports above a threshold (e.g., > 500 rows), switch to async export: return a job ID immediately, process the export via Inngest, and show "Export in progress" in the UI with polling or a "Download" button that activates when complete. Add the `report_exports.status` column (e.g., `pending`, `processing`, `complete`, `failed`) to track async export state.

---

### EC-8: Cohort Retention With < 1 Month of Data (MODERATE)

**Scenario:** A new SaaS customer has been using Meridian for 2 weeks. The cohort retention chart requires comparing signup month to measurement month. With < 1 month of data, `cohort_snapshots` has zero rows.

The cohort chart component must gracefully handle this with an empty state: "Cohort data requires at least 2 months of member history. Check back in [X days]."

---

### EC-9: Glofox CSV With UTF-8 Non-Standard Characters (MODERATE)

**Scenario:** A member's name is "María González" or "Björn Sten." Glofox may export CSVs in various encodings (UTF-8, Latin-1, Windows-1252). If the parser assumes UTF-8 and the file is Latin-1, the name will display as garbled characters and potentially fail database insertion if the field has a length constraint.

**Required handling:** The CSV parser must detect encoding (use the `chardet` npm package or similar) or explicitly convert to UTF-8 before parsing. This is a known pattern for CSV imports from legacy enterprise software.

---

### EC-10: AI Insight Generation When No New Data Exists (LOW)

**Scenario:** The `cron/ai-insights` runs daily at 6 AM. On days with no bookings (e.g., the studio is closed for a holiday), the input to `generateInsights()` contains 30-day metrics but today's data is flat/zero.

If the AI generates insights from partial data and produces "Class fill rates are at 0% — urgent action required" when the studio was simply closed, this is a false positive that degrades trust in the insights feature.

**Required handling:** The `generateInsights()` function should check if `total_bookings` for the last N days is zero before generating scheduling/attendance insights. Skip insight types that require recent data when that data is absent. The Inngest job should also check if it is a closed day (the `settings` table likely has operational hours or closed dates) before triggering generation.

---

### EC-11: Dashboard Widget With Deleted Data Source (LOW)

**Scenario:** An admin creates a widget using the `campaigns` data source (Campaign Performance). Phase 2 is later partially rolled back and the `campaigns` table is dropped. The widget's `data_source = 'campaigns'` now references a non-existent table.

**Required handling:** The widget data resolver must catch data source errors gracefully, returning an empty state with "Data source unavailable" rather than throwing an unhandled exception that breaks the entire dashboard page.

---

## Edge Cases Already Handled Well

- **Duplicate insight deduplication:** `fingerprint` column with 7-day window — correct
- **Glofox import idempotency:** `ON CONFLICT DO NOTHING` — correct
- **Phase 2 report templates with no data:** Graceful degradation with "Requires Marketing module" badge — correct
- **Migration rollback:** Per-job rollback SQL — correct approach (though storage mechanism needs improvement)
- **RLS everywhere:** All 10 new tables have RLS enabled — correct
- **AI fallback when API key missing:** Rules-based fallback pattern already established — correct
- **Trainer bonus threshold excludes trainer self check-in:** Logic is correct in concept (though schema assumption needs verification — EC-3 above)

---

## Edge Case Verdict Summary

| ID | Description | Severity | Handled? |
|----|-------------|----------|----------|
| EC-1 | First-run empty state | High | No — add empty states |
| EC-2 | Cron failure data gaps | High | No — add gap recovery |
| EC-3 | Trainer self-exclusion schema assumption | High | Partial — column name likely wrong |
| EC-4 | Concurrent migration jobs | High | No — add 409 check |
| EC-5 | Pricing Apply has no rollback path | High | No — add revert flow |
| EC-6 | Stale snapshot data in reports | Moderate | No — add freshness indicator |
| EC-7 | PDF generation timeout on large exports | Moderate | No — add async export path |
| EC-8 | Cohort chart with < 1 month data | Moderate | No — add empty state |
| EC-9 | CSV UTF-8 encoding edge cases | Moderate | No — add encoding detection |
| EC-10 | AI insights on closed/no-activity days | Low | No — add data check |
| EC-11 | Widget with deleted data source | Low | No — add resolver error handling |
