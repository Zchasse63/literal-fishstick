# Verdict: Meridian Phase 4 — Corporate & Operations
**Synthesized:** 2026-03-20
**Input agents:** 7 (technical-feasibility, scope-complexity, user-value, cost-benefit, architecture-impact, edge-cases, competitive-context)

---

## Overall Verdict: MODIFY

Phase 4 is the right plan doing the right work — but it is attempting to do 20 weeks of work in a 14-week window, and it bundles two distinct product goals that should be separated. The core operational features (corporate accounts, events, employee payroll, merch/shipping, SMS) are high-value, technically sound, and should proceed. The SaaS onboarding wizard and Stripe Billing integration should be separated into Phase 4B, to be built when the first external studio customer is ready to onboard.

Additionally, there are five implementation problems in the current plan that will cause build failures or schema conflicts if not corrected before Sprint 1 begins.

---

## Verdict by Feature Area

| Feature | Verdict | Rationale |
|---|---|---|
| Corporate Accounts + Invoicing | GO | High ROI, solves active pain, no competitor does this |
| Event Management | GO | Closes the B2B revenue loop, strong conversion tracking value |
| Employee Payroll + Documents | GO | Closes Phase 1 mock data, genuine operational pain |
| Geofence Enhancement | GO (partial) | Already ~70% implemented; finish the settings UI |
| Merch + Shipping | GO | Low-risk, fills existing gap |
| SMS/Twilio | GO | Drop-in replacement, 2–3 days of work |
| API Keys + OpenAPI Docs | GO | Needed as SaaS foundation, low complexity |
| SaaS Onboarding Wizard | DEFER | No real customer yet; wait for pilot feedback |
| Stripe Billing for SaaS | DEFER | Depends on onboarding; premature |
| Custom Dashboard Builder | DEFER | Low value for current user, high cost |

---

## Required Changes Before Development Begins

### Must-Fix (Sprint 1 Blockers)

1. **Schema audit first.** Run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('clock_entries', 'time_entries', 'geofence_locations')` against the live Supabase database before finalizing the migration. The plan has a table name conflict (clock_entries vs time_entries) and may attempt to CREATE TABLE geofence_locations when it already exists.

2. **Add IF NOT EXISTS to all CREATE TABLE statements** in the Phase 4 migration to make it safe to re-run.

3. **Update packages/types/src/employees.ts** to match Phase 4 schema: add 'w9' and 'direct_deposit' to document_type; change DocumentStatus to match the new schema values ('pending' | 'approved' | 'rejected' | 'expired').

4. **Decide and document 5 edge case policies** (see edge-cases report: EC-1 through EC-5) — corporate credit expiry, event/class conflict handling, payroll dispute workflow, duplicate event inquiry, multi-company member billing. Add as EC-19 through EC-23 in edge-case-policies.md.

### Should-Fix (Sprint-Level Concerns)

5. **Remove profiles.company_id FK.** Use company_members join table exclusively. The FK creates denormalization that will break for multi-company members.

6. **Unify Stripe webhook handling** — add `metadata.subscription_type: 'saas'` to SaaS subscriptions and route within the single existing webhook handler rather than creating a second endpoint.

7. **Replace next-swagger-doc with static OpenAPI YAML** — next-swagger-doc is Pages Router-only; this is an App Router project.

8. **Replace react-grid-layout with @dnd-kit** for the dashboard builder — @dnd-kit is already installed, react-grid-layout has React 19 compat issues, and adding a second DnD library creates unnecessary duplication.

9. **Route payroll calculation through Inngest** — the POST /api/payroll/periods/[id]/calculate may timeout on Netlify's 10s default for large studios.

10. **Add geofence_clock_out_location_id column** to clock entries for proper multi-location future support (one extra column now vs a migration later).

### Scope Decisions

11. **Cut SaaS Onboarding (Sprint 5) from Phase 4.** This alone saves 4–6 weeks. The Sauna Guys does not need it. Build it as Phase 4B when the first external customer is ready to sign up.

12. **Cut Custom Dashboard Builder from Sprint 6.** The existing Phase 3 analytics dashboards are comprehensive. This can be Phase 5 or later.

13. **Specify product variant handling** — either explicitly scope it in, or call it out as "MVP: no variants, single SKU per product."

---

## Revised Phase Structure

**Phase 4A (12–14 weeks):** Corporate & Operations Core
- Sprint 1: Corporate Foundation (2.5 weeks)
- Sprint 2: Events & Invoicing (3 weeks)
- Sprint 3: Employee Enhancements (3 weeks)
- Sprint 4: Merch & Shipping (3 weeks)
- Sprint 5: SMS + API Keys + OpenAPI Docs (2 weeks)
- Sprint 6: Polish + Integration (1.5 weeks)

**Phase 4B (6–8 weeks, when first external customer exists):** SaaS Platform
- SaaS subscription billing
- Onboarding wizard
- Glofox import tooling
- Custom dashboard builder

---

## Assumptions to Validate

1. The geofence_locations table already exists in production — verify before running the migration
2. The clock API table is named time_entries (not clock_entries) — verify against live Supabase schema
3. Corporate credit rollover policy is acceptable to The Sauna Guys (currently unspecified)
4. Product variant support is not needed for Phase 4 (single SKU per product is sufficient)
5. Florida payroll uses federal overtime rules only (no daily overtime) — currently assumed, needs confirmation
6. The Sauna Guys wants to use the same Stripe account for SaaS billing and studio payments — this is assumed; separate accounts may be preferable
