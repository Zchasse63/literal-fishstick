# Edge Cases Analysis — Phase 4: Corporate & Operations

**Agent:** edge-cases
**Plan:** Meridian Phase 4
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

The plan is well-structured but leaves several high-probability edge cases completely unaddressed. Three of them (event/class conflicts, payroll clock entry disputes, corporate credit expiry) will create operational incidents within the first month of use if not decided before development begins. The existing `edge-case-policies.md` established an excellent precedent for pre-deciding these. Phase 4 needs its own edge case policy decisions.

---

## High-Probability Edge Cases (Decide Before Sprint 1)

### EC-1: Event Booking Conflicts with Regular Classes

**Scenario:** An event is confirmed for Saturday 5–7pm. A regular "Open Sauna" class is already on the schedule for Saturday 5–6pm. The sauna has 12-person capacity. Both the event guests and class members show up.

**The plan does not address this.** Events have a `resources_reserved` JSONB field, but there is no join to the existing bookings/schedule system to detect conflicts at inquiry or confirmation time.

**Required decision:**
- Does the studio pause regular classes during a private event? (Most likely yes for a venue this size)
- Does the system automatically block the class slot when an event is confirmed, or must the admin manually manage this?
- What happens to existing bookings for that class slot when the event is confirmed?

**Recommended policy:** When an event transitions to "confirmed" status, the system should check for overlapping class slots (using start_time + setup_time_minutes and end_time + cleanup_time_minutes). If conflicts exist, surface a warning before confirmation and offer to cancel/move conflicting classes. The admin must explicitly acknowledge. Auto-cancellation without notification would be a serious operational failure.

---

### EC-2: Corporate Credit Expiry and Rollover

**Scenario:** A company has `monthly_credit_allocation = 50` and `credits_remaining = 30` at the end of the billing month. The Inngest job fires `corporate-credits-refresh`. Do the remaining 30 credits roll over or reset to 50?

**The plan does not specify rollover policy.**

**The stakes:** If credits expire without notice, the company contact will complain. If credits roll over indefinitely, the studio has an uncapped liability (a company could accumulate 600 credits/year and redeem them all at once during the busiest month).

**Required decision:** Choose one:
- Option A: Credits reset to allocation amount on refresh (no rollover). Unused credits expire. Must notify the company 7 days before refresh.
- Option B: Credits roll over, capped at 2x monthly allocation. Prevents unlimited accumulation while allowing short-term carryover.
- Option C: Credits roll over without cap. Most member-friendly, highest liability risk.

**Recommended policy:** Option B (capped rollover at 2x). Notify company admins 7 days before refresh of pending expiry. This matches industry norms for corporate wellness programs.

---

### EC-3: Payroll Period with Disputed Clock Entries

**Scenario:** The payroll calculation for a period includes clock entries that are manually edited (the `manually_edited` flag exists in ClockEntry). An employee disputes their total hours. The payroll period is already approved.

**Questions not addressed:**
- Can a payroll period be reopened after approval? If yes, what is the approval workflow?
- Who can dispute hours — only the employee via the portal, or also the admin?
- How does a dispute affect payroll export — is the export blocked pending resolution?

**Required decision:**
- Payroll periods should be lockable but reopenable with explicit admin override and audit log entry
- Employees should be able to flag specific clock entries for review from the employee portal
- Disputed entries should not block export but should be flagged in the CSV/PDF output with a "pending review" annotation

---

### EC-4: Duplicate Event Inquiry (Same Company, Same Date)

**Scenario:** A corporate client submits an event inquiry via email AND their account manager submits one on their behalf in the system, resulting in two "inquiry" status events for the same company on the same date.

**The plan has no duplicate detection.** The events table has no unique constraint on (studio_id, company_id, start_time).

**Required decision:** Add a soft duplicate warning (not a hard block) when creating an event with the same company_id and overlapping time range as an existing non-cancelled event. Admin must acknowledge before proceeding.

---

### EC-5: Member Linked to Multiple Corporate Accounts

**Scenario:** A member is an employee of Company A (which has a corporate wellness contract) and later joins Company B (a second corporate client). The `company_members` junction allows this. But `profiles.company_id` (proposed FK) only allows one. Additionally, if Company A pays for the member's membership and Company B also tries to cover them, whose billing should apply?

**This is a real scenario for studios with multiple corporate clients.**

**Required decision:**
- Remove `profiles.company_id` FK (already recommended in architecture-impact)
- Use `company_members` as the source of truth for all company ↔ member relationships
- When a member has multiple active corporate memberships, apply the most recently added one for billing purposes (or surface a conflict to the admin)

---

### EC-6: Invoice Sent to Wrong Billing Email

**Scenario:** An admin updates a company's billing email after an invoice has already been sent. The company claims they never received it. The invoice status is "sent" but `viewed_at` is NULL.

**Required decision:**
- Add a "Resend invoice" action that triggers a new email to the current billing_email and updates `sent_at`
- Log each send attempt (not just the first) with timestamp and recipient email
- The "viewed" tracking (via email open/click pixel) should be noted as unreliable — many email clients block tracking pixels

