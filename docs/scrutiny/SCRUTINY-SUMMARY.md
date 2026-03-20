# SCRUTINY SUMMARY -- Meridian PRD v1.0 (Run 2)
**Fitness Studio Operating System -- Admin Dashboard + Employee Portal + Member Web Portal**

**Verdict: MODIFY**
**Complexity: MAJOR**
**Date: 2026-03-20**
**Run: 2 of 2 (all 4 blockers from Run 1 are resolved)**
**Agents: 7/7 (technical-feasibility, scope-complexity, user-value, cost-benefit, architecture-impact, edge-cases, competitive-context)**

---

## The One-Paragraph Verdict

Meridian's PRD v1.0 is an exceptionally well-prepared planning document. Business logic is locked, design system is complete, 18 edge cases are decided, stack choices are excellent, and the differentiation thesis (direct Stripe, trainer economy, AI-native) is real and specific. A developer can start monorepo scaffolding and static UI today. The verdict is MODIFY because three implementation specifications must be written before any data-driven feature can be built: (1) the database schema (~35-40 tables, zero of which are defined), (2) the Stripe webhook handler inventory, and (3) the auth flow implementation spec. Additionally, the PRD text still contains a direct contradiction between Section 11 and Section 13 about the web booking portal -- the decision has been made (it is in Phase 1) but the document has not been updated. These are specification gaps, not strategy problems. Estimated effort to close all gaps: 2-3 focused days. No new decisions are required.

---

## Top 3 Concerns

**1. No database schema.** 4 of 7 agents flagged this as the top blocker. The PRD describes ~35-40 tables of data but defines none of them. The credit system, booking engine, and Stripe integration cannot be built without it. Writing the schema is the single highest-value pre-development task.

**2. Team size and timeline are undefined.** 3 of 7 agents flagged this. Phase 1 scope is ambitious -- 8 admin modules, employee portal, member web portal, Stripe integration, data migration. Without a team composition and target date, scope will expand to consume all available time. A 2-person team needs 4-6 months. A solo developer needs 6-10 months.

**3. Glofox/Stripe account structure is unverified.** The migration plan assumes payment methods are portable. If Glofox uses managed Stripe Connect accounts (common), member payment data cannot be transferred. All members would need to re-enter card info at launch -- a significant operational risk. One phone call to Stripe support resolves this uncertainty.

---

## Confidence by Domain

| Domain | Rating | Notes |
|---|---|---|
| Value proposition | STRONG | Pain is real, daily, verified. Top-value features are lowest-cost to build. |
| Competitive positioning | STRONG | Direct Stripe + trainer economy are structural advantages, not copyable features. |
| Business logic | STRONG | 18 edge cases decided. All pricing locked. All policies explicit. |
| Design system | STRONG | Complete tokens, components, animations, routes. Unusually thorough for pre-code. |
| Architecture (conceptual) | STRONG | Stack well-chosen. Multi-tenancy correct. Module structure logical. |
| Implementation specs | NEEDS WORK | Schema absent. Auth undefined. Stripe webhooks unspecified. |
| Edge case documentation | GOOD | 18 decided. 2 have minor errors (wrong prices, ambiguous timing). 8 additional missing but non-blocking. |
| Cost justification | CONDITIONAL | Excellent if founder-built. Requires SaaS path if hiring engineers ($50K+/yr upside vs. $60-100K build cost). |

---

## What to Do Next (In Order)

### This Week (Resolve Before Sprint 1)

1. **Fix the PRD contradiction.** Update Section 13 to include the web booking portal in Phase 1. Add a brief spec for the minimal member portal (schedule, booking, QR display, account management, credit balance). _30 minutes._

2. **Fix Edge Case 6 prices.** Change $79/mo to $120/mo and $149/mo to $225/mo in the proration example. _5 minutes._

3. **Fix Edge Case 12 timing.** Change "or 30 minutes after class start" to "at class_end_time." _5 minutes._

4. **Call Stripe support.** Verify whether The Sauna Guys' Stripe account is standard (payment methods portable) or a managed Connect sub-account under Glofox (not portable). _1 hour._

5. **Establish team size and Phase 1 target date.** This determines everything else about scope. _Decision._

### Next 2-3 Days (Write the Missing Specs)

6. **Write the database schema.** All tables, columns, types, constraints, foreign keys, RLS policies. The PRD and edge cases contain all the business logic -- it needs translation into SQL. _1-2 days._

7. **Write the auth flow spec.** Role storage (JWT custom claims), middleware pattern, magic link redirect chain, dual-role context switching. _2-4 hours._

8. **Write the Stripe integration spec.** Webhook event inventory, Payment Element vs. Checkout Session per scenario, wallet offset flow, off-session penalty charges. _4-6 hours._

