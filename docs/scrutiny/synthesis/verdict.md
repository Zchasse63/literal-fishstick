# Scrutiny Verdict — Meridian PRD v1.0 (Run 2)

**Verdict:** MODIFY
**Confidence:** HIGH
**Date:** 2026-03-20
**Scrutiny Run:** 2 (follow-up to March 19 initial scrutiny)
**Agents Reporting:** 7/7 (all agents ran in Deep+ mode)
**Source Documents:** meridian-prd.md v1.0, magicpath-design-guide.md, edge-case-policies.md, CLAUDE.md

---

## Verdict Rationale

Meridian's PRD v1.0 is a strong, well-specified product plan with locked business logic, a complete design system, resolved edge cases, and a well-chosen tech stack. The differentiation thesis is real and specific. The internal build economics are favorable.

The verdict is MODIFY, not GO, because the PRD is complete at the WHAT level but incomplete at the HOW level. A developer can start scaffolding and static UI today, but cannot implement any data-driven feature. Three specific gaps must be closed first:

1. **No database schema exists.** (Flagged by 4/7 agents: technical-feasibility, scope-complexity, architecture-impact, edge-cases)
2. **Stripe integration flows are unspecified.** (Flagged by 3/7 agents: technical-feasibility, architecture-impact, edge-cases)
3. **Auth architecture is undefined.** (Flagged by 2/7 agents: technical-feasibility, architecture-impact)

These are not missing decisions -- the decisions are all made. What is missing is the translation of business logic into implementation specifications. Estimated effort to close all gaps: 2-3 focused days.

The verdict is MODIFY, not DEFER, because:
- No fundamental rethinking is needed
- The gaps are well-scoped and closable
- A developer CAN start productive work today (monorepo, UI, design system)
- The first scrutiny run's 4 blockers have been resolved

---

## What Changed Since Scrutiny Run 1 (March 19)

| Issue from Run 1 | Status |
|---|---|
| Web booking portal not in Phase 1 | RESOLVED -- added to Phase 1 scope |
| Multi-tenancy architecture undecided | RESOLVED -- Postgres RLS with studio_id on every table |
| Walk-in kiosk scope unclear | RESOLVED -- moved to employee iOS app (separate build) |
| Edge cases incomplete | RESOLVED -- all 18 fully defined with specific policies |

Additional progress:
- Complete design system extracted from MagicPath output (tokens, components, animations, routes)
- Component system decided (shadcn/ui)
- Full dependency list documented (keep/drop/add)
- All pricing, trainer pay, and policy decisions locked
- Route structure defined for Next.js App Router

---

## Remaining Issues by Priority

### BLOCKERS (Must resolve before implementing data-driven features)

**1. Database Schema Does Not Exist**
- Source agents: technical-feasibility (BLOCKER), architecture-impact (BLOCKER), scope-complexity, edge-cases
- ~35-40 tables implied across features and edge cases. Zero definitions exist.
- No table structures, column types, constraints, foreign keys, or RLS policies.
- A developer cannot implement booking, credits, Stripe integration, or any data-touching feature.
- Resolution: Write the Supabase schema. This is the single highest-priority pre-development task.
- Estimated effort: 1-2 days for full schema with RLS policies.

**2. PRD Section 11 vs. Section 13 Contradiction**
- Source agents: technical-feasibility (BLOCKER), scope-complexity (BLOCKER), architecture-impact (BLOCKER), user-value
- Section 11 includes "Web Booking Portal" in Phase 1. Section 13 excludes it.
- Per user decision (post-Run 1), the web portal IS in Phase 1. The PRD text must be updated.
- Resolution: Update Section 13 to remove the exclusion. Add minimal Phase 1 member portal spec (view schedule, book, QR display, manage account/payment, credit balance).
- Estimated effort: 30 minutes.

### HIGH (Must resolve before the affected feature is built)

**3. Auth Flow Architecture**
- Source agents: technical-feasibility (HIGH), architecture-impact (HIGH)
- Undefined: role storage mechanism (JWT custom claims via user_roles table), middleware route gating, magic link redirect chain, dual-role context switching UI, front desk vs. trainer permission boundaries.
- Resolution: 1-page auth architecture spec.
- Estimated effort: 2-4 hours.

**4. Stripe Integration Specification**
- Source agents: technical-feasibility (HIGH), architecture-impact (MEDIUM), edge-cases
- Undefined: webhook event inventory, Payment Element vs. Checkout Session per scenario, wallet offset flow, off-session strike penalties, proration preview API call, Stripe Customer bootstrap step.
- Resolution: 1-page Stripe integration spec mapping each payment scenario to its API surface.
- Estimated effort: 4-6 hours.