---

## Medium-Probability Edge Cases

### EC-7: EasyPost Label Purchased for Cancelled Order

**Scenario:** A shipping label is purchased (EasyPost charges the account) and then the customer requests a cancellation. EasyPost allows label voiding within a window (varies by carrier: USPS allows void within 28 days, UPS within 14 days).

**Required decision:** Order cancellation flow must check for existing purchased shipping labels and automatically attempt to void them via the EasyPost API. If the void window has passed, alert the admin. Log the refund status.

---

### EC-8: Employee Clocks In at Studio A, Out at Studio B (Multi-Location Future)

**Scenario:** In future multi-location scenarios, an employee clocks in at location A (verified via geofence) and clocks out at location B (also verified, different geofence). The `geofence_location_id` references a single location per clock action. Hours are calculated correctly, but the location report shows a split shift.

**This is a future-state concern but the schema should handle it now.** The `clock_entries` table has a single `geofence_location_id` column. A `geofence_clock_out_location_id` column would properly capture split-location shifts.

**Recommended decision:** Add `geofence_clock_out_location_id UUID REFERENCES geofence_locations(id)` to the clock entries migration. Cost: one extra column. Saves a schema migration later.

---

### EC-9: Payroll Calculation During Active Clock-In

**Scenario:** An admin runs the payroll calculation for a period while an employee is still clocked in (their period's clock_out is NULL). The calculation window ends mid-shift.

**Required decision:** Payroll calculation should only include clock entries where `clock_out IS NOT NULL`. Open shifts should be flagged in the payroll output as "open shift — requires manual review." Do not auto-close open clock entries during payroll calculation.

---

### EC-10: Corporate Member's Membership Lapses While Event Is Scheduled

**Scenario:** A corporate client has 20 employees as linked members. The company's contract lapses (status → 'churned'). 5 of those employees have bookings for classes next week. 3 of them are registered as guests for a confirmed event next month.

**Required decision:**
- On contract status change to 'churned', the system should NOT auto-cancel member bookings or event registrations. These were made in good faith.
- The company_members.is_active flag should be set to false, preventing new bookings under corporate billing.
- Admin should receive a notification listing active bookings for corporate members that will need to be reconciled.

---

### EC-11: Onboarding Studio Provisioning Failure (Partial State)

**Scenario:** The `/api/onboarding/studio` provisioning route creates the `studios` record, the `saas_subscriptions` record, and is partway through creating the first admin profile when a network timeout occurs. The studio now exists in the database with no admin user.

**Required decision:**
- The provisioning route must be idempotent: if called again with the same email/studio name, it should resume from the last completed step rather than creating a duplicate.
- Use the `onboarding_progress` table to track which steps completed.
- The studio record + subscription can be created in one transaction. The admin profile creation is a second step that references the completed studio.
- Add a recovery flow: if a studio has no active admin user after 24 hours, send a re-invite email.

---

### EC-12: Geofence Verification — Employee GPS Spoofing

**Scenario:** An employee uses a GPS spoofing app to fake their location and clock in remotely.

**Decision context:** Browser Geolocation API has no reliable anti-spoofing. This is a known limitation of web-based geofencing. The plan correctly uses geofence as "verification" (flag as verified/unverified) rather than "enforcement" (block clock-in entirely). This is the right tradeoff.

**Recommendation:** Document explicitly that geofence verification is a deterrent and audit tool, not an absolute security control. The admin visibility into unverified clock-ins and the distance_from_studio field serve as sufficient deterrents for a small studio context. Do not over-engineer anti-spoofing for Phase 4.

---

## Low-Probability Edge Cases (Acknowledge and Accept)

**EC-13: Twilio number porting mid-campaign** — If The Sauna Guys changes their Twilio phone number, active opt-in records reference the old number. The SMS opt-in system must store the phone number that received the opt-in, not just a boolean. (Flagged for the Twilio implementation sprint.)

**EC-14: EasyPost rate returned in non-USD currency** — For international rate shopping (if ever enabled), rate amounts are carrier-specific. Ensure all rate comparisons use `rate.rate` in the same `rate.currency`.

**EC-15: Invoice tax_rate changes after invoice is sent** — The tax_rate on a corporate invoice should be locked at send time and not affected by later changes to the studio's tax settings. The JSONB line_items approach already handles this correctly by storing amounts at point of invoice creation.

---

## Edge Case Policy Decisions Required Before Sprint 1

1. **Corporate credit expiry policy** (EC-2) — rollover cap amount and notification timing
2. **Event/class conflict handling** (EC-1) — who resolves conflicts and how
3. **Payroll dispute workflow** (EC-3) — can approved periods be reopened?
4. **Duplicate event inquiry handling** (EC-4) — soft warning vs hard block
5. **Multi-company member billing** (EC-5) — which company's billing applies?

These should be added to `edge-case-policies.md` as Phase 4 decisions (EC-19 through EC-23).
