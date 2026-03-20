# Architecture Impact Analysis — Meridian PRD v1.0

**Agent:** architecture-impact
**Complexity:** MAJOR (Deep+ mode)
**Date:** 2026-03-20
**Source:** meridian-prd.md v1.0, magicpath-design-guide.md, edge-case-policies.md, CLAUDE.md

---

## Agent Verdict

**MODIFY**

The architecture is directionally excellent. The stack is well-chosen, the multi-tenant RLS approach is correct, the shared backend is the right call, and the design system provides an exceptional foundation. Three structural issues require resolution before a developer starts: (1) the Phase 1 scope contradiction about the web booking portal, (2) the absence of a database schema despite extensive data requirements in the edge case policies, and (3) undefined Turborepo package boundaries. Beyond these, there are several important but non-blocking clarifications needed around auth flow, Stripe payment surface selection, and the credits state machine. The design guide's "architecture migration notes" section provides an unusually helpful head start — the Next.js App Router route structure is well-considered and correct.

---

## Architecture Strengths

**Next.js App Router route structure (design guide Section 9):** The proposed route groups — `(admin)/`, `(employee)/`, `(member)/`, `(auth)/` — are architecturally correct. Each route group gets its own layout with the appropriate navigation (admin sidebar vs. employee sidebar vs. member nav). Middleware can gate each group to specific roles without touching page components. This is clean and scalable.

**Supabase + RLS multi-tenancy:** Choosing Postgres RLS with `studio_id` on every table is the right call. It's the standard Supabase multi-tenant pattern, it's well-documented, and it puts tenant isolation at the database layer rather than the application layer (where it can be bypassed by bugs). The overhead is real but justified.

**Direct Stripe + Payment Element:** Using Payment Element rather than Checkout Session is the right choice for Meridian's use case. Payment Element supports Apple Pay/Google Pay, inline rendering (no redirect), and custom wallet offset logic. The downside (more integration work) is worth the UX control.

**60-second polling for Phase 1:** This is pragmatic and correct. React Query's `refetchInterval: 60000` handles this cleanly on the client. The Command Center "live" metrics update every 60 seconds — acceptable for an admin dashboard. The activity feed may need 30-second polling to feel genuinely live, but this is tunable.

**Turborepo monorepo:** Correct for the multi-surface architecture. When the iOS app and member portal are built in later phases, shared types (`@meridian/types`) and Supabase utilities (`@meridian/db`) prevent schema drift between surfaces.

**Design system completeness:** The design guide provides design tokens, component specs, animation specs, responsive patterns, icon mappings, and a route structure. This is an unusually complete pre-code artifact. A developer can implement consistent UI without design reviews for every component.

---

## Architecture Issues

### Issue 1: Phase 1 Web Portal Contradiction
**Severity: BLOCKER**

PRD Section 11 lists "Web Booking Portal (member-facing)" as a Phase 1 deliverable.
PRD Section 13 explicitly excludes it: "Member Web Booking Portal — will consume same Supabase backend."

The architecture impact: if the member portal is in Phase 1, its route group (`(member)/`) must be scaffolded, its auth flow must handle magic link + member role assignment, and its pages must be designed (they are not in the MagicPath prototypes). If it's out, the Supabase backend still must be designed with the member portal's eventual data needs in mind.

**Resolution:** Decide and document. The recommendation is to include a minimal member portal in Phase 1 (view schedule, book, display QR code, manage account) — otherwise Glofox cannot be decommissioned.

### Issue 2: No Database Schema
**Severity: BLOCKER**

The PRD describes data extensively. The edge cases document specifies tables needed for the guest system (`guest_invites`, `guest_profiles`, `guest_visits`, `member_referral_conversions`). But no schema file exists. A developer cannot implement the booking engine, the credit system, or the Stripe integration without a schema.

**What's needed before development:**
- All table definitions with column types and constraints
- Foreign key relationships (member → subscription → credits; booking → class_slot → check_in)
- RLS policy for each table (owner sees all studio data, manager sees all except financial settings, trainer sees own assignments and promo data, member sees own data only, front desk sees bookings and check-ins)
- Index strategy for high-frequency queries

### Issue 3: Turborepo Package Boundaries Undefined
**Severity: HIGH**

