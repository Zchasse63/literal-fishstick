# Unified Verdict: Unified Member Data Architecture

**Date:** 2026-04-04
**Plan:** Unified Member Data Architecture for Meridian Fitness Studio Platform
**Complexity Class:** SIGNIFICANT
**Mode:** Deep (7 agents)

---

## Overall Verdict: MODIFY

The plan is correct in problem identification, correct in approach, and correct in priority. It should proceed — but with structural modifications before work begins. The modifications are not about changing direction; they are about preventing three specific failure modes that the plan as written will encounter.

---

## Verdict Rationale

**Why not NO-GO:** The core problems are real and correctly diagnosed. total_visits and last_visit being 0/null for all members is broken functionality, not a missing feature. Automation triggers are misfiring silently. ClassPass conversion is a real revenue opportunity. This work is a legitimate prerequisite to Phase 2.

**Why not unqualified GO:** Three issues need resolution before implementation begins: (1) the member_360 VIEW performance model is wrong and will be rewritten under load, (2) the computed field update strategy creates a correctness gap in automation triggers, (3) the "mass pull" scope in Phase B is underspecified and will stall mid-sprint.

**Why MODIFY:** With the modifications below, this becomes a clean GO. The modifications are design clarifications, not scope challenges.

---

## Required Modifications

### Modification 1: Start With the Backfill SQL — Today

The backfill of `members.total_visits`, `members.last_visit`, `members.engagement_status`, and `profiles.acquisition_source` is a single SQL migration file. It requires no code changes. It fixes broken automation triggers immediately. It takes a few hours to write and test.

Do this first, before any other work. Every day it isn't done, the milestone trigger is silently misfiring.

**SQL pattern required:**
```sql
UPDATE members m
SET
  total_visits = COALESCE(sub.visit_count, 0),
  last_visit = sub.last_checked_in
FROM (
  SELECT
    member_id,
    COUNT(*) FILTER (WHERE checked_in_at IS NOT NULL
                     AND status NOT IN ('cancelled', 'no_show', 'waitlisted')) AS visit_count,
    MAX(checked_in_at) FILTER (WHERE checked_in_at IS NOT NULL) AS last_checked_in
  FROM bookings
  WHERE studio_id = '<studio_id>'
  GROUP BY member_id
) sub
WHERE m.profile_id = sub.member_id
  AND m.studio_id = '<studio_id>';
```

The booking status filter is mandatory (EC-01). Count only actual check-ins.

**ClassPass backfill:**
```sql
UPDATE profiles
SET acquisition_source = 'classpass'
WHERE phone = '+10000000000'
  AND lead_source = 'U'
  AND acquisition_source IS NULL
  AND studio_id = '<studio_id>';
```

This column already exists on the table (phase2-migration.sql applied it).

### Modification 2: Update total_visits at Check-In, Not Via Daily Cron

The daily cron-member-enrichment should be a reconciliation tool, not the primary update path. The check-in handler (wherever bookings.checked_in_at is set) must also:
- Increment `members.total_visits` by 1
- Update `members.last_visit` to the check-in timestamp

This ensures milestone triggers fire within 10 minutes of the actual visit rather than up to 23 hours later.

### Modification 3: member_360 VIEW Must Not Re-Aggregate from Bookings

The VIEW should read pre-computed columns from members (total_visits, last_visit, engagement_status) rather than re-aggregating from bookings on every query. Complex derived fields (favorite_class_type) can use a LATERAL subquery — this is bounded (one per member) and acceptable.

**Correct VIEW structure:**
```sql
CREATE VIEW member_360 AS
SELECT
  p.id AS profile_id,
  p.first_name, p.last_name, p.email, p.phone,
  p.acquisition_source,
  p.studio_id,
  m.id AS member_id,
  m.total_visits,
  m.last_visit,
  m.engagement_status,
  m.membership_status,
  m.membership_tier,
  CURRENT_DATE - m.last_visit::date AS days_since_last_visit,
  mp.name AS plan_name,
  gpm.plan_name AS glofox_plan_name,
  ft.class_type_name AS favorite_class_type
FROM profiles p
LEFT JOIN members m ON m.profile_id = p.id AND m.studio_id = p.studio_id
LEFT JOIN membership_plans mp ON mp.id = m.membership_plan_id
LEFT JOIN glofox_plan_map gpm ON gpm.glofox_plan_id = m.glofox_plan_code
  AND gpm.studio_id = p.studio_id
LEFT JOIN LATERAL (
  SELECT ct.name AS class_type_name
  FROM bookings b
  JOIN classes c ON c.id = b.class_id
  JOIN class_types ct ON ct.id = c.class_type_id
  WHERE b.member_id = p.id
    AND b.checked_in_at IS NOT NULL
  GROUP BY ct.id, ct.name
  ORDER BY COUNT(*) DESC, ct.name ASC
  LIMIT 1
) ft ON true;
```

