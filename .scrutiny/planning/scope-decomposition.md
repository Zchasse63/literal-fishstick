# Scope Decomposition — Phase 4: Corporate & Operations
**Date:** 2026-03-20

---

## Phase 4A: Core Operations (Recommended — Build Now)

### Module 1: Corporate Accounts (Sprint 1, Weeks 1–2.5)

**Database:**
- company_accounts table
- company_members table (junction)
- corporate_invoices table
- Remove profiles.company_id migration (use company_members instead)

**API Routes (12):**
- GET/POST /api/corporate
- GET/PUT/DELETE /api/corporate/[id]
- GET/POST /api/corporate/[id]/members
- DELETE /api/corporate/[id]/members/[mid]
- GET/POST /api/corporate/[id]/invoices
- POST /api/corporate/[id]/credits
- GET /api/corporate/dashboard

**UI (3 pages):**
- /corporate — Pipeline kanban (Prospect/Active/Paused/Churned) + company list
- /corporate/[id] — Company detail: members, events, invoices, credit balance
- /corporate/new — Create/edit company form

**Definition of Done:**
- Company can be created, linked to members, and have credits allocated
- Corporate dashboard shows total contract value, active companies, upcoming events

---

### Module 2: Events Management (Sprint 2, Weeks 3–5)

**Database:**
- events table
- event_guests table

**API Routes (10):**
- GET/POST /api/events
- GET/PUT/DELETE /api/events/[id]
- POST /api/events/[id]/quote
- POST /api/events/[id]/confirm
- GET/POST /api/events/[id]/guests
- PUT /api/events/[id]/guests/[gid]

**UI (2 pages):**
- /corporate/events — Event calendar (month/week toggle), filterable by type
- /corporate/events/[id] — Full event management: guest list, RSVP, pricing, logistics

**Definition of Done:**
- Inquiry submitted → quoted → confirmed → invoiced flow works end-to-end
- Guest list shows RSVP status and conversion (did they become a member?)
- Event calendar does not show conflicts with existing scheduled classes (shows a warning)

---

### Module 3: Corporate Invoicing (Sprint 2 continuation)

**API Routes (6):**
- GET/PUT /api/invoices/[id]
- POST /api/invoices/[id]/send
- POST /api/invoices/[id]/record-payment
- POST /api/invoices/[id]/void
- GET /api/invoices/[id]/pdf

**Inngest:**
- cron/invoice-overdue-check (daily 8am)
- cron/contract-expiry-check (daily 8am)
- event/invoice-sent

**Definition of Done:**
- Invoice created from event, sent via Resend with PDF attachment
- Overdue check runs daily and updates invoice status
- PDF renders professionally with studio logo, line items, tax, payment instructions

---

### Module 4: Employee Portal Enhancements (Sprint 3, Weeks 6–8)

**Database:**
- payroll_periods table
- payroll_line_items table
- employee_documents table
- Verify geofence_locations exists; add admin management if missing
- Modify clock_entries/time_entries (verify correct name) with geofence_location_id

**API Routes (13):**
- POST /api/clock (enhance with geofence_location_id linkage if not already)
- GET/POST /api/payroll/periods
- GET /api/payroll/periods/[id]
- POST /api/payroll/periods/[id]/calculate (via Inngest)
- PUT /api/payroll/periods/[id]/approve
- POST /api/payroll/periods/[id]/export
- GET/POST /api/employees/[id]/documents
- DELETE /api/employees/[id]/documents/[did]
- GET/POST/PUT /api/geofence + /api/geofence/[id]

**UI (4 pages/tabs):**
- /operations payroll tab — real payroll periods, create/calculate/approve/export workflow
- /operations documents tab — employee document upload, status, review
- /settings geofence section — map display with radius configuration
- /employee (clock UI enhancement) — distance indicator, geofence verification badge

**Inngest:**
- cron/payroll-reminder (weekly Monday 9am)

**Definition of Done:**
- Payroll period shows real aggregated data from clock entries + bonuses + commissions
- Admin can approve and export to CSV with all earnings broken down
- Employees can upload W4/W9; admin can approve/reject
- Geofence settings UI allows radius adjustment per location