The PRD says "shared types, utilities, API client across all apps" but doesn't specify package contents. This matters because packages define what can change independently vs. what requires coordination. Recommended boundaries:

```
packages/
├── @meridian/types         — TypeScript interfaces for all database entities
├── @meridian/db            — Supabase client factory, shared query utilities, RLS helpers
├── @meridian/stripe        — Stripe client, webhook signature verification, payment intent utilities
├── @meridian/email         — Resend client, React Email templates, send functions
├── @meridian/ui            — Shared shadcn components with Meridian design tokens applied
└── @meridian/utils         — Date formatting (date-fns), QR code generation, geofencing math

apps/
├── dashboard               — Next.js (admin + employee + member routes)
└── (future) mobile         — React Native
```

### Issue 4: Auth Flow Not Fully Specified
**Severity: HIGH**

The PRD specifies magic link for members and roles via Supabase Auth, but doesn't describe:

**Magic link flow:** Member enters email → Supabase sends magic link → member clicks → redirected to `/auth/callback` → session established → redirected to `/member/dashboard`. This is the standard flow but must be implemented correctly in `app/(auth)/callback/route.ts`.

**Role assignment:** New users who sign up via magic link default to `member` role. Admin-created users get their role(s) set by the admin. How is this stored? **Recommended:** JWT custom claims via a Supabase `auth.users` trigger that populates claims from a `user_roles` table. This enables role-gating in Next.js middleware without a database lookup per request.

**Context switching:** An owner who is also a member — how do they switch between admin view and member view? **Recommended:** A persistent UI element (sidebar footer or header dropdown) that switches the app context. The URL changes (`/dashboard` vs. `/member/schedule`) but the session/JWT doesn't — roles are already in the JWT. No re-auth needed.

**Front desk role:** Front desk staff have limited access (check-in, member lookup, walk-in booking). They must not see financial data or member payment info. This needs an explicit middleware guard and RLS policy that's distinct from Manager and Owner.

### Issue 5: Credits Are Undocumented as a State Machine
**Severity: HIGH**

The credit system involves multiple states, transitions, and constraints that must be implemented atomically:
- Credit types: membership recurring, class pack purchased, trial/promo, family pool
- Credit lifecycle: allocated → available → reserved (at booking) → consumed (at class time? at booking time?) → expired
- Deduction priority: soonest-expiring first, per edge case 7
- Family pool: debited from pool regardless of which member books, per edge case 10
- Grace period: 7 days after membership renewal before credits expire
- The credit reservation for booking happens at booking time (not class time), per edge case 7

This is complex enough to warrant a state diagram and pseudocode before implementation. A developer who implements credits incorrectly will cause member-visible bugs (wrong balance displayed, wrong credits deducted, incorrect expiry behavior) that are hard to fix in production.

### Issue 6: Stripe Payment Surface Not Specified
**Severity: MEDIUM**

The PRD mentions Stripe, Apple Pay, Google Pay throughout but doesn't specify which Stripe integration surface handles which payment scenario:

- **Subscriptions (recurring memberships):** Create a Stripe Customer, create a Subscription with the appropriate Price ID. Handled server-side.
- **One-time purchases (drop-ins, class packs, merch):** Payment Element with PaymentIntent or a Checkout Session. Which?
- **Gift card purchases (any user, not necessarily a member):** Must work for non-authenticated users. Needs a Checkout Session or a guest payment flow.
- **Wallet offset (gift card balance → reduce charge):** Custom PaymentIntent with amount = (total - wallet balance). Must be server-side only.
- **Strike penalties ($5/$10):** Server-side PaymentIntent with `customer` + `payment_method` + `confirm: true`. Off-session charge.

**Recommendation:** Use Payment Element for all member-facing payments (consistent UX, Apple Pay/Google Pay support). Use server-side PaymentIntent creation for all off-session charges (penalties, subscription renewals).

### Issue 7: Waiver Facility Name Bug
**Severity: MEDIUM**

PRD Appendix A contains the full waiver text, which references "Cigar City CrossFit" as the Facility. This must be replaced with The Sauna Guys' current facility name and address before the waiver is shown to any member. The PRD notes this but a developer reading quickly might implement the waiver text as-is. This is a legal liability.

**Additionally:** The waiver system must be per-location configurable for multi-tenancy. The waiver text field must be a database column per studio, not a hardcoded string.