### Modification 4: Specify Phase B Scope Before Starting It

Before Phase B begins, explicitly map each data source to a GlofoxClient method:
- "transactions" → `getTransactions()` (Analytics/report) — already in backfill function, may just need triggering
- "activity/history" → `getInteractions(userId)` per-member OR clarify it means something else
- "subscriptions" → clarify: is this `getMemberships()`? Already done. Or per-member subscription detail?

If interactions require per-member calls (N+1), scope the work as: run once as a batch job, not as ongoing sync, with explicit rate limiting.

### Modification 5: Coordinate Backfill Timing With Automation Flows

Before running the backfill that sets real total_visits values, confirm that no milestone or behavior-based automation flows are currently active in production. If active flows exist, the backfill will immediately qualify potentially hundreds of members and trigger bulk enrollments.

Check: `SELECT count(*) FROM automation_flows WHERE is_active = true;`

If count > 0, either deactivate flows temporarily during backfill, or accept the bulk enrollment (if intentional).

---

## What Does NOT Need Modification

- New automation trigger types (6) — the switch-statement extension pattern is correct
- glofox_plan_map table design — simple, correct
- cron-member-enrichment as reconciliation (not primary) — correct role after Modification 2
- UI integration approach (member profile badges, campaign segments) — straightforward
- The overall 4-phase structure as a conceptual framework (even if Sprint 1 = all of Phase A backfill in a day)

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Backfill triggers bulk automation enrollment | HIGH | MEDIUM | Check active flows before running backfill |
| ClassPass false positives | LOW | LOW | Compound condition + only set where NULL |
| member_360 performance (if aggregation-based) | HIGH (without Mod 3) | MEDIUM | Implement Modification 3 |
| Phase B stalls on undefined endpoints | MEDIUM | LOW-MEDIUM | Implement Modification 4 |
| total_visits lag for triggers (if cron-only) | HIGH (without Mod 2) | MEDIUM | Implement Modification 2 |
| STUDIO_ID hardcoding in evaluate-triggers.ts compounds | MEDIUM | LOW (for now) | Address MED-001 before adding triggers |

---

## Assumptions to Validate

1. **The Glofox backfill function (glofox-backfill.ts) has been triggered and run successfully at some point.** If it has never run, transactions, credit_packs, and leads tables are all empty. The plan assumes these have been populated.

2. **phase2-migration.sql has been applied to the production database.** The acquisition_source column, automation_flows table, and other Phase 2 schema changes must be live for this plan's work to build on them correctly.

3. **The Analytics/report endpoint returns transactions from 2020 to present.** The backfill start date is hardcoded as '2020-01-01'. If Glofox's analytics endpoint has a retention window shorter than this, historical transactions will be incomplete.

4. **The '+10000000000' phone pattern is exclusively a Glofox ClassPass placeholder.** If Glofox uses this as a generic "no phone provided" default for non-ClassPass members, false positive rate will be higher than expected.

5. **No active automation flows exist in production currently.** The plan says 0 rows in automation_flows, but this should be confirmed before backfill.

---

## Sequenced Work Plan

**Immediate (this sprint):**
1. Write and run member data backfill SQL (total_visits, last_visit, engagement_status, acquisition_source)
2. Write and run glofox_plan_map migration + populate
3. Check active automation flows; confirm safe to backfill
4. Trigger existing transactions backfill (or confirm it's already run)

**Sprint 2:**
5. Modify check-in handler to increment total_visits/update last_visit in real time
6. Create member_360 VIEW (thin JOIN, pre-computed columns)
7. Create cron-member-enrichment Inngest function (reconciliation role)
8. Clarify and scope Phase B mass-pull endpoints

**Sprint 3:**
9. Add 6 new trigger types to evaluate-triggers.ts (after data is accurate)
10. Fix MED-001 (STUDIO_ID hardcoding) in evaluate-triggers.ts while touching the file
11. Create pre-built automation flow templates

**Sprint 4:**
12. UI: member profile enrichment (acquisition source badge, engagement tier, favorite class type)
13. UI: campaign builder behavior-based segments
14. UI: plan name display from glofox_plan_map

---

## Final Assessment

This is the right plan to execute now. The problems it addresses are real, the approach fits the architecture, and the value is immediate. With the 5 modifications above, implementation risk drops from MEDIUM to LOW. The most important action is to write the backfill SQL today — everything else can follow.

**Confidence:** HIGH
