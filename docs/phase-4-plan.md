# Phase 4: Corporate & Operations — Implementation Plan

**Version:** 2.0 FINAL (Post-Scrutiny)
**Date:** March 20, 2026
**Status:** APPROVED — Ready for implementation

---

## 1. Executive Summary

Phase 4 adds the Corporate module (company accounts, event management, group/party bookings), enhances the employee portal (payroll processing, tax documentation, geofencing for clock in/out), builds merchandise shipping infrastructure, publishes OpenAPI documentation, and fulfills the SMS stub with Twilio integration. This phase completes the admin dashboard as a full business operating system.

**Build order:** Database schema → Corporate API routes → Events API routes → Employee portal enhancements → Merch shipping → SMS integration → API documentation → Admin polish.

**Estimated scope:** ~15 weeks for a single developer, broken into 6 sprints built sequentially.

**Key architectural decisions:**
- **Corporate accounts as first-class entities** — separate from individual members, with company billing, employee member linking, and dedicated event booking flow
- **Events as request-based flow** — corporate clients request events, studio confirms/prices/invoices (not instant booking)
- **Geofencing via browser Geolocation API** — no native app dependency; 150m radius around studio coordinates, configurable per location
- **Payroll as data aggregation + export** — not a full payroll processor. Calculate hours/bonuses/commissions from clock entries + class data, export to CSV/PDF for external payroll (Gusto, ADP, etc.)
- **Tax documents as upload/management** — W4/W9 collection, W2/1099 storage. Not IRS filing. Staff upload, admin manages.
- **Merch shipping via EasyPost API** — rate shopping across USPS/UPS/FedEx, label generation, tracking webhook updates. Start with USPS only, add carriers incrementally.
- **SMS provider integration (Twilio)** — fulfill the Phase 2 stub. Provider-agnostic factory already exists.
- **OpenAPI spec as static YAML** — not `next-swagger-doc` (only works with Pages Router). Serve via GET route, render with `swagger-ui-react` (dynamically imported to avoid 4MB bundle bloat).
- **No `profiles.company_id` column** — members can belong to multiple companies via `company_members` junction table
- **Single Stripe webhook handler** — route SaaS events via `metadata.subscription_type`, not a separate endpoint

**Post-scrutiny changes (v2.0):**
- ❌ Deferred: SaaS onboarding wizard, Stripe Billing for SaaS, subscription management → `docs/future-plans.md`
- ❌ Deferred: Custom dashboard builder (react-grid-layout) → `docs/future-plans.md`
- ❌ Deferred: API key management → `docs/future-plans.md`
- 🔧 Fix: Removed `profiles.company_id` ALTER — use `company_members` junction table instead
- 🔧 Fix: Schema verified against live DB — `clock_entries` confirmed (not `time_entries`), `geofence_locations` doesn't exist yet, `orders` already has `fulfillment_type`/`shipping_address`
- 🔧 Fix: `next-swagger-doc` → static `openapi.yaml` (App Router compatible)
- 🔧 Fix: Existing clock API bug — `api/clock/route.ts` references `time_entries` but DB table is `clock_entries`
- 🔧 Add: 5 new edge case policies (EC-19 through EC-23) for corporate operations
- 🔧 Add: EmployeeDocument types updated to include `w9` and `direct_deposit`

---

## 2. What Already Exists (Phase 1–3 Foundation)