---

## Module Dependency Map

Order of implementation to minimize blocked work:

```
FOUNDATION (no dependencies — start here)
├── Turborepo scaffold + package setup
├── Supabase project + schema + RLS
├── Auth (magic link + JWT role claims + middleware)
└── Settings (studio config, Stripe keys)

PHASE 1A (depends on foundation)
├── Members module (requires Auth + schema)
├── Revenue — Stripe subscriptions (requires Auth + Members + Settings)
└── Schedule — class slot creation (requires Auth + Members)

PHASE 1B (depends on 1A)
├── Booking engine (requires Schedule + Revenue + Members)
├── Command Center (requires Booking + Revenue + Members for data)
├── Walk-in check-in (requires Booking)
└── Waitlist (requires Booking)

PHASE 1C (depends on 1B + parallel)
├── Member web portal — minimal (requires Booking + Auth + Revenue)
├── Employee portal — clock-in (requires Auth + geofencing)
├── Waivers (requires Members + Auth)
└── Data migration tooling (requires schema complete)

PHASE 2 (depends on Phase 1 stable)
├── Marketing campaigns (requires Members + Resend)
├── Automation flows (requires Marketing + Members + Revenue events)
├── Merch + inventory (requires Revenue + Stripe)
├── Gift cards (requires wallet schema + Stripe PaymentIntent)
├── Employee portal — full payroll (requires timeclock + trainer_classes)
└── React Native iOS app (requires stable API from Phase 1)
```

---

## Design System Implementation Notes

The design guide provides an exceptionally complete specification. Key implementation notes for Next.js:

**Framer Motion in App Router:** All components using `motion.*` or `AnimatePresence` must be in client components. The pattern: create a `PageTransition` client component wrapper in the layout, not on individual pages. This keeps pages as server components while enabling animations.

**shadcn/ui installation:** Each shadcn component is added individually (`npx shadcn@latest add button`). The design guide lists which primitives are needed: Dialog, DropdownMenu, Tabs, Table, Command, Toast, Tooltip, Sheet, Select, Input, Badge, Calendar, Popover, Avatar. Install all of these during initial setup.

**Tailwind v4 config:** v4 uses `@import "tailwindcss"` in CSS instead of a config file. Custom tokens (the Meridian color palette, spacing values) are defined via CSS custom properties in the global stylesheet. This differs from the v3 config pattern in the MagicPath prototypes but all the class names still work.

**The `qrcode` package:** Listed in dependencies for QR code generation. Generate QR codes server-side (in a Route Handler) and serve as PNG data URLs or SVG strings. Do not generate QR codes client-side — they may contain sensitive tokens (member UUID or signed JWT) that should not be exposed in the browser bundle.

**Dark mode:** The design guide specifies dark mode tokens (`#0F0F11` background, `#1A1A1F` cards). Tailwind v4 supports dark mode via `@variant dark` in CSS. The sidebar spec includes a dark mode toggle (Sun/Moon icons). This should use `next-themes` — which is in the "Drop" list from the design guide but is actually the standard solution for Next.js dark mode. This item in the "Drop" list should be reconsidered.

---

## Architecture Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RLS policy missing on a table → data leakage between tenants | High | Critical | RLS test suite before any multi-tenant data goes live |
| Stripe webhook handler missing event types | High | High | Audit Stripe event docs against every feature that depends on Stripe state |
| Credits state machine implemented incorrectly → balance bugs | Medium | High | State machine diagram + unit tests before implementation |
| Waiver text deploys with "Cigar City CrossFit" | High | Medium (legal) | Code review checklist item; waiver text stored in database not hardcoded |
| Dark mode toggle drops `next-themes` from deps | Medium | Low | Add `next-themes` back to dependency list |
| Framer Motion hydration issues in App Router | Medium | Low | Use client wrapper pattern consistently |
| QR code tokens exposed client-side | Low | Medium | Always generate QR tokens server-side |

---

## Summary

The architecture is sound and the design system is a genuine asset. The two blockers are the database schema (absent) and the Phase 1 scope contradiction (web portal in or out). The auth flow, credit state machine, Stripe payment surface selection, and Turborepo package boundaries all need one-page specs before development begins. None of these require significant new decisions — the PRD has the business logic; what's missing is the translation of that logic into implementation specifications.
