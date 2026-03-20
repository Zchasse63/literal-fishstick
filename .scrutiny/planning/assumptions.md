# Assumptions Register — Phase 4: Corporate & Operations
**Date:** 2026-03-20

---

## Critical Assumptions (Validate Before Sprint 1)

### A-1: Schema Table Names
**Assumption:** The clock/timesheet table in the live Supabase database is named `time_entries` (as used in the existing clock API route) not `clock_entries` (as used in the Phase 4 migration SQL).
**How to validate:** `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('clock_entries', 'time_entries');`
**Risk if wrong:** Migration targets wrong table. Payroll calculation returns empty data.

### A-2: geofence_locations Already Exists
**Assumption:** The `geofence_locations` table was created in Phase 1 alongside the clock API and already has the columns latitude, longitude, radius_meters, is_active.
**How to validate:** `SELECT column_name FROM information_schema.columns WHERE table_name = 'geofence_locations';`
**Risk if wrong:** If it doesn't exist, Sprint 3 scope increases. If it does exist with different columns, migration will conflict.

### A-3: Florida Federal Overtime Rules Only
**Assumption:** The Sauna Guys is in Tampa, Florida. Florida follows federal overtime law (1.5x after 40 hours/week). No daily overtime threshold.
**How to validate:** Confirm with studio owner that all employees are W2 or 1099 and no contracts specify non-standard overtime.
**Risk if wrong:** Payroll calculation engine uses wrong overtime logic, producing incorrect gross pay.

### A-4: No Product Variants Required
**Assumption:** Phase 4 merch admin UI will support single-SKU products (one price, one inventory count per product). No size/color variants.
**How to validate:** Confirm with studio owner whether they sell size-variant products (e.g., shirts in S/M/L/XL).
**Risk if wrong:** The product catalog UI won't support variants, creating usability problems at launch.

### A-5: Same Stripe Account for SaaS Billing
**Assumption:** The plan uses separate Stripe price IDs (STRIPE_SAAS_PRICE_STARTER etc.) but the same Stripe account as studio payment processing.
**How to validate:** Confirm with owner. Two approaches are possible: same account with metadata routing, or separate account with complete isolation.
**Risk if wrong:** Webhook routing conflicts between studio events and SaaS billing events.

---

## Design Assumptions

### A-6: Corporate Invoices Are Separate from Member Invoices
**Assumption:** The new `corporate_invoices` table is completely separate from any existing invoices infrastructure. The existing revenue module handles member invoicing; the corporate module handles B2B invoicing.
**How to validate:** Check if an `invoices` table exists in the database from Phase 1/2/3.
**Risk if wrong:** If a generic invoices table already exists, creating corporate_invoices as a separate table creates duplication.

### A-7: Events Do Not Require Real-Time Slot Blocking
**Assumption:** Event confirmation will require a manual admin step to cancel/move conflicting regular classes. There is no automated calendar locking.
**How to validate:** Confirm with owner what the workflow should be when an event overlaps with a scheduled class.
**Risk if wrong:** Double-booking incidents if auto-conflict-detection is not implemented.

### A-8: Corporate Credit Rollover Is Capped at 2x Monthly Allocation
**Assumption:** Unused credits roll over to the next month, capped at 2x the monthly allocation. This is the recommended policy from the edge-cases analysis.
**How to validate:** Confirm with owner before implementing the Inngest corporate-credits-refresh function.
**Risk if wrong:** Either unused credits are silently lost (company will complain) or unlimited accumulation creates liability.

### A-9: Glofox Import Is Out of Scope for Phase 4A
**Assumption:** The onboarding wizard's "import" step is deferred with Phase 4B. Phase 4A does not include Glofox data migration tooling.
**How to validate:** Confirm this is acceptable — the Glofox migration was partially planned for Phase 3 and then re-referenced here.
**Risk if wrong:** The onboarding wizard is incomplete without a working import step.

### A-10: EasyPost Single Origin (One Studio Location)
**Assumption:** All shipped orders originate from a single studio address. The `from_address` in shipping_labels is the studio's address from the settings table.
**How to validate:** Confirm The Sauna Guys ships only from their Tampa location.
**Risk if wrong:** Multi-location shipping is significantly more complex and requires a from_location selector in the order fulfillment UI.

---

## Technical Assumptions

### A-11: @react-pdf/renderer Is Already Installed
**Assumption:** The invoice PDF generation uses `@react-pdf/renderer`, which the plan says is "already validated" from Phase 3 reports.
**How to validate:** Check package.json. It's not listed in the current dependencies.
**Risk if wrong:** PDF generation (invoices, payroll export) requires adding another dependency and templating work.

### A-12: Supabase Storage Is Already Configured for File Uploads
**Assumption:** Supabase Storage is provisioned and configured for the project. Employee document upload will use the existing Storage setup.
**How to validate:** Check if any Phase 1–3 features use Supabase Storage (avatar uploads, report PDFs, etc.).
**Risk if wrong:** Storage bucket configuration and CORS setup must be done as prerequisite work.

### A-13: Inngest Infrastructure Can Handle 6 New Functions Without Scaling Issues
**Assumption:** The existing Inngest setup handles the new cron and event-triggered functions without hitting plan limits.
**How to validate:** Check current Inngest function count and plan tier.
**Risk if wrong:** May need to upgrade Inngest plan or optimize function consolidation.
