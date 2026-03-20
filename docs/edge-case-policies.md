# Meridian — Edge Case Policy Definitions

This document defines the exact behavior for every edge case identified during scrutiny. These are the rules the codebase will enforce.

---

## DECIDED

### Edge Case 1: Last-Seat Race Condition
**Pattern:** Atomic insert (first to submit wins)
- Second member gets a friendly error: "This class just filled up" + option to join waitlist or book next available slot
- No hold/reservation pattern — simpler, faster, no 10-minute timeout to manage
- At the scale of a single studio (12-person classes), the race window is extremely small

### Edge Case 2: Late Cancellation Policy
**Pattern:** Progressive penalty system with membership-tier exemptions

**Late cancellation window:** 1 hour before class start. Configurable in Settings UI.

**Strike system (rolling 30-day window):**
- 1st late cancellation: Free pass, no penalty. System logs the strike.
- 2nd late cancellation: **$5 flat fee** charged to card on file (separate from credit system)
- 3rd+ late cancellation: **$10 flat fee** charged to card on file

**Membership exemptions:** Unlimited/recurring members receive **warnings only** — no financial penalty. Strikes are still tracked for data, and members see notifications ("This is your 2nd no-show this month"), but no fee is charged.

**Toggle system:**
- **System-level toggle** in Settings → Cancellation Policy: Global ON/OFF for the entire penalty system. Use this during pilot/launch to disable penalties while testing.
- **Member-level override** on individual profiles: Temporary grace flag that auto-expires after 30 days. For edge cases like family emergencies.

**Additional rules decided:**
- If a member cancels and immediately re-books a different slot in the same action → treated as a "move," not a cancellation (no strike)
- If the studio later cancels the class the member late-cancelled from → strike is retroactively removed
- If a waitlisted member fills the cancelled spot → the cancelling member's strike still stands (they caused the operational disruption)

### Edge Case 3: Studio-Side Class Cancellation
- All booked members: credits refunded immediately
- Members with expiring credits: expiry extended by the same duration + 2 extra days as buffer
- Waitlisted members: notified ("Class cancelled, you've been removed from the waitlist")
- Trainer pay: NOT paid for force majeure cancellations — written into trainer contract
- Trainer bonus: NOT earned even if threshold was met before cancellation

### Edge Case 4: No-Show Handling
**Pattern:** Linked to the same progressive strike system as late cancellations
- No-shows count as strikes in the same rolling 30-day window
- Same tier: 1st = warning, 2nd = $5 flat fee, 3rd = $10 flat fee
- **Unlimited/recurring members:** Warning-only, no financial penalty (still tracked)
- Late arrivals (checked in after 50% of class duration elapsed): treated as a no-show unless staff manually overrides

### Edge Case 5: Waitlist Promotion Timing
- **15-minute claim window.** First waitlisted member gets push notification + SMS. 15 minutes to tap "Confirm."
- **If class starts in less than 15 minutes:** Window shortens to match (e.g., cancellation 10 min before class → 5-minute claim window)
- **If class has already started:** Spot opens for walk-ins only. No waitlist promotion.
- **Expired credits / no payment method:** Skip that person, auto-offer to next in line. Separate notification: "A spot opened but your credits have expired."
- **Notification delivery:** Push first. If push is disabled (detectable), fall back to SMS. Email is too slow for time-sensitive promotions.

### Edge Case 6: Self-Service Upgrade Proration
**Uses Stripe's native proration with transparent display.**
- Example: Member on 6-class ($120/mo) upgrades to Unlimited ($225/mo) on day 15 of 30.
- Stripe calculates: unused portion ($120 × 15/30 = $60.00 credit) applied against prorated new plan ($225 × 15/30 = $112.50).
- **Member pays $52.50 today.** Next billing cycle: $225/mo at normal anchor date.
- **Remaining credits from old plan vanish.** Member is now Unlimited — credits are meaningless. Clear message: "Your 2 remaining class credits will be replaced by unlimited access."
- **Downgrades supported.** Takes effect at NEXT billing cycle (not immediately). Prevents abuse. Message: "Your plan will change to 6-Class Pack on [next billing date]. You'll keep unlimited access until then."
- **Confirmation screen required** before commit: "You'll be charged $52.50 today. Starting [next billing date], your plan will be Unlimited Monthly at $225/mo."

