# Technical Feasibility Analysis — Meridian PRD v1.0

**Agent:** technical-feasibility
**Complexity:** MAJOR (Deep+ mode)
**Date:** 2026-03-20
**Source:** meridian-prd.md v1.0, magicpath-design-guide.md, edge-case-policies.md, CLAUDE.md

---

## Agent Verdict

**MODIFY**

The PRD is technically sound in its architecture choices and integration selections. The stack is well-matched to the problem. However, it is not yet developer-ready: the Supabase schema is entirely unspecified, API contracts are undefined, auth middleware logic is undocumented, and the Stripe integration complexity is substantially underestimated. The design system is exceptionally complete and eliminates a large class of front-end ambiguity. But several core features — the booking race condition, the wallet offset payment flow, the geofencing implementation, and the QR check-in system for Phase 1 — need implementation specs before a developer can build them correctly. The PRD can be handed to a developer to begin monorepo scaffolding and static UI work immediately. It cannot yet support implementing any data-driven feature.

---

## Stack Assessment

The chosen stack is genuinely well-suited to this problem.

| Decision | Assessment |
|---|---|
| Next.js App Router | Correct. Role-based routing via route groups, server components for data fetching, middleware for auth. Ideal fit. |
| Supabase | Correct. Postgres RLS handles multi-tenancy, Auth covers magic link/SSO, Realtime subscriptions are available when needed, Edge Functions for server-only logic. |
| Stripe direct (not Connect) | Correct and important. Connect would impose 0.25-0.5% additional fee and restrict dashboard access. Direct Stripe is right for a single-tenant operator. |
| Turborepo monorepo | Correct. Shared types and Supabase client across admin/employee surfaces prevents drift. Essential when future iOS and member portal surfaces are added. |
| shadcn/ui + Tailwind v4 | Correct. shadcn gives ownership over components. Tailwind v4 uses CSS-first config (no tailwind.config.js) — developer needs awareness; MagicPath prototypes used v3 class conventions which still work in v4 but config approach differs. |
| Anthropic SDK | Appropriate. Must be used server-side only (Next.js Route Handlers or Supabase Edge Functions as proxy — never in client bundles). |
| pgvector | Correct addition for AI search. Can be added to schema now and used as AI features mature. |
| Resend | Correct. Developer-friendly, React Email for templating, built-in open/click tracking. |
| @tanstack/react-query | Correct for data fetching. `refetchInterval: 60000` on relevant queries is the clean implementation of the Phase 1 polling strategy. |
| Framer Motion | Appropriate for the animation spec. In App Router, all Framer Motion components need `"use client"` — typically on a layout wrapper, not the page itself. Wrong placement causes hydration mismatches. |

---

## Critical Technical Gaps

### Gap 1: No Database Schema
**Severity: BLOCKER**

The PRD describes data extensively but contains zero schema. No developer can build anything data-driven without it.

Minimum required before development:
- Table definitions: columns, types, constraints, defaults
- Foreign key relationships and cascade rules
- RLS policies per table per role (owner, manager, trainer, front desk, member)
- Index strategy (booking lookups, member searches, analytics aggregations)
- pgvector column placement

The edge case policies and feature set imply approximately 35-40 tables minimum:

```
studios, locations, users, user_roles, member_profiles,
membership_plans, member_subscriptions, stripe_customers,
class_types, class_slots, bookings, check_ins,
waitlist_entries, credits, credit_packs, credit_transactions,
trainers, trainer_class_assignments, trainer_pay_rules,
promo_codes, promo_attributions,
wallet_balances, wallet_transactions, gift_cards,
merch_products, merch_variants, merch_inventory, inventory_holds, merch_orders,
invoices, invoice_line_items,
strikes, strike_overrides,
guest_invites, guest_profiles, guest_visits,
member_referral_conversions,
family_accounts, family_members,
waivers, waiver_signatures,
timeclock_entries, break_entries,
payroll_periods, payroll_line_items,
notification_log, scheduled_notifications
```

