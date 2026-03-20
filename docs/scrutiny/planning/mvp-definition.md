# MVP Definition -- Meridian Phase 1

**Date:** 2026-03-20
**MVP Goal:** Replace Glofox. Turn it off. Members book through Meridian. Staff manages through Meridian. Revenue flows through direct Stripe.

---

## MVP Scope (Minimum to Decommission Glofox)

### Admin Dashboard
- **Command Center:** Today's revenue, class fill rates, upcoming classes, recent activity feed, rules-based AI briefing ("3 members haven't visited in 14 days")
- **Schedule:** Create/edit/cancel class slots, assign trainers, recurring schedule templates
- **Members:** Directory, profiles, family accounts, analytics exclusion toggle, credit balance display
- **Revenue:** Stripe subscriptions (3 plans + packs + drop-in), proration on upgrades, transaction log, basic revenue metrics (MRR, ARPM)
- **Operations:** Staff management, roles/permissions, booking rules (cancellation window, capacity), business settings
- **Waivers:** Digital signature capture, per-studio waiver text from database
- **Booking engine:** Atomic insert, capacity check, credit reservation at booking time
- **Waitlist:** Auto-promotion with email notification, 30-minute claim window
- **Check-in:** Name-based lookup + QR code scanning

### Employee Portal
- Clock-in/out with geofencing (300m radius)
- Timesheet view
- Trainer promo code performance dashboard
- Trainer bonus visibility ("5/7 check-ins -- 2 more for bonus")

### Member Web Portal (Minimal)
- View schedule (upcoming slots, capacity, trainer)
- Book a class (select slot, confirm, credit deduction)
- Account management (view membership, credit balance, payment method)
- Self-service membership upgrade with proration preview
- QR code display for check-in
- Magic link authentication

### Backend
- Supabase schema with RLS (all tables, all roles)
- Stripe webhook handler (invoice.paid, invoice.payment_failed, subscription.updated, subscription.deleted, payment_intent.succeeded)
- Email notifications via Resend (booking confirmation, cancellation, waitlist promotion, credit expiry warnings)
- pg_cron scheduled jobs (waitlist polling, credit expiry notifications, bonus evaluation)

### Data Migration
- Import Glofox members (profiles, emails, membership status)
- Import credit balances
- Import booking history
- Stripe Customer creation for all active members
- Double-billing prevention during parallel operation

---

## What Is CUT from Full Plan for MVP

| Feature | Why Cut | When It Returns |
|---|---|---|
| Marketing module (campaigns, automations, lead pipeline) | Biggest scope relief. Studio can use Resend directly or existing tools. | Phase 2 |
| Merch inventory | In-studio merch sales can continue manually. | Phase 2 |
| Gift cards + wallet system | Nice-to-have, not operational necessity. | Phase 2 |
| Dunning automation | Staff handles failed payments manually for now (email from Stripe). | Phase 2 |
| Full employee payroll (tax docs, detailed stubs) | Clock-in/out covers immediate need. Payroll calc can be manual initially. | Phase 2 |
| Wellness journey tracking | Data accumulates during Phase 1. UI build is Phase 2. | Phase 2 |
| Trainer public profiles (member-facing) | Trainers are known by name at current scale. | Phase 2 |
| Community / social board | Empty at 11 members. | Phase 2+ (if 100+ members) |
| LLM-powered AI | Rules-based briefing covers Phase 1. LLM needs data to be useful. | Phase 3 |
| Analytics dashboards | Command Center metrics are sufficient for single-location. | Phase 3 |
| Corporate module | Zero corporate clients currently. | Phase 4 |
| iOS app | Web portal covers member booking needs. | Phase 4 |

---

## MVP vs. Full Platform Effort

| Scope | Solo Developer | 2-Person Team |
|---|---|---|
| MVP (Phase 1) | 6-10 months | 4-6 months |
| Full platform (Phase 1-4) | 19-29 months | 14-20 months |
| **MVP as % of full** | **~35%** | **~30%** |

---

## MVP Success Criteria

The MVP succeeds when ALL of these are true:

1. **Glofox is turned off.** No member or staff member needs Glofox for any operational task.
2. **Members can book classes** through the Meridian web portal without staff assistance.
3. **Revenue flows through direct Stripe.** All subscriptions, credit pack purchases, and drop-in payments are processed via Meridian's Stripe integration (not Glofox's Stripe Connect).
4. **No manual booking management.** Waitlists auto-promote. Capacity is enforced atomically. Credits deduct correctly.
5. **Trainers can see their earnings.** Promo code performance and bonus status are visible in the employee portal.
6. **The owner can see revenue.** MRR, today's revenue, and the AI briefing are on the Command Center.
7. **Zero data integrity issues.** Credit balances match reality. Membership statuses are correct. No duplicate charges during migration.

### How to Know If It Is Worth Expanding

After 30 days of MVP operation, evaluate:
- Time saved per week (staff operational labor reduction)
- Revenue recovered (failed payments that Stripe auto-retries successfully)
- Self-service upgrades (did any member upgrade without staff help?)
- Trainer satisfaction (do trainers check their dashboard?)
- Member satisfaction (any complaints about booking experience?)

If the answer to these is positive, proceed to Phase 2. If trainers ignore the dashboard and members find the booking flow confusing, fix those before adding scope.
