# Scope & Complexity Analysis
**Agent:** scope-complexity
**Plan:** Glofox API Migration to Meridian
**Complexity:** SIGNIFICANT
**Date:** 2026-03-31

---

## Agent Verdict
**MODIFY** — The plan is doing real work and the overall decomposition into phases is reasonable. However, the scope is understated in three material ways: the member-facing portal prerequisite is not scoped at all, the sync monitoring dashboard is mentioned in one sentence without any specification, and the payment migration is presented as a 5-step process when it is actually a multi-week campaign with its own failure modes. The 8-week timeline is achievable for the sync engine and admin cutover. It is not achievable for a full cutover that requires members to interact with Meridian.

---

## Scope Inventory

### What Is Explicitly Scoped

**Schema work (Week 1):**
- 11 `ALTER TABLE` statements adding `glofox_id` columns (7 tables)
- 4 `glofox_synced_at` columns
- 27 new data fields across 6 tables
- 3 new tables (`glofox_sync_state`, `glofox_sync_conflicts`, `lead_interactions`)
- Environment variable setup

Complexity: Low. All additive, nullable, no destructive changes. Estimated 1 day of actual work.

**Sync engine (Weeks 2–3):**
- `GlofoxClient` class with 15+ methods
- 5 inbound Inngest cron functions
- 3 outbound event-driven Inngest functions
- Conflict resolution per-field rules
- Conflict logging to database

Complexity: Medium-High. The Inngest pattern is established, but each sync function requires careful field mapping, error handling, and the conflict detection logic is non-trivial. Estimated 8–12 days of focused development.

**Transition period (Weeks 4–6):**
- Shadow mode monitoring (integrity check queries)
- Staff training
- Parallel mode operations
- Sync monitoring dashboard

Complexity: The sync engine work in shadow/parallel mode is operational, not developmental. Staff training and monitoring are real time costs but not engineering scope. The sync monitoring dashboard is new UI that is entirely unscoped.

**Cutover (Weeks 7–8):**
- Cutover runbook execution
- DNS switch
- Stripe activation
- Post-cutover monitoring

Complexity: Low engineering, high operational risk. One-time execution.

---

## Scope Gaps

### Gap 1: Sync Monitoring Dashboard Has Zero Specification

Section 3.2 mentions:

> "Monitoring dashboard (new admin page): Last sync time per entity type, records synced in last hour/day, active conflicts needing resolution, error count and last error message"

This is described as a "new admin page" but receives no further specification. It requires:
- A new page in the admin dashboard (route + component)
- API route(s) to serve sync state and conflict data
- Real-time or near-real-time refresh (the sync runs every 5–30 minutes)
- Conflict resolution UI (staff must be able to mark conflicts as resolved, pick which value wins)
- Error state display with enough context to debug

The conflict resolution UI in particular is non-trivial — it needs to show both values side-by-side, allow selection, and write back to `glofox_sync_conflicts.resolution`. This is probably 2–4 days of UI work that the timeline does not account for. It is needed before Parallel Mode (Week 5), not after.

### Gap 2: Member-Facing Portal Is a Prerequisite But Is Not Scoped

The cutover pre-checklist requires "all member-facing features ready." This includes:
- A web booking portal (members can see schedule, book classes)
- Authentication for members (magic link / SSO)
- Stripe payment method capture
- Account management (membership status, class history)

Per CLAUDE.md, Phase 5 has not started. The plan implicitly assumes this work happens in parallel by a separate team or happens before this migration begins. Neither assumption is stated. Neither has a timeline.

Notably, the payment migration in Week 6 requires members to enter payment details via "Meridian member portal" — which means the member portal needs at minimum a Stripe payment capture form before Week 6, not Week 7+.

**Minimum viable member surface needed before cutover:**
1. Member auth (magic link login)
2. Stripe payment method form
3. Basic account page (membership status, billing info)

This is not a full booking portal, but it is still 1–2 weeks of development that is not on the plan's timeline.

### Gap 3: Glofox Subscription Cancellation Process Is Unspecified

The plan ends with "Cancel Glofox subscription" as a Day 30 task. In practice:
- Glofox contracts may have notice periods (30–90 days is standard for SaaS)
- Cancellation may require contacting account management
- There may be data export requirements or format specifications Glofox imposes
- The final data archive format is not specified

If Glofox has a 30-day cancellation notice requirement, that notice needs to be given during Week 5–6 (parallel mode), not after cutover. Failing to give notice on time extends the contract and the subscription cost.

### Gap 4: Glofox Event/Schedule Write Limitation Creates Operational Gap

The plan notes Glofox has no write endpoint for classes/schedules. This means:
- During parallel mode, any new class created in Meridian does NOT sync to Glofox
- Staff or members using Glofox during parallel mode would not see classes created in Meridian
- This creates an operational inconsistency that limits how "parallel" the parallel mode can actually be

The plan does not address this. The implication is that class management must move to Meridian-only during Week 5, making the admin portal the single source of truth for scheduling even during "parallel mode." Staff training must cover this specific constraint.

---

## Timeline Assessment

| Week | Work | Estimate | Plan's Estimate | Delta |
|------|------|----------|----------------|-------|
| 1 | Schema migrations | 1–2 days | 1 week | Padded — good |
| 2–3 | Sync engine build | 10–14 days | 2 weeks | Tight but realistic |
| 4 | Shadow mode + monitoring dashboard UI | 5 days ops + 3 days UI | 1 week | UI work not in plan |
| 5–6 | Parallel mode + payment collection + staff training | 2 weeks ops | 2 weeks | Reasonable for ops; member portal needed for payment collection |
| 7–8 | Cutover | 2 days execution | 2 weeks | Very padded; appropriate buffer |

**Total engineering work:** Approximately 4–5 weeks of development
**Total calendar time (with ops phases):** 9–10 weeks if member portal minimum is built in parallel

---

## Complexity Drivers

**What makes this harder than it looks:**
1. Bidirectional sync is inherently more complex than one-way ETL. Every write to either system creates potential for divergence.
2. Glofox API version fragmentation (2.0, 2.1, 2.2, 2.3, v3.0, Analytics) means different response shapes, error codes, and pagination patterns per endpoint.
3. The conflict resolution rules are clear in principle but require careful implementation for concurrent modification scenarios (two updates to the same record within one sync window).
4. Payment migration is a UX problem (getting ~1,100 members to take action) as much as it is a technical problem.
5. The Analytics/report transaction endpoint is a reporting tool being used as a data sync source — this is an unusual use pattern that may have undocumented limitations.

**What makes this simpler than a typical migration:**
1. Small data volume (~1,100 members, ~1,300 bookings, ~2,500 transactions)
2. No data transformation complexity — field names map relatively directly
3. Glofox writes (outbound sync) are limited to profiles, bookings, and attendance — not the full data model
4. The business is small (10 staff, one branch) so operational coordination is manageable
5. Rollback is clean (Supabase PITR + Glofox stays intact)

---

## Recommended Scope Adjustments

1. **Add sync monitoring dashboard to Week 3 scope** (before shadow mode begins, not after).
2. **Explicitly scope the minimum member-facing surface** needed for payment collection (auth + Stripe form + account page) and add it to the timeline or acknowledge it as a separate workstream.
3. **Check Glofox contract cancellation terms now.** If 30-day notice is required, the clock starts no later than Week 6.
4. **Add a class-management-in-Meridian-only policy** to the Week 5 staff training, and update the parallel mode description to reflect that schedule management is Meridian-primary, not truly bidirectional.
5. **Define "full reconciliation"** in the sync-full-refresh function. What constitutes a complete check? What action is taken for orphaned records?