RLS policies must cover every table × every role combination. This is substantial work but the right approach for Supabase.

### Gap 2: No API Contract / Route Handler Specification
**Severity: HIGH**

The PRD describes features but not how data flows. No developer can implement the booking flow, Stripe webhook handler, or waitlist promotion without knowing:

- Which operations use Next.js Route Handlers vs. Supabase client directly vs. Supabase Edge Functions?
- What is the webhook endpoint inventory? (Stripe sends: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `payment_intent.succeeded`)
- What triggers waitlist promotion? (Supabase Realtime on booking deletion? pg_cron? Client polling?)
- Where does the 15-minute claim window timer live? (Supabase scheduled function? Database column with expiry timestamp?)
- Where does the atomic booking insert execute? (Postgres function with transaction isolation? Advisory lock?)

**Recommended pattern:** Use Next.js Route Handlers for all admin dashboard business logic (they share the Next.js auth session). Reserve Supabase Edge Functions for: database triggers, scheduled jobs (credit expiry notifications, inventory hold release), and webhook receivers that need to run independently of the Next.js app.

### Gap 3: Auth Architecture Undefined
**Severity: HIGH**

PRD says "single account, multiple roles" but the implementation spec is missing:

- How are roles stored? Supabase JWT custom claims (correct answer) via a `handle_new_user` database function or auth hook, plus a `user_roles` table for admin management.
- How does Next.js middleware read roles to gate route groups without a database round-trip on every request? (JWT claims is the answer — avoids latency.)
- Magic link flow: what is the redirect chain? Where does initial role assignment happen? (New user via magic link → assign member role by default → admin can escalate.)
- How does an owner who is also a member switch between "admin mode" and "member mode" in the UI? (Context switcher in sidebar? URL-based? Separate sessions?)
- What happens when a trainer navigates to an admin route? (Middleware redirect to /employee/dashboard, or 403 page?)

`@supabase/ssr` requires precise cookie-based session management in App Router (middleware.ts + server client + browser client pattern). First-time developers frequently get this wrong, causing auth session bugs. Must be documented before dev starts.

### Gap 4: Stripe Integration Complexity Underestimated
**Severity: HIGH**

The PRD treats Stripe as "handled" but the actual implementation involves several non-trivial flows:

**Subscriptions and proration:**
- Stripe Customer must be created before first payment — this is a bootstrap step not mentioned
- Three Stripe Price objects for recurring plans + separate prices for drop-ins and credit packs
- Proration preview requires `stripe.invoices.retrieveUpcoming()` before the confirmation screen — must happen server-side
- Downgrade uses `subscription_schedule` (not immediate cancellation) — different API surface than upgrade
- Webhook handler for subscription lifecycle events is the most critical piece of infrastructure in the system

**Gift card wallet offset:**
- Meridian wallet is a custom Supabase implementation (not a native Stripe feature)
- To apply wallet balance before charging the card: must intercept payment intent creation, calculate wallet offset, create PaymentIntent for the remainder, update wallet balance transactionally
- This means using Stripe Payment Element (not Checkout Session) to build the payment UI — a more complex integration
- Wallet deduction and Stripe charge must be atomic or have rollback logic

**Strike penalties ($5 / $10 charges):**
- Ad-hoc charges to a card on file (not part of subscription)
- Requires `stripe.paymentIntents.create()` with `customer` + `payment_method` + `confirm: true`
- Must handle payment failure at penalty charge time (card declined when charging the $5 fee)

**Merch inventory hold (15-minute timer):**
- Requires a scheduled job to release expired holds
- Supabase doesn't have native cron — requires `pg_cron` extension (available in Supabase) or an external trigger
- Inventory hold must be atomic with the add-to-cart action

**Apple Pay / Google Pay:**
- Requires Stripe Payment Element or Payment Request Button (web-compatible, works on HTTPS)
- Netlify provides HTTPS — no issue there
- Must be in scope for Phase 1 checkout flows if listed as a supported payment method

