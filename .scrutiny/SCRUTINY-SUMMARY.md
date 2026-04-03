# SCRUTINY SUMMARY
## Glofox API Migration to Meridian
**Date:** 2026-03-31
**Mode:** Deep (7 agents)
**Complexity:** SIGNIFICANT

---

## Overall Verdict: MODIFY

**The migration is the right move. Proceed — with specific fixes before Phase 2 begins.**

The sync engine architecture is sound. The tooling choices are correct for this codebase. The value case is clear and the cost case is positive. Five concrete bugs in the plan's code samples and six unaddressed edge cases would cause rework if discovered mid-execution rather than now. The 8-week timeline works for the sync engine and admin/staff cutover. It does not work for a full member-facing cutover because the member portal prerequisite has no timeline.

---

## Verdict Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Technical Feasibility | 7/10 | Sync engine is buildable; 5 code bugs; rate limits unknown |
| Scope Clarity | 6/10 | Monitoring dashboard unscoped; member portal gap unacknowledged |
| User Value | 9/10 | Clear, high, unlocks multiple built-but-inert features |
| Cost-Benefit | 8/10 | ROI positive; payment non-collection is the primary financial risk |
| Architecture Fit | 8/10 | Clean fit into existing Inngest + Supabase patterns; RLS gap |
| Edge Case Coverage | 5/10 | 8 unaddressed cases, 3 high-severity |
| Strategic Alignment | 9/10 | Required for product roadmap; migration tooling is a competitive asset |

---

## Must-Fix Before Phase 2 (Blocking)

These 6 items will cause significant rework if not resolved before Phase 2 code is written:

### Fix 1: Validate Glofox API Rate Limits
The sync schedule (bookings every 5 min = 288+ calls/day) was designed for freshness, not for any known rate limit. Obtain rate limit docs or run an empirical burst test in Phase 1. The frequencies may need to change.

### Fix 2: Validate Pagination Contract
The `fetchAll` function assumes `body.has_more` terminates pagination. If wrong, every sync returns only the first 100 records. 1,000 of 1,100 members silently missed. Verify in glofox-api-guide.md and test against a live endpoint.

### Fix 3: Fix 5 Code Bugs in the Plan
- `pushMemberUpdate` name-splitting has a null-access risk and is semantically wrong (read first/last directly from schema)
- `glofox_sync_state` table missing `UNIQUE(studio_id, entity_type)` constraint — upserts will fail
- `sold_by_profile_id` FK will reject transactions from staff without Meridian profiles — make nullable
- `fetchAll` URL construction drops the `/prod` base path for absolute path arguments — use string concatenation
- Confirm `POST /Analytics/report` returns individual transaction rows with date filters (not aggregates)

### Fix 4: Specify Outbound Sync Trigger Mechanism + Add Loop Guard
"Event-driven, triggered by database changes" is not a specification. Confirm: application-level triggering (API routes call `inngest.send()` after writes). Add loop guard: skip outbound sync if `glofox_synced_at` updated within last 60 seconds (prevents Glofox → Meridian → Glofox infinite loop).

### Fix 5: Build the Plan Code → Stripe Price ID Mapping
Glofox plan codes (e.g., UNLIMITED_MONTHLY) must map to Stripe price IDs before cutover. This mapping is entirely absent from the plan. Without it, subscription migration is manual and error-prone.

### Fix 6: Resolve the Member Portal Prerequisite
The pre-cutover checklist requires member-facing features. Phase 5 (the member portal) has not started. Choose one:
- **Option A (recommended):** Scope a minimum member surface (magic link auth + Stripe payment form + account page) as a parallel 2-week workstream, targeting Week 5 completion for payment collection
- **Option B:** Define this as an admin-only cutover (Glofox member app stays active for members; Glofox subscription continues until Phase 5 launches)

The plan cannot proceed to cutover without choosing.

---

## Important But Not Blocking

