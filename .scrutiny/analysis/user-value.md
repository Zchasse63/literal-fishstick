# User Value Analysis — Phase 4: Corporate & Operations

**Agent:** user-value
**Plan:** Meridian Phase 4
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

The core of Phase 4 — corporate accounts, event management, employee payroll, and merch shipping — delivers high value to The Sauna Guys and solves real operational pain they cannot address with Glofox today. The SaaS onboarding and custom dashboard builder, however, solve a speculative future customer problem rather than the primary user's immediate needs. These should be deferred. The plan should be prioritized in value-delivery order, not feature-bundling order.

---

## User Populations

**Primary user: Studio owner/admin (The Sauna Guys)**
The Sauna Guys operates in Tampa with a growing corporate wellness clientele (from the business model docs). They currently have no structured way to manage company accounts, track invoices, or handle event logistics within Glofox.

**Secondary user: Studio employees/trainers**
Currently limited to the Phase 1/2/3 employee portal features. The payroll and document management features directly serve them.

**Tertiary user: Future SaaS customers (other fitness studios)**
The SaaS onboarding and multi-tenant features serve this audience. This user does not exist yet.

---

## Value Assessment by Feature Area

### Corporate Accounts & Invoicing — HIGH VALUE

The Sauna Guys explicitly has corporate wellness clients. Without Phase 4, managing these accounts requires:
- Tracking company contacts in a separate spreadsheet or CRM
- Manually invoicing (Word/Google Docs → PDF → email)
- No visibility into contract value, credit usage, or member linkage
- No event history tied to the company

Phase 4 provides a structured pipeline view, automated invoicing, and credit allocation. The value is immediate and addresses a known operational gap. The B2B invoice PDF, net-30/60 payment terms, and Stripe payment link are all features a boutique studio with corporate clients genuinely needs.

**User pain solved:** "We don't have a way to track who owes us what from our corporate clients."

### Event Management — HIGH VALUE

Birthday parties, corporate wellness sessions, and private events are revenue streams that fitness studios routinely manage through email chains and spreadsheets. The inquiry → quoted → confirmed → invoiced flow maps exactly to how event sales actually work. The guest list with RSVP tracking and conversion attribution (did the guest become a member?) is a genuinely differentiated feature — no competitor does this with native conversion tracking.

The event calendar integration with the existing schedule (so events block regular class slots) is critical for operations. This is called out in the edge cases section.

**User pain solved:** "We're juggling event logistics in email and missing follow-up on leads."

### Employee Payroll + Documents — HIGH VALUE for Staff, HIGH VALUE for Owner

The payroll calculation engine (clock entries + class bonuses + promo commissions → gross pay export) closes the loop on Phase 1's payroll tab, which shows mock data. The trainer bonus threshold feature (already defined in the business model: check-ins > threshold = bonus) is business logic that currently requires manual calculation by the owner. Automating this removes error risk and owner time.

Employee document management (W4/W9 collection, W2/1099 storage) addresses a compliance need that every studio has but no fitness SaaS platform handles well. Trainers resent chasing down paper forms. This feature saves time for both the admin and the employee.

**User pain solved:** "Payroll takes me 2 hours every two weeks to calculate manually" and "We still have paper W4s in a drawer."

### Geofence Clock-In Enforcement — MEDIUM-HIGH VALUE

Clock in/out geofencing prevents employees from punching in from home or while stuck in traffic. For a small studio where every labor dollar matters, this is a meaningful control. The plan's graceful fallback (allow clock-in without geofence verification, flag as unverified) is the right approach — it prevents the system from blocking an employee who has a GPS glitch, while still giving the admin visibility.

The UI enhancement (showing distance from studio, verification badge) adds transparency that employees will appreciate rather than resent, if framed correctly.

**User pain solved:** "I can't tell if people are actually at the studio when they clock in."

### Merch & Shipping — MEDIUM VALUE

In-studio pickup exists from Phase 1. Shipping expands the merch channel to online orders from members who aren't coming in. For a boutique sauna studio in Tampa, the shipping volume is likely modest (merch is secondary revenue). However, the administrative overhead of managing orders without a UI is real — staff currently have no way to see pending orders, mark them as fulfilled, or generate shipping labels.

