# Scope Decomposition

**Plan:** Unified Member Data Architecture
**Date:** 2026-04-04

---

## Sprint 1: Backfill SQL (Immediate — 1 day)
- [ ] Write member-data-backfill.sql migration
  - UPDATE members: total_visits (checked_in_at filter), last_visit
  - UPDATE members: engagement_status from visit pattern
  - UPDATE profiles: acquisition_source = 'classpass' where phone='+10000000000' AND lead_source='U' AND acquisition_source IS NULL
- [ ] Write glofox_plan_map migration + populate from existing membership_plans data
- [ ] Confirm automation_flows count = 0 (safe to backfill)
- [ ] Run migrations in dev, verify counts, run in production
- [ ] Confirm existing transactions backfill has run (or trigger it)

**Files:** 1–2 new .sql migration files

---

## Sprint 2: Foundation (Days 2–5)
- [ ] Modify check-in handler: increment members.total_visits + update members.last_visit at check-in time
- [ ] Create member_360 VIEW (thin JOIN, no aggregation of pre-computed fields)
- [ ] Create cron-member-enrichment.ts Inngest function (daily reconciliation)
  - Update total_visits/last_visit/engagement_status for all studios
  - Multi-tenancy aware (iterate studios table, not hardcoded STUDIO_ID)
- [ ] Clarify Phase B endpoints: map "activity/history" and "subscriptions" to specific Glofox API methods

**Files:** 1–2 existing files modified, 2–3 new files

---

## Sprint 3: Automation Triggers (Days 6–10)
- [ ] Fix MED-001: Remove STUDIO_ID hardcoding from evaluate-triggers.ts (iterate studios table)
- [ ] Add 6 new trigger cases to evaluate-triggers.ts:
  - never_booked (profiles with 0 total_visits and membership_status = 'active')
  - classpass_repeat (acquisition_source = 'classpass' AND total_visits >= 2)
  - one_and_done (total_visits = 1 AND days_since_last_visit > 14)
  - cooling_off (visit frequency declining over last 3 months)
  - plan_upgrade_candidate (6_class or 10_class with near-limit visit pace)
  - class_type_fan (favorite_class_type X with >= N visits)
- [ ] Add exit conditions for behavioral triggers (check if condition still applies)
- [ ] Create pre-built automation flow templates in seed data or UI

**Files:** 1 existing file (evaluate-triggers.ts), 1–2 new template files

---

## Sprint 4: UI Integration (Days 11–15)
- [ ] Member profile page: acquisition_source badge, engagement_status tier indicator, favorite class type, days since last visit
- [ ] Campaign builder: segment filter options for acquisition_source, engagement_status, behavior_segment
- [ ] Plan name display: resolve glofox_plan_map in member list and profile views
- [ ] Types package: add member_360 TypeScript type

**Files:** 3–5 existing UI component files, 1 types update

---

## Total Estimated Files: 15–20 files touched
## Total Estimated Hours: 35–55 hours
