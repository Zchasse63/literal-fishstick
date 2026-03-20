# Technical Feasibility Analysis — Phase 4: Corporate & Operations

**Agent:** technical-feasibility
**Plan:** Meridian Phase 4
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

The plan is technically executable by a competent solo developer, but contains five concrete implementation problems that will cause build failures, schema conflicts, or production incidents if not corrected before development begins. None are individual blockers, but collectively they represent 2–3 weeks of unplanned rework if discovered mid-sprint. The schema must be audited against the live Supabase database before the migration is finalized.

---

## Confidence Level

High — based on direct inspection of existing route handlers, type definitions, and the proposed migration SQL.

---

## Findings

### CRITICAL: Geofencing Is Already Implemented — Migration Will Fail

Direct inspection of `/api/clock/route.ts` shows the geofence_locations table already exists and is actively queried. The existing clock API performs Haversine distance calculation, queries `geofence_locations` (latitude, longitude, radius_meters, is_active), sets `geofence_verified_in`/`geofence_verified_out` on clock entries, and stores lat/lng coordinates on clock records. The `ClockEntry` type in `packages/types/src/employees.ts` already has `geofence_verified_in`, `geofence_verified_out`, `latitude_in`, `longitude_in` fields confirming the types were written expecting this to exist.

The Phase 4 migration runs `CREATE TABLE geofence_locations` without `IF NOT EXISTS`. This will throw "relation already exists" and abort the transaction. The plan must remove this CREATE TABLE entirely, or wrap it in a `DO $$ BEGIN IF NOT EXISTS... END $$` block.

Additionally, the plan's Sprint 3 framing ("Geofence API + settings UI") implies building geofencing from scratch. The actual remaining work is: (a) a settings UI to configure geofence zones, and (b) verifying the existing clock API is wired correctly. Sprint 3 is likely 1 week shorter than estimated.

### CRITICAL: Table Name Discrepancy — clock_entries vs time_entries

The Phase 4 migration targets `clock_entries`:
```sql
ALTER TABLE clock_entries ADD COLUMN IF NOT EXISTS geofence_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE clock_entries ADD COLUMN IF NOT EXISTS geofence_location_id UUID REFERENCES geofence_locations(id);
```

The existing `/api/clock/route.ts` reads/writes to a table called `time_entries` with columns `clock_in`, `clock_out`, `clock_in_lat`, `clock_in_lng`, `clock_out_lat`, `clock_out_lng`, `hours_worked`. The `ClockEntry` type in the types package uses the name `ClockEntry` but its fields (`geofence_verified_in`, not `geofence_verified`) suggest it was written against a third schema version.

The payroll calculation engine in Sprint 3 joins clock data to compute hours. If it queries `clock_entries` but the data lives in `time_entries`, it will return zero rows and produce incorrect payroll. This must be resolved before Sprint 3 begins.

