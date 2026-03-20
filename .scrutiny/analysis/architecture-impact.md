# Architecture Impact Analysis — Phase 4: Corporate & Operations

**Agent:** architecture-impact
**Plan:** Meridian Phase 4
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

Phase 4 is architecturally additive — it extends the existing patterns rather than replacing them. The core Supabase/Next.js/Inngest foundation handles the new load well. However, there are three architectural decisions that will compound into technical debt if not addressed now: (1) the `profiles.company_id` FK denormalization, (2) the dual Stripe webhook routing problem, and (3) the SaaS multi-tenancy model conflict. These are resolvable without major restructuring, but require explicit decisions before Sprint 1.

---

## Impact on Existing Architecture

### Database Layer

**New tables: 13.** These are additive with no changes to existing tables except:
1. `ALTER TABLE clock_entries` — adds geofence columns (see technical-feasibility for the table name conflict)
2. `ALTER TABLE orders` — adds fulfillment_type, shipping_address, shipping_cost, tracking_number, shipped_at, delivered_at
3. `ALTER TABLE profiles ADD COLUMN company_id UUID REFERENCES company_accounts(id)` — this is a denormalization concern (addressed below)

**RLS pattern consistency:** All new tables follow the existing `studio_id = current_setting('app.studio_id')::uuid` RLS pattern. This is correct and consistent. No RLS regressions expected.

**Index coverage:** The proposed indexes are appropriate. The composite indexes on (studio_id, status), (studio_id, start_time) correctly follow query patterns. No gaps identified.

---

### CONCERN: profiles.company_id Denormalization