**5. Credit System State Machine**
- Source agents: technical-feasibility (HIGH), architecture-impact (HIGH), edge-cases
- The most complex data problem in the system. Multiple pack types with individual expiry, soonest-first deduction, family pools, 7-day grace period, booking-time reservation. Rules are decided but no state machine, pseudocode, or transaction flow exists.
- Resolution: State machine document with entity definitions, transition rules, deduction algorithm.
- Estimated effort: 3-4 hours.

**6. Edge Case 6 Uses Wrong Prices**
- Source agents: edge-cases (HIGH), technical-feasibility
- Proration example uses $79/mo and $149/mo (MagicPath values) instead of locked prices ($120/mo and $225/mo). Will produce wrong UI if developer uses as reference.
- Resolution: Update edge-case-policies.md with correct prices.
- Estimated effort: 5 minutes.

**7. Phase 1 Waitlist Notification Gap**
- Source agents: edge-cases (HIGH)
- Waitlist claim window is 15 minutes. Phase 1 has no push (no iOS app) and no SMS (stubbed). Email is the only channel and too slow for 15-minute windows.
- Resolution: Phase 1 fallback -- email + admin dashboard alert, extend claim window to 30 minutes. Full push/SMS waitlist in Phase 2.
- Estimated effort: Decision only.

### MEDIUM (Should resolve, not blocking)

**8. Turborepo Package Boundaries** -- architecture-impact (HIGH), technical-feasibility (MEDIUM). Both agents provided identical recommended structure. Decide before first `npm init`.

**9. Geofencing Accuracy** -- technical-feasibility (MEDIUM). 200m radius with +/-50-200m GPS accuracy creates false rejections. Increase to 300m. Define behavior for denied permissions.

**10. Waiver Facility Name** -- architecture-impact (MEDIUM). PRD Appendix A references "Cigar City CrossFit." Legal liability if deployed. Store in database for multi-tenancy, not hardcoded.

**11. Bonus Evaluation Timing** -- edge-cases (MEDIUM). "At class end (or 30 min after start)" is ambiguous. Clarify: evaluate at class_end_time.

**12. next-themes Dependency** -- architecture-impact (LOW). Design guide "drop" list includes next-themes, but dark mode toggle is in the sidebar spec. Add it back.

---

## Cross-Agent Agreements (High Confidence)

These findings appeared independently in 3+ agent reports:

| Finding | Agent Count | Assessment |
|---|---|---|
| Database schema is the #1 blocker | 4/7 | Unanimous. No dissent. Top priority. |
| Web booking portal must be in Phase 1 | 5/7 | Unanimous. Without it, Glofox cannot be decommissioned. |
| Design system is a genuine development accelerator | 5/7 | Complete tokens, components, animations, routes. Rare pre-code asset. |
| Multi-tenancy upfront is correct | 4/7 | 15-20% overhead justified. Retrofit cost would be 2-3x higher. |
| Tech stack is well-chosen | 4/7 | Mature, well-documented, no exotic dependencies. |
| Credit system complexity is underestimated | 3/7 | Needs its own implementation spec before coding. |
| Trainer economy is a unique competitive differentiator | 3/7 | No competitor has this as first-class infrastructure. |
| Phase 1 scope is ambitious for an undefined team size | 3/7 | Team size and timeline must be established. |

---

## Cross-Agent Conflicts and Resolutions

### Conflict 1: Phase 1 Scope -- Expand or Contract?

- scope-complexity: Phase 1 is too large. Defer Marketing, merch, gift cards, employee payroll.
- user-value: PULL trainer promo dashboards INTO Phase 1. Pull wellness tracking to Phase 2 (not Phase 4).
- cost-benefit: Scope depends entirely on team size, which is unstated.

**Resolution:** All three are correct from their perspectives. The synthesis: keep Phase 1 core as defined, ADD trainer promo/bonus visibility (1-2 week build, outsized value), DEFER Marketing module entirely to Phase 2 (biggest scope relief). Team size and target date must be established -- without a forcing constraint, scope will expand to fill all time.

### Conflict 2: AI Implementation Timing

- technical-feasibility: pgvector requires a non-Anthropic embedding model (dependency gap).
- competitive-context: AI narrative must be established in Phase 1 (urgency -- 18-24 month window).
- cost-benefit: LLM integration before 3-6 months of data produces low-quality output.

**Resolution:** Non-contradictory when synthesized. Ship rules-based AI briefing in Phase 1 (SQL queries formatted as natural language). Defer LLM-powered insights to Phase 3 when data exists. Add embedding model to Phase 3 dependencies. Market the rules-based version as "AI-powered" -- users see the output quality, not the implementation.

