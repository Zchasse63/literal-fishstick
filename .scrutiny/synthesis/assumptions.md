# Assumptions Register: Glofox API Migration to Meridian
**Date:** 2026-03-31

---

## Critical Assumptions (Validate Before Phase 2)

### A1: Glofox API rate limits are acceptable for the proposed sync frequencies
**Status:** UNVALIDATED — highest priority
**Assumption:** Glofox's API allows 600–700+ requests/day across all entity endpoints
**If wrong:** Sync frequencies must be reduced (e.g., bookings: 5 min → 30 min); data freshness degrades
**Validation:** Request rate limit documentation from Glofox account manager; if unavailable, run burst test in Phase 1 environment
**Owner:** Must resolve before designing Phase 2 sync schedule

### A2: Glofox API pagination uses `has_more` boolean field
**Status:** UNVALIDATED
**Assumption:** `body.has_more ?? false` correctly detects end of pagination for all entity endpoints
**If wrong:** `fetchAll` returns only first page; up to 1,000 of 1,100 members silently missed
**Validation:** Read glofox-api-guide.md; test `fetchAll` against live members endpoint with known count
**Owner:** Must resolve before Phase 2 is considered complete

### A3: Glofox API credentials are obtainable
**Status:** UNVALIDATED (explicitly listed as open question in plan)
**Assumption:** `x-glofox-api-token` and `x-api-key` can be obtained in time for Phase 2
**If wrong:** Entire migration timeline shifts right by however long it takes to obtain credentials
**Validation:** Escalate with Glofox account representative immediately
**Owner:** Zach — this is a business relationship question, not a technical one

### A4: POST /Analytics/report returns individual transaction records with date filters
**Status:** UNVALIDATED
**Assumption:** The analytics endpoint supports incremental sync and returns row-level transaction data
**If wrong:** Transaction sync needs a different endpoint or approach; historical transaction data may be inaccessible
**Validation:** Test with API credentials once obtained; review glofox-api-guide.md

---

## High-Confidence Assumptions (Verify But Likely Correct)

### A5: All 229 existing tests pass on the current codebase
**Status:** ASSUMED CORRECT (plan states this as a gate)
**Risk:** If any tests are currently failing, schema migration may obscure whether new failures are regressions
**Validation:** Run test suite before applying Phase 1 migrations; establish a clean baseline

### A6: Stripe merchant account is functional for live payment processing
**Status:** ASSUMED PARTIALLY (Stripe is integrated; merchant account status unclear)
**Risk:** Stripe merchant accounts require approval, bank verification, and may have processing limits
**Validation:** Confirm Stripe account is fully verified and not in test-mode-only state

### A7: Supabase PITR (point-in-time recovery) is enabled on the production database
**Status:** ASSUMED (plan relies on it for rollback)
**Risk:** PITR requires Supabase Pro plan or above; if on free/starter tier, PITR is not available
**Validation:** Check Supabase project settings for PITR status before relying on it as a rollback mechanism

### A8: glofox_id already exists on profiles table
**Status:** MARKED AS CONFIRMED in plan (checkmark notation)
**Risk:** Low; marked as existing
**Validation:** Verify with `\d profiles` in Supabase SQL editor

### A9: Members' Glofox IDs are present in Meridian for all CSV-imported records
**Status:** ASSUMED (plan depends on glofox_id for ID mapping)
**Risk:** If the original CSV import did not include Glofox user IDs, the sync engine cannot match records and will create duplicates
**Validation:** Run `SELECT count(*) FROM members WHERE glofox_id IS NOT NULL` and compare to Glofox total member count

---

## Timeline Assumptions

### A10: Member-facing portal (booking + auth + Stripe form) will be ready by Week 5–6
**Status:** UNVALIDATED — major gap
**Assumption:** The pre-cutover checklist item "member-facing features ready" will be satisfied by cutover date
**If wrong:** Cutover must be admin-only (members continue using Glofox app); Glofox subscription stays active longer
**Resolution required:** Choose between admin-only cutover (Option A) or full cutover (Option B requires scoping Phase 5 minimum surface)

### A11: Staff training can be completed in 2 weeks (Parallel Mode period)
**Status:** ASSUMED — reasonable for ~10 staff at a small studio
**Risk:** Low given the small team size and Meridian's UX quality
**Validation:** Identify all staff who will need training; assess their current Meridian familiarity

### A12: Sunday night is the lowest-traffic period
**Status:** ASSUMED CORRECT for a sauna/wellness studio (weekend evenings are likely active; late Sunday may be low)
**Risk:** Low; wellness studios typically have Sunday night slowdowns
**Validation:** Pull Glofox booking data to confirm Sunday 22:00 is reliably low traffic

### A13: DNS propagation completes fast enough for the cutover sequence
**Status:** ASSUMED
**Risk:** DNS TTL must be set low (300 seconds or less) before cutover week; if current TTL is 86400 (24 hours), the 22:00 DNS switch won't be live by 23:00
**Validation:** Check current DNS TTL settings; reduce to 300 seconds 48 hours before planned cutover

---

## Business Assumptions

### A14: Glofox will not revoke API access during the 8-week migration
**Status:** ASSUMED
**Risk:** Low but non-zero; if The Sauna Guys appears to be migrating away, Glofox account management may notice
**Mitigation:** Complete full Glofox data export at Phase 1 completion regardless; keep migration details private during execution

### A15: ~80%+ of members will re-enter payment methods before cutover
**Status:** ASSUMED OPTIMISTIC
**Risk:** Industry benchmarks suggest 15–30% non-collection; 220+ members without Stripe payment methods is a high-risk scenario
**Mitigation:** Start collection 4 weeks before cutover (not 2); use multiple reminder touchpoints via Resend; make re-entry as frictionless as possible

### A16: Glofox contract has no 30-day+ cancellation notice requirement
**Status:** UNVALIDATED
**Risk:** If Glofox requires 30-day notice, cancellation notice must be given during parallel mode (Week 5–6), not after cutover
**Validation:** Review Glofox contract terms immediately

### A17: The Glofox branch MongoDB ObjectID is known
**Status:** LISTED AS OPEN QUESTION in plan
**Risk:** Required for all branch-specific API calls (bookings, events); without it, most write endpoints are non-functional
**Validation:** Locate in Glofox admin URL (per plan's open question #3)