| Component | Status | Location |
|---|---|---|
| Employee types (ClockEntry, TimesheetPeriod, EmployeeDocument, TimeOffRequest) | ✅ Complete | `packages/types/src/employees.ts` |
| Operations page (staff directory, payroll tab, permissions) | ✅ Complete | `(admin)/operations/page.tsx` |
| Employee portal (8 pages: dashboard, classes, schedule, pay, performance, profile, promo, timesheets) | ✅ Complete | `(employee)/employee/*` |
| Clock in/out API | ✅ Complete (bug: uses `time_entries` instead of `clock_entries`) | `api/clock/route.ts` |
| Staff CRUD API | ✅ Complete | `api/staff/route.ts`, `api/staff/[id]/route.ts` |
| Merch types (Product, Order, OrderItem, InventoryHold, ShippingAddress) | ✅ Complete | `packages/types/src/merch.ts` |
| Merch DB schema (products, orders, order_items tables) | ✅ Complete | Supabase — `orders` already has `fulfillment_type`, `shipping_address` |
| SMS stub (provider-agnostic factory, StubProvider) | ✅ Complete | `src/lib/sms/` |
| Inngest infrastructure (client, event types, serve endpoint) | ✅ Complete | `src/lib/inngest/` |
| Stripe integration (payments, subscriptions, proration) | ✅ Complete | `src/lib/stripe.ts` |
| Supabase Auth (Magic Link, role-based) | ✅ Complete | `src/lib/supabase/` |
| Settings page (studio config) | ✅ Complete | `(admin)/settings/page.tsx` |
| Activity logging | ✅ Complete | Used across all API routes |
| 109 API routes across 22 categories | ✅ Complete | `api/*` |

**Known bug to fix in Sprint 1:** `api/clock/route.ts` queries `time_entries` (lines 140, 155, 197, 219) but the actual DB table is `clock_entries`. Fix during geofence enhancement.

**Gap analysis:** No corporate account tables or APIs. No event management. No merch API routes (types and DB exist but no routes or admin UI). Employee portal has no geofence verification on clock actions. Payroll tab shows mock data — no real aggregation from clock entries. No tax document upload/management. No API documentation. SMS is stubbed only.

---

## 3. Database Schema (New Tables & Modifications)

### 3.1 New Tables

