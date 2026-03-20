# Scope Complexity Analysis — Meridian PRD v1.0

**Agent:** scope-complexity
**Complexity:** MAJOR (Deep+ mode)
**Date:** 2026-03-20
**Source:** meridian-prd.md v1.0, edge-case-policies.md, CLAUDE.md

---

## Agent Verdict

**MODIFY**

The PRD scope is coherent and well-specified. The business logic decisions are locked. The phase structure is logical. However, the scope as written for Phase 1 is significantly larger than a standard "start building" phase, and a critical contradiction exists between Section 11 (Phase 1 deliverables) and Section 13 (scope exclusions) regarding the web booking portal. Resolving this contradiction alone would meaningfully clarify what Phase 1 actually is. Beyond that, the plan contains several features whose build effort is disproportionate to their value at The Sauna Guys' current scale — the multi-tenant RLS architecture is the right call but adds overhead; the Marketing module in Phase 1 is ambitious; the Corporate module is Phase 4 complexity in a Phase 1 plan. No features should be cut — the vision is correct — but the phasing needs calibration against what a real developer can ship in a focused first sprint.

---

## The Phase 1 Contradiction

Section 11 lists "Web Booking Portal (member-facing)" as a Phase 1 deliverable.
Section 13 explicitly states: "Member Web Booking Portal (Next.js) — will consume same Supabase backend" is excluded from this PRD's scope.

These directly contradict each other. The resolution has significant implications:

**If web portal is IN Phase 1:** Members have a booking surface from launch day. Glofox can be turned off. Phase 1 is complete as an operational replacement.

**If web portal is OUT of Phase 1:** Members cannot book through Meridian. The admin dashboard can run parallel to Glofox (staff uses Meridian, members still book on Glofox) but you cannot turn Glofox off. The migration is incomplete.

**Recommendation:** The web booking portal must be in Phase 1. It doesn't need to be full-featured — a minimal member portal (view schedule, book a slot, manage account, display QR code) is sufficient to enable Glofox decommission. Scope it as "Phase 1b" and explicitly document what the member portal includes vs. defers to Phase 2.

---

## Phase 1 Scope Reality Check

Phase 1 as written includes: 8 admin modules, employee portal, Supabase backend, Stripe integration, Resend email, AI Briefing Card, QR check-in system, and data migration. That is not a Phase 1. That is the entire product minus the iOS app.

What Phase 1 actually needs to replace Glofox (the forcing constraint):

| Feature | Required to Replace Glofox | Notes |
|---|---|---|
| Class schedule (admin creates/edits/cancels slots) | YES | Core operation |
| Member booking via web portal | YES | Members need to book |
| Member directory + profiles | YES | Operational necessity |
| Membership management + credit packs | YES | Revenue collection |
| Stripe integration (recurring billing, payments) | YES | Money in |
| Basic check-in (name lookup or QR) | YES | Front desk needs this |
| Waitlist (basic auto-promotion) | YES | Used daily |
| Staff roles + trainer assignment | YES | Operational |
| Settings (booking rules, cancellation window) | YES | Configuration |
| Waiver management | YES | Legal requirement |
| Data migration from Glofox (Wave 1-3) | YES | Prerequisite to go-live |
| Email notifications (booking confirmation, cancellation) | YES | Basic comms |
| Walk-in kiosk mode | SHOULD | Can survive with name lookup initially |
| Self-service membership upgrades | SHOULD | High pain point; doable in Phase 1 |
| Trainer promo codes + bonuses | SHOULD | Can be manual initially |
| Command Center with live metrics | SHOULD | High admin value; Phase 1 level effort |
| Marketing campaigns | DEFER | Phase 2 |
| Automation flows | DEFER | Phase 2 |
| Merch inventory | DEFER | Phase 2 |
| Gift cards | DEFER | Phase 2 |
| Employee portal (payroll, geofencing) | DEFER | Phase 2 can work for first weeks |
| AI briefing (LLM-powered) | DEFER | Phase 2/3; rules-based version Phase 1 |
| Analytics dashboards | DEFER | Phase 3 |
| Corporate module | DEFER | Phase 4 |

The PRD's Marketing module (Section 5.5) is in Phase 1 but contains: campaign builder, automation flows, lead pipeline, and community/content hub. This is Phase 2 material. The PRD's Operations module (Section 5.7) includes employee portal features that are genuinely useful but not required to replace Glofox.

---

## Module-Level Complexity Assessment

| Module | Pages | True Complexity | Phase Fit |
|---|---|---|---|
| Command Center | 1 | HIGH — real-time metrics, AI briefing, facility map, activity feed | Phase 1 (high value, achievable) |
| Schedule | 4 | HIGH — calendar, kiosk, waitlists, resources | Phase 1 (kiosk Phase 1b) |
| Members | 3 | MEDIUM-HIGH — directory, smart segments, family accounts | Phase 1 (segments Phase 2) |
| Revenue | 7 | VERY HIGH — proration, dunning, invoicing, merch, gift cards | Phase 1 core; merch/gift cards Phase 2 |
| Marketing | 5 | HIGH — campaign builder, automations, lead pipeline, content hub | Phase 2 (entire module) |
| Corporate | 3 | MEDIUM — company accounts, events, group bookings | Phase 4 (entire module) |
| Operations | 4 | MEDIUM — staff, employee portal, facilities, waivers, settings | Phase 1 core; geofenced payroll Phase 2 |
| Analytics | 3 | HIGH — custom dashboards, AI insights, reports | Phase 3 |