The EasyPost integration is technically solid and appropriately scoped (rate shopping, label generation, tracking). For a small operation, USPS-only would actually cover 90% of use cases, and the plan appropriately suggests starting there.

**User pain solved:** "We sell merch but don't have a way to manage who's ordered what."

### SMS via Twilio — MEDIUM VALUE

SMS is already factored into Phase 2 campaign builder and automation flows (they just no-op through the stub). Enabling Twilio fulfills existing functionality that members are expecting. Class reminders, booking confirmations, and waitlist notifications via SMS have high open rates compared to email. This is a straightforward value add.

**User pain solved:** "We can't send texts to members even though the campaign builder has an SMS option."

### SaaS Onboarding Wizard — LOW-TO-MEDIUM VALUE (Right Now)

The Sauna Guys does not need a SaaS onboarding wizard. This feature serves a future customer who doesn't exist yet. Building it now means:
- 4–6 weeks of developer time solving a problem that has no current user
- Scope assumptions about what "other studios" need may be wrong
- The import step (Glofox migration) is underspecified

Value is real — but premature for this phase. The right time to build SaaS onboarding is when the first pilot customer (a second studio) is ready to onboard. That customer's feedback should shape the wizard flow.

**Honest assessment:** Building SaaS onboarding based on assumptions about what a hypothetical second studio needs is a classic premature SaaS optimization. Wait until you have a real customer to tell you what the wizard should actually do.

### Custom Dashboard Builder — LOW VALUE (Right Now)

The custom dashboard builder was deferred from Phase 3, suggesting it wasn't urgent then either. Building a drag-and-drop widget dashboard requires: widget type definitions, data source bindings, layout persistence per user, and a non-trivial UI. The existing analytics dashboards from Phase 3 already provide fixed but comprehensive views. The marginal value of customization over a well-designed fixed layout is low for a studio with one primary admin user.

**Honest assessment:** This is a feature that sounds valuable in a product spec but rarely moves the needle in day-to-day usage for a studio of this size. Defer to Phase 5 or later.

### API Documentation — HIGH VALUE for SaaS, LOW Value for The Sauna Guys

The Sauna Guys will never use the public API directly. The API documentation value is entirely about SaaS attractiveness to developer-friendly customers. It's the right move for a SaaS product, but its urgency depends on when real customers arrive.

---

## Value Delivery Order

If scope must be cut, this is the order to deliver:

| Priority | Feature | Why |
|---|---|---|
| 1 | Employee payroll + documents | Closes the loop on Phase 1, ongoing operational pain |
| 2 | Corporate accounts | Active revenue stream, current manual pain |
| 3 | Event management | Active revenue stream, current manual pain |
| 4 | SMS/Twilio | Fulfills existing stub, improves member communication |
| 5 | Merch admin UI + shipping | Removes operational friction |
| 6 | API keys + OpenAPI docs | Prerequisite for SaaS positioning |
| 7 | SaaS onboarding | Defer until first real customer |
| 8 | Custom dashboard builder | Defer indefinitely |

---

## Risks to User Value

**Payroll calculation accuracy risk:** If the payroll engine has bugs (e.g., wrong overtime threshold, missed bonus class), the studio owner will lose trust in the feature and revert to manual calculation. The calculation logic must be surfaced transparently (show the breakdown: X hours regular, Y hours OT, Z bonus-eligible classes) so the admin can spot-check the numbers. Black-box total is not acceptable for payroll.

**Invoice PDF quality risk:** The corporate invoice PDF is a customer-facing document. If it looks unprofessional (wrong formatting, truncated addresses, missing logo), it reflects badly on The Sauna Guys. PDF generation requires design attention, not just data correctness.

**Event conflict risk:** If an event is booked in a slot that already has a regular class (or vice versa), and the system doesn't prevent it, the studio will double-book their facility. This is the highest operational risk in the plan (detailed in edge-cases report).
