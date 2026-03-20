# Edge Cases Analysis — Meridian PRD v1.0

**Agent:** edge-cases
**Complexity:** MAJOR (Deep+ mode)
**Date:** 2026-03-20
**Source:** meridian-prd.md v1.0, edge-case-policies.md (all 18 decided)

---

## Agent Verdict

**MODIFY**

The 18 documented edge cases in `edge-case-policies.md` are well-defined and implementable. Most critical booking, credit, and trainer economy scenarios are covered with explicit, unambiguous rules. This is unusually thorough for a pre-code document. However, there are gaps in three areas: (1) some decided policies contain internal inconsistencies or reference wrong data (wrong prices in the proration example), (2) several implementation questions remain for policies that are "decided" in principle but need implementation specs, and (3) there are important edge cases entirely absent from the document that will occur in the first 30 days of operation. None of these are blockers — but several need resolution before the affected features are built.

---

## Assessment of the 18 Decided Edge Cases

### Edge Case 1: Last-Seat Race Condition — IMPLEMENTABLE AS WRITTEN
Atomic insert (first to submit wins) is the correct choice at this scale. Implementation: a Postgres function that inserts into `bookings` with a check constraint (booking count < class capacity), wrapped in a serializable transaction. If the insert fails, return the "just filled up" error. Clean, simple, correct.

**Note:** The policy says "no hold/reservation pattern" — this also means no 15-minute seat hold during checkout. A member who starts the checkout flow and spends 10 minutes entering payment details could lose the seat mid-checkout. For a 12-person class, this is acceptable. For a 3-person class with high demand, it might cause frustration. Document this as a known limitation.

### Edge Case 2: Late Cancellation — IMPLEMENTABLE WITH ONE CLARIFICATION
The "move, not a cancellation" rule (cancel + rebook same action = no strike) is well-defined. The system-level toggle and member-level override are clear.

**Clarification needed:** The policy says "if the studio later cancels the class the member late-cancelled from → strike is retroactively removed." How does the system detect this? The late cancellation is logged against a specific `class_slot_id`. When that class slot is cancelled, a database trigger or application logic must query `strikes` for bookings on that slot and mark them as voided. This is implementable but requires explicit handling in the studio-cancellation flow.

**Implementation note:** The retroactive strike removal must happen as part of the studio cancellation transaction — not as a separate process that could be missed.

### Edge Case 3: Studio-Side Class Cancellation — IMPLEMENTABLE AS WRITTEN
Credit refund, expiry extension +2 days, trainer not paid. Clean and clear.

**Implementation chain:** Cancel class → for each booking: (1) refund credit and extend expiry if applicable, (2) send cancellation notification. For waitlisted members: send notification ("class cancelled, removed from waitlist"). Mark trainer as not paid for this slot.

**Note:** "Credits refunded, expiry extended by the same duration + 2 extra days" — what duration? The class duration (1 hour) is not the credit expiry extension. This should be "existing credit expiry extended by 2 days" (a grace buffer). The phrasing is ambiguous. Confirm the intended behavior.

### Edge Case 4: No-Show — IMPLEMENTABLE AS WRITTEN
Same strike system as late cancellation. Unlimited/recurring members get warning only. Late arrivals (50%+ of class elapsed) = no-show unless staff overrides.

**Implementation note:** The 50% threshold trigger. Who or what evaluates whether a check-in is "late"? Options: (a) staff marks a check-in as "late" manually, (b) the system compares check-in timestamp to class start time and flags automatically. Automatic flagging is cleaner but requires the check-in to happen via the system (not a paper sign-in). Define the trigger.

### Edge Case 5: Waitlist Promotion — IMPLEMENTABLE WITH CLARIFICATION
15-minute claim window, shortens if class is <15 min away, closes if class has started. Push first, SMS fallback.

**Gap:** "If push is disabled (detectable), fall back to SMS." Push notification disable state is detectable only on iOS/Android — not on web. For Phase 1 (web-only, no iOS app), push notifications don't exist yet. The fallback for Phase 1 is: email notification (slower) or SMS. Since SMS is stubbed in Phase 1, the only Phase 1 fallback for waitlist promotion is email. At 15-minute windows, email is often too slow. This is a functional gap for Phase 1 waitlist promotion.

