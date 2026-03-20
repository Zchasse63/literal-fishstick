# Risk Register — Meridian PRD v1.0 (Run 2)

**Date:** 2026-03-20
**Source:** All 7 scrutiny agent reports, synthesized

---

## CRITICAL Risks

| # | Risk | Source Agents | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R1 | No database schema exists -- developer makes structural assumptions that produce data bugs, especially in credit system and booking engine | technical-feasibility, architecture-impact, scope-complexity, edge-cases | CERTAIN (it does not exist) | CRITICAL | Write the schema before any data-driven development. 1-2 day task. All business logic is locked. |
| R2 | Glofox Stripe Connect account is managed (not standard) -- payment methods not portable, all members must re-enter cards at migration | edge-cases, cost-benefit | MEDIUM (unknown until verified) | CRITICAL | Call Stripe support this week. Verify account type. If managed, plan a re-enrollment campaign. |
| R3 | RLS policy missing on one or more tables -- data leaks between tenants in SaaS mode | architecture-impact, technical-feasibility | HIGH (35+ tables, each needs 4-5 policies) | CRITICAL | Automated RLS test suite before any multi-tenant data goes live. Test every table x role combination. |

---

## HIGH Risks

| # | Risk | Source Agents | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R4 | Credit system implemented incorrectly -- wrong balance displayed, wrong credits deducted, incorrect expiry or family pool behavior | technical-feasibility, architecture-impact, edge-cases | MEDIUM | HIGH | Write state machine spec with pseudocode. Unit test deduction algorithm exhaustively before shipping. |
| R5 | Stripe webhook handler missing event types -- subscription changes not reflected, dunning not triggered, wallet transactions not confirmed | technical-feasibility, architecture-impact | HIGH | HIGH | Create webhook event inventory document. Test every event in Stripe sandbox. |
| R6 | Phase 1 scope exceeds team capacity -- no team size or timeline established | scope-complexity, cost-benefit, user-value | HIGH (no forcing constraint defined) | HIGH | Establish team composition and target go-live date before sprint 1. These inputs determine what Phase 1 actually contains. |
| R7 | Scope creep during development -- Marketing module, automation flow builder, community board consume time disproportionate to value | cost-benefit, scope-complexity | HIGH | HIGH | Strictly defer Marketing module to Phase 2. Defer community board until 100+ members. Automation flow builder is a 6-10 week build minimum -- treat as its own project. |
| R8 | Auth implementation bugs -- session management in App Router (middleware.ts + server client + browser client pattern) is frequently implemented incorrectly | technical-feasibility, architecture-impact | MEDIUM | HIGH | Write auth flow spec. Follow @supabase/ssr documentation precisely. Test role-based access on every route group. |
| R9 | Wrong prices in Edge Case 6 leak into proration UI | edge-cases, technical-feasibility | HIGH (uncorrected as of today) | MEDIUM | Fix edge-case-policies.md. Update $79 to $120, $149 to $225. 5-minute task. |
| R10 | Waiver deploys with "Cigar City CrossFit" facility name -- legal liability | architecture-impact | HIGH (uncorrected as of today) | MEDIUM | Update waiver text. Store in database column per studio, not hardcoded. |

---

## MEDIUM Risks

| # | Risk | Source Agents | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R11 | Waitlist auto-promotion fails silently in Phase 1 -- email too slow for 15-min claim window, no push/SMS available | edge-cases | HIGH | MEDIUM | Extend Phase 1 claim window to 30 minutes. Add admin dashboard alert as backup. Full push/SMS in Phase 2. |
| R12 | Geofencing false rejections -- 200m radius with +/-50-200m GPS accuracy | technical-feasibility | MEDIUM | MEDIUM | Increase effective radius to 300m. Add manager override for denied permissions. Test at studio location. |
| R13 | Framer Motion hydration mismatches in App Router | architecture-impact, technical-feasibility | MEDIUM | LOW | Use client wrapper pattern consistently. All motion components in "use client" wrapper layouts. |
| R14 | Tailwind v4 config confusion -- MagicPath prototypes used v3 class conventions | technical-feasibility, architecture-impact | LOW | LOW | v3 class names work in v4. Config approach differs (CSS-first, no tailwind.config.js). Document for developer. |
| R15 | AI features produce low-quality output before sufficient data exists | cost-benefit, competitive-context | MEDIUM (if LLM used too early) | MEDIUM | Ship rules-based briefing Phase 1. Defer LLM to Phase 3 after 3-6 months of operational data. |
| R16 | Community board launches to empty feed at current member scale | user-value | CERTAIN (at 11 members) | MEDIUM | Defer entirely. Use SnapWidget Instagram embed. Revisit at 100+ members. |

---

## Risk Heat Map

```
              LOW IMPACT    MEDIUM IMPACT    HIGH IMPACT    CRITICAL IMPACT
CERTAIN       |             | R16            |              | R1 (schema)
HIGH          |             | R9, R10, R11   | R5,R6,R7     | R3 (RLS)
MEDIUM        |             | R12, R15       | R4, R8       | R2 (Stripe)
LOW           | R14         | R13            |              |
```

---

## Risk Interaction Chains

**Chain 1: Schema -> Credits -> Stripe -> Member Trust**
R1 (no schema) -> R4 (credit bugs) -> R5 (webhook gaps) -> member sees wrong balance, gets charged incorrectly, loses trust. Entire chain is prevented by writing the schema first.

**Chain 2: Scope -> Timeline -> Competitive Window**
R6 (no team size) -> R7 (scope creep) -> competitive-context agent's 18-24 month AI window closes before Meridian ships. Prevented by establishing team size and hard Phase 1 deadline.

**Chain 3: RLS -> Multi-Tenant Data Leak**
R3 (RLS gap) -> one studio sees another's data -> trust-destroying SaaS incident. Prevented by automated RLS testing before onboarding any studio beyond The Sauna Guys.