### Edge Case 7: Credit Expiry at Billing Boundary
- **7-day grace period** after billing renewal for unused credits. New credits also available immediately.
- **Auto-notification sequence:** Email/push at 7 days, 3 days, and 1 day before expiry.
- **Bookings that span the expiry boundary:** Credits consumed at booking time, not at class time. A booking for the 31st at 11pm is valid even if credits "expire" at midnight.
- **Non-recurring credit packs** (e.g., "10-pack valid for 60 days"): Same 7-day grace period. Per-credit expiry uses pack's expiry date. Deduction priority: soonest-expiring pack first.

### Edge Case 8: Gift Card System
**Gift cards create a wallet balance — not a one-time payment split.**
- $100 gift card redeemed → $100 added to member's Meridian wallet.
- At billing: wallet balance consumed first, remainder charged to card on file.
- Month 1: $100 wallet - $120 membership = $0 wallet + $20 to card. Month 2: $0 wallet → $120 to card.
- **Failed card after wallet exhaustion:** Standard dunning sequence. No special treatment.
- **Existing members:** Gift card added to wallet. Usable for memberships, class packs, merch, drop-ins — anything purchasable.
- **Non-members:** Wallet created on a new account (they sign up). Balance available immediately.
- **Wallet balance never expires.** Cash equivalent once redeemed.

### Edge Case 9: Member Discount Lapses Mid-Checkout
- **Discount locked at checkout start.** 30-minute checkout window. If membership lapses during checkout, discount persists for that transaction.
- **After checkout:** System evaluates membership status fresh for all future transactions.
- **Reasoning:** The dollar amount at stake (~$4 on a $40 item at 10%) isn't worth the bad UX of pulling a discount mid-checkout.

### Edge Case 10: Family Account Credit Sharing
- **Credits belong to the pool, not the parent.** Parent is billing anchor, credits are shared.
- **Parent's membership lapses:** Pool freezes. Future bookings held for 7 days (grace period aligned with dunning), then auto-cancelled.
- **No-show strikes:** Assigned to the individual who no-showed, not the parent. Each family member has own strike count.
- **Minor waivers:** Parent signs ONE waiver covering all minors in the family account. Tied to family relationship, not individual booking.
- **Credit deduction priority:** Expiring soonest first, regardless of which family member booked. Pool doesn't differentiate.

### Edge Case 11: Promo Code Attribution
- **Code-based, point-in-time, final.** Whoever's code was entered at checkout gets credit. No retroactive reassignment.
- **Admin exception:** Admin can void a clearly fraudulent attribution but cannot reassign to a different trainer.
- **Prior activity:** Drop-in classes before signup are NOT attributed. Attribution starts from the moment the code was used.
- **Code usage:** One use per member. Tied to initial purchase (membership or pack), not individual classes.

### Edge Case 12: Bonus Threshold Calculation
- **Based on check-ins, not bookings.** Bonus rewards the trainer for people actually in the room.
- **Threshold evaluated at class end time.**
- **Late bookings:** If someone books 5 min before class and checks in, they count. Book and no-show → don't count.
- **Trainer's own attendance does NOT count** toward the threshold.
- **Studio-cancelled class:** No bonus earned regardless of pre-cancellation count.

### Edge Case 13: Trainer on Multiple Classes Same Day
- **Base pay:** Sum of per-class rates. 2 classes = 2× base pay.
- **Bonus:** Evaluated independently per class. One hits threshold, other doesn't → one bonus.
- **Promo code:** Attribution per-signup, not per-attendance. Same member attending both classes = one credit.
- **Payroll report:** Aggregates in pay period — base pay per class + bonuses + promo commissions. One line per class in detail, one total in summary.

### Edge Case 14: Owner Booking Their Own Class
- **Book as a member.** Same flow as any other member. No special admin override.
- **Capacity:** Owner respects same limits. If full, joins waitlist. Admin can "Override capacity for this booking" with confirmation dialog + audit log entry.
- **Credits:** Normal credit flow. Comped "unlimited" = no credits deducted. Analytics exclusion flag handles financial reports.
- **Visit history:** Booking appears in member profile automatically.

### Edge Case 15: Trainer Checking Into Their Own Class
- **Leading and attending are separate.** Trainer auto-logged as class leader when assigned.
- **Optional wellness tracking:** Toggle in trainer profile settings: "Track my own attendance when leading classes." If ON, auto-logs a visit to their member profile.
- **Trainer's own attendance does NOT count toward bonus threshold.**
- **Trainer pay always based on assignment**, never on a member booking.

