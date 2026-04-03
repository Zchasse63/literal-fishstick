# Verdict: Glofox API Migration to Meridian
**Synthesized:** 2026-03-31
**Input agents:** 7 (technical-feasibility, scope-complexity, user-value, cost-benefit, architecture-impact, edge-cases, competitive-context)

---

## Overall Verdict: MODIFY

**Proceed with the migration — with explicit modifications before Phase 2 begins.**

The migration is the right move strategically and technically. The sync engine architecture is sound, the tooling choices are correct, and the value case is clear. The plan fails on specificity in several areas that will cause problems mid-execution if not addressed now. The 8-week timeline is achievable for the sync engine and admin/staff cutover. It is not achievable for a full member-facing cutover because the prerequisite (member portal) does not exist and has no timeline.

---

## Verdict by Agent

| Agent | Verdict | Primary Concern |
|-------|---------|----------------|
| Technical Feasibility | MODIFY | Rate limits unknown; 5 code bugs; outbound trigger mechanism unspecified; Phase 5 dependency |
| Scope Complexity | MODIFY | Sync monitoring dashboard unscoped; member portal prerequisite unscoped; Glofox contract notice not considered |
| User Value | GO | Value is real and immediate; member friction is manageable |
| Cost-Benefit | GO | ROI positive; payment migration is the primary financial risk |
| Architecture Impact | MODIFY | Missing RLS policies; missing Inngest event types; post-cutover cleanup needs precision |
| Edge Cases | MODIFY | 8 unaddressed edge cases, 3 of them high-severity |
| Competitive Context | GO | Migration is a competitive asset; delay increases risk |

**Aggregate: MODIFY (4 MODIFY, 3 GO, 0 DEFER, 0 NO-GO)**

---

## Required Modifications Before Phase 2

These are not optional improvements — they are blocking issues that will cause rework if not addressed first:

### M1: Validate Glofox API rate limits (do this in Week 1)
The sync frequencies (bookings every 5 min = 288+ requests/day) were chosen for data freshness, not based on any knowledge of Glofox's rate limits. If the limit is 100 requests/hour, the booking sync alone fails. Get rate limit documentation or empirically test before designing the sync schedule.

### M2: Fix the pagination contract (do this in Week 1)
The `fetchAll` function assumes `body.has_more` terminates pagination. If the Glofox API uses a different signal, every sync silently returns only page 1. With 1,100 members at 100/page, this means 1,000 members are missed. Validate against glofox-api-guide.md and test against a live endpoint before Phase 2 code is finalized.

### M3: Fix 5 code bugs before Phase 2 is shipped
- Name-splitting null-access and semantic errors in `pushMemberUpdate`
- Missing `UNIQUE(studio_id, entity_type)` constraint on `glofox_sync_state`
- `sold_by_profile_id` FK will fail for staff without Meridian profiles — make nullable
- `fetchAll` URL construction drops `/prod` path prefix for absolute paths
- Verify `POST /Analytics/report` supports individual transaction records and incremental date filters

### M4: Specify and implement outbound sync trigger mechanism (Week 2)
The plan says "event-driven, triggered by database changes" but never defines how. Specify it as application-level triggering (API routes call `inngest.send()` after writes). Add loop-prevention logic using `glofox_synced_at` timestamp.

### M5: Add the plan code → Stripe price ID mapping step (Week 2)
Glofox plan codes (UNLIMITED_MONTHLY, etc.) must map to Stripe price IDs before cutover. This mapping is completely absent from the plan. Establish it in Phase 2 or the cutover has no membership continuity.

### M6: Address the member portal prerequisite (before Phase 4 pre-checklist)
The cutover checklist requires "member-facing features ready." Phase 5 has not started. Either:
- **Option A (recommended):** Scope a minimal member surface (auth + Stripe payment form + account page) as a standalone 1–2 week project, and schedule it to complete by Week 5 so payment collection can begin
- **Option B:** Explicitly define the cutover as admin-only (staff and operations migrate; Glofox member app stays active for members until Phase 5), and update the checklist to reflect this

The plan cannot have the checklist it has without choosing between these options.

---

## Recommended Modifications (Not Blocking, But Important)

### R1: Add sync monitoring dashboard to Week 3 scope
It is needed before parallel mode begins (Week 5), not after.

### R2: Check Glofox contract cancellation terms now
If a 30-day notice period applies, give notice during Week 6 (parallel mode). Missing the window extends the subscription unnecessarily.

### R3: Add credit pack sync to the inbound sync schedule
Credit balances are listed as "no change needed" but may not have been imported from CSV. Per-member credit sync (`GET /2.0/credits` × 1,100 members) should be part of the full refresh, not assumed complete.

### R4: Add RLS policies for the 3 new tables
`glofox_sync_state`, `glofox_sync_conflicts`, and `lead_interactions` need RLS policies consistent with the rest of the schema.

### R5: Define Inngest event types for outbound sync events
Add `glofox/sync_member`, `glofox/sync_booking`, `glofox/sync_attendance` to `MeridianEvents` type in `lib/inngest/client.ts`.

### R6: Treat the glofox migration module as a permanent library
`lib/glofox/` should be maintained post-cutover as a reusable migration tool for future Meridian customers migrating from Glofox. Don't delete it.

---

## What the Plan Gets Right

- Inngest for sync orchestration is the correct choice given the existing codebase
- Incremental sync via modified-date filters is better than snapshot-and-cutover
- Per-field conflict resolution rules are clear and correct
- Shadow mode before parallel mode is the right validation sequence
- "Never delete from Glofox" policy enables clean rollback
- Supabase PITR + manual snapshot before cutover is correct
- Sunday night cutover with 2-hour window and tiered rollback plan is operationally sound
- The sync monitoring dashboard concept is right (just needs to be scoped)
- All schema changes are safe (nullable/default — no destructive operations)

---

## Timeline Recommendation

**Proceed with Phase 1 (schema) immediately.** It is safe, additive, and reversible.

**Before committing to Phase 2:** Complete M1 (rate limits) and M2 (pagination validation). These take 1–3 days and will meaningfully change the Phase 2 design.

**Revise the timeline to reflect:** The sync monitoring dashboard (Week 3, not Week 5+) and the minimum member surface for payment collection (parallel workstream, target Week 5 completion). The rest of the timeline is reasonable.