**Resolution options for Phase 1:** (a) Accept that waitlist promotion via email may be slow and the window may expire, (b) implement a "claim" mechanism in the admin dashboard where staff manually promotes from the waitlist, (c) move waitlist automation to Phase 2 when push/SMS are available and use manual waitlist in Phase 1.

### Edge Case 6: Upgrade Proration — IMPLEMENTABLE BUT CONTAINS WRONG PRICES
The proration example uses "$79/mo" (6-class plan) and "$149/mo" (unlimited) — these are the MagicPath prototype prices, not the actual locked prices ($120/mo and $225/mo per PRD Section 3.3). The formula is correct; the numbers are wrong.

**Must fix:** Update the example in edge-case-policies.md to use actual prices:
- Member on 6-class ($120/mo), day 15 of 30: $120 × 15/30 = $60 prorated credit
- Upgrading to Unlimited ($225/mo): $225 × 15/30 = $112.50 prorated charge
- Member pays: $112.50 - $60.00 = $52.50 today
- Next cycle: $225/mo at normal anchor date

This discrepancy, if not corrected, will be used by a developer to build the proration preview UI with wrong example amounts. Fix this before development.

### Edge Case 7: Credit Expiry — IMPLEMENTABLE AS WRITTEN
7-day grace period, notifications at 7/3/1 days, deducted at booking time. Soonest-expiring first deduction priority. Clean and unambiguous.

**Implementation note:** The grace period notifications (7/3/1 days) need a scheduled job (pg_cron) to query for credits expiring in those windows and queue notification sends. This is a Phase 1 background job that must be on the developer's implementation list.

### Edge Case 8: Gift Cards → Wallet — IMPLEMENTABLE AS WRITTEN
Wallet-first billing (wallet consumed before card charge), never expires.

**Implementation complexity:** The Stripe charge for the remainder after wallet offset requires a custom payment intent (not a Checkout Session). The wallet debit and Stripe charge must be atomic — if the Stripe charge fails, the wallet balance must be restored. This requires a database transaction that rolls back on Stripe failure.

**Implementation note:** The `wallet_transactions` table needs a `status` column (`pending`, `completed`, `reversed`) and the application logic must handle Stripe webhook confirmation before marking the wallet transaction as complete.