**Misphased items from the PRD:**
- Marketing module: Listed as Phase 1 in the module spec (Section 5.5) but Phase 2 in Section 11. Section 11 wins — this is correct.
- Walk-in Kiosk: Section 11 includes it in Phase 1; Section 13 moves it out. For a physical front desk, this needs resolution.
- Employee Portal (full payroll, geofencing): Phase 1 has clock-in only; full payroll is Phase 2. This is reasonable.

---

## The "30 Pages" Reality

The design guide documents 17 designed pages (9 admin + 8 employee portal) from MagicPath prototypes. The PRD's module specs imply additional pages not yet designed:
- Smart Segments page (complex filter builder)
- Dunning management page
- Invoicing page
- Gift cards admin page
- Automation flow builder page (visual, like Zapier)
- Lead pipeline page
- Content hub page
- Corporate accounts pages (3)
- Analytics custom dashboard builder
- Reports page

The MagicPath prototypes cover the highest-priority surfaces. But significant UI work remains for the pages not yet prototyped. This is not a blocker — it's a scoping input for the developer to know what UI work still needs design.

---

## SaaS Multi-Tenancy Overhead

The PRD correctly adds multi-tenancy from day one (RLS with studio_id/location_id). This adds approximately 15-20% overhead to backend development — every query, every RLS policy, every Edge Function must respect tenant context.

At The Sauna Guys' current scale (~11 active memberships, 3 trainers, 1 location), multi-tenancy adds zero business value today. It is justified solely as an investment in the SaaS future.

**Assessment:** This is the right call. The cost of retrofitting multi-tenancy later is vastly higher than building it upfront. The overhead is acceptable. But developers must understand that every table needs `studio_id`, every query must include it, and every RLS policy must enforce it — this is not optional scaffolding.

---

## The Scope vs. Team Size Problem

The PRD doesn't state team size, timeline, or budget. This is the single largest risk in the entire document. Without a forcing constraint, the scope will expand to fill all available time.

At realistic development velocities:
- Phase 1 core (admin dashboard + backend + Stripe + minimal member portal): 4-6 months for 2 engineers
- Phase 2 (iOS app + Marketing + Employee Portal full): 3-5 months
- Phase 3 (Analytics + AI): 2-4 months
- Phase 4 (Corporate + Events): 3-5 months
- **Total to full platform:** 12-20 months for a 2-person team

For a solo developer:
- Phase 1 alone: 6-10 months
- Full platform: 20-30 months

**Recommendation:** Before development begins, establish: (1) team composition, (2) target go-live date for Phase 1, (3) budget constraint. These three inputs determine what Phase 1 actually contains.

---

## Feature Complexity Hotspots

Features that consistently underestimated in planning:

**The credit system** (credits, packs, expiry, family pools, deduction priority, grace periods): This is a mini billing engine. The 18 edge cases document gives most of the rules, but the implementation — tracking per-credit expiry, deducting in priority order, handling the 7-day grace, managing family pool atomically — is 3-5 weeks of careful backend work.

**The waitlist promotion trigger**: Deciding what fires the 15-minute window timer (Supabase realtime trigger on booking deletion? pg_cron polling? Client-side event?) is a real architectural decision with operational reliability implications.

**The automation flow builder (Marketing)**: The "visual flow builder" with triggers, conditions, and actions (like Zapier or Klaviyo) is a substantial product on its own. It's correctly in Phase 2, but it should be flagged as a 6-10 week build minimum, not a 2-week sprint.

**Smart segments with AND/OR logic**: Building a segment builder where admins can combine conditions (membership type = Unlimited AND last visit > 14 days ago AND city = Tampa) requires a query builder that translates UI rules to SQL. This is non-trivial.

---

## What's Correctly Scoped

- The design system is complete and will dramatically reduce front-end development time
- All pricing, policies, and business logic decisions are locked — no mid-sprint discovery
- The edge case policies document answers most "what should happen when X?" questions
- The MagicPath prototypes eliminate most design ambiguity
- Deferring weather correlation, IoT logging, and custom dashboard widget builder is correct
- Treating the walk-in kiosk as a separate surface (Part of employee iOS app) is architecturally clean

---

## Summary

The PRD is well-specified and the scope decisions are mostly correct. The critical issue is the Phase 1 contradiction: the web booking portal must be in Phase 1 for Glofox to be decommissioned, and this needs to be explicitly resolved. The Marketing module should be moved entirely to Phase 2. The team size and go-live date must be established to create a meaningful Phase 1 scope boundary. Once those three items are addressed, the PRD is a solid development brief.