**Required action:** Run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('clock_entries', 'time_entries')` against the live Supabase instance and canonicalize the name throughout the plan and types.

### HIGH: EmployeeDocument Type/Status Mismatch

`packages/types/src/employees.ts` defines DocumentStatus as `'current' | 'expiring_soon' | 'expired' | 'missing'` but the Phase 4 schema defines status CHECK as `('pending', 'approved', 'rejected', 'expired')`. The type also lacks `'w9'` and `'direct_deposit'` document_type values that appear in the new schema.

When Phase 4 document API routes read rows from the new `employee_documents` table and the frontend maps them to the existing TypeScript type, two of the four possible status values ('pending', 'approved', 'rejected') are not in the type definition. UI components handling document status will need to handle unknown values or will display incorrect states. TypeScript compilation will not catch this if responses are typed as generic Supabase query results.

**Required action:** Update `packages/types/src/employees.ts` before Sprint 3 begins. Add the new status enum values and the missing document types.

### MEDIUM: Dual Stripe Webhook Handlers — Event Routing Risk

The plan introduces `/api/webhooks/stripe-saas` alongside the existing `/api/webhooks/stripe`. If both use the same Stripe account (implied by env var naming — only separate price IDs, no separate account), Stripe fires all account events to all registered webhook endpoints. A `customer.subscription.updated` event from a SaaS billing action will hit both handlers.

The existing handler guards on `subscription.metadata?.meridian_member_id`. SaaS subscriptions won't have this field, so events will be silently skipped — acceptable. However, the reverse (SaaS handler receiving member subscription events) needs the same guard. If the SaaS webhook handler routes on `event.type` without also checking `metadata.subscription_type`, it could incorrectly interpret a member subscription renewal as a SaaS plan change.

**Required action:** Add `metadata.subscription_type: 'saas'` to all SaaS Stripe subscriptions at creation time. Guard the SaaS webhook handler to only process events where `metadata.subscription_type === 'saas'`.

### MEDIUM: next-swagger-doc Incompatibility with Next.js 16 App Router

`next-swagger-doc` uses JSDoc annotations on Pages Router API routes (`/pages/api/*`) and `getStaticProps` to generate the spec. This project is pure App Router. Using `next-swagger-doc` would require creating at least one Pages Router API route, introducing a hybrid routing setup into an otherwise clean App Router codebase.

**Recommended fix:** Write a static `openapi.yaml` manually or generate it programmatically once, serve it from `GET /api/docs/spec`, and render it with `swagger-ui-react` at `/docs/api`. This is simpler, avoids the Pages Router contamination, and produces a spec that is checkable into version control and diffable.

### MEDIUM: react-grid-layout / @hello-pangea/dnd vs Existing @dnd-kit

The project already has `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` installed. Adding `react-grid-layout` introduces a second drag-and-drop system. The plan's own risk register flags react-grid-layout React 19 compatibility as "medium likelihood." @dnd-kit already supports React 19. @dnd-kit/sortable with CSS grid can implement a dashboard builder without a new dependency.

**Recommended fix:** Use @dnd-kit for the custom dashboard builder. Remove `react-grid-layout` from the planned dependencies.

### LOW: Payroll Calculation Should Route Through Inngest

`POST /api/payroll/periods/[id]/calculate` needs to aggregate all clock entries for the period, join class data for trainer bonuses, join promo conversions for commissions, and write payroll line items. Netlify serverless functions default to a 10-second timeout. For a studio with 10+ employees over a 2-week period, this could process hundreds of rows with multiple joins and may approach the limit under load.

**Recommended fix:** The endpoint should enqueue an Inngest job and return a job ID. The frontend polls for completion. This pattern is already established in the codebase.

### LOW: EasyPost SDK Node.js Version

`@easypost/api` v7 requires Node.js 18+. Netlify's default is 18.x but this should be confirmed in `netlify.toml` before Sprint 4.

---

## What Is Technically Sound

The overall architecture is solid. The incremental approach (schema first, then API routes, then UI) is correct. The SMS factory pattern is a well-designed abstraction — TwilioProvider will be a 50-line drop-in. The corporate invoice JSONB line_items approach is pragmatic and appropriate for Supabase. API key SHA-256 hashing with prefix display is the correct security pattern. Inngest cron jobs for payroll reminder, invoice overdue, and contract expiry are well-scoped.

---

## Pre-Development Checklist

- [ ] Run schema audit: verify exact table names for clock/geofence tables in live Supabase
- [ ] Add IF NOT EXISTS to all CREATE TABLE statements in migration
- [ ] Remove CREATE TABLE geofence_locations (already exists)
- [ ] Update packages/types/src/employees.ts with Phase 4 schema values
- [ ] Add subscription_type metadata guard to both Stripe webhook handlers
- [ ] Replace next-swagger-doc with static OpenAPI YAML approach
- [ ] Replace react-grid-layout with @dnd-kit for dashboard builder
- [ ] Route payroll calculation through Inngest
- [ ] Confirm Node.js version in netlify.toml
