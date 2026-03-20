# Scope & Complexity Analysis — Phase 4: Corporate & Operations

**Agent:** scope-complexity
**Plan:** Meridian Phase 4
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

The plan attempts to do too much in one phase for a single developer. It bundles seven distinct product capabilities across six sprints, and the stated 12–14 week estimate is optimistic given the hidden complexity in several work streams. The scope contains two items (SaaS onboarding and custom dashboard builder) that would each justify their own phase. The core Phase 4 work — corporate accounts, events, employee enhancements, merch/shipping — is the right focus and should be completed first. SaaS onboarding and the dashboard builder should be deferred or separated into Phase 4B.

---

## Confidence Level

High — based on line-by-line review of API routes, UI pages, sprint structure, and cross-referencing with existing codebase state.

---

## Scope Assessment

### True Route Count vs Stated Count

The plan states ~67 new API routes. Actual count from the route tables:
- Corporate: 12
- Events: 10
- Invoices: 6
- Employee enhancements: 10
- Geofence: 3
- Merch/Shipping: 12
- SaaS/Onboarding: 8
- API Keys: 4
- SMS: 2

**Total: 67 routes.** The count is accurate. However, route count understates complexity. Several of these routes contain non-trivial logic:
- `/api/payroll/periods/[id]/calculate` — multi-table aggregation with overtime rules
- `/api/orders/[id]/ship` — EasyPost API integration with rate shopping
- `/api/onboarding/studio` — multi-step provisioning (create studio, RLS setup, initial config, team invites)
- `/api/invoices/[id]/pdf` — PDF generation (already validated via @react-pdf/renderer but still requires template design)

Counting these as single route-equivalents underestimates their development cost by 3–5x.

---

## Sprint-by-Sprint Reality Check

### Sprint 1 (Weeks 1–2): Corporate Foundation — PLAUSIBLE

13 new tables + 12 corporate API routes + 3 UI pages in 2 weeks is achievable if:
- The migration is clean (it currently has issues — see technical-feasibility report)
- The UI pages follow existing patterns (they should — the admin page pattern is well-established)

The migration schema is thorough and well-thought-out. Sprint 1 is the best-scoped sprint in the plan.

**Realistic estimate: 2.5 weeks.** The schema audit and migration conflict resolution (clock_entries/time_entries) will absorb the buffer.

### Sprint 2 (Weeks 3–4): Events & Invoicing — TIGHT

Events (10 routes) + Invoices (6 routes) + 2 UI pages + PDF generation + Inngest jobs in 2 weeks is aggressive. The event status flow (inquiry → quoted → confirmed → deposit_paid → in_progress → completed → invoiced → paid) has 8 states with transition validation logic at each step. The invoice PDF must be designed and built. The event calendar UI (month/week view) is non-trivial front-end work — the plan already has the schedule module using a calendar, but events have different data shapes and interaction patterns.

**Realistic estimate: 3 weeks.** PDF generation alone typically takes 3–5 days for a professional-quality document.

### Sprint 3 (Weeks 5–7): Employee Portal Enhancements — OVERSCOPED

This sprint is allocated 3 weeks, the longest in the plan. However, geofencing is already substantially implemented (see technical-feasibility report). The real work is:
- Payroll API routes (7) + calculation engine: this is the genuinely complex piece
- Employee document management (upload/view/approve): moderate complexity with Supabase Storage
- Settings UI for geofence configuration: straightforward
- Clock UI updates for geofence badge: minimal changes to existing UI

The payroll calculation engine requires careful design: overtime thresholds (1.5x after 40 hours/week or 8 hours/day? federal vs state rules vary), trainer bonus calculation (join class_bookings or check_ins by trainer, filter by threshold, per-class), promo commission calculation (join promo_code_uses). This is the most domain-complex piece in Phase 4.

**Realistic estimate: 3 weeks.** The sprint is appropriately sized but the payroll calculation is harder than it appears.

### Sprint 4 (Weeks 8–9): Merch & Shipping — UNDERSCOPED

Merch CRUD (5 routes) + orders (4 routes) + EasyPost (3+ integration touchpoints) + 3 UI pages in 2 weeks is tight. EasyPost integration involves:
- Rate quote API (shipment object creation, rates retrieval, comparison UI)
- Label purchase API (rate selection → label creation → PDF download)
- Tracking webhook registration and handling
- Order status state machine updates driven by tracking events

EasyPost's API is well-documented but has non-obvious behaviors: shipment objects are immutable after creation (must create a new one to change rates), label voiding has a time window, tracking webhooks fire multiple events per package. The integration will take longer than a typical API integration.

Additionally, product variants are not addressed. The plan covers product CRUD but real merch has size/color variants. The existing types don't show variant support. Either this is out of scope (and should be stated) or it's a missing requirement that will surface during UI build.

**Realistic estimate: 3 weeks.**

### Sprint 5 (Weeks 10–11): SMS + SaaS Onboarding — SEVERELY UNDERSCOPED

This is the most underscoped sprint. It bundles:

