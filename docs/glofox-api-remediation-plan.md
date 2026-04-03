# Glofox API Integration — Gap Remediation Plan

> Generated: 2026-04-01
> Status: ACTIVE — Implementation in progress

## Summary

A comprehensive API audit (1,914 URL combinations probed + official OpenAPI spec review) revealed our Glofox integration was missing **40+ endpoints** out of 50 officially documented + additional undocumented but functional endpoints. The existing integration was read-only and covered only 10 GET endpoints. This plan adds all missing endpoints, write-back capabilities, and cascading changes to schema, UI, data flow, AI layer, and business logic.

## Deferred Items (User Will Revisit)

- **Emily Drennen promo code** — Create `EMILY60` (same $29 off 2-week trial)
- **Active member criteria** — Define what "active" means (only ~7 of 490 Glofox "active" accounts have paid subscriptions)
- **Member subscription backfill** — 480 members with NULL plan_code need Glofox subscription data mapped

---

## Current State (Pre-Remediation)

### In Our Client (10 endpoints):
| Method | Endpoint | Client Method |
|--------|----------|---------------|
| GET | `2.0/members` | `getMembers()` |
| GET | `2.0/members/{userId}` | `getMember()` |
| GET | `2.0/staff` | `getStaff()` |
| GET | `2.0/events` | `getEvents()` |
| GET | `2.2/branches/{id}/bookings` | `getBookings()` |
| POST | `Analytics/report` | `getTransactions()` |
| GET | `2.0/memberships` | `getMemberships()` |
| GET | `2.0/credits` | `getCredits()` |
| GET | `TermsConditions/view` | `getWaivers()` |
| GET | `2.2/branches/{id}/discounts` | `getDiscounts()` |

Plus: `getLeads()`, `getProducts()`, `getUserAgreements()`, `getLinkedAccounts()`, `getTrainerPerformance()`

### Missing from Official OpenAPI Spec (50 endpoints total):

**Write operations (NONE existed):**
- Booking create/cancel
- Attendance marking (check-in)
- Member registration/update
- Membership purchase/cancel
- Agreement sending
- Interaction/note creation
- Profile image upload
- Access record creation

**Read endpoints missing:**
- Programs, facilities, branches, categories
- Appointments + availability
- Payment methods, taxes
- Invoices, charges
- Lead contact/marketing sources
- Member search by email
- Agreement templates
- Price breakdown calculator
- Pre-checkout cart
- Analytics (members, revenue, bookings)

### Discovered via Brute-Force (not in official docs):
- `GET 2.2/branches/{id}/taxes` — Tax config (4.25% "Fees & Tax")
- `GET 2.0/programs` — "Open Sauna" + "Guided Breathwork" with pricing
- `GET 2.0/facilities` — Physical location + online facility
- `GET 2.0/invoices` — Historical invoices (Nov 2023+)
- `GET 2.0/branches` — Full branch data with address/timezone
- `GET 2.0/integrations` — 6 integrations (ClassPass is active!)
- `GET 2.0/categories` — Program categories
- `GET/POST Analytics/members` — Rich member analytics
- `GET/POST Analytics/revenue` — Revenue by payment type
- `GET/POST Analytics/bookings` — Booking analytics (requires `by` param)
- `GET 2.0/analytics/revenue` — Revenue reports
- `GET 2.0/analytics/bookings` — Booking reports

### Key Business Findings:
- **ClassPass integration is active** — Bookings may come from ClassPass
- **Tax rate: 4.25%** ("Fees & Tax")
- **`discount_ids` and `promo_code` are mutually exclusive** in price-breakdown
- **Attendance endpoint exists** (`POST 2.0/attendances`) — critical for trainer bonus accuracy
- **Programs are data, not hardcoded** — Currently hardcoded as `CLASS_TYPE_MAP` UUIDs in 3 files

---

## Implementation Phases

### Phase 1: Attendance Marking + Check-In Sync (CRITICAL, Effort: M)

**Why first:** Trainer bonuses are calculated from check-in counts. Without `POST 2.0/attendances`, check-ins in Meridian are invisible to Glofox, creating data drift that affects payroll accuracy.