### Edge Case 9: Discount Lock — IMPLEMENTABLE AS WRITTEN
Discount locked at checkout start for 30 minutes. Simple: store `discount_locked_at` and `discount_percentage` on the checkout session. On payment submission, verify `discount_locked_at` + 30 minutes > now. If expired, recalculate (don't block payment — apply new discount or no discount based on current membership status).

### Edge Case 10: Family Account Credits — IMPLEMENTABLE AS WRITTEN
Pool-based, individual strikes, parent waiver covers minors, pool freezes if parent lapses (7-day grace before auto-cancel).

**Implementation note:** The "7-day grace before auto-cancel" for family pool freeze aligns with the dunning sequence. The dunning trigger (failed payment) should simultaneously: (1) start Stripe retry sequence, (2) freeze family credit pool, (3) set 7-day auto-cancel timer on pending family bookings. This requires coordination between the dunning logic and the family account logic.

### Edge Case 11: Promo Attribution — IMPLEMENTABLE AS WRITTEN
Code-based, point-in-time, final. Admin can void fraud but not reassign.

**Gap:** What happens if a member uses a promo code, gets attributed to Trainer A, and then their membership is refunded (member dissatisfied and leaves)? Does the promo commission liability reverse? The policy says attribution is "final" — does "final" include refund scenarios?

**Recommended addition:** Add a clause: "If the attributed purchase is refunded within 30 days, the promo commission is voided. After 30 days, commission is locked regardless of membership status."

### Edge Case 12: Bonus Threshold — IMPLEMENTABLE AS WRITTEN
Check-ins, not bookings. Evaluated at class end (or 30 min after start). Trainer's own attendance excluded.

**Implementation note:** "Evaluated at class end" means a scheduled trigger at class end time. Options: pg_cron job that runs every 30 minutes and evaluates completed classes, or a database trigger when check-in records are finalized. The pg_cron approach is simpler and more reliable.

**Gap:** What time exactly is "class end"? For a 1-hour class at 6pm, class end is 7pm. The bonus evaluation should run at 7pm or shortly after. "30 minutes after class start" as an alternative means 6:30pm — but members could still arrive up to that point. Clarify: evaluate at class_end_time, not 30 min after start. The "30 min after start" phrasing in the policy is ambiguous.

### Edge Case 13: Trainer Multiple Classes — IMPLEMENTABLE AS WRITTEN
Independent evaluation per class. No cross-class dependencies. Clean.

### Edge Case 14: Owner Booking — IMPLEMENTABLE AS WRITTEN
Acts as member. Capacity override requires confirmation dialog + audit log. Analytics exclusion handles financial data.

### Edge Case 15: Trainer Self-Check-In — IMPLEMENTABLE AS WRITTEN
Optional wellness tracking toggle. Trainer's attendance doesn't count toward bonus. Clean.

### Edge Case 16: Data Migration — IMPLEMENTABLE AS WRITTEN
5-wave soft migration, Glofox stays live during waves 1-3. Double-billing prevention via Glofox renewal date tracking.

**Gap not addressed:** Glofox Stripe Connect account ownership. If Glofox uses managed Stripe Connect accounts (not standard), the studio's Stripe customer and payment method data belongs to Glofox's account and cannot be transferred. Members would need to re-enter payment methods at migration. The PRD acknowledges "payment info likely not portable" but doesn't have a confirmed answer. This should be verified with Glofox/Stripe support before migration is planned in detail.

### Edge Case 17: Merch Fulfillment — IMPLEMENTABLE AS WRITTEN
In-studio pickup only for Phase 1. 15-minute inventory hold at add-to-cart. Shipping DB schema built now, carrier APIs inactive.

**Implementation note:** The 15-minute inventory hold release requires pg_cron or an equivalent scheduled job. This is the same scheduling infrastructure needed for credit expiry notifications. Build the scheduling infrastructure once and reuse.

### Edge Case 18: Guest Pass System — IMPLEMENTABLE AS WRITTEN (DETAILED SPEC)
QR/link invite, host must be present, counts toward capacity, conversion tracking.

**This is the most detailed edge case and is well-specified.** The four database tables (`guest_invites`, `guest_profiles`, `guest_visits`, `member_referral_conversions`) are explicitly listed.

**Gap:** "Referral rewards: Track conversions now, decide on reward structure later." The conversion tracking is correctly deferred from reward implementation. But the developer needs to know: when a guest converts to a paid member, what triggers? A manual admin action? An automated check when the guest signs up for a membership? Specify the conversion detection trigger.

**Recommended:** When a `guest_profile` email matches a new `user_account` creation, check `guest_visits` for that email. If a guest visit exists, create a `member_referral_conversions` record. Automated, no manual step required.

---

## Missing Edge Cases (Not Documented)

### Missing 1: Member Cancels During the Cancellation Window and Waitlisted Member Gets the Spot — Does Strike Still Apply?

The policy says "if a waitlisted member fills the cancelled spot → the cancelling member's strike still stands (they caused the operational disruption)." This is documented (Edge Case 2). But what if the studio cancels the class AFTER the member already received a strike for late cancellation from that class? The retroactive strike removal only triggers on studio cancellation, not on "studio cancelled after member's late cancellation." The case: member late-cancels → gets strike → studio then cancels same class 10 minutes later → does the strike get retroactively removed? Per the documented policy, yes — "if the studio later cancels the class the member late-cancelled from → strike is retroactively removed." This covers the scenario. Good.

### Missing 2: Member Upgrades and Has Pre-Existing Bookings That Fall in the New Billing Cycle

A member on 6-class plan books 3 classes next week. They upgrade to Unlimited today, mid-cycle. The 3 booked classes in the new cycle: do they count against the (now voided) 6-class credits, or are they included in the new Unlimited plan? Per Edge Case 6, "remaining credits from old plan vanish — member is now Unlimited." So the future bookings are covered by Unlimited. Good. But: the 3 bookings already had credits reserved. Those reservations must be released when the upgrade happens. Is this handled automatically? Needs to be specified.

### Missing 3: Two Members in a Family Account Both Book the Same Class

Parent and child book the same class slot. This uses 2 credits from the family pool. At check-in, both show up. No issue. But what if the class is at capacity (11 others booked + parent + child = 13 > 12)? The family members book independently — each booking goes through the capacity check. The second family member's booking would fail capacity. Is there a family-group booking flow where a parent books multiple family members in one action? This is undefined.

### Missing 4: Promo Code Used at Checkout Start, Membership Payment Fails

Member enters Trainer A's promo code at checkout. Payment fails (card declined). Attribution record is not yet final (no successful purchase). Does the promo attribution get recorded on failed payment attempt? The policy says "one use per member" — if the attribution records on attempt (not completion), a failed payment would "use up" the member's one code use. This should be: attribution is recorded on confirmed payment, not on checkout initiation.

### Missing 5: Trainer Assigned to a Class, Studio Cancels — Is There a Process for Notifying the Trainer?

Edge Case 3 says trainer is not paid for studio-cancelled classes. But there's no mention of notifying the trainer. If Whitney shows up to teach Wednesday 7pm and the class was cancelled 2 hours ago, that's a problem. The notification system must include trainer notification on studio cancellation. The policy should add: "Trainer notified via push/SMS/email at time of cancellation."

### Missing 6: Member Downgrades and Has Upcoming Bookings That Exceed New Plan's Credits

A member on Unlimited downgrades to 6-class/month, effective next billing cycle. Before the new cycle starts, they have 4 classes booked. The downgrade takes effect — now they have 6 class credits. Their 4 upcoming bookings are intact. They book 3 more classes (total 7 booked). At billing cycle start, they have 6 credits but 7 bookings. What happens to the 7th booking? The system should auto-cancel it with a notification ("Your plan change reduced your credits — your booking on X was cancelled") or require the member to manage bookings before the cycle switches. Needs a defined behavior.

### Missing 7: Credit Pack Member Tries to Book Beyond Their Pack Balance

A member has a 4-pack with 0 credits remaining. They try to book a class. They should see: "You have 0 credits remaining. Purchase another pack or a drop-in to book." This seems obvious but the booking flow's credit check needs to handle the "zero credits" state gracefully and offer a purchase path, not just a dead-end error. Needs UI spec.

### Missing 8: Guest Invite Link Expires Before Guest Signs Up (But Guest Shows Up Anyway)

A member sends a guest invite link tied to Wednesday 7pm class. Guest doesn't click the link, but shows up at the studio with the member. The invite link has expired (after class time). Can staff manually check in an unregistered guest? This requires a staff override flow for in-person guest situations.

---

## Implementation Sequencing for Edge Cases

Edge cases that require scheduled jobs (pg_cron):
- Credit expiry notifications (7/3/1 days before expiry)
- Inventory hold release (15 minutes after add-to-cart)
- Bonus threshold evaluation (at class end time)
- Family pool auto-cancel (7 days after billing failure)
- Waitlist claim window expiry (15 minutes after promotion)

These all need the pg_cron extension enabled in Supabase and a scheduled job registry in the codebase.

---

## Summary

The 18 decided edge cases are substantially complete and implementable. The main issues are: (1) Edge Case 6 uses wrong prices — must fix before building proration UI, (2) the bonus evaluation timing ("30 min after start" vs. "at class end") is ambiguous, (3) Phase 1 waitlist auto-promotion lacks a working notification channel (push not yet built), (4) Stripe Connect ownership for migration needs external verification, and (5) eight additional edge cases are missing that will occur in the first 30 days of operation. None of these are blockers for starting development, but the wrong prices in Edge Case 6 specifically must be corrected before the proration preview feature is built.
