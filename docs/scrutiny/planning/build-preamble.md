# Build Preamble -- Meridian Phase 1

**Date:** 2026-03-20
**Prerequisite:** Complete all Phase 0 items before starting Phase 1 code.

---

## Key Architectural Decisions (Must Make Before Coding)

### 1. Auth: JWT Custom Claims for Roles
Store user roles in a `user_roles` table. Use a Supabase database trigger (`handle_new_user`) to populate JWT custom claims from `user_roles` on every auth token refresh. This enables Next.js middleware to gate route groups without a database lookup per request.

### 2. Payment Surface: Stripe Payment Element (Not Checkout Session)
Use Payment Element for all member-facing payments. This supports Apple Pay/Google Pay inline, custom wallet offset logic, and consistent UX. Reserve Checkout Session only for anonymous gift card purchases (non-authenticated users). Use server-side PaymentIntent for off-session charges (strike penalties, subscription renewals).

### 3. Booking Race Condition: Postgres Function with Serializable Transaction
Implement the atomic booking insert as a Postgres function that checks capacity and inserts in a single serializable transaction. If capacity is exceeded, the function returns an error. No hold/reservation pattern.

### 4. Waitlist Promotion Trigger: pg_cron Polling
Use a pg_cron job that runs every minute to check for open spots in upcoming classes with active waitlists. When a spot opens, update the waitlist entry status and trigger an email notification. The 30-minute claim window (Phase 1) is tracked via a `claim_expires_at` timestamp column.

### 5. Credit Deduction: Soonest-Expiring First Algorithm
Implement credit deduction as a Postgres function that queries available credits ordered by `expires_at ASC`, reserves the soonest-expiring credit, and returns the updated balance. This must be atomic to prevent double-deduction in concurrent requests.

### 6. Multi-Tenancy: RLS on Every Table
Every table has `studio_id`. Every query goes through RLS. No exceptions. The Supabase client is initialized with the user's JWT, which contains `studio_id` in custom claims. RLS policies enforce tenant isolation at the database layer.

---

## Dependencies to Set Up First

| Dependency | Setup Steps | Blocking |
|---|---|---|
| Supabase project | Create project, enable pg_cron, enable pgvector, apply schema | Everything |
| Stripe account | Verify TSG account exists (not Glofox sub-account), create Products + Prices for all plans | Revenue module |
| Resend | Create account, verify sending domain (DNS records), set up API key | Email notifications |
| Anthropic API | Get API key, store server-side only (env var, never in client bundle) | AI briefing |
| Netlify | Create site, connect to monorepo, configure build command for Next.js | Deployment |

---

## Risk Mitigation During Development

1. **RLS testing:** After writing any new RLS policy, immediately test with each role (owner, manager, trainer, front_desk, member). Create a test script that runs all role combinations. Run before every deploy.

2. **Stripe webhook testing:** Use Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) during local development. Test every webhook event type before deploying the handler.

3. **Credit system:** Write unit tests for the credit deduction algorithm before building the booking UI. Test: single pack, multiple packs with different expiry, family pool, zero balance, grace period.

4. **Data migration:** Run migration script on a staging Supabase instance with real Glofox data before touching production. Verify credit balances match, membership statuses are correct, booking history is intact.

---

## Validation Gates

| Gate | When | Pass Criteria | Fail Action |
|---|---|---|---|
| Schema review | After Phase 0 | All tables defined, RLS policies tested, no missing relationships | Do not proceed to Phase 1A |
| Auth smoke test | Week 2 of Phase 1 | Magic link login works, role-based routing works, context switching works for dual-role user | Fix before building any module |
| Stripe integration test | Before Revenue module | Subscription creation, upgrade with proration, webhook handling all work in sandbox | Do not build payment UI |
| Booking load test | Before Phase 1C | 12 concurrent booking attempts, exactly 12 succeed, 13th gets "class full" error | Fix atomic insert function |
| Migration dry run | Before Phase 1D | All Glofox data imports correctly, credit balances match, no duplicate members | Do not proceed to live migration |
| Glofox decommission readiness | End of Phase 1 | Members can book, check in, manage account, and pay through Meridian. No Glofox dependency remains. | Keep Glofox live until resolved |

---

## Team Skill Requirements

- Next.js App Router (not Pages Router) -- server components, route groups, middleware
- Supabase (Postgres, RLS policies, Edge Functions, Auth with @supabase/ssr)
- Stripe (Subscriptions API, Payment Element, webhook handling)
- TypeScript (strict mode, shared types across monorepo)
- Tailwind CSS v4 (CSS-first configuration)
- React (hooks, context, React Query for data fetching)