| # | Issue | When to Address |
|---|-------|----------------|
| R1 | Add sync monitoring dashboard to Week 3 scope (needs to exist before parallel mode) | Phase 2 |
| R2 | Check Glofox contract cancellation notice period | Week 1 |
| R3 | Add credit pack sync to daily full-refresh job | Phase 2 |
| R4 | Add RLS policies to all 3 new tables | Phase 1 |
| R5 | Add Glofox event types to `MeridianEvents` type definition | Phase 2 |
| R6 | Add `UNIQUE` index to `glofox_sync_state` before first upsert | Phase 1 |
| R7 | Verify all ~10 Glofox staff have Meridian profile mappings | Phase 1 |
| R8 | Reduce DNS TTL to 300 seconds 48 hours before cutover | Week 7 |
| R9 | Keep `lib/glofox/` as a permanent reusable library (future SaaS migration tool) | Week 9 cleanup |

---

## Edge Cases That Need Explicit Handling

| Edge Case | Severity | Action |
|-----------|----------|--------|
| Members with billing dates within 7 days of cutover | High | Pull billing dates; coordinate manually to prevent double-charge |
| Credit pack balances not synced from Glofox | High | Add to full-refresh; verify all active credit members before cutover |
| New members created in Meridian during parallel mode have no glofox_id | Medium | Outbound new-member registration should call `POST /2.0/register` and store returned Glofox ID |
| Glofox plan code → Stripe price ID mapping | High | See Fix 5 above |
| Staff profiles without Meridian mapping cause FK failures | Medium | Verify in Phase 1; create missing mappings manually |
| Class schedule in Glofox during parallel mode | Medium | Classes must be created in Meridian only; Glofox schedule diverges — communicate to staff |

---

## Timeline Assessment

| Week | Plan Says | Realistic Assessment |
|------|-----------|---------------------|
| 1 | Schema prep | Correct; add: rate limit testing, pagination validation, staff profile verification, CSV export |
| 2–3 | Sync engine build | Correct; add: bug fixes, loop guard, Inngest event types, monitoring dashboard |
| 4 | Shadow mode | Correct; extend if integrity issues found |
| 5–6 | Parallel mode + payment collection | Correct; payment collection needs minimum member portal online; start collection 4 weeks before cutover (Week 3) |
| 7–8 | Cutover | Correct; add DNS TTL prep at Week 7 start |
| 9+ | Cleanup | Correct; retain lib/glofox/ module |

**Revised total: 9–10 calendar weeks if minimum member surface is built in parallel. 8 weeks for admin-only cutover.**

---

## What the Plan Gets Right

- Inngest is the right choice and fits the existing codebase perfectly
- Incremental sync via modified-date filters is superior to snapshot-and-cutover
- Per-field conflict resolution with Glofox-owns-financial-data rule is correct
- Shadow mode before parallel mode is the right validation sequence
- "Never delete from Glofox" policy enables clean rollback at any point
- Supabase PITR + manual snapshot is the right data safety net
- Sunday night cutover with tiered rollback plan is operationally sound
- All schema changes are additive and non-destructive

---

## Key Assumptions to Validate

| Assumption | Validation Method | Priority |
|-----------|------------------|----------|
| Glofox API rate limits allow 600+ calls/day | Request docs or burst test | Critical |
| `has_more` pagination field exists in API responses | Check glofox-api-guide.md; test live | Critical |
| API credentials obtainable | Contact Glofox account manager | Critical |
| Analytics endpoint returns row-level transaction data | Test with API credentials | High |
| All 229 tests currently pass | Run test suite now | High |
| Stripe merchant account is fully verified | Check Stripe dashboard | High |
| Supabase PITR is enabled | Check Supabase project settings | High |
| Glofox contract has no 30-day notice requirement | Review contract | Medium |

---

## Files Generated

- `/Users/zach/Desktop/literal-fishstick/.scrutiny/normalized-plan.md` — Normalized input plan
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/technical-feasibility.md` — Full technical analysis
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/scope-complexity.md` — Scope and timeline analysis
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/user-value.md` — Value delivery analysis
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/cost-benefit.md` — Financial analysis
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/architecture-impact.md` — Architecture analysis
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/edge-cases.md` — Edge case catalog
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/competitive-context.md` — Strategic context
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/synthesis/verdict.md` — Detailed verdict
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/synthesis/assumptions.md` — Assumption register
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/synthesis/scope-decomposition.md` — Revised scope map