### Edge Case 16: Data Migration (Active Subscriptions)
**Soft migration — run Meridian in parallel with Glofox for 4–8 weeks.**
- **Wave 1:** Import all member profiles, credit balances, booking history into Meridian. Members continue booking via Glofox.
- **Wave 2:** Owners and close friends/family set up Meridian accounts. Internal testing and feedback.
- **Wave 3:** Invite 20–30 pilot customers (good relationships, small discount during pilot). They start booking through Meridian.
- **Wave 4:** Expand to all members. "Welcome to your new booking portal" campaign with onboarding flow — Magic Link login, add payment method, choose first class.
- **Wave 5:** Turn off Glofox.
- **Double-billing prevention:** Don't activate Meridian billing until member's current Glofox cycle ends. Track each member's Glofox renewal date.
- **Historical data:** Import all-time booking history for wellness tracking. Credit balances imported as-is. Waitlist positions: don't migrate.
- **Payment info:** Cannot be migrated from Glofox's Stripe Connect. Members re-enter payment methods — accepted as unavoidable.

### Edge Case 17: Merch — Shipped vs. In-Studio Pickup
- **Phase 1: In-studio pickup only.** No carrier APIs, shipping address collection, or fulfillment tracking active.
- **Flow:** Purchase via app/website → "Ready for Pickup" → member picks up at front desk → staff marks "Collected."
- **Notification:** Push/email on order confirmation: "Your order is ready for pickup at the studio!"
- **Inventory hold:** Reserve at add-to-cart with 15-minute hold timer. If checkout not completed, hold releases.
- **Build shipping infrastructure in database from day one.** Schema includes shipping address fields, carrier tracking fields, fulfillment status workflow. When ready to enable shipping, just add API keys — no rework needed.
- **Future:** Add shipping as a later feature. Use flat-rate shipping model (not real-time carrier rates) to keep it simple.

### Edge Case 18: Guest Pass System
**Guest allowances by membership tier (per billing cycle):**
- 6-class: 1 guest/month
- 10-class: 1 guest/month
- Unlimited: 2 guests/month
- Can be the same person each time — no restriction on repeat guests

**Guest invite flow:**
1. Member taps "Invite a Guest" in iOS app or web portal
2. System generates a **unique, one-time-use invite link** tied to: the member's account (attribution), a specific class date, an expiry (link dies after class time)
3. Member shares via **QR code** (displayed in-app, guest scans in person) or **share sheet** (SMS, iMessage, WhatsApp, email — standard OS share drawer)
4. Guest taps link → **lightweight guest signup page:** name, email, phone, digital waiver (same as member waiver), submit
5. Guest is registered in database, attached to the member's booking for that class
6. At check-in: guest scans QR or staff looks up by name. System confirms host member is also checked in.

**Policy rules:**
- **Guest counts toward class capacity.** 10 members + 2 guests = 12/12 full.
- **Guest can only attend when accompanied by host member.** If they want to come alone, they need a drop-in or membership.
- **If host member cancels or no-shows:** Guest registration auto-cancelled.
- **Guests do NOT consume the member's class credits.** Guest slot is a membership perk.
- **When guest allowance is used up:** "Invite a Guest" button disabled with message: "You've used your guest pass(es) this month. Next available on [billing date]."

**Tracking & attribution:**
- Every invite link has the member's ID baked in
- **Guest visit log:** Which member brought which guest, to which class, on what date
- **Repeat guest tracking:** "Sarah's friend Mike has visited 3 times in 2 months"
- **Conversion tracking:** If a guest later signs up for a membership, attributed to the referring member
- **Referral rewards:** Track conversions now, decide on reward structure later (free credit, account credit, etc.)

**Database tables needed:**
- `guest_invites` — invite link, host member ID, class ID, status, expiry
- `guest_profiles` — name, email, phone, waiver status
- `guest_visits` — guest ID, host member ID, class ID, check-in timestamp
- `member_referral_conversions` — guest ID → new member ID, referring member ID, conversion date

### Edge Case 19: Corporate Credit Expiry/Rollover
**Pattern:** Capped rollover with configurable limit
- Unused monthly credits roll over with a cap of **2× monthly allocation** (configurable per company via `credit_rollover_cap`)
- Credits beyond the cap expire at month end
- Example: Company has 20 credits/month, cap = 40. Month 1: uses 10, rolls over 10. Month 2: allocated 20 + 10 rolled = 30. Uses 5, would roll 25 but cap is 40 so all 25 roll. Month 3: allocated 20 + 25 = 45, but cap is 40 → 5 expire.
- `credit_rollover_cap = NULL` means no cap (unlimited rollover)
- Credits refresh handled by Inngest cron on 1st of month

