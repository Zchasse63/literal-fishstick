# SCRUTINY SUMMARY
## Meridian Phase 4 — Corporate & Operations
**Date:** 2026-03-20
**Verdict:** MODIFY
**Confidence:** High

---

## The One-Paragraph Summary

Phase 4 is the right plan working on the right problems, but it's 20 weeks of work planned as 14, and it bundles two distinct product goals that belong in separate phases. The core operations work — corporate accounts, event management, employee payroll, merch shipping, and SMS — has clear ROI, solves active pain for The Sauna Guys, and builds genuine competitive moats that no fitness SaaS competitor currently offers. The SaaS onboarding wizard and Stripe Billing integration serve a customer who doesn't exist yet and should be deferred until a real pilot customer is ready to onboard. Additionally, five concrete pre-development problems must be fixed before Sprint 1: a schema table name conflict, a migration that will fail because geofencing already exists, a type mismatch on EmployeeDocument, a Stripe webhook routing risk, and five unresolved edge case policies. Fix these first, split SaaS onboarding into Phase 4B, and the remaining plan is solid.

---

## Verdict by Feature

| Feature | Verdict | Why |
|---|---|---|
| Corporate Accounts + Invoicing | GO | Active pain, no competitor does this well, direct revenue impact |
| Event Management | GO | Closes B2B loop, conversion tracking is unique differentiator |
| Employee Payroll + Documents | GO | Closes Phase 1 mock data gap, genuine compliance and time savings |
| Geofence Clock Enhancement | GO | Already ~70% implemented; finish the settings UI |
| Merch + Shipping | GO | Low risk, fills operational gap |
| SMS/Twilio | GO | 2–3 day drop-in, fulfills existing stub in Phase 2 |
| API Keys + OpenAPI Docs | GO | Low complexity, right move for SaaS positioning |
| SaaS Onboarding Wizard | DEFER | No real customer yet; will be rebuilt based on pilot feedback |
| Stripe Billing for SaaS | DEFER | Depends on onboarding; premature without a paying customer |
| Custom Dashboard Builder | DEFER | Low marginal value over Phase 3 dashboards; not urgent |

---

## Critical Problems to Fix Before Sprint 1

### 1. Schema Audit Required — Two Table Name Conflicts

The Phase 4 migration targets `clock_entries` but the existing `/api/clock/route.ts` reads/writes to `time_entries`. These appear to be different names for the same table. The migration also proposes `CREATE TABLE geofence_locations` but the clock API already queries this table (it was built in Phase 1).