The plan proposes:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company_accounts(id);
```

This assumes each profile belongs to at most one company. But:
1. A member could be an employee of multiple companies that both use the same studio
2. A member could change employers, invalidating the FK while the membership continues
3. The `company_members` junction table already captures the company ↔ member relationship properly

Adding `company_id` directly to `profiles` duplicates the relationship that `company_members` is designed to hold, creates an inconsistency risk (the two can diverge), and breaks the multi-company assumption.

**Recommended fix:** Remove the `profiles.company_id` migration. Query company membership through the `company_members` join table. The company detail page should load members via `SELECT * FROM company_members WHERE company_id = $1`. This is one extra join, which is trivially fast with the existing indexes.

---

### API Layer

**67 new routes in the App Router.** The existing 109 routes span 22 categories. Adding 67 more (a 61% increase) in well-separated route directories follows the established pattern cleanly. No naming conflicts identified with existing routes.

**New route categories that don't conflict with existing ones:**
- `/api/corporate/*` — new
- `/api/events/*` — new
- `/api/invoices/*` — new (existing `/api/revenue/` handles member invoices; this handles corporate invoices — they should remain separate)
- `/api/payroll/*` — new (extending the existing `/api/clock/` functionality)
- `/api/geofence/*` — new admin management routes (existing clock API already handles verification)
- `/api/products/*` — new (merch; the DB exists, routes don't)
- `/api/orders/*` — new
- `/api/shipping/*` — new
- `/api/onboarding/*` — new
- `/api/subscription/*` — new
- `/api/api-keys/*` — new
- `/api/sms/*` — new
- `/api/webhooks/easypost` — new; extends existing `/api/webhooks/` pattern
- `/api/webhooks/twilio` — new
- `/api/webhooks/stripe-saas` — new (see concern below)

---

### CONCERN: Dual Stripe Webhook Handlers

The existing `/api/webhooks/stripe/route.ts` handles member subscription events. The plan adds `/api/webhooks/stripe-saas/route.ts` for SaaS billing events. Both handlers will receive ALL events from the Stripe account if registered separately.

**Architecture options:**

Option A (Recommended): Single webhook endpoint with routing logic
```typescript
// /api/webhooks/stripe/route.ts
switch(event.type) {
  case 'customer.subscription.updated':
    if (event.data.object.metadata.subscription_type === 'saas') {
      return handleSaasSubscriptionUpdate(event, supabase)
    }
    return handleMemberSubscriptionUpdate(event, supabase)
}
```
Add `metadata.subscription_type: 'saas' | 'member'` at subscription creation time. Keeps one Stripe webhook endpoint. The existing handler already pattern-matches on metadata.

Option B: Separate Stripe accounts
Use a completely separate Stripe account for SaaS billing. Cleaner isolation, but doubles Stripe dashboard management overhead. Overkill for the current scale.

Option C: Separate webhook endpoints with metadata guards (the plan's approach)
Works if implemented correctly with metadata guards, but requires two Stripe webhook registrations and creates operational complexity.

**Recommendation:** Option A. Minimal change to existing code, uses established Stripe metadata pattern already in the codebase.

---

### SaaS Multi-Tenancy Architecture Concern

The plan introduces `saas_subscriptions` and `onboarding_progress` tables tied to `studio_id`. This correctly extends the existing multi-tenant model. However, there's a bootstrapping problem:

**Who creates the studio record before onboarding begins?**

The existing RLS model requires a `studio_id` on every table. The onboarding flow needs to:
1. Create the `studios` record first (requires a super-admin context, bypassing RLS)
2. Create the `saas_subscriptions` record
3. Set up initial `onboarding_progress`
4. Create the first admin `profiles` record linked to the new studio
5. Set `app.studio_id` in the JWT/session for the new admin

Steps 1–3 must run in a service-role context (bypassing RLS), while steps 4–5 transition to the user-role context. This is a non-trivial transaction that the plan's `POST /api/onboarding/studio` must implement carefully. A partial failure here leaves orphaned records.

**Recommended approach:** Use a Supabase service-role client for the studio provisioning API route. Wrap the multi-step creation in an explicit Postgres transaction. Return an error that rolls back fully if any step fails.

---

### Inngest Function Architecture

The 6 new Inngest functions are appropriate additions to the existing job infrastructure. Three observations:

**`event/shipping-tracker`** polls EasyPost for tracking updates. Polling frequency matters — EasyPost also offers tracking webhooks (the plan correctly includes `/api/webhooks/easypost`). The Inngest polling function should only be a fallback for missed webhooks, not the primary update mechanism. Polling every N minutes for every in-transit shipment could get expensive at scale.

**`event/corporate-credits-refresh`** — triggered on `subscription/period_start`. This presumes SaaS subscription period events. For The Sauna Guys' own corporate contracts, credit refresh is on the company's contract anniversary, not the SaaS billing cycle. The trigger event needs to be either a corporate-specific event type or a monthly cron.

**`cron/invoice-overdue-check`** — flags invoices past due_date. This correctly runs daily at 8am. The update should be idempotent (don't re-flag already-flagged invoices) and should send one reminder email per invoice, not a reminder every day it's overdue.

---

### Navigation & Routing Impact

New admin pages require navigation additions:

**New top-level module:** `/corporate` — needs to be added to the admin sidebar navigation. The existing modules are: analytics, engagement/marketing, members, operations, revenue, schedule, settings. Corporate becomes the 8th top-level module.

**Revenue module expansion:** Products and orders live under `/revenue/products` and `/revenue/orders`, extending the existing revenue section. This is the right placement — merch is revenue.

**Settings expansion:** Geofence settings and SMS provider configuration extend the existing `/settings` page. This follows Phase 3's pattern of adding tabs to settings rather than standalone pages.

**Onboarding wizard:** Lives at `/onboarding` outside the admin route group. This needs to be accessible before full admin setup, meaning it must have different auth middleware handling (allow access before `studio_id` is set in context).

---

### Bundle Size Impact

New npm packages and their estimated bundle contributions:
- `twilio` (~500KB unpacked) — server-only, no client bundle impact
- `@easypost/api` (~200KB unpacked) — server-only, no client bundle impact
- `next-swagger-doc` (~100KB) + `swagger-ui-react` (~4MB unpacked) — swagger-ui is large and client-rendered. Should be lazy-loaded and route-split at `/docs/api` to prevent it from entering the main bundle
- `react-grid-layout` (~120KB) — client bundle, used only in dashboard builder

**Concern:** `swagger-ui-react` at ~4MB is significant. It must be dynamically imported: `const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })`. Failure to do this will inflate every page's bundle.

**Better approach for swagger-ui:** Use [Scalar](https://github.com/scalar/scalar) (React component, ~200KB, much better UX) instead of swagger-ui-react. Or use the Redoc component. swagger-ui-react is functional but shows its age.

---

### Type System Impact

Phase 4 requires new type definitions in `packages/types/src/`. Based on the plan:

New files needed:
- `packages/types/src/corporate.ts` — CompanyAccount, CompanyMember, CorporateInvoice
- `packages/types/src/events.ts` — Event, EventGuest
- `packages/types/src/payroll.ts` — PayrollPeriod, PayrollLineItem
- `packages/types/src/shipping.ts` — ShippingLabel (extends existing merch.ts)
- `packages/types/src/saas.ts` — SaasSubscription, OnboardingProgress, ApiKey

The existing `employees.ts` and `merch.ts` types need updates (see technical-feasibility). The `packages/types/src/index.ts` barrel export must be updated to export from these new files.

---

## Architecture Health After Phase 4

If the identified concerns are addressed, Phase 4 leaves the architecture in good health:
- RLS isolation maintained across all 22+ tables
- API routes remain organized by domain
- Inngest handles all async jobs
- Stripe handles all payments
- SMS is provider-agnostic
- Shipping is behind an abstraction (EasyPost SDK, swappable)

The main architectural risk introduced by Phase 4 is the complexity of the SaaS billing layer sitting alongside studio payment processing in the same Stripe account. This is manageable with the metadata routing approach but adds ongoing operational awareness requirements.
