# Edge Cases & Risk Analysis

**Agent:** edge-cases
**Plan:** Unified Member Data Architecture
**Complexity:** SIGNIFICANT
**Date:** 2026-04-04

---

## Agent Verdict

**MODIFY** — The plan has 6 specific edge cases that will produce incorrect behavior or data corruption if not addressed before implementation. None are blockers, but 3 of them (booking status filter for visit counts, ClassPass false positive logic, and trigger double-enrollment) will cause incorrect automation behavior immediately after deployment.

---

## Edge Case Inventory

### EC-01: Booking Status Filter for total_visits Backfill

**Risk: HIGH — Incorrect visit counts**

The plan says "backfill total_visits from actual booking data." The filter is not specified. If the backfill counts ALL bookings (including cancelled, waitlisted, no_show), total_visits will be inflated.

The correct filter: only count bookings where status IN ('confirmed', 'checked_in') AND checked_in_at IS NOT NULL. A booking that was made but cancelled before check-in should NOT count as a visit. A booking that is 'confirmed' but never checked in is debatable — for visit count purposes, only actual attendance (checked_in_at IS NOT NULL) should count.

This also affects the engagement_status backfill and all 6 new trigger types that reason about visits.

**Recommendation:** The migration SQL must explicitly filter: `WHERE checked_in_at IS NOT NULL AND status NOT IN ('cancelled', 'no_show', 'waitlisted')`

---

### EC-02: ClassPass False Positive Pattern

**Risk: MEDIUM — Incorrectly tagging real members as ClassPass**