**Changes:**
- **types.ts** — Add `GlofoxAttendanceRequest`, `GlofoxAttendanceResponse`, `GlofoxStaffSingle`
- **client.ts** — Add `markAttendance()`, `getStaffMember()`
- **check-in/route.ts** — After Supabase booking update, fire-and-forget `markAttendance()` with `glofox_id`
- **New: inngest/functions/glofox-write-attendance.ts** — Async attendance write-back via Inngest
- **inngest/client.ts** — Add `'glofox/mark-attendance'` event type
- **inngest/functions/index.ts** — Register new function

**Pattern:** Supabase first (source of truth) > Glofox write-back async > Log failures to `glofox_sync_conflicts`

---

### Phase 2: Booking Create + Cancel Write-Back (CRITICAL, Effort: L)

**Why:** Bookings in Meridian don't exist in Glofox without this. Members see different data.

**Changes:**
- **types.ts** — Add `GlofoxBookingCreateRequest`, `GlofoxBookingCancelRequest`, `GlofoxBookingPriceResponse`
- **client.ts** — Add `createBooking()` (v2.3 with impersonation), `cancelBooking()`, `getBookingPrice()`
- **bookings/route.ts** — After Supabase insert, write to Glofox, store returned `glofox_id`
- **bookings/[id]/cancel/route.ts** — After Supabase cancel, cancel in Glofox
- **Schema migration** — Add `glofox_write_status`, `glofox_write_error` columns to `bookings`

**Risk:** Race condition on hourly sync re-importing. Mitigated by storing `glofox_id` immediately after Glofox create.

---

### Phase 3: Price Calculator + Discount Integration (HIGH, Effort: M)

**Why:** Checkout flow needs accurate pricing with tax and discounts.

**Changes:**
- **types.ts** — Add `GlofoxPriceBreakdownRequest/Response`, `GlofoxTaxConfig`
- **client.ts** — Add `calculatePriceBreakdown()`, `calculateEventPrice()`, `calculateAppointmentPrice()`, `calculateFacilityPrice()`, `calculateCoursePrice()`, `getTaxConfig()`, `preCheckout()`
- **Schema migration** — Create `tax_configurations` table; add `tax_amount`, `discount_id`, `promo_code` to `transactions`
- **New: api/pricing/route.ts** — Price calculation API route
- **validation.ts** — Enforce `discount_ids` / `promo_code` mutual exclusivity

---

### Phase 4: Programs, Facilities, Branches + Reference Data (HIGH, Effort: M)

**Why:** Programs ("Open Sauna", "Guided Breathwork") are hardcoded as `CLASS_TYPE_MAP` UUIDs in 3 sync files. Facilities and branches needed for multi-location.

**Changes:**
- **types.ts** — Add `GlofoxProgram`, `GlofoxFacility`, `GlofoxBranch`, `GlofoxCategory`, `GlofoxIntegration`, `GlofoxCourse`
- **client.ts** — Add `getPrograms()`, `getFacilities()`, `getBranches()`, `getCategories()`, `getIntegrations()`, `getCourses()`
- **transformers.ts** — Add `transformProgram()`, `transformFacility()`
- **Schema migration** — Create `programs`, `facilities`, `integrations` tables; add `program_id`, `facility_id` to `classes`
- **All 3 sync files** — Replace hardcoded `CLASS_TYPE_MAP` with dynamic program lookup
- **Data migration** — Map existing `class_type_id` to new `program_id`

**Breaking Change:** `class_type_id` FK shifts to `program_id` FK.

---

### Phase 5: Member Write Operations + Search (HIGH, Effort: M)

**Why:** Members registered in Meridian must exist in Glofox. Email search enables dedup.

**Changes:**
- **types.ts** — Add register, update, search, password reset types
- **client.ts** — Add `registerMember()`, `updateMember()`, `searchMembersByEmail()`, `uploadProfileImage()`, `requestPasswordReset()`
- **Schema** — Add `glofox_write_status` to `profiles`

---

### Phase 6: Membership Purchase + Cancel Write-Back (HIGH, Effort: L)

