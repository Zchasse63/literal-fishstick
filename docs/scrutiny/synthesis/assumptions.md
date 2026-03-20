# Assumptions Register — Meridian PRD v1.0 (Run 2)

**Date:** 2026-03-20
**Source:** All 7 scrutiny agent reports

---

## CRITICAL Assumptions (Validate Before Building)

| # | Category | Assumption | Source Agents | Why It Matters | How to Validate | Effort |
|---|---|---|---|---|---|---|
| A1 | TECHNICAL | Stripe payment methods are portable from Glofox's Connect account | technical-feasibility, edge-cases, cost-benefit | If Glofox uses a managed Stripe Connect account, member payment methods cannot be transferred. All members must re-enter payment info at migration -- expect 20-40% temporary churn. | Log into Stripe dashboard. Check if Glofox's account is "Standard" (portable) or "Express/Custom/Managed" (not portable). Call Stripe support if unclear. | 1 hour |
| A2 | RESOURCE | Member data is exportable from Glofox in a usable format | edge-cases, scope-complexity | Migration Waves 1-3 require complete, clean data. If export is partial or malformed, migration timeline extends significantly. | Request a full data export from Glofox today. Verify export includes: member emails, credit balances per plan, booking history, membership type and status, waiver signatures. | 2 hours |
| A3 | RESOURCE | The development team has or can acquire Next.js App Router + Supabase RLS capability | technical-feasibility, cost-benefit | Entire Phase 1 depends on this stack. App Router (not Pages Router) and Supabase RLS are the specific sub-skills needed -- general "React experience" is insufficient. | Assess team skills. If no App Router or Supabase RLS experience, allocate 2-3 weeks ramp-up before feature development. | Assessment: 1 hour |
| A4 | TECHNICAL | The Sauna Guys has a direct Stripe account separate from Glofox | cost-benefit, technical-feasibility | If all revenue has flowed through Glofox's Stripe Connect sub-account, The Sauna Guys may not have its own Stripe account. Historical financial data and customer records may not be accessible. | Check Stripe dashboard access. Verify TSG has its own account. | 30 minutes |

---

## HIGH Assumptions (Validate During Phase 0)

| # | Category | Assumption | Source Agents | How to Validate | Effort |
|---|---|---|---|---|---|
| B1 | TECHNICAL | Supabase RLS with studio_id is sufficient for multi-tenancy | architecture-impact, technical-feasibility, scope-complexity | Standard Supabase pattern. Validate with a test: create 2 simulated studios, apply RLS policies, verify isolation. | 2-3 hours |
| B2 | TECHNICAL | Stripe's native proration engine handles the upgrade/downgrade scenarios correctly | technical-feasibility, edge-cases | Test in Stripe sandbox: create $120/mo and $225/mo prices, subscribe test customer, upgrade mid-cycle, verify calculation matches Edge Case 6 formula. | 2 hours |
| B3 | TECHNICAL | pg_cron is available and sufficient for scheduled jobs | edge-cases, technical-feasibility | Supabase supports pg_cron but not on all plans. Verify it is enabled on the chosen plan. Test: create a job that runs every minute, verify execution. | 1 hour |
| B4 | TECHNICAL | Web Geolocation API works reliably at 200-300m radius at the studio location | technical-feasibility | Test at the studio address with actual staff devices. Measure GPS accuracy. If >100m variance, increase geofence radius. | 1 hour on-site |
| B5 | TECHNICAL | The qrcode npm package produces codes scannable by standard iPad camera | architecture-impact | Generate sample QR at typical display size. Scan with the specific iPad model used at the front desk. | 30 minutes |
| B6 | RESOURCE | Team size and composition are sufficient for Phase 1 scope | scope-complexity, cost-benefit | Establish team composition. Map against Phase 1 scope. At 2 engineers: 4-6 months. Solo developer: 6-10 months. These are the forcing constraints. | Decision required |

---

## MEDIUM Assumptions (Validate During Phase 1)

