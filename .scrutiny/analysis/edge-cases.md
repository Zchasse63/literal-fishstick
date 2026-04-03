# Edge Cases Analysis
**Agent:** edge-cases
**Plan:** Glofox API Migration to Meridian
**Complexity:** SIGNIFICANT
**Date:** 2026-03-31

---

## Agent Verdict
**MODIFY** — The plan addresses happy-path sync scenarios well but has meaningful gaps in failure handling. Several edge cases that will definitely occur in a live migration are either unaddressed or inadequately handled: members who exist in one system but not the other, records modified in both systems within the same sync window, Glofox API partial failures, and the billing cycle edge case at cutover. These are not theoretical — they will happen. The plan needs explicit handling for each.

---

## Edge Cases the Plan Addresses

**Concurrent booking race conditions:** The plan inherits the atomic insert policy from the CLAUDE.md edge case decisions. Meridian uses atomic inserts for booking races — this carries through to the sync engine's outbound booking creation.

**Inbound update vs. new insert:** The `syncMembersInbound` function correctly distinguishes between existing records (update) and new records (insert) using `glofox_id` lookup. This is the right pattern.

**Conflict detection:** The `glofox_sync_conflicts` table and per-field resolution rules handle the case of concurrent modification in both systems.

**Rollback capability:** Supabase PITR + "never delete from Glofox" policy provides a genuine rollback path.

**Idempotency:** Inbound sync is inherently idempotent (upsert on glofox_id). Outbound sync stores the resulting Glofox ID back to the Meridian record to prevent duplicates.

---

## Unaddressed Edge Cases

### Edge Case 1: Members in Meridian With No Glofox ID

After the one-time CSV import, there may be Meridian member records that have no `glofox_id` mapping (e.g., members who were created directly in Meridian, test accounts, or import gaps). The inbound sync skips these (correctly — it only processes Glofox records). But the outbound sync's `pushMemberUpdate` function returns early with `if (!member?.glofox_id) return` — silently dropping the update.