### Gap 5: QR Check-In Has No Member Surface in Phase 1
**Severity: HIGH**

PRD Section 13 explicitly moves the walk-in kiosk AND the member web portal out of Phase 1 scope. But the QR code check-in system is listed as a Phase 1 deliverable.

**The problem:** If neither the kiosk nor the member portal ships in Phase 1, there is no surface on which members can display their QR code, and no surface on which staff can scan it. This means the QR check-in system cannot function in Phase 1 as specified.

**Resolution options:**
1. Include a minimal member-facing page (just the QR code display, no full booking portal) in Phase 1
2. Fall back to name-based lookup for Phase 1 check-in (no QR scanning)
3. Clarify that "check-in" in Phase 1 means admin manually marks attendance in the admin dashboard

This gap must be resolved before development starts. It is a functional blocker for a core Phase 1 feature.

### Gap 6: Phase 1 Scope Conflict
**Severity: HIGH**

Section 11 (Phase 1 deliverables) lists: "Web Booking Portal (member-facing)"
Section 13 (Scope Clarification) explicitly excludes: "Member Web Booking Portal (Next.js) — will consume same Supabase backend"

These two sections directly contradict each other. A developer reading the PRD cannot know whether to build the member portal in Phase 1 or not. This must be resolved before sprint planning begins.

### Gap 7: Geofencing Implementation Underspecified
**Severity: MEDIUM**

200-meter geofencing for employee clock-in is decided. Implementation details missing:
- Uses Web Geolocation API (`navigator.geolocation.getCurrentPosition()`) — requires HTTPS (fine on Netlify) and user permission grant
- Studio lat/lng coordinates must be stored per location in the database
- Distance calculation: Haversine formula client-side, or PostGIS `ST_DWithin` server-side (PostGIS is available in Supabase)
- GPS accuracy on mobile browser can be ±50-200m — at exactly 200m radius this creates false rejections
- What happens if the employee denies location permission? (Block clock-in? Allow with manager override? Require manual location entry?)
- What happens on desktop browser where GPS is unavailable? (IP geolocation is too imprecise for 200m)

**Recommendation:** Store studio coordinates per location. Calculate distance server-side via PostGIS for accuracy. Allow clock-in with manager override if permission is denied, flagged in timesheet for review. Increase effective radius to 300m to account for GPS inaccuracy.

### Gap 8: pgvector / AI Architecture Underspecified
**Severity: LOW**

pgvector is in the stack but its use is undefined:
- Which content gets embedded? (Member notes, class descriptions, campaign content)
- When are embeddings generated and updated?
- Which Anthropic model generates embeddings? (Claude doesn't expose an embeddings API — need `text-embedding-3-small` from OpenAI, or use Supabase's built-in pg_embedding with a different model)

**Note:** Anthropic's SDK (`@anthropic-ai/sdk`) is for generating text with Claude models, not for creating vector embeddings. If pgvector is used for semantic search, a separate embedding model is needed. This is not currently reflected in the dependencies list.

---

## Integration Complexity Assessment

| Integration | Complexity | Risk |
|---|---|---|
| Supabase Auth (magic link) | Medium | Low |
| Supabase RLS (35+ tables) | High | Medium — needs thorough testing |
| Stripe subscriptions + proration | High | Medium |
| Stripe ad-hoc charges (strike penalties) | Medium | Low |
| Stripe wallet offset (gift cards) | High | Medium — custom payment intent flow |
| Resend transactional + campaigns | Low-Medium | Low |
| Anthropic SDK (server-side, Route Handler) | Medium | Low |
| QR code generation (qrcode package) | Low | Low |
| Geofencing (Web Geolocation + PostGIS) | Medium | Medium — accuracy edge cases |
| Turborepo shared packages | Medium | Low |
| Tailwind v4 (CSS-first config) | Low | Low — but different from v3 |
| pg_cron (inventory holds, expiry jobs) | Medium | Low — available in Supabase |