| # | Category | Assumption | Source Agents | How to Validate | Effort |
|---|---|---|---|---|---|
| C1 | USER | Trainers agree with the bonus threshold structure ($20 at 7+ check-ins) | user-value | Discuss with Whitney, Drennen, and Trent before building payroll system. They may have different expectations about thresholds or rates. | 1 conversation |
| C2 | USER | Members will use self-service membership upgrades if available | user-value | Survey 5 members who have previously requested manual upgrades. | 30 minutes |
| C3 | MARKET | Other sauna/recovery studios share the same Glofox pain points | competitive-context | Interview 3-5 sauna studio owners outside Tampa. Ask specifically about dual-role accounts, proration, trainer attribution. | 3-5 hours |
| C4 | MARKET | Studios will pay $200-350/month for Meridian once proven | competitive-context, cost-benefit | Informal pricing conversations with 3-5 target studios before building SaaS billing. | 3-5 hours |
| C5 | USER | The corporate event opportunity ($395+/hr) is real and recurring | cost-benefit | Count corporate event inquiries over the next 60 days. If <2 inquiries, defer Corporate module beyond Phase 4. | Tracking only |
| C6 | MARKET | The AI differentiation window (18-24 months) is real | competitive-context | Monitor Walla, Mariana Tek, Glofox release notes quarterly for AI features. | Ongoing |
| C7 | TECHNICAL | React Native delivers acceptable "Apple-native" feel for the iOS member app | architecture-impact | Build a React Native prototype of the booking flow in Phase 2 planning. Evaluate against the design philosophy. | 1 week |
| C8 | USER | Walk-in volume is significant enough to prioritize kiosk mode | scope-complexity | Track walk-in count manually for 4 weeks. | Tracking only |

---

## Assumptions Likely to Be FALSE (Act Now)

| # | Assumption | Why Likely False | Recommended Action |
|---|---|---|---|
| F1 | The community/social board will be active at ~11-30 member scale | Social features require critical mass. At current scale, the board will be empty, making the app feel abandoned. | Defer community board entirely. Use SnapWidget Instagram embed for community feel. Revisit at 100+ active members. |
| F2 | Edge Case 6 proration examples are correct ($79/mo, $149/mo) | These are MagicPath prototype prices, not locked prices ($120/mo, $225/mo). | Fix edge-case-policies.md immediately. 5-minute fix. |
| F3 | next-themes should be dropped from dependencies | Design guide "drop" list includes next-themes, but sidebar spec includes dark mode toggle. next-themes is the standard Next.js dark mode solution. | Add next-themes back to the keep list. |
| F4 | Anthropic SDK can handle vector embeddings for pgvector | Anthropic SDK generates text, not embeddings. pgvector requires a separate embedding model (e.g., OpenAI text-embedding-3-small). | Add embedding model provider to Phase 3 dependency list. Not a Phase 1 concern. |
| F5 | LLM-powered AI briefing will be useful before 3-6 months of operational data exists | LLM needs context (visit patterns, revenue trends) to produce quality insights. Early outputs will be generic and set negative expectations. | Ship rules-based AI briefing in Phase 1. Defer LLM to Phase 3 when data exists. |

---

## Assumption Interaction Map

Some assumptions compound if multiple prove false:

- If A1 (Stripe portability) AND A2 (data export) are both false: migration becomes a manual, high-touch process with significant member churn risk. This combination would change the launch strategy from "soft migration" to "hard cutover with re-enrollment."

- If A3 (team skills) AND B6 (team size) are both unfavorable: Phase 1 timeline extends to 10-12 months for a single developer ramping up on unfamiliar stack. At that timeline, competitive-context agent's AI window concern becomes material.

- If C3 (market validation) AND C4 (pricing validation) are both false: the SaaS path is not viable, and the 30-35% architecture overhead for multi-tenancy was a wasted investment. Internal use case still justifies the build, but ROI is lower.