**Why:** Revenue path. Membership purchases in Meridian must create Glofox subscriptions.

**Changes:**
- **types.ts** — Add purchase, cancel, payment method types
- **client.ts** — Add `purchaseMembership()`, `finalizeFlexiblePurchase()`, `cancelMembership()`, `getPaymentMethods()`
- **Schema** — Add `glofox_charge_id` to `transactions`, `glofox_membership_id` to `members`
- **Stripe webhook route** — Trigger Glofox purchase/cancel on Stripe subscription events

---

### Phase 7: CRM / Interactions + Leads Enhancement (MEDIUM, Effort: S)

**Changes:**
- **client.ts** — Add `createInteraction()`, `getInteractions()`, `getContactSources()`, `getMarketingSources()`
- **Schema** — Create `lead_interactions` table
- **Sync** — Backfill interactions for leads

---

### Phase 8: Agreements + Waivers Enhancement (MEDIUM, Effort: S)

**Changes:**
- **client.ts** — Add `sendAgreement()`, `getAgreementTemplate()`

---

### Phase 9: Appointments + Availability (MEDIUM, Effort: S)

**Changes:**
- **types.ts** — Add `GlofoxAppointment`, `GlofoxAppointmentAvailability`
- **client.ts** — Add `getAppointments()`, `getAppointmentAvailability()`
- **Schema** — Appointments table or `classes` with `type = 'appointment'`

---

### Phase 10: Analytics + Invoices (MEDIUM, Effort: S)

**Changes:**
- **client.ts** — Add `getMemberAnalytics()`, `getRevenueAnalytics()`, `getBookingAnalytics()`, `getInvoices()`, `createAccessRecord()`
- **Schema** — Create `invoices` table

---

### Phase 11: AI Layer Update (MEDIUM, Effort: S)

**File: anthropic.ts**
- Update `SCHEMA_CONTEXT` (line ~642) with new tables: `programs`, `facilities`, `tax_configurations`, `integrations`, `invoices`, `lead_interactions`, `appointments`
- Update NL search system prompt rules

---

### Phase 12: UI Sync Dashboard Enhancement (SMALL, Effort: S)

**File: DataSyncButton.tsx**
- Add new entity type labels
- Add write-back status indicators
- Per-entity sync buttons

**File: api/glofox/sync/route.ts**
- Update `VALID_ENTITY_TYPES` array

---

## Cross-Cutting Patterns

### Write-Back Pattern (All Write Phases)
1. Supabase operation first (Meridian = source of truth)
2. Glofox write-back async (via Inngest preferred)
3. Store `glofox_write_status` on entity
4. Log failures to `glofox_sync_conflicts`
5. Never block user-facing operation on Glofox availability

Extract into: `/apps/web/src/lib/glofox/write-back.ts`

### Sync Helper Dedup
`buildLookupMap`, `stripNulls`, `batchUpsert`, `emptyResult`, `SyncResult` are duplicated across 3 sync files. Extract to `/apps/web/src/lib/glofox/sync-helpers.ts`.

### Inngest Event Registry
Batch-add all write-back event types to `inngest/client.ts` in Phase 1.

---

## Official Glofox API Reference

- **Developer Portal:** https://apidocs-plat.aws.glofox.com/
- **OpenAPI Spec:** https://apidocs-plat.aws.glofox.com/openapi.yaml
- **Base URL:** `https://gf-api.aws.glofox.com/prod/`
- **Auth:** `x-glofox-api-token`, `x-api-key`, `x-glofox-branch-id`
- **Rate Limits:** 10 req/sec (live), 3 req/sec (sandbox), burst: 1000/300
- **Support:** glofox.APISupport@abcfitness.com

## Branch / Credentials

- **Branch ID:** `654e7d37c8a12ada310de13a`
- **Namespace:** `thesaunaguys`
- **Studio ID (Meridian):** `11111111-1111-1111-1111-111111111111`
- **Credentials:** `.env.local` (GLOFOX_API_KEY, GLOFOX_API_TOKEN, GLOFOX_BRANCH_ID)