The plan identifies ClassPass members as: lead_source='U' + phone='+10000000000'. The phone pattern is a Glofox-generated placeholder, not a real number. However:
- What if a real member also has lead_source='U' and never provided a phone (leaving Glofox's default)?
- What if Glofox uses '+10000000000' as the default for phone-not-provided members generally?

The detection logic should be: phone = '+10000000000' AND lead_source = 'U'. This is a compound condition. But it should also be: acquisition_source should only be SET to 'classpass' where it is currently NULL — never overwriting an already-set value.

Additionally, if a ClassPass user converts to a direct member (updates their phone number in Glofox), the sync will update their phone — but acquisition_source = 'classpass' will remain set forever. This is probably correct (they originally came via ClassPass), but the business should be aware.

**Recommendation:** Backfill query: `WHERE phone = '+10000000000' AND lead_source = 'U' AND acquisition_source IS NULL`. Do not overwrite existing values. Document the permanence of acquisition_source.

---

### EC-03: Trigger Double-Enrollment on Backfill

**Risk: HIGH — Automation triggers fire for all members at once**

When total_visits is backfilled from 0 to actual values, every member who has ≥10 visits (or whatever the milestone threshold is) will simultaneously qualify for the milestone trigger. The next evaluate-triggers.ts run after backfill will attempt to enroll all of them.

If there are automation flows with a milestone trigger active at backfill time, this could trigger hundreds of simultaneous enrollments and email sends. The automation_enrollments unique constraint (partial index on active status) prevents duplicate active enrollments — but it doesn't prevent bulk enrollment of everyone who "newly" qualifies.

**Recommendation:** Either (a) run the backfill when no milestone automation flows are active, or (b) add a "trigger suppression" mechanism for backfill scenarios, or (c) use the enrollment cooldown system to prevent immediate re-enrollment. Most pragmatically: ensure no active automation flows use milestone/inactivity triggers before running the backfill.

---

### EC-04: Members Without Bookings

**Risk: LOW — NULL handling in backfill**

Some members will have 0 bookings. The UPDATE query must handle the case where a member has no matching rows in bookings — total_visits should be set to 0 (not NULL) and last_visit should remain NULL (correct). A LEFT JOIN or correlated subquery handles this correctly. A plain JOIN will silently leave unmatched members unchanged.

**Recommendation:** Use `LEFT JOIN` or `COALESCE(count, 0)` in the backfill SQL to ensure all members are updated, not just those with bookings.

---

### EC-05: Plan Code Gaps in glofox_plan_map

**Risk: LOW — Incomplete mapping display**

The Glofox memberships endpoint returns currently active plan definitions. Historical plan codes referenced in members' records may correspond to plans that have been archived or deleted in Glofox. The glofox_plan_map will miss these codes.

For deleted plans, the members.plan_code (or however plan codes are stored) will still reference the old numeric ID, but there will be no row in glofox_plan_map to resolve it.

**Recommendation:** The glofox_plan_map lookup should COALESCE to the raw code when no mapping exists: `COALESCE(gpm.plan_name, members.membership_plan_id::text)`. UI should display "Plan #12345" rather than blank or error for unmapped codes.

---

### EC-06: New Trigger Types Without Exit Conditions

**Risk: MEDIUM — Members stuck in automation flows**

The new trigger types (classpass_repeat, one_and_done, cooling_off) target transient behavioral states. A member classified as "cooling_off" (decreasing visit frequency) may return to normal frequency — they should exit the cooling_off automation flow. But if the flow has no exit condition defined (exit_conditions is JSONB on automation_flows, default '{}'), they remain enrolled until the flow completes all steps.

For behavior-based triggers, exit conditions are more important than for event-based triggers (signup, birthday). A member who converts from ClassPass to direct member should exit any "classpass_repeat" flow immediately.

**Recommendation:** For each new trigger type, define the corresponding exit condition. Document this in the pre-built flow templates. Consider adding a "trigger_resolved" exit condition that the cron checks: re-evaluate the trigger condition for enrolled members and exit if it no longer applies.

---

### EC-07: Favorite Class Type With Tied Counts

**Risk: LOW — Determinism in member_360**

If a member has equal bookings across two class types, favorite_class_type is non-deterministic (depends on query plan or tiebreaker). For a VIEW that surfaces this to the UI, this should be deterministic.

**Recommendation:** Add ORDER BY count DESC, class_type_name ASC (or similar tiebreaker) in any LATERAL subquery computing favorite_class_type. Also handle the case where a member has no bookings (NULL).

---

### EC-08: The "Subscription" Pull Ambiguity

**Risk: MEDIUM — Implementation stall**

Phase B includes "pull subscriptions from Glofox." This term does not map to a known GlofoxClient method. If implementation begins and the developer cannot find a "subscriptions" endpoint, the work stalls while clarification is sought. In a sprint context, this wastes time.

**Recommendation:** Before Phase B begins, explicitly map "activity/history" and "subscriptions" to specific GlofoxClient methods or confirm new methods need to be added. Don't let this be a discovery item mid-sprint.

---

## Edge Cases Inherited from Existing System

**milestone trigger re-firing:** If total_visits is updated via daily cron rather than at check-in, a member could theoretically pass a milestone threshold between cron runs multiple times before the trigger fires. The enrollment unique constraint prevents duplicate active enrollments, but the trigger should also have a "already completed" check. The existing `canEnrollMember` helper handles this via cooldown_days.

**ClassPass members and capacity counts:** ClassPass members who book via the Glofox integration count toward class capacity. This is correct. The acquisition_source tag doesn't affect booking behavior — it's metadata only.

---

## Summary

| Edge Case | Risk | Status |
|-----------|------|--------|
| EC-01: Booking status filter | HIGH | Fix before backfill |
| EC-02: ClassPass false positive | MEDIUM | Fix in backfill SQL |
| EC-03: Trigger double-enrollment | HIGH | Coordinate with automation team |
| EC-04: Members without bookings | LOW | Fix in SQL (LEFT JOIN) |
| EC-05: Plan code gaps | LOW | Handle in VIEW/UI |
| EC-06: Trigger exit conditions | MEDIUM | Add to pre-built templates |
| EC-07: Favorite class type ties | LOW | Add tiebreaker |
| EC-08: Subscription endpoint ambiguity | MEDIUM | Clarify before Phase B |

---

## Verdict Confidence: HIGH