---

### Module 5: Merch & Shipping (Sprint 4, Weeks 9–11)

**Database:**
- shipping_labels table
- Modify orders table (fulfillment_type, shipping_cost, tracking fields)

**API Routes (12):**
- GET/POST /api/products
- GET/PUT/DELETE /api/products/[id]
- GET /api/orders
- GET /api/orders/[id]
- PUT /api/orders/[id]/status
- POST /api/orders/[id]/ship
- GET /api/orders/[id]/tracking
- POST /api/shipping/rates
- POST /api/webhooks/easypost

**UI (3 pages):**
- /revenue/products — product catalog with inventory, quick-edit inline
- /revenue/products/[id] — full product editor (images, pricing, shipping weight)
- /revenue/orders — order list, fulfillment status, shipping label workflow

**Inngest:**
- event/shipping-tracker (fallback polling for missed EasyPost webhooks)

**Definition of Done:**
- Products can be created, edited, and have inventory tracked
- Orders show in fulfillment queue with shipping label generation
- Tracking updates flow from EasyPost webhook into order status

---

### Module 6: SMS/Twilio + API Keys + OpenAPI (Sprint 5, Weeks 12–13)

**SMS (3–4 days):**
- src/lib/sms/providers/twilio.ts (TwilioProvider implementing SMSProvider)
- Factory updated: createSMSProvider() returns TwilioProvider when SMS_PROVIDER=twilio
- POST /api/sms/send
- POST /api/webhooks/twilio
- /settings SMS section — credentials, phone number, test send

**API Keys (3–4 days):**
- api_keys table
- GET/POST /api/api-keys
- DELETE /api/api-keys/[id]
- GET /api/api-keys/[id]/usage
- UI in settings for key management

**OpenAPI Documentation (3–4 days):**
- Write openapi.yaml manually covering all public endpoints
- GET /api/docs/spec (serves the YAML)
- /docs/api page with swagger-ui-react (lazy-loaded, dynamic import)

**Definition of Done:**
- SMS campaigns fire real Twilio messages (not stub)
- Delivery receipts update campaign analytics
- API keys can be created, scoped, and revoked
- /docs/api renders interactive documentation

---

### Module 7: Polish + Integration (Sprint 6, Week 14)

- Navigation: add Corporate to admin sidebar
- Navigation: add Products/Orders to Revenue section
- Settings: consolidate Geofence + SMS + Subscription sections
- Breadcrumbs on all new pages
- Loading states and error boundaries on all new pages
- Inngest: verify all 6 new functions deploy correctly
- Integration test: end-to-end corporate account → event → invoice → payment flow
- Integration test: payroll period create → calculate → approve → export
- Build verification on Netlify

---

## Phase 4B: SaaS Platform (Defer — Build When First External Customer Exists)

### SaaS Onboarding Wizard
- saas_subscriptions table
- onboarding_progress table
- POST /api/onboarding/studio (provisioning)
- GET/PUT /api/onboarding/progress
- POST /api/onboarding/invite
- GET/POST /api/subscription
- POST /api/subscription/upgrade + cancel
- POST /api/webhooks/stripe-saas
- /onboarding (wizard UI)
- /settings/subscription (plan management)

**Trigger for build:** First non-Sauna Guys studio ready to onboard

### Custom Dashboard Builder
- Widget type definitions (which metrics, which data sources)
- Layout persistence per user (JSONB in profiles or separate table)
- Drag-and-drop grid UI using @dnd-kit (already installed)
- Widget library: booking volume, revenue MRR, member growth, class fill rate, churn rate

**Trigger for build:** Owner requests after using Phase 3 fixed dashboards for 60+ days

---

## Deferred Items That Surfaced During Scrutiny

- **Product variants (size/color)** — add as Phase 4A scope if The Sauna Guys sells size-variant merch
- **Glofox import tooling** — Phase 4B, needs format specification
- **Event/class conflict auto-detection** — implement the warning in Sprint 2 (not auto-cancellation)
- **W9 and direct_deposit document types** — add to employees.ts types in Sprint 3 prep