**SMS (Twilio):** The TwilioProvider drop-in replacement is genuinely straightforward — 1–2 days. The webhook handler for delivery receipts is another day. Settings UI is 1 day. Total: 3–4 days. This is fine.

**SaaS Onboarding:** The onboarding wizard, subscription management page, and SaaS Stripe Billing integration in 1.5 weeks is not realistic:
- Studio provisioning (`/api/onboarding/studio`) requires: create studios record, set up RLS context, create initial default data (class types, settings), send welcome email, provision Supabase Storage bucket path. This is a multi-step transaction that must be idempotent and resumable.
- Stripe Billing integration: SaaS subscription creation, trial period management, webhook handling for subscription lifecycle, plan upgrade/downgrade logic, usage-based limit enforcement (member_limit, staff_limit, location_limit)
- Onboarding wizard UI: multi-step form with state persistence (what if they close the browser mid-way?), import step (what format? Glofox CSV?), branding step (logo upload, color picker), team invite step (bulk email invites)

The Glofox data migration import step in particular is referenced in Phase 3 and this plan without concrete specification. What format does the import accept? What entities are migrated? A full CSV importer for Glofox data is a significant feature by itself.

**Realistic estimate: 4–5 weeks** for SaaS onboarding done properly.

### Sprint 6 (Weeks 12–14): API Docs + Polish — REASONABLE BUT CUSTOM DASHBOARD BUILDER IS DEFERRED SCOPE

API key management (4 routes) and UI: 3–4 days.
OpenAPI documentation: 3–4 days (with the static YAML approach).
Admin polish pass: 3–5 days.
Build verification: 2–3 days.

The custom dashboard builder deferred from Phase 3 is listed here with no detailed specification. "react-grid-layout or @hello-pangea/dnd" is not a spec. What widgets are available? How are they persisted? Per-user or per-studio? What are the available data sources? This is a 2–4 week feature on its own that is being squeezed into the polish sprint.

**Realistic estimate: 3 weeks for everything except the dashboard builder. Dashboard builder needs its own sprint or should be moved to Phase 5.**

---

## Revised Timeline Estimate

| Sprint | Plan | Realistic |
|---|---|---|
| Sprint 1: Corporate Foundation | 2 weeks | 2.5 weeks |
| Sprint 2: Events & Invoicing | 2 weeks | 3 weeks |
| Sprint 3: Employee Enhancements | 3 weeks | 3 weeks |
| Sprint 4: Merch & Shipping | 2 weeks | 3 weeks |
| Sprint 5: SMS + SaaS Onboarding | 2 weeks | 5 weeks |
| Sprint 6: API Docs + Polish | 2–3 weeks | 3 weeks |
| **Total** | **12–14 weeks** | **19.5–20 weeks** |

This is a 40–60% timeline underestimate, primarily driven by Sprint 5 (SaaS onboarding) and Sprint 4 (EasyPost integration).

---

## Recommended Scope Split

### Phase 4A (12–14 weeks) — Core Corporate & Operations

Remove from Phase 4 and keep:
- Corporate accounts + invoicing (Sprint 1–2)
- Events management (Sprint 2)
- Employee portal enhancements (Sprint 3)
- Merch + shipping (Sprint 4)
- SMS/Twilio (Sprint 5 — straightforward drop-in)
- API keys + OpenAPI docs (Sprint 6)

### Phase 4B (6–8 weeks) — SaaS & Platform

Move to a separate phase:
- SaaS onboarding wizard
- Stripe Billing for SaaS subscriptions
- Custom dashboard builder
- Glofox data import tooling

**Rationale:** Phase 4A is cohesive — it completes the Sauna Guys feature surface. Phase 4B is specifically about making Meridian sellable to other studios. These are different product goals with different customers. The Sauna Guys does not need SaaS billing or a multi-tenant onboarding wizard. These features are valuable but not urgent for the primary stakeholder.

---

## Hidden Complexity Not in the Plan

1. **Product variants** — The merch system has no variant model (size M black shirt vs size L black shirt). This will surface during the product admin UI build. Either scope it in or explicitly call it out as deferred.

2. **Glofox import format** — The onboarding wizard's "import" step references Glofox data migration (previously defined as a 5-wave soft migration in edge-case-policies.md). The import step in the wizard needs a concrete format specification before it can be built.

3. **Credit allocation mechanics** — Corporate monthly_credit_allocation resets via Inngest cron. What happens to unused credits? Do they roll over or expire? The plan doesn't specify. This will create a support issue.

4. **Event conflict detection** — If an event is booked for 6–8pm Saturday and a regular class is also scheduled for 6–7pm, who resolves the conflict? The events table reserves resources via JSONB, but there's no join to the existing schedule/bookings data to detect conflicts.

5. **Payroll overtime rules** — Federal overtime is 1.5x after 40 hours/week. Some states (California) require daily overtime (1.5x after 8 hours/day, 2x after 12). The plan has `overtime_rate` but no jurisdiction-based calculation logic. For Florida (Tampa), federal rules apply, so this may be fine for MVP, but it's worth noting.