9. **Write the credit state machine.** Entity definitions, state transitions, deduction algorithm, family pool logic, grace period handling. _3-4 hours._

### Parallel (Start Now, Complete Before Migration)

10. **Request full Glofox data export.** Verify it includes member emails, credit balances, booking history, membership status.

11. **Test Stripe proration in sandbox.** Create $120/mo and $225/mo prices, subscribe a test customer, upgrade mid-cycle, verify calculation.

12. **Verify pg_cron on chosen Supabase plan.** Required for credit expiry notifications, inventory holds, bonus evaluation.

---

## What a Developer CAN Start Today

Before the schema and specs are written, productive work includes:

- Turborepo monorepo scaffold with package boundaries
- Next.js App Router with route groups: (admin), (employee), (member), (auth)
- shadcn/ui installation + Meridian design tokens (CSS custom properties)
- Static page builds from all 17 MagicPath prototype pages
- Sidebar navigation with collapse animation
- Tailwind v4 global stylesheet
- Supabase project creation (auth config)

This is 1-2 weeks of work that does not depend on the database schema.

---

## What Is Unambiguously Right (Do Not Change)

- **Stack:** Next.js + Supabase + Stripe direct + Turborepo
- **Direct Stripe:** Structural cost advantage over every competitor
- **Single account, multiple roles:** Solves the daily Glofox frustration
- **18 edge cases decided:** Eliminates mid-development ambiguity
- **Multi-tenancy from day one:** 15-20% overhead now vs. total rewrite later
- **60-second polling Phase 1:** Pragmatic. React Query handles it cleanly.
- **Rules-based AI briefing Phase 1:** Establishes AI positioning without LLM complexity
- **Trainer economy features:** No competitor has this. Trainers become platform advocates.
- **Design system completeness:** Tokens, components, animations, routes -- all documented

---

## What to Defer or Drop

| Item | Action | Reason |
|---|---|---|
| Community / social board | DEFER to 100+ members | Empty feed at 11 members is worse than no feed |
| Marketing module | DEFER to Phase 2 | Biggest scope relief for Phase 1 |
| Automation flow builder | DEFER to Phase 2 | 6-10 week build minimum; its own product |
| LLM-powered AI (beyond rules briefing) | DEFER to Phase 3 | Needs 3-6 months of data to produce quality output |
| Custom dashboard widget builder | DEFER indefinitely | Pre-built dashboards serve single-location better |
| Corporate module | DEFER to Phase 4 | Zero value until corporate clients exist (track inquiries first) |
| Instagram API integration | DROP | Meta deprecated Basic Display API. Use SnapWidget embed. |
| Weather correlation | DROP | Not actionable for single studio |
| IoT equipment logging | DROP | No sensors exist |

---

## SaaS Path Notes

- Internal build economics are compelling if founder-built (~$50K/yr upside vs. ~$65-165/mo infra cost)
- SaaS requires 50+ studios at $249/mo to sustain a small team ($150K ARR)
- Best initial market: sauna/recovery/wellness studios (3,000-6,000 US locations sharing the exact same booking model)
- Lead with direct Stripe savings and trainer economy in positioning, not "AI-powered" (AI is table stakes by 2027)
- ClassPass integration gap vs. Mindbody -- add to Phase 3-4 roadmap
- The Sauna Guys as a live reference customer is the most credible sales tool possible

---

## Files in This Scrutiny Run

| File | Content |
|---|---|
| `.scrutiny/normalized-plan.md` | Normalized plan (v2, PRD v1.0) |
| `.scrutiny/analysis/technical-feasibility.md` | Full technical analysis |
| `.scrutiny/analysis/scope-complexity.md` | Scope and phasing analysis |
| `.scrutiny/analysis/user-value.md` | User value analysis by stakeholder |
| `.scrutiny/analysis/cost-benefit.md` | Cost-benefit and SaaS economics |
| `.scrutiny/analysis/architecture-impact.md` | Architecture impact analysis |
| `.scrutiny/analysis/edge-cases.md` | Edge case audit (18 reviewed + 8 new identified) |
| `.scrutiny/analysis/competitive-context.md` | Competitive landscape and positioning |
| `.scrutiny/synthesis/verdict.md` | Detailed verdict with conditions for GO |
| `.scrutiny/synthesis/assumptions.md` | Full assumptions register (4 critical, 6 high, 8 medium, 5 likely false) |
| `.scrutiny/synthesis/risks.md` | Risk register with heat map (3 critical, 7 high, 6 medium) |
| `.scrutiny/planning/scope-decomposition.md` | Revised phase breakdown |

All files at: `/Users/zach/Desktop/Fitness Dashboard/.scrutiny/`