This is correct behavior during transition (Glofox-unmapped members shouldn't push updates to Glofox). But post-cutover, if any member created in Meridian during parallel mode has no `glofox_id`, their data will never have been synced to Glofox, and their booking history in Glofox will be incomplete.

**Scenario:** Staff creates a new member in Meridian during parallel mode → member books a class in Meridian → outbound sync fires → `glofox_id` is null → sync skipped → Glofox booking not created → Glofox's attendance records for that class are incomplete → trainer bonus threshold calculation in Glofox is wrong.

**Recommended handling:** New member registrations in Meridian during parallel mode should trigger a `POST /2.0/register` call to Glofox and store the resulting Glofox user ID back to `profiles.glofox_id`. The plan includes the `sync-member-outbound` function but does not specify that new member creation (not just profile updates) should trigger it.

### Edge Case 2: Records Modified in Both Systems Within One Sync Window

The conflict detection assumes last-modified wins for profile fields. But "last modified" depends on comparing timestamps across two systems with potentially different clock synchronization. If Meridian's server clock and Glofox's clock differ by more than a few seconds (not uncommon across cloud providers), the "last modified" comparison may produce wrong results.

More critically: if the same field (e.g., phone number) is updated in both systems within the same 10-minute sync window, the outcome is: Glofox's value gets pulled in by inbound sync, overwrites Meridian's value, then outbound sync fires and pushes Meridian's now-stale value back to Glofox. The result is that the Glofox update wins even though the Meridian update may have been more recent.

**Recommended handling:** Store the Meridian-side `updated_at` at the time of each sync. When running conflict detection, compare `record.updated_at` vs. `glofox_member.modified_at` using a tolerance window (e.g., if within 60 seconds, flag as a conflict requiring manual review rather than applying last-modified). This is defensive but prevents silent data corruption.

### Edge Case 3: Glofox API Returns Partial Results Mid-Pagination

If the Glofox API times out, returns a 5xx error, or returns an empty page mid-pagination, the `fetchAll` function will either throw (and abort the sync) or return partial results (if error handling catches at a page level). The current implementation throws on non-OK responses, which means the entire sync run fails.

This is acceptable for ad-hoc calls but problematic for large entity types. If the bookings endpoint times out on page 8 of 15 during the 5-minute sync cycle, the sync engine logs an error and the next run will re-attempt from `last_sync_at` — but the next run won't know that pages 1–7 were already processed. If the sync increments `last_sync_at` only on successful completion, pages 1–7 will be re-synced next time (harmless due to upsert). But if `last_sync_at` is updated incrementally as pages are processed, an aborted mid-run could leave a gap.

The code updates `last_sync_at` to `new Date().toISOString()` only after processing all records, which means the next run will re-process all records since the original `last_sync_at`. This is safe but may cause unnecessary reprocessing of up to 10 minutes of records during recovery.

**No change needed** — the current approach is correct. But this should be explicitly documented as the intended behavior, not left implicit.

### Edge Case 4: Billing Cycle Boundary at Cutover

The cutover happens "Sunday night at 22:00." But member billing cycles are individual (they started on different days). Some members will have billing dates that fall Monday or Tuesday — within 48 hours of cutover.

The plan says: "Create Stripe Subscription (set to start on their next billing date)." This is correct — Stripe subscriptions start on the next billing date, so there is no double-charge. But it creates a gap scenario:

- Member's billing date: Monday (Day 1 post-cutover)
- Stripe subscription created on Saturday (Day -1): starts Monday
- Glofox processes final charge on Sunday night (before freeze) or not at all
- If Glofox processes a charge on Sunday and Stripe starts Monday: member may be charged twice in 2 days

**Recommended handling:** Before the cutover freeze, pull all member billing dates from Glofox. For any member whose next billing date is within 7 days of cutover, coordinate manually: either skip the final Glofox charge and start Stripe one cycle earlier, or ensure Stripe subscription starts after the Glofox charge date.

### Edge Case 5: Credit Pack Members at Cutover

The plan states: "Members with credits/packs: no change needed (credits are in Meridian DB)." But are they? If the one-time CSV import was incomplete (27 fields missing), credit pack balances and expiry dates may not have been imported. The sync engine will pull credit pack data from Glofox via `GET /2.0/credits` per member — but this is a per-member endpoint, not a bulk endpoint, meaning enriching credits for all 1,100 members requires 1,100 individual API calls.

The plan does not include credit pack enrichment as part of the inbound sync schedule. If credits are not synced before cutover, members with remaining credits will have incorrect balances in Meridian.

**Recommended handling:** Add a `sync-credits-inbound` function or include credits in the full refresh daily job. Verify credit balances for all active members match before cutover sign-off.

### Edge Case 6: Staff Accounts Without Meridian Profiles

The plan syncs staff from Glofox (`GET /2.0/staff`), and transactions include a `sold_by` field referencing staff. If staff in Glofox do not have corresponding profiles in Meridian (or if staff were not included in the original CSV import), the `sold_by_profile_id` FK insertion will fail.

The plan notes Glofox has ~10 staff. But the dual-role issue documented in CLAUDE.md (trainers who are also members, owners who have personal memberships) suggests the staff records in Glofox may not map cleanly to Meridian's profile records. Some Glofox staff may not have Meridian profiles at all.

**Recommended handling:** Before Phase 2, manually verify all Glofox staff IDs have corresponding Meridian profiles. For any without mappings, create profiles and establish the glofox_id link manually. This should be a Phase 1 task, not a Phase 2 discovery.

### Edge Case 7: Deleted Records in Glofox

The plan's inbound sync handles creates and updates. It does not handle deletes. If a booking is cancelled in Glofox (status changes to "cancelled"), the incremental sync will pull the updated booking and update Meridian's status — this is handled. But if a member record is archived or deleted in Glofox, the `utc_modified_start_date` filter may or may not include it depending on how Glofox handles deleted record visibility in its API.

If Glofox hard-deletes records, they will simply stop appearing in sync results. Meridian will have a record for a member that no longer exists in Glofox, creating a phantom. The daily full reconciliation should detect count discrepancies, but the plan does not specify what action to take when a Meridian record has a `glofox_id` that no longer appears in Glofox's member list.

**Recommended handling:** The daily full reconciliation should include a step: for all Meridian members with `glofox_id IS NOT NULL`, verify the Glofox ID still exists in the Glofox member list. Members missing from Glofox should be flagged for manual review, not automatically deleted.

### Edge Case 8: Membership Plan Mismatch After Cutover

Glofox membership plans (read-only in API) will not exist in Meridian post-cutover. The `glofox_plan_code` column stores the Glofox-internal plan identifier. After cutover, when creating new subscriptions or upgrades, Meridian uses Stripe products/prices — which are different entities.

The mapping between Glofox plan codes and Stripe price IDs must be established before cutover. If a member's `glofox_plan_code` = "UNLIMITED_MONTHLY" and the corresponding Stripe price ID is `price_xyz123`, that mapping needs to be explicit in the codebase. The plan does not include this mapping step.

**Recommended handling:** Create a `membership_plan_mapping` or `plan_catalog` table that maps Glofox plan codes to Stripe price IDs during the transition period. This should be established in Phase 1 or Phase 2, not discovered at cutover.

---

## Edge Cases in the Rollback Plan

### Rollback Edge Case: Bookings Created in Meridian During Cutover Window

The rollback plan for "within 1 hour" says: "Run reverse sync (Meridian → Glofox for any new bookings)." But outbound booking sync requires a valid `glofox_id` on the class being booked. If any classes were created in Meridian (not synced from Glofox) and have no Glofox equivalent, bookings for those classes cannot be synced to Glofox on rollback.

The mitigation: no new classes should be created in Meridian during the cutover window. This should be an explicit constraint in the cutover runbook.

### Rollback Edge Case: Members Who Logged Into Meridian During Cutover

If rollback happens after some members have authenticated with Meridian (magic link) but Glofox is reverted to primary, those members will receive password/login prompts from the old system they no longer expect. This creates member confusion but is manageable with proactive communication.

---

## Summary of Edge Cases by Severity

| Edge Case | Probability | Severity | Addressed? |
|-----------|------------|----------|------------|
| Members without glofox_id receiving no outbound sync | High | Medium | No |
| Concurrent modification within sync window | Medium | Medium | Partial |
| Billing cycle collision at cutover | Medium | High | No |
| Credit pack data not synced | Medium | High | No |
| Staff without Meridian profiles causing FK failures | High | Medium | No |
| Glofox hard-deleted records creating phantoms | Low | Low | No |
| Plan code → Stripe price ID mapping missing | High | High | No |
| API partial failure mid-pagination | Medium | Low | Implicit only |
| DNS propagation lag causing partial traffic split | Low | Medium | Not mentioned |