### Conflict 3: Community Board

- user-value: Defer indefinitely. At 11 members, empty social feed is worse than no feed.
- PRD: Places in Phase 2.

**Resolution:** user-value is correct. At current scale, a community board will feel dead and make the product seem abandoned. SnapWidget Instagram embed delivers community feel at zero cost. Defer until 100+ active members.

---

## Blind Spots (What No Agent Fully Covered)

1. **Testing strategy.** No agent addressed how 35+ tables with RLS policies, Stripe webhooks, and credit state machines will be tested. RLS policies in particular need automated testing -- a missing policy means data leaks between tenants. Recommendation: add a testing strategy (Vitest + Supabase local dev for RLS testing) to the pre-development checklist.

2. **Deployment pipeline.** No agent addressed CI/CD. Netlify handles frontend deployment, but Supabase migrations need a strategy. Recommendation: use Supabase CLI migrations from day one.

3. **Monitoring and error handling.** No agent deeply covered what happens when things fail in production (Stripe webhook fails, Supabase timeout, Anthropic API down). Recommendation: define error handling patterns and consider Sentry or equivalent for Phase 1.

4. **Accessibility.** The design system is visually complete but no agent assessed WCAG compliance. shadcn/ui components have accessibility built in, but custom components and the design token contrast ratios should be verified.

---

## What a Developer CAN Start Today

Before blockers are resolved, productive work includes:

1. Turborepo monorepo scaffold with package boundaries
2. Next.js App Router with route groups: (admin), (employee), (member), (auth)
3. shadcn/ui installation + Meridian design token application (CSS custom properties)
4. Static page builds from MagicPath prototypes (17 pages with visual reference)
5. Tailwind v4 global stylesheet setup
6. Sidebar navigation component with collapse animation
7. Supabase project creation (auth config, no schema yet)

This is approximately 1-2 weeks of productive work independent of the schema.

---

## Conditions for Upgrading to GO

The verdict becomes GO when:

1. Database schema is written (all tables, columns, types, constraints, RLS policies)
2. PRD Section 13 is updated to include web booking portal in Phase 1
3. Auth flow spec is documented (1 page)
4. Stripe integration spec is documented (1 page)
5. Credit state machine is documented (1 page)
6. Edge Case 6 prices are corrected
7. Team size and Phase 1 target date are established

Estimated time to close conditions 1-6: 2-3 focused days of specification writing. No new decisions required -- all business logic is locked. The work is translating decisions into implementation specs.

---

## Recommended Phase Structure (Modified)

### Phase 0: Pre-Build (2-3 weeks)
- Write database schema + RLS policies
- Write auth, Stripe, and credit specs
- Supabase project setup with schema
- Stripe product/price object configuration
- Glofox data export validation
- Glofox/Stripe account relationship audit

### Phase 1: Core + Minimal Member Portal (4-6 months, 2 engineers)
- Admin dashboard: Command Center, Schedule, Members, Revenue core, Operations/Settings
- Employee portal: clock-in (geofenced)
- Minimal member web portal: schedule, booking, account management, QR code, credit balance
- Trainer promo code dashboard + bonus visibility (ADDED from Phase 2)
- Waitlist with email notification + 30-min claim window
- AI briefing (rules-based v1)
- Data migration (Waves 1-3)
- Glofox decommission

### Phase 2: Engagement + Revenue Expansion
- Full Marketing module (campaigns, automations, lead pipeline)
- Merch inventory + gift cards
- Full Employee Portal (payroll, tax docs)
- Wellness journey tracking (member portal)
- Trainer public profiles
- SMS integration
- Community board evaluation (only if 100+ active members)

### Phase 3: Intelligence
- Analytics dashboards
- LLM-powered AI insights (churn prediction, scheduling optimization)
- Advanced reporting
- pgvector + embedding model integration

### Phase 4: Growth + SaaS
- Corporate module + events
- iOS React Native app
- Merch shipping
- SaaS onboarding for new studios
- ClassPass integration (competitive gap closure)

---

## Final Assessment

Meridian is a well-conceived, genuinely differentiated product with locked business logic, a complete design system, and a sound architecture. The PRD v1.0 is the strongest pre-code planning document produced for this project.

The modifications needed are implementation specifications, not strategy changes. The database schema is the single highest-value artifact that does not yet exist. Writing it unlocks everything else.

**The single most important action in the next 7 days:** Write the database schema.
**The single highest-risk external dependency:** Glofox/Stripe Connect account structure (determines payment method portability at migration).
**The most important decision not yet made:** Team size and Phase 1 target go-live date.
