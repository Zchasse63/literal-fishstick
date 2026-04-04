# Architecture Impact Analysis

**Agent:** architecture-impact
**Plan:** Unified Member Data Architecture
**Complexity:** SIGNIFICANT
**Date:** 2026-04-04

---

## Agent Verdict

**MODIFY** — The plan fits the existing architecture well but introduces two patterns that conflict with the system's established conventions: (1) a VIEW as a primary query surface when pre-computed columns are the established pattern, and (2) a daily cron for computed fields when real-time updates are needed for correct trigger behavior. Both are fixable without significant rework. Additionally, the STUDIO_ID hardcoding in evaluate-triggers.ts (already marked as TODO: MED-001) must be addressed before adding more trigger types to avoid compounding the multi-tenancy debt.

---

## Architectural Fit Assessment

### Patterns That Fit Well

**Inngest for background jobs**

The cron-member-enrichment proposal fits the existing Inngest function pattern perfectly. There are already 13 Inngest functions including cron-daily-metrics, cron-cohort-refresh, and cron-trainer-metrics. A new cron-member-enrichment follows the established pattern: single function, explicit studio_id filtering, service-role client, step-based execution.

**batchUpsert pattern for data population**

The existing batchUpsert helper (500-row batches, onConflict handling, error tracking) is the correct mechanism for populating glofox_plan_map and any other new tables from Glofox data. This pattern is already proven.

**Extending evaluate-triggers.ts**

The switch statement in evaluate-triggers.ts is explicitly designed for extension. Each trigger type is an independent case. Adding 6 new cases follows the established pattern exactly.

**RLS on new tables**

The plan correctly identifies that new tables need RLS. The existing pattern (ALTER TABLE X ENABLE ROW LEVEL SECURITY + CREATE POLICY X_studio_isolation using current_setting) is well-established. glofox_plan_map should follow this pattern even though it's primarily a reference table.

---

### Architectural Conflicts

**Conflict 1: VIEW as computed data surface vs. pre-computed columns**

The system already has total_visits and last_visit as real columns on the members table. The decision was made that these are stored, not computed. Introducing a VIEW that re-aggregates them from bookings creates two sources of truth:
- members.total_visits (the stored value, used by triggers)
- member_360.computed_total_visits (aggregated from bookings in the VIEW)

These will diverge. The trigger system reads members.total_visits. The UI would read member_360. When a member checks in, members.total_visits updates immediately (if the check-in handler is fixed), but member_360 reflects the live count. This creates confusion for developers and potential inconsistency bugs.

The resolution: member_360 should JOIN on the pre-computed columns (members.total_visits, members.last_visit) rather than re-aggregating from bookings. Complex derived fields not worth storing (favorite_class_type, behavior_segment) can be aggregated in the VIEW — but only if these fields are not used by latency-sensitive paths.

**Conflict 2: Daily cron for trigger-sensitive computed fields**

evaluate-triggers.ts runs every 10 minutes. milestone trigger reads members.total_visits. If total_visits is updated by a daily cron, there is a 0–1440 minute lag between a member's milestone visit and trigger firing. For a welcome/milestone automation, this is unacceptable.

The correct architecture: the check-in code path (wherever bookings.checked_in_at is set) must also increment members.total_visits and update members.last_visit. This is a direct write, not deferred to a cron. The daily cron becomes a consistency check/reconciliation tool, not the primary update mechanism.

Looking at the existing codebase, the check-in flow writes to bookings.checked_in_at. That same transaction should update the members row. This is a small addition to the existing check-in handler.

**Conflict 3: STUDIO_ID hardcoding in evaluate-triggers.ts**

The file explicitly has `// TODO: Multi-tenancy — query studios table and iterate all active studios instead of hardcoding a single studio ID. See MED-001.`

Adding 6 new trigger types before fixing this hardcoding compounds the debt. When MED-001 is eventually fixed (querying all studios and iterating), every new trigger case must handle multi-studio context correctly. The fix is not complex — wrap the per-flow evaluation in a studio loop — but doing it now before adding 6 more cases is cleaner than retrofitting later.

---

### New Components Required

**glofox_plan_map table**

Simple reference table. Needs:
- studio_id (multi-tenancy)
- glofox_plan_id (TEXT, the numeric ID)
- plan_name (TEXT, human-readable)
- plan_type (TEXT, CHECK constraint)
- RLS policy

This should live in a new migration file, not appended to existing migrations.

**cron-member-enrichment.ts**

New Inngest function. Must:
- Query all studios (fixes MED-001 in this function, even if evaluate-triggers.ts isn't fixed yet)
- For each studio, batch-update members.total_visits, members.last_visit, members.engagement_status from bookings aggregation
- Update members.acquisition_source from profiles where not yet set
- Handle partial failures per-studio without failing the entire cron
- Log results to a reconciliation log or activity_log

**member_360 VIEW**

Should be created as a VIEW (not materialized — Supabase auto-refresh limitations). Must:
- JOIN profiles + members + membership_plans (thin joins, no aggregation of these)
- JOIN LATERAL to get favorite class type if needed (acceptable — this is a one-per-member aggregation, bounded)
- NOT re-aggregate total_visits/last_visit from bookings (use the stored columns)
- Include studio_id for RLS
- Document security context (SECURITY INVOKER vs SECURITY DEFINER)

---

### Migration Strategy

**Order of migrations:**

1. `member-data-backfill.sql` — UPDATE members.total_visits, last_visit, engagement_status from bookings. UPDATE profiles.acquisition_source from lead_source/phone pattern. Run immediately.
2. `glofox_plan_map.sql` — CREATE TABLE + RLS + initial populate. Run immediately.
3. `member_360_view.sql` — CREATE VIEW. Run after (1) so it reflects accurate data from first query.
4. `evaluate-triggers-new-types.ts` — Code change, deploy with cron-member-enrichment.ts.

**No schema changes break existing functionality.** The backfill updates existing columns. The new table and VIEW are additive. RLS policies on new objects follow the established pattern.

---

## Long-Term Architecture Implications

This plan correctly treats Glofox as a data source, not as the system of record. Meridian is becoming the system of record with computed, enriched member data. This is the right direction.

The risk: as computed fields proliferate (behavior_segment, favorite_class_type, plan_upgrade_candidate), maintaining consistency between stored columns, VIEW definitions, and the cron reconciliation job becomes harder. The plan should document a clear policy: which fields are stored, which are computed in the VIEW, and what the source of truth is for each.

---

## Verdict Confidence: HIGH