```sql
-- ============================================================================
-- Meridian Phase 4: Corporate & Operations — Database Migration
-- ============================================================================

BEGIN;

-- ==========================================
-- CORPORATE ACCOUNTS
-- ==========================================
CREATE TABLE IF NOT EXISTS company_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT, -- EIN for invoicing
  industry TEXT,
  company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '500+')),

  -- Primary contact
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  contact_title TEXT,

  -- Billing
  billing_email TEXT,
  billing_address JSONB, -- { line1, line2, city, state, zip, country }
  stripe_customer_id TEXT,
  payment_terms TEXT DEFAULT 'net_30' CHECK (payment_terms IN ('immediate', 'net_15', 'net_30', 'net_60')),

  -- Contract
  contract_start DATE,
  contract_end DATE,
  contract_value NUMERIC(10,2),
  monthly_credit_allocation INT DEFAULT 0,
  credits_remaining INT DEFAULT 0,
  credit_rollover_cap INT, -- NULL = no cap, else max rollover (e.g., 2x monthly allocation)
  auto_renew BOOLEAN DEFAULT FALSE,

  -- Status
  status TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'paused', 'churned')),

  -- Metadata
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CORPORATE MEMBERS (link company → member profiles)
-- Many-to-many: a member can belong to multiple companies
-- ==========================================
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_accounts(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id),
  studio_id UUID NOT NULL REFERENCES studios(id),
  role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
  is_active BOOLEAN DEFAULT TRUE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE(company_id, member_id)
);

-- ==========================================
-- EVENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),

  -- Event details
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('corporate_wellness', 'private_party', 'team_building', 'birthday', 'bachelor_bachelorette', 'community', 'workshop', 'custom')),

  -- Scheduling
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  setup_time_minutes INT DEFAULT 30,
  cleanup_time_minutes INT DEFAULT 30,

  -- Capacity
  min_guests INT DEFAULT 1,
  max_guests INT,
  expected_guests INT,
  actual_guests INT,

  -- Pricing
  base_price NUMERIC(10,2),
  per_person_price NUMERIC(10,2),
  total_price NUMERIC(10,2),
  deposit_amount NUMERIC(10,2),
  deposit_paid BOOLEAN DEFAULT FALSE,

  -- Corporate link (optional — not all events are corporate)
  company_id UUID REFERENCES company_accounts(id),

  -- Booking contact (for non-corporate events)
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Status flow: inquiry → quoted → confirmed → deposit_paid → completed → invoiced → paid
  status TEXT NOT NULL DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'quoted', 'confirmed', 'deposit_paid', 'in_progress', 'completed', 'invoiced', 'paid', 'cancelled')),

  -- Logistics
  special_requests TEXT,
  internal_notes TEXT,
  assigned_staff UUID[] DEFAULT '{}',
  resources_reserved JSONB DEFAULT '[]',

  -- Invoicing
  invoice_id UUID,
  stripe_payment_intent_id TEXT,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- EVENT GUESTS (track RSVPs and attendance)
-- ==========================================
CREATE TABLE IF NOT EXISTS event_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL REFERENCES studios(id),

  member_id UUID REFERENCES profiles(id),
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,

  rsvp_status TEXT DEFAULT 'invited' CHECK (rsvp_status IN ('invited', 'confirmed', 'declined', 'waitlisted', 'attended', 'no_show')),
  rsvp_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,

  converted_to_member BOOLEAN DEFAULT FALSE,
  conversion_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CORPORATE INVOICES
-- ==========================================
CREATE TABLE IF NOT EXISTS corporate_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  company_id UUID NOT NULL REFERENCES company_accounts(id),

  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'void', 'refunded')),

  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,4) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) DEFAULT 0,

  line_items JSONB NOT NULL DEFAULT '[]',

  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  paid_date DATE,

  payment_method TEXT,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,

  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  notes TEXT,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- EMPLOYEE DOCUMENTS (tax forms, contracts)
-- ==========================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  employee_id UUID NOT NULL REFERENCES profiles(id),

  document_type TEXT NOT NULL CHECK (document_type IN ('w4', 'w9', 'i9', 'w2', '1099', 'contract', 'certification', 'direct_deposit', 'other')),
  name TEXT NOT NULL,
  description TEXT,

  file_url TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,

  tax_year INT,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PAYROLL PERIODS (aggregated from clock entries)
-- ==========================================
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'processing', 'approved', 'reopened', 'exported', 'paid')),

  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES profiles(id),
  reopened_at TIMESTAMPTZ,
  reopen_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(studio_id, period_start, period_end)
);

-- ==========================================
-- PAYROLL LINE ITEMS (per employee per period)
-- ==========================================
CREATE TABLE IF NOT EXISTS payroll_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id),
  studio_id UUID NOT NULL REFERENCES studios(id),

  regular_hours NUMERIC(6,2) DEFAULT 0,
  overtime_hours NUMERIC(6,2) DEFAULT 0,

  hourly_rate NUMERIC(8,2),
  overtime_rate NUMERIC(8,2),

  base_pay NUMERIC(10,2) DEFAULT 0,
  overtime_pay NUMERIC(10,2) DEFAULT 0,
  trainer_bonuses NUMERIC(10,2) DEFAULT 0,
  promo_commissions NUMERIC(10,2) DEFAULT 0,
  tips NUMERIC(10,2) DEFAULT 0,
  other_earnings NUMERIC(10,2) DEFAULT 0,
  gross_pay NUMERIC(10,2) DEFAULT 0,

  federal_tax_estimate NUMERIC(10,2) DEFAULT 0,
  state_tax_estimate NUMERIC(10,2) DEFAULT 0,
  fica_estimate NUMERIC(10,2) DEFAULT 0,
  other_deductions NUMERIC(10,2) DEFAULT 0,
  net_pay_estimate NUMERIC(10,2) DEFAULT 0,

  classes_led INT DEFAULT 0,
  bonus_eligible_classes INT DEFAULT 0,
  promo_conversions INT DEFAULT 0,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(payroll_period_id, employee_id)
);

-- ==========================================
-- GEOFENCE LOCATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS geofence_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  name TEXT NOT NULL,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  radius_meters INT NOT NULL DEFAULT 150,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SHIPPING LABELS
-- ==========================================
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  studio_id UUID NOT NULL REFERENCES studios(id),

  easypost_shipment_id TEXT,
  easypost_rate_id TEXT,
  easypost_label_id TEXT,

  carrier TEXT NOT NULL,
  service TEXT NOT NULL,
  tracking_number TEXT,
  tracking_url TEXT,

  rate_amount NUMERIC(8,2),
  insurance_amount NUMERIC(8,2) DEFAULT 0,

  label_url TEXT,
  label_format TEXT DEFAULT 'pdf',

  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'purchased', 'in_transit', 'delivered', 'returned', 'failed')),

  from_address JSONB NOT NULL,
  to_address JSONB NOT NULL,

  tracking_events JSONB DEFAULT '[]',
  estimated_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
```