**Action:** Run these two queries against live Supabase before any migration work:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('clock_entries', 'time_entries', 'geofence_locations');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'geofence_locations';
```

Then correct the migration SQL to: (a) use the canonical clock table name, (b) remove CREATE TABLE geofence_locations, (c) add IF NOT EXISTS to all remaining CREATE TABLE statements.

If these conflicts reach Sprint 3, payroll calculation will return empty data and the phase will need a mid-flight schema remediation.

### 2. Type Mismatch on EmployeeDocument

`packages/types/src/employees.ts` defines `DocumentStatus` as `'current' | 'expiring_soon' | 'expired' | 'missing'`. The Phase 4 database schema defines it as `'pending' | 'approved' | 'rejected' | 'expired'`. The type also lacks `'w9'` and `'direct_deposit'` document_type values.

**Action:** Update `packages/types/src/employees.ts` before Sprint 3. Sprint 3 document API routes will produce TypeScript type errors or silent runtime mismatches if this isn't fixed first.

### 3. Remove profiles.company_id Denormalization

The plan proposes `ALTER TABLE profiles ADD COLUMN company_id UUID REFERENCES company_accounts(id)`. This breaks for members who belong to multiple companies. The `company_members` junction table already models the relationship correctly.

**Action:** Remove the `profiles.company_id` migration entirely. Query company membership through `company_members`. This is one extra join with negligible performance impact.

### 4. Stripe Webhook Routing Risk

The plan adds `/api/webhooks/stripe-saas` alongside the existing `/api/webhooks/stripe`. If using the same Stripe account, both endpoints receive all events. A SaaS billing event hitting the member subscription handler (or vice versa) can produce incorrect state updates.

**Action:** Route within the existing webhook handler using `metadata.subscription_type: 'saas' | 'member'` set at subscription creation time. Do not create a second webhook endpoint.

### 5. Five Edge Case Policies Are Unresolved

The following must be decided and documented in `edge-case-policies.md` before Sprint 1:

- **EC-19: Corporate credit expiry** — do unused credits roll over or expire at month end? (Recommended: cap rollover at 2x monthly allocation)
- **EC-20: Event/class conflict handling** — when an event overlaps with a scheduled class, who resolves it? (Recommended: surface warning at confirmation, admin acknowledges, manual class cancellation)
- **EC-21: Payroll dispute workflow** — can an approved payroll period be reopened? (Recommended: yes, with admin override and audit log)
- **EC-22: Duplicate event inquiry detection** — soft warning or hard block? (Recommended: soft warning with acknowledgement required)
- **EC-23: Multi-company member billing** — if a member is in two company accounts, which billing applies? (Recommended: most recently added wins; surface conflict to admin)

---

## Scope Recommendation: Split Into Phase 4A and 4B

### Phase 4A (Build Now, 12–14 weeks)

Corporate accounts, events, invoicing, employee payroll + documents, geofence settings UI, merch + shipping, SMS/Twilio, API keys, OpenAPI documentation, polish.

This delivers every feature that The Sauna Guys will use in the next 6 months.

### Phase 4B (Build When First External Customer Exists, 6–8 weeks)

SaaS onboarding wizard, Stripe Billing for SaaS subscriptions, Glofox import tooling, custom dashboard builder.

**Why defer?** The SaaS onboarding wizard's primary design input should come from watching the first real customer onboard. Building it from assumptions produces a wizard that gets rebuilt. Wait for the pilot. The savings: 4–6 weeks of developer time redirected to higher-ROI Phase 4A work.

---

## Realistic Timeline

| Sprint | Content | Realistic Duration |
|---|---|---|
| 1 | Corporate foundation + schema | 2.5 weeks |
| 2 | Events + invoicing | 3 weeks |
| 3 | Employee payroll + documents + geofence | 3 weeks |
| 4 | Merch + shipping | 3 weeks |
| 5 | SMS + API keys + OpenAPI | 2 weeks |
| 6 | Polish + integration | 1.5 weeks |
| **4A Total** | | **15 weeks** |

The plan's 12–14 week estimate is ~20% optimistic for Phase 4A alone after accounting for schema audit, type fixes, edge case resolution, and real EasyPost integration complexity.

---

## Technical Highlights to Address Per Sprint

**Sprint 1 prep:**
- Run schema audit before any migration work
- Add IF NOT EXISTS to all migration CREATE TABLE statements
- Update employees.ts types

**Sprint 2:**
- Implement event/class conflict warning at confirmation step
- Lazy-load swagger-ui-react with dynamic import (bundle impact otherwise significant)

**Sprint 3:**
- Route payroll calculation through Inngest (not a synchronous API handler) — Netlify 10s timeout risk
- Use @dnd-kit for dashboard builder instead of react-grid-layout

**Sprint 4:**
- Start with USPS-only EasyPost, add UPS/FedEx incrementally
- Label voiding on order cancellation must call EasyPost void API within carrier window

**Sprint 5:**
- Replace next-swagger-doc with static openapi.yaml approach (next-swagger-doc is Pages Router only)
- Write openapi.yaml manually or generate once — it's checkable into version control

---

## Competitive Moats Being Built

Phase 4A creates three genuine competitive advantages that no fitness SaaS competitor currently offers:

1. **Corporate wellness CRM native to the studio platform** — not a spreadsheet workaround, not a Mindbody marketplace intermediary. Studio-owned relationship with company-level invoicing and credit allocation.

2. **Trainer performance bonus calculation wired to payroll** — no competitor connects class check-in thresholds to payroll as a first-class automated feature.

3. **Event conversion tracking** — did event guests become members? This closes the lead generation → member acquisition loop that makes events profitable beyond their immediate revenue.

---

## What Would Change the Verdict to Full GO

1. Complete the schema audit and confirm no conflicts
2. Document the 5 edge case policies in edge-case-policies.md
3. Confirm SaaS onboarding is formally moved to Phase 4B
4. Confirm product variants are out of scope for Phase 4A

If those four items are completed before Sprint 1 starts, the plan can proceed without further changes.

---

## Full Reports

All detailed analysis is in `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/`:
- `technical-feasibility.md` — schema conflicts, dependency issues, implementation risks
- `scope-complexity.md` — sprint-by-sprint reality check, timeline reestimate
- `user-value.md` — feature-by-feature value assessment, value delivery order
- `cost-benefit.md` — ROI by feature, third-party service costs, budget recommendation
- `architecture-impact.md` — DB denormalization concern, webhook routing, type system impact
- `edge-cases.md` — 15 edge cases, 5 requiring decisions before Sprint 1
- `competitive-context.md` — competitor gap analysis, market timing, moat assessment

Supporting documents:
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/synthesis/verdict.md`
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/planning/assumptions.md`
- `/Users/zach/Desktop/literal-fishstick/.scrutiny/planning/scope-decomposition.md`