---

## Architecture Concerns

**Concern 1: Turborepo Package Boundaries Not Defined**
PRD mentions "shared types, utilities, API client" but not what lives in each package. Recommended structure: `@meridian/types`, `@meridian/db` (Supabase client + query utilities), `@meridian/stripe` (Stripe client + webhook helpers), `@meridian/email` (Resend templates), `@meridian/ui` (shared shadcn components).

**Concern 2: Anthropic SDK Embedding Gap**
The Anthropic SDK generates text (Claude models) but not vector embeddings. pgvector requires an embedding model. If semantic search is a Phase 1 dependency, add an embedding provider (OpenAI `text-embedding-3-small` is cost-effective). If Phase 3+, pgvector can be added to schema now and populated later.

**Concern 3: Credits Are a Mini Billing Engine**
The credit system (multiple packs with different expiry dates, deduction priority rules, family pool sharing, grace period logic) is the most complex data problem in the system. It deserves its own implementation spec (state machine diagram, transaction log schema, deduction algorithm pseudocode) before development begins.

**Concern 4: Stripe Proration Preview UX**
Section 6 of edge-case-policies.md shows the proration example using wrong prices ($79/mo and $149/mo instead of the actual $120/mo and $225/mo). The developer will build the proration preview UI; this typo must not leak into the implementation. Verify all Stripe Price object amounts against the locked pricing table in PRD Section 3.3.

---

## What's Missing for Developer Handoff

| Missing Item | Priority |
|---|---|
| Supabase database schema (tables, columns, types, constraints) | BLOCKER |
| RLS policies per table per role | BLOCKER |
| Resolution of Phase 1 scope conflict (web portal in or out?) | BLOCKER |
| Resolution of QR check-in surface for Phase 1 | HIGH |
| Stripe webhook handler inventory (events + actions) | HIGH |
| Stripe product/price object setup | HIGH |
| Auth flow spec (magic link redirect, role assignment, context switching) | HIGH |
| Booking atomic insert spec (Postgres function or advisory lock) | HIGH |
| Waitlist promotion trigger mechanism | HIGH |
| Credit deduction state machine (priority, expiry, grace period) | HIGH |
| Wallet offset payment intent flow | HIGH |
| Geofencing implementation spec | MEDIUM |
| pg_cron job inventory (what runs, when) | MEDIUM |
| Environment variable inventory | MEDIUM |
| Turborepo package boundary definitions | MEDIUM |
| Embedding model decision (for pgvector) | MEDIUM |
| Error handling patterns (Stripe failure, Supabase timeout, AI API failure) | MEDIUM |

---

## Positive Signals

- Design system is complete and developer-ready. Tokens, components, animation specs, route structure — consistent implementation is possible from day one.
- 18 edge cases are fully decided with explicit behavior rules. This eliminates a large class of mid-development ambiguity.
- 17 pages of MagicPath prototype provide visual reference for every page.
- Stack choices are well-reasoned and mature. No exotic dependencies.
- Dependencies "keep vs. drop" list in design guide is useful for a clean start.
- All pricing, trainer pay rates, and promo commission percentages are locked. No mid-sprint number changes.
- The "data corrections" table in design guide Section 7 explicitly flags all MagicPath values that use wrong prices — important to not let these leak into the real implementation.
- Waiver text is provided and complete (minus the facility name update needed — "Cigar City CrossFit" reference must be replaced).

---

## Summary

The PRD establishes an architecturally sound plan with excellent design artifacts and fully-resolved business logic. It is not yet developer-ready because: (1) no database schema exists, (2) Stripe webhook specification is absent, (3) Phase 1 scope has a direct contradiction about the web booking portal, (4) the QR check-in system has no member display surface defined for Phase 1. A developer can start monorepo setup, Turborepo scaffolding, and static UI from the design guide today. They cannot implement any data-driven feature without the schema.
