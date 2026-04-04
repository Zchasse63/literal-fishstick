# Scope & Complexity Analysis

**Agent:** scope-complexity
**Plan:** Unified Member Data Architecture
**Complexity:** SIGNIFICANT
**Date:** 2026-04-04

---

## Agent Verdict

**MODIFY** — The plan bundles work that should be sequenced differently. Phases A and B overlap in ways that create false dependencies. Phase B's "mass pull" is actually several distinct workstreams with different risk profiles. The plan as written will take longer than necessary because it treats 4 phases as sequential when most of Phase A can ship in a day and immediately unblock live automation flows.

---

## Scope Assessment

### Actual Work Inventory

The plan contains three distinct categories of work that should not be treated as a monolithic 4-phase project:

**Category 1: One-Time SQL Backfill (hours of work, immediate impact)**
- UPDATE members SET total_visits, last_visit from bookings
- UPDATE members SET engagement_status from visit patterns
- UPDATE profiles SET acquisition_source from lead_source + phone pattern
- CREATE TABLE glofox_plan_map + populate from existing membership_plans data

This is a single migration SQL file. It requires no code changes. It can be written, tested, and deployed in a few hours. The impact is immediate: milestone and inactivity triggers start working, ClassPass members are tagged, plan names are human-readable. This is the highest ROI work in the entire plan.

**Category 2: Structural Additions (days of work, medium impact)**
- member_360 VIEW (thin JOIN layer)
- cron-member-enrichment Inngest function (daily reconciliation)
- Check-in handler increment for real-time total_visits update
- New automation trigger types in evaluate-triggers.ts

Each item here is independently scoped and deployable. None depend on Category 3.

**Category 3: Glofox Data Pull Expansion (unknown timeline, variable risk)**
- Transactions backfill (partially done — backfill function exists, may just need to be triggered)
- Interactions/activity pull (N+1 problem: 1,199 API calls)
- "Subscriptions" (unclear what endpoint this maps to)

Category 3 has the most uncertainty. The transactions backfill is likely already done if the Inngest function has been triggered. The interactions pull requires endpoint clarification first.

---

### Phase Structure Issues

**Phases A and B have artificial overlap**

Phase A step 1 (member_360 VIEW) is listed before Phase B step 7 (cron to keep it current). But the VIEW needs the cron to be useful. Shipping the VIEW without the update mechanism creates a static snapshot that becomes stale. The correct grouping puts the VIEW and the enrichment cron in the same deliverable.

**Phase A step 3 is already done**

profiles.acquisition_source was added in phase2-migration.sql. The plan should say "backfill acquisition_source" not "add column and backfill." This is a documentation issue but signals the plan may not have been written with full knowledge of what's already been applied.

**Phase C triggers depend on correct data**

The new trigger types (never_booked, one_and_done, cooling_off, plan_upgrade_candidate, class_type_fan) all query behavior data that is currently incorrect or missing. They cannot be reliably implemented until Category 1 (backfill SQL) has run. This dependency is implicit in the plan but not stated.

---

### Complexity Drivers

**High complexity items:**
- cron-member-enrichment: must handle multi-tenancy (iterate all studios), avoid running during peak hours, and handle partial failures gracefully. The existing cron functions have a TODO about multi-tenancy hardcoding (STUDIO_ID is hardcoded in evaluate-triggers.ts).
- New trigger types with relational logic: classpass_repeat requires joining profiles.acquisition_source to bookings. plan_upgrade_candidate requires comparing current plan against booking frequency. These are non-trivial queries.
- member_360 RLS: must be correct for both UI queries and Inngest service-role queries.

**Low complexity items (often overestimated):**
- Backfill SQL: 1 file, ~30 lines of SQL
- glofox_plan_map: 1 table, 1 populate query
- acquisition_source backfill: 1 UPDATE statement
- UI badges for acquisition_source: 1 component addition

---

### Files Affected (Estimate)

| Area | Files | Complexity |
|------|-------|------------|
| Migration SQL | 1–2 new files | Low |
| glofox-backfill.ts | 0–1 (may just need triggering) | Low–Medium |
| evaluate-triggers.ts | 1 (add 6 cases to switch) | Medium |
| New cron-member-enrichment.ts | 1 new file | Medium |
| Check-in handler | 1–2 existing files | Low |
| member_360 VIEW | 1 SQL migration | Low (thin JOIN) / Medium (with aggregation) |
| UI: member profile | 1–2 existing files | Low |
| UI: campaign builder | 1–2 existing files | Low–Medium |
| Types package | 1 (new types for member_360) | Low |

Total: ~10–15 files touched. This is a MODERATE sized implementation, not a large one.

---

### Timeline Estimate

If properly sequenced:
- **Day 1:** Category 1 SQL + run. Automation triggers start working.
- **Days 2–4:** Category 2 (VIEW, cron, check-in handler, new triggers).
- **Days 5–7:** Category 3 + UI integration.

If run as 4 sequential phases as described: 2–3 weeks, with automation triggers broken for the first week unnecessarily.

---

## Recommended Restructure

**Sprint 1 (immediate):** Backfill SQL only — total_visits, last_visit, acquisition_source, engagement_status, plan_map. Ship today.

**Sprint 2:** member_360 VIEW (thin) + cron-member-enrichment + check-in real-time update + existing transactions backfill trigger.

**Sprint 3:** New automation trigger types + pre-built flow templates.

**Sprint 4:** UI integration (badges, campaign segments, member profile enrichment).

Each sprint is independently shippable and independently valuable.
