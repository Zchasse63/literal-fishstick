# Scrutiny Summary: Unified Member Data Architecture

**Date:** 2026-04-04
**Verdict:** MODIFY
**Confidence:** HIGH
**Complexity Class:** SIGNIFICANT
**Agents Run:** 7 (technical-feasibility, scope-complexity, user-value, cost-benefit, architecture-impact, edge-cases, competitive-context)

---

## Verdict: MODIFY

The plan correctly identifies real problems and the right approach. It should proceed with 5 structural modifications that prevent specific failure modes. This is not a course-correction — it's a "fix 5 things before building."

---

## What the Analysis Found

### The Problems Are Real and Urgent

The plan is not proposing a nice-to-have. `members.total_visits = 0` for all 1,183 members despite 5,427 bookings existing is a bug, not a gap. The milestone automation trigger is silently misfiring right now. The `failed_payment` trigger reads an empty transactions table. These are live correctness issues.

### The Approach Fits the Architecture

The tech stack (Supabase PostgreSQL, Inngest crons, Glofox read-only API) is well-understood and the plan works within all constraints. No architectural violations. No pattern conflicts (with the modifications below). The Glofox-read-only constraint is respected.

### Phase Sequencing Is the Primary Issue

The plan treats 4 phases as sequential when the first sprint's work (the SQL backfill) is a standalone migration that can ship today and fixes broken automation triggers immediately. The rest of the plan depends on this but doesn't communicate the urgency.

---

## 5 Required Modifications

**1. Ship the backfill SQL first, today**

Write a single migration file that:
- Backfills `members.total_visits` from bookings (filter: `checked_in_at IS NOT NULL AND status NOT IN ('cancelled', 'no_show', 'waitlisted')` — the booking status filter is mandatory)
- Backfills `members.last_visit` from MAX(checked_in_at)
- Backfills `profiles.acquisition_source = 'classpass'` where `phone = '+10000000000' AND lead_source = 'U' AND acquisition_source IS NULL`
- Backfills `members.engagement_status` from visit patterns

Before running: confirm `SELECT count(*) FROM automation_flows WHERE is_active = true` = 0. If active milestone/inactivity flows exist, the backfill will immediately qualify potentially hundreds of members and trigger bulk enrollments.

**2. Update total_visits at check-in time, not via daily cron**

The `evaluate-triggers.ts` milestone trigger runs every 10 minutes. If `total_visits` is only updated daily, there is a 0–23 hour lag between a member's visit and the trigger firing. Fix: the check-in handler must increment `members.total_visits` and update `members.last_visit` as part of the same transaction that writes `bookings.checked_in_at`. The daily cron becomes a reconciliation/catch-all, not the primary update path.

**3. member_360 VIEW must read pre-computed columns, not re-aggregate**

The VIEW must JOIN on `members.total_visits` and `members.last_visit` (the stored columns), not recalculate them from the bookings table. Re-aggregating in the VIEW creates two diverging sources of truth and a performance liability. Only fields not worth storing (e.g., `favorite_class_type`) should use a LATERAL subquery in the VIEW — bounded to one row per member, acceptable.

**4. Specify Phase B scope before starting**

"Activity/history" and "subscriptions" do not map to known GlofoxClient methods. Before Phase B begins, map each planned data source to a specific `GlofoxClient` method. If "activity" means `getInteractions(userId)` (per-member endpoint), it's an N+1 problem requiring 1,199+ API calls — that's a batch job, not an ongoing sync, and needs explicit scoping.

**5. Fix STUDIO_ID hardcoding (MED-001) when touching evaluate-triggers.ts**

The file has an existing TODO: `// Multi-tenancy — query studios table and iterate all active studios instead of hardcoding a single studio ID. See MED-001.` Adding 6 new trigger types without fixing this compoundsthe debt. Fix it while the file is open for the new trigger work.

---

## What Needs No Modification

- The 6 new automation trigger types — correct and extensible
- glofox_plan_map table design
- cron-member-enrichment as a reconciliation mechanism
- UI integration approach
- Overall phasing concept (just resequence so backfill is immediate)

---

## Sequenced Work Plan

**Sprint 1 (1 day, immediate):** Backfill SQL + glofox_plan_map + confirm/trigger transactions backfill

**Sprint 2 (days 2–5):** Check-in handler update + member_360 VIEW + cron-member-enrichment + Phase B endpoint clarification

**Sprint 3 (days 6–10):** Fix MED-001 + 6 new trigger types + exit conditions + pre-built templates

**Sprint 4 (days 11–15):** UI integration (member profile badges, campaign segments, plan name display)

---

## Key Risks

| Risk | Action Required |
|------|----------------|
| Backfill triggers bulk automation enrollment | Check active flows before running |
| member_360 re-aggregation (slow queries) | Implement Modification 3 |
| total_visits lag for automation triggers | Implement Modification 2 |
| Phase B stalls on undefined endpoints | Implement Modification 4 |

---

## Assumptions to Validate Before Starting

1. `phase2-migration.sql` has been applied to production (acquisition_source column exists on profiles)
2. `automation_flows` table has 0 active rows (safe to run backfill)
3. `glofox-backfill.ts` has been triggered and run at some point (transactions may already be populated)
4. `+10000000000` is exclusively Glofox's ClassPass placeholder, not a generic "no phone" default

---

## Full Reports

All 7 agent reports are at `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/`

- `technical-feasibility.md` — VIEW structure, cron lag, Phase B endpoint gaps
- `scope-complexity.md` — Sprint restructuring, accurate file count, timeline
- `user-value.md` — ClassPass conversion opportunity, automation prerequisite value
- `cost-benefit.md` — 50h estimate, $4–32k/year ClassPass conversion potential
- `architecture-impact.md` — Convention conflicts, RLS handling, dependency order
- `edge-cases.md` — 8 specific edge cases, 3 rated HIGH
- `competitive-context.md` — Glofox differentiation, SaaS positioning

Synthesis verdict: `/Users/zach/Desktop/literal-fishstick/.scrutiny/synthesis/verdict.md`
Scope decomposition: `/Users/zach/Desktop/literal-fishstick/.scrutiny/planning/scope-decomposition.md`
