# Normalized Plan: Meridian Phase 4 — Corporate & Operations

**Scrutiny Date:** 2026-03-20
**Complexity Class:** SIGNIFICANT (Deep mode — all 7 agents)
**Source:** /Users/zach/Desktop/literal-fishstick/docs/phase-4-plan.md

---

## What Is Being Proposed

Phase 4 transforms Meridian from a single-studio internal tool into a commercially sellable SaaS product. It adds six major capability areas to a Next.js 16 / Supabase / Turborepo monorepo that has already completed Phases 1–3.

### Proposed Capabilities

1. **Corporate Accounts & Invoicing** — Company accounts with contact/billing info, linked member employees, B2B invoice generation (draft → sent → paid), PDF export, net-30/60 payment terms, monthly credit allocations. 3 new tables, 12 new API routes, 3 new UI pages.

2. **Event Management** — Request-based flow (inquiry → quoted → confirmed → deposit_paid → completed → invoiced → paid). Supports corporate wellness, private parties, birthdays, workshops. Guest list with RSVP tracking, conversion attribution. 2 new tables, 10 new API routes, 2 new UI pages.

3. **Employee Portal Enhancements** — Real payroll period calculation (from clock entries + class bonuses + promo commissions), CSV/PDF export for external payroll. Employee document management (W4/W9/I9/W2/1099 via Supabase Storage). Geofence enforcement on clock-in/out via browser Geolocation API (150m radius, configurable). 4 new tables, 10 new API routes, 4 updated UI pages.

4. **Merchandise & Shipping** — Full product CRUD admin UI (types/DB already exist), order management, EasyPost integration for shipping labels (USPS/UPS/FedEx rate shopping), tracking webhooks, Inngest polling. 1 new table (shipping_labels), 12 new API routes, 3 new UI pages.

5. **SMS via Twilio** — Fulfill existing provider-agnostic stub (StubProvider). TwilioProvider implements SMSProvider interface. Delivery receipt webhooks. 2 new API routes, 1 settings page update.

6. **SaaS Onboarding & Billing** — Multi-step onboarding wizard (studio info → billing → branding → import → invite team → first class). Stripe Billing for SaaS subscription (starter/growth/enterprise, separate from studio payment processing). API key management (SHA-256 hashed, scoped). OpenAPI spec via next-swagger-doc + swagger-ui-react. 3 new tables, 14 new API routes, 3 new UI pages.

7. **Custom Dashboard Builder** — Deferred from Phase 3, included in Sprint 6. react-grid-layout or @hello-pangea/dnd.

### What Is Explicitly Out of Scope

- IRS tax filing (documents are upload/management only)
- Full payroll processing (aggregate + export to Gusto/ADP, not end-to-end payroll)
- Native app geofencing (web browser Geolocation API only)
- Phase 5 member-facing surfaces

---

## Existing System Context

**Tech Stack:**
- Next.js 16.2.0 with App Router, React 19.2.4
- Supabase (Postgres + Auth + RLS with studio_id isolation on every table)
- Turborepo monorepo: apps/web (Next.js), packages/types, packages/supabase, packages/utils
- Stripe v20.4.1 (direct, not Connect) already handling subscriptions, proration, webhooks
- Resend v6.9.4 — transactional + campaign email with click/open tracking
- Inngest v4.0.2 — async job infrastructure already in place
- Anthropic SDK v0.80.0 (Claude Sonnet 4.6) — 10 AI features already shipped
- Hosted on Netlify (NOT Vercel — relevant for serverless function limits)

**Already Exists That Phase 4 Builds On:**
- 109 API routes across 22 categories
- Employee types (ClockEntry, TimesheetPeriod, EmployeeDocument, TimeOffRequest) fully typed
- Clock in/out API already has Haversine distance calculation AND geofence_locations table queries — geofencing is substantially already implemented
- Employee portal: 8 pages (dashboard, classes, schedule, pay, performance, profile, promo, timesheets)
- Merch types fully typed (Product, Order, OrderItem, InventoryHold, ShippingAddress) + DB schema exists
- SMS stub (StubProvider with full SMSProvider interface) — drop-in replacement pattern ready
- Stripe webhook handler already routing subscription events
- Activity logging across all routes
- RLS pattern: studio_id = current_setting('app.studio_id')::uuid used uniformly
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities already installed

**Critical Findings from Codebase Scan:**

FINDING 1 — Geofencing Already Partially Implemented:
The existing /api/clock/route.ts already implements Haversine distance calculation, queries geofence_locations table (latitude, longitude, radius_meters), sets geofence_verified_in/out on clock entries, stores lat/lng on clock. The Phase 4 plan treats geofencing as a new feature requiring a new geofence_locations table, but this table and logic already exist. Sprint 3 scope is overstated.

FINDING 2 — Table Name Discrepancy:
The clock API references the table as "time_entries" (columns: clock_in, clock_out, clock_in_lat, clock_in_lng), but Phase 4 migration proposes modifying "clock_entries" (columns: geofence_location_id, distance_from_studio). These appear to be different table names for the same concept — either the plan is working against the wrong schema, or the types package references a different table than what the API actually uses.

FINDING 3 — Type/Schema Discrepancy on EmployeeDocument:
packages/types/src/employees.ts has DocumentStatus as 'current' | 'expiring_soon' | 'expired' | 'missing', but Phase 4 DB schema proposes 'pending' | 'approved' | 'rejected' | 'expired'. The types also lack 'w9' and 'direct_deposit' document types present in the new schema.

FINDING 4 — DnD Library Duplication:
@dnd-kit is already installed. Adding react-grid-layout creates a second drag-and-drop dependency. The custom dashboard builder should use @dnd-kit to stay consistent.

FINDING 5 — Stripe Webhook Complexity:
The plan proposes a second Stripe webhook handler (/api/webhooks/stripe-saas) for SaaS billing alongside the existing /api/webhooks/stripe for studio payment processing. Using the same Stripe account with different product configurations requires careful webhook routing to avoid event conflicts.

---

## Estimated Scope

- **Timeline:** 12–14 weeks, 6 sprints, single developer
- **New tables:** 13
- **New/modified API routes:** ~67
- **New UI pages:** 16
- **New npm packages:** 5
- **New Inngest functions:** 6
- **New env variables:** 6+