### Edge Case 20: Event/Class Time Conflict
- When confirming an event that overlaps with a scheduled class, show a **warning** with conflicting class details
- Admin must explicitly acknowledge the conflict to proceed
- System does NOT auto-cancel the class — admin decides: cancel class, move event, or allow overlap
- Legitimate overlap scenarios exist (e.g., event uses outdoor space while class uses sauna)
- Conflict check runs on event confirmation, not on initial inquiry creation

### Edge Case 21: Payroll Period Dispute/Reopen
- An approved payroll period **can be reopened** by owner/manager with a required reason
- Status changes to `reopened`; `reopened_by`, `reopened_at`, `reopen_reason` logged
- Period must be re-approved after edits
- Full audit trail preserved — previous approval record not overwritten
- An `exported` or `paid` period can also be reopened, but shows a stronger warning: "This period has already been exported/paid. Changes may cause discrepancies with your payroll provider."

### Edge Case 22: Duplicate Event Inquiry
- When creating an event for the same company on the same date, show a **soft warning**: "This company already has an event on [date]. Continue anyway?"
- Admin acknowledges to proceed — not a hard block
- Legitimate scenarios: morning wellness session + evening party for same company
- Warning checks: same `company_id` + overlapping `start_time`/`end_time` date

### Edge Case 23: Multi-Company Member
- A member can belong to multiple corporate accounts via `company_members` junction table
- At booking time, if member has credits from multiple companies, they **select which company's credits to use**
- If no explicit selection, default to **most recently added** company
- Each company's credits are tracked independently on the `company_accounts` row
- Corporate admin for Company A cannot see that the member also belongs to Company B

---

---

## ARCHITECTURE DECISIONS LOGGED (from same conversation)

### Employee Portal
- Full employee portal needed: clock in/out, payroll, taxes
- Geofencing required for clock in/out verification
- Part of the admin dashboard, not a separate app

### Email & SMS
- Email provider: **Resend** (click tracking, open tracking built in)
- SMS provider: **Stub out for now**, decide on provider later
- Campaign infrastructure should be provider-agnostic (swap SMS provider without rework)

### Infrastructure
- Hosting: **Netlify** (frontend) + **Supabase** (backend/database/auth)
- Consider **pgvector** for AI-powered search and retrieval
- iOS app: **React Native**
- Need to determine monorepo vs. multi-repo structure

### Tech Stack Architecture
- Landing page / marketing website → links to booking, membership purchase
- iOS member app (React Native)
- Admin dashboard + employee portal (web)
- All share one Supabase backend

### Rollout Strategy
- NOT building an MVP — building the full product from the start
- Keep using Glofox during development
- Roll out to core members in waves (internal → friends/family → pilot customers → all members)
- Pilot customers get small discount during testing period
- Turn off Glofox only when Meridian is fully validated

### AI Approach
- AI and LLM are CORE infrastructure, not a Phase 3 add-on
- Wrap Anthropic SDK from the beginning
- Rules-based "smart insights" + LLM-powered insights both ship together
- No rework — build it right from the start

### Data Migration
- Have Glofox data exported already (in PSG data folder)
- Payment info likely NOT portable from Glofox's Stripe Connect
- Members will need to re-enter payment methods — accepted as unavoidable

### Kiosk / Check-In
- QR code scanning for member check-in
- Admin iOS portal should support QR scanning
- Each member gets a QR code as their "pass"

### Multi-Tenancy
- YES — build for multiple locations from the start
- Different locations may have different membership pricing
- Need "all-access" memberships that work across all locations
- Use Postgres RLS with studio_id/location_id on every table

### Real-Time Data
- 60-second polling for Phase 1 (not 5-second, not WebSockets)
- Reassess in Phase 2

### Proration
- Use Stripe's native proration — don't build custom

### Features Status
- Community/social board: BUILDING IT
- Instagram: Use SnapWidget embed (not API)
- Weather correlation: DEFER
- IoT equipment logging: DEFER
- Custom dashboard widget builder: DEFER
- Corporate wellness portal: DEFER

### Competitors
- Not relevant — building for internal use first, not competing with Walla/Mariana Tek