### 3.2 Modifications to Existing Tables

```sql
-- Add geofence location reference and distance to clock_entries
-- (geofence_verified_in/out, latitude_in/out already exist)
ALTER TABLE clock_entries ADD COLUMN IF NOT EXISTS geofence_location_id UUID REFERENCES geofence_locations(id);
ALTER TABLE clock_entries ADD COLUMN IF NOT EXISTS distance_from_studio NUMERIC(8,2);

-- Add shipping/tracking fields to orders
-- (fulfillment_type and shipping_address already exist)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(8,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- NOTE: No profiles.company_id column — use company_members junction table instead
-- (a member can belong to multiple companies)
```

### 3.3 Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_company_accounts_studio ON company_accounts(studio_id);
CREATE INDEX IF NOT EXISTS idx_company_accounts_status ON company_accounts(studio_id, status);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_member ON company_members(member_id);

CREATE INDEX IF NOT EXISTS idx_events_studio ON events(studio_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(studio_id, start_time);
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(studio_id, status);
CREATE INDEX IF NOT EXISTS idx_event_guests_event ON event_guests(event_id);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON corporate_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON corporate_invoices(studio_id, status);

CREATE INDEX IF NOT EXISTS idx_employee_docs_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_docs_type ON employee_documents(studio_id, document_type);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_studio ON payroll_periods(studio_id, period_start);
CREATE INDEX IF NOT EXISTS idx_payroll_items_period ON payroll_line_items(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON payroll_line_items(employee_id);

CREATE INDEX IF NOT EXISTS idx_shipping_labels_order ON shipping_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking ON shipping_labels(tracking_number);

CREATE INDEX IF NOT EXISTS idx_geofence_locations_studio ON geofence_locations(studio_id);
```

### 3.4 RLS Policies

```sql
ALTER TABLE company_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studio_isolation" ON company_accounts
  USING (studio_id = current_setting('app.studio_id')::uuid);
CREATE POLICY "studio_isolation" ON company_members
  USING (studio_id = current_setting('app.studio_id')::uuid);
CREATE POLICY "studio_isolation" ON events
  USING (studio_id = current_setting('app.studio_id')::uuid);
CREATE POLICY "studio_isolation" ON event_guests
  USING (studio_id = current_setting('app.studio_id')::uuid);
CREATE POLICY "studio_isolation" ON corporate_invoices
  USING (studio_id = current_setting('app.studio_id')::uuid);
CREATE POLICY "studio_isolation" ON employee_documents
  USING (studio_id = current_setting('app.studio_id')::uuid);
CREATE POLICY "studio_isolation" ON payroll_periods
  USING (studio_id = current_setting('app.studio_id')::uuid);
CREATE POLICY "studio_isolation" ON payroll_line_items
  USING (studio_id = current_setting('app.studio_id')::uuid);
CREATE POLICY "studio_isolation" ON geofence_locations
  USING (studio_id = current_setting('app.studio_id')::uuid);
CREATE POLICY "studio_isolation" ON shipping_labels
  USING (studio_id = current_setting('app.studio_id')::uuid);
```

---

## 4. API Routes

### 4.1 Corporate Routes (12 routes)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/corporate` | List company accounts (filterable by status, search) |
| POST | `/api/corporate` | Create company account |
| GET | `/api/corporate/[id]` | Get company detail with members, events, invoices |
| PUT | `/api/corporate/[id]` | Update company account |
| DELETE | `/api/corporate/[id]` | Soft-delete company account |
| GET | `/api/corporate/[id]/members` | List company members |
| POST | `/api/corporate/[id]/members` | Add member to company |
| DELETE | `/api/corporate/[id]/members/[mid]` | Remove member from company |
| GET | `/api/corporate/[id]/invoices` | List company invoices |
| POST | `/api/corporate/[id]/invoices` | Create invoice for company |
| POST | `/api/corporate/[id]/credits` | Allocate/adjust credits |
| GET | `/api/corporate/dashboard` | Corporate overview metrics |

### 4.2 Event Routes (10 routes)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/events` | List events (filterable by type, status, date range) |
| POST | `/api/events` | Create event / submit inquiry |
| GET | `/api/events/[id]` | Get event detail with guests |
| PUT | `/api/events/[id]` | Update event |
| DELETE | `/api/events/[id]` | Cancel/delete event |
| POST | `/api/events/[id]/quote` | Generate price quote |
| POST | `/api/events/[id]/confirm` | Confirm event (status → confirmed) |
| GET | `/api/events/[id]/guests` | List event guests |
| POST | `/api/events/[id]/guests` | Add guests (bulk) |
| PUT | `/api/events/[id]/guests/[gid]` | Update guest RSVP/check-in |

### 4.3 Invoice Routes (6 routes)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/invoices/[id]` | Get invoice detail |
| PUT | `/api/invoices/[id]` | Update invoice (draft only) |
| POST | `/api/invoices/[id]/send` | Send invoice via email (Resend) |
| POST | `/api/invoices/[id]/record-payment` | Record manual payment |
| POST | `/api/invoices/[id]/void` | Void an invoice |
| GET | `/api/invoices/[id]/pdf` | Generate invoice PDF |

### 4.4 Employee Portal Enhancement Routes (10 routes)

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/clock` | Enhanced: add geofence verification + fix `time_entries` → `clock_entries` bug |
| GET | `/api/payroll/periods` | List payroll periods |
| POST | `/api/payroll/periods` | Create new payroll period |
| GET | `/api/payroll/periods/[id]` | Get period with line items |
| POST | `/api/payroll/periods/[id]/calculate` | Auto-calculate from clock entries + classes |
| PUT | `/api/payroll/periods/[id]/approve` | Approve payroll period |
| POST | `/api/payroll/periods/[id]/reopen` | Reopen approved period (with audit log) |
| POST | `/api/payroll/periods/[id]/export` | Export as CSV/PDF |
| GET | `/api/employees/[id]/documents` | List employee documents |
| POST | `/api/employees/[id]/documents` | Upload document (Supabase Storage) |
| DELETE | `/api/employees/[id]/documents/[did]` | Delete document |

### 4.5 Geofence Routes (3 routes)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/geofence` | List geofence locations |
| POST | `/api/geofence` | Create geofence location |
| PUT | `/api/geofence/[id]` | Update geofence (coordinates, radius) |

### 4.6 Merch & Shipping Routes (12 routes)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/products` | List products (filterable by category, in_stock) |
| POST | `/api/products` | Create product |
| GET | `/api/products/[id]` | Get product detail |
| PUT | `/api/products/[id]` | Update product (price, inventory, etc.) |
| DELETE | `/api/products/[id]` | Soft-delete product |
| GET | `/api/orders` | List orders (filterable by status, fulfillment_type) |
| GET | `/api/orders/[id]` | Get order detail with items + shipping |
| PUT | `/api/orders/[id]/status` | Update order status |
| POST | `/api/orders/[id]/ship` | Create shipping label via EasyPost |
| GET | `/api/orders/[id]/tracking` | Get tracking info |
| POST | `/api/shipping/rates` | Get shipping rate quotes |
| POST | `/api/webhooks/easypost` | EasyPost tracking webhook |

### 4.7 SMS Provider Routes (2 routes)

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/sms/send` | Send SMS via Twilio |
| POST | `/api/webhooks/twilio` | Twilio delivery status webhook |

### 4.8 API Documentation Route (1 route)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/openapi` | Serve static OpenAPI 3.1 YAML spec |

---

## 5. UI Pages

### 5.1 Corporate Module (5 pages)

1. **Corporate Dashboard** — `/corporate` — Company account list with pipeline view (Prospect/Active/Paused/Churned), total contract value, credits allocated, upcoming events
2. **Company Detail** — `/corporate/[id]` — Company profile, linked members, event history, invoices, credit balance, notes
3. **Company New/Edit** — `/corporate/new` — Form for creating/editing company accounts
4. **Event Calendar** — `/corporate/events` — Calendar view of all events (corporate + private), filterable by type, month/week view
5. **Event Detail** — `/corporate/events/[id]` — Event management: guest list, RSVP tracking, pricing, invoicing, logistics, check-in

### 5.2 Operations Enhancements (4 pages / updates)

6. **Operations: Payroll Tab** — `/operations` (payroll tab) — Real payroll periods (not mock), create/calculate/approve/reopen/export workflow
7. **Operations: Documents Tab** — `/operations` (documents tab) — Employee document management (upload W4/W9/I9, view W2/1099)
8. **Operations: Geofence Settings** — `/settings` (geofence section) — Map-based geofence configuration, radius adjustment
9. **Employee Portal: Enhanced Clock** — `/employee` — Geofence verification UI (location permission, distance indicator, verification badge)

### 5.3 Merch/Inventory (3 pages)

10. **Product Catalog** — `/revenue/products` — Product list with inventory levels, pricing, categories, quick-edit
11. **Product Detail** — `/revenue/products/[id]` — Full product editor (images, variants, pricing, inventory, shipping weight)
12. **Order Management** — `/revenue/orders` — Order list with fulfillment status, shipping labels, tracking

### 5.4 API Documentation (1 page)

13. **API Documentation** — `/docs/api` — Interactive OpenAPI documentation with swagger-ui-react (dynamically imported)

### 5.5 SMS Configuration (1 page update)

14. **Settings: SMS Provider** — `/settings` (sms section) — Twilio credentials, phone number configuration, test send

---

## 6. Inngest Functions (Phase 4)

| Function | Schedule/Trigger | Purpose |
|---|---|---|
| `cron/payroll-reminder` | Weekly Monday 9am ET | Remind admins of open payroll periods |
| `cron/invoice-overdue-check` | Daily 8am ET | Flag overdue invoices, send payment reminders via Resend |
| `cron/contract-expiry-check` | Daily 8am ET | Alert on corporate contracts expiring within 30 days |
| `event/shipping-tracker` | On `shipping/label_created` | Poll EasyPost for tracking updates, update order status |
| `event/invoice-sent` | On `invoice/sent` | Track invoice email delivery, update `sent_at` |
| `cron/corporate-credits-refresh` | 1st of month, 2am ET | Reset monthly corporate credit allocations (respecting rollover cap) |

---

## 7. SMS Integration (Twilio)

Fulfill the Phase 2 stub with real Twilio integration:

```typescript
// src/lib/sms/providers/twilio.ts
export class TwilioProvider implements SMSProvider {
  async send(to: string, body: string): Promise<SMSResult> { ... }
  async sendBulk(messages: SMSMessage[]): Promise<SMSResult[]> { ... }
  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus> { ... }
}
```

- Update `createSMSProvider()` factory to return `TwilioProvider` when `SMS_PROVIDER=twilio`
- Twilio webhook for delivery receipts at `/api/webhooks/twilio`
- Campaign send enhanced to use real SMS for `sms` channel campaigns
- Automation engine `sms` step type uses real provider
- SMS opt-in required, daily send limits configurable per studio

---

## 8. Sprint Structure

### Sprint 1 (Weeks 1–2.5): Corporate Foundation
- Database migration (all 10 new tables + ALTER columns)
- Fix clock API bug (`time_entries` → `clock_entries`)
- Corporate API routes (12 routes)
- Corporate UI (dashboard, detail, new/edit)
- TypeScript types for all Phase 4 entities
- Update `packages/types/src/employees.ts` — add `w9`, `direct_deposit` document types

### Sprint 2 (Weeks 3–5): Events & Invoicing
- Event API routes (10 routes)
- Invoice API routes (6 routes)
- Event calendar + detail pages
- Invoice PDF generation (reuse `@react-pdf/renderer` pattern from reports)
- Inngest: invoice overdue check, contract expiry check

### Sprint 3 (Weeks 6–8): Employee Portal Enhancements
- Geofence API + settings UI
- Clock in/out geofence verification (browser Geolocation API, graceful fallback if denied)
- Payroll API routes (8 routes, including reopen)
- Payroll calculation engine (aggregate clock entries + class data + trainer bonuses + promo commissions)
- Employee document management (upload to Supabase Storage, view/approve/reject)
- Payroll export (CSV/PDF)
- Inngest: payroll reminder, corporate credits refresh

### Sprint 4 (Weeks 9–11): Merch & Shipping
- Product CRUD API routes (5 routes)
- Order management API routes (4 routes)
- EasyPost integration (start with USPS only — shipping labels, rate quotes, tracking)
- EasyPost webhook handler for tracking updates
- Product catalog UI (inventory levels, quick-edit)
- Order management UI with fulfillment workflow (ready for pickup → shipped → delivered)
- Inngest: shipping tracker

### Sprint 5 (Weeks 12–13): SMS + API Documentation
- Twilio provider implementation (fulfill Phase 2 stub)
- SMS send + webhook routes
- Settings UI for SMS configuration (credentials, phone number, test send)
- Static OpenAPI 3.1 YAML specification covering all ~120+ routes
- Interactive API documentation page with `swagger-ui-react`

### Sprint 6 (Weeks 14–15): Polish + Integration
- Admin navigation updates (Corporate module in sidebar)
- Breadcrumbs for all new routes
- Loading states and error boundaries on new pages
- Empty state handling for all new data views
- Build verification + integration testing
- Edge case policy implementation audit

---

## 9. Edge Case Policies (New for Phase 4)

Added to `docs/edge-case-policies.md` as EC-19 through EC-23:

- **EC-19: Corporate Credit Expiry/Rollover** — Unused monthly credits roll over with a cap of 2× monthly allocation. Credits beyond the cap expire at month end. Cap is configurable per company account (`credit_rollover_cap` column).

- **EC-20: Event/Class Time Conflict** — When confirming an event that overlaps with a scheduled class, show a warning with the conflicting class details. Admin must explicitly acknowledge the conflict to proceed. System does NOT auto-cancel the class — admin decides whether to cancel the class, move the event, or allow overlap (e.g., event uses different resources).

- **EC-21: Payroll Period Dispute/Reopen** — An approved payroll period can be reopened by an owner/manager with a required reason. Status changes to `reopened`, and `reopened_by`, `reopened_at`, `reopen_reason` are logged. The period must be re-approved after edits. Full audit trail preserved.

- **EC-22: Duplicate Event Inquiry** — When creating an event for the same company on the same date, show a soft warning: "This company already has an event on [date]. Continue anyway?" Admin acknowledges to proceed. Not a hard block — legitimate scenarios exist (morning wellness + evening party).

- **EC-23: Multi-Company Member** — A member belonging to multiple corporate accounts uses credits from the company that was **most recently active** (last booking made through that company). At booking time, if the member has credits from multiple companies, they select which company's credits to use. If no selection, default to most recently added company.

---

## 10. Dependencies & Environment Variables

### New Environment Variables

```env
# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# EasyPost
EASYPOST_API_KEY=
EASYPOST_WEBHOOK_SECRET=
```

### New npm Dependencies

```json
{
  "@easypost/api": "^7.0.0",
  "twilio": "^5.0.0",
  "swagger-ui-react": "^5.0.0"
}
```

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| EasyPost API complexity | Medium | Medium | Start with USPS only, add UPS/FedEx incrementally |
| Geolocation API browser permissions | Medium | Low | Graceful fallback: allow clock without geofence, flag as unverified |
| SaaS onboarding deferred | Low | Low | Documented in future-plans.md with full design spec for when needed |
| Invoice PDF rendering | Low | Low | Same `@react-pdf/renderer` pattern as report PDFs (already validated) |
| Twilio costs at scale | Low | Medium | SMS opt-in required, daily send limits per studio, configurable in settings |
| Clock API table name bug | High | High | Fix in Sprint 1 before building payroll aggregation on top of it |
