# Cost-Benefit Analysis — Meridian PRD v1.0

**Agent:** cost-benefit
**Complexity:** MAJOR (Deep+ mode)
**Date:** 2026-03-20
**Source:** meridian-prd.md v1.0, edge-case-policies.md, CLAUDE.md

---

## Agent Verdict

**GO** (on internal build economics if founder-built) / **MODIFY** (on SaaS path and team size assumptions)

The internal use case economics are favorable regardless of the SaaS ambition: eliminating Glofox fees, recovering failed payments via dunning automation, enabling self-service upgrades, and adding net-new revenue streams (merch, gift cards, corporate events) creates meaningful financial impact that justifies the build if the development is founder-driven or low-cost. The SaaS path is viable but requires explicit validation milestones that the PRD does not include. The risk is building an enterprise-grade SaaS product for a studio with ~11 active memberships — the architecture is right but the complexity overhead must be proportionate to actual operating scale.

---

## Current Costs Being Eliminated

**Glofox platform fees:** Not publicly priced, but comparable platforms (WellnessLiving, Pike13) run $150-350/month for a single-location boutique studio. Estimate: $150-300/month.

**Payment processing markup:** Glofox uses Stripe Connect and may retain a portion of transaction fees on top of Stripe's standard 2.9% + $0.30. At The Sauna Guys' estimated revenue ($10,000-25,000/month at ~11 active memberships × $120-225/month + drop-ins + packs), a 0.5% markup = $50-125/month in unnecessary fees.

**Operational labor from platform gaps:**
- Manual trainer bonus calculation: ~30 min/week × $25/hr = $55/month
- Manual membership upgrade processing: ~1 hr/week × $25/hr = $110/month
- Manual waitlist management: ~1 hr/week = $110/month
- Manual failed payment follow-up: ~2 hr/month = $50/month
- **Estimated labor waste:** $325/month

**Total ongoing cost of Glofox:** Estimated $475-750/month

---

## Revenue Upside Enabled by Meridian

Features that create new or recovered revenue:

| Feature | Estimated Annual Upside |
|---|---|
| Self-service upgrades (reduce friction → more upgrades happen) | $2,400-9,600/yr (assuming 2-8 additional upgrades/month × $100-200 revenue increase per upgrade) |
| Dunning automation (recover failed payments before churn) | $1,800-7,200/yr (recover 20-40% of failed payment events; at ~$180/mo ARPU, recovering 1-3 members/month) |
| Merch sales via web portal (new channel) | $3,000-15,000/yr (highly variable; depends on product launch) |
| Gift card sales (new revenue stream) | $2,400-9,600/yr (includes breakage — unredeemed balances become studio revenue over time) |
| Promo code optimization (trainer attribution → better campaign targeting) | $1,200-4,800/yr |
| Private events / corporate bookings (Phase 4 module) | $10,000-48,000/yr ($395+/hr at 2-10 events/month) |
| Reduced churn from AI briefing + early intervention | $2,400-9,600/yr (retain 1-2 members/month who would have churned; ~$200/member/month) |

**Conservative total annual upside:** $23,200-103,800/yr
**Midpoint estimate:** ~$50,000/yr in improved economics

---

## Build Cost Scenarios

### Scenario A: Founder Builds (Technical Founder or Co-Founder)

**Direct costs:**
- Netlify hosting: $0-19/month (Starter free tier → Pro for team features)
- Supabase: $0-25/month (Free tier → Pro for 8GB database)
- Stripe: 2.9% + $0.30 per transaction (standard rate, no markup)
- Anthropic API (AI briefing): ~$20-100/month depending on usage
- Resend: $0-20/month (up to 100K emails/month on paid tier)
- Total direct infrastructure: ~$40-165/month

**Time cost:** 4-6 months Phase 1 (founder full-time)

**Economics:** If annual savings + revenue upside = $50K/year, break-even on direct costs is immediate. Break-even on opportunity cost (4-6 months of founder time) depends on founder's alternatives.

**Verdict:** COMPELLING if founder has development skills.

### Scenario B: Single Hired Developer ($120-150K/year)

**Phase 1 cost:** $40,000-75,000 (4-6 months developer time)
**Full platform:** $130,000-200,000 (12-18 months)

**Break-even vs. internal savings:** 2.5-4 years on savings alone
**Break-even including revenue upside ($50K/yr total):** 1.5-2.5 years

**Verdict:** Marginal for internal use only. Viable if SaaS revenue materializes within 18 months of Phase 1 launch.

### Scenario C: Two-Person Team (Founder + 1 Developer)

**Phase 1 cost:** $60,000-100,000 (4-5 months at $150K/year developer)
**Full platform:** $180,000-280,000

**Verdict:** Requires SaaS path to justify. Internal savings alone don't justify this investment within a reasonable horizon.

---

## SaaS Path Economics

**Market:** ~40,000 boutique fitness studios in the US. Recovery/wellness niche (sauna, cold plunge, float, cryo) = ~3,000-6,000 studios. Initial target: sauna/recovery studios that share The Sauna Guys' exact booking model.

**Pricing:** Comparable platforms price $99-500/month. Meridian's positioning (direct Stripe = lower fees, AI-first, better UX) justifies $200-350/month. Target: $249/month as anchor price.

**Milestones:**
- 10 paying studios × $249/month = $29,880 ARR (ramen profitable for a solo founder)
- 50 paying studios × $249/month = $149,400 ARR (hire 1 support/success person)
- 100 paying studios × $249/month = $298,800 ARR (small team sustainable)
- 250 paying studios × $249/month = $747,000 ARR (meaningful SaaS business)

**Customer acquisition:** Studio switching cost is high. CAC in this market is likely $500-2,000 via outbound/content. At $249/month, payback period is 2-8 months — favorable unit economics but meaningful capital required for sales.

**The "build internal first" advantage for SaaS:** Having The Sauna Guys as a live reference customer is worth more than any marketing. A prospective studio can talk to a real owner who replaced Glofox. This is the most credible sales tool possible and costs nothing.

---

## Architecture Cost Overhead

The PRD correctly adds multi-tenancy (RLS with studio_id) from day one. This is the right call for the SaaS path but adds real development overhead:

| Architecture Choice | Development Overhead | Justification |
|---|---|---|
| RLS with studio_id on every table | +15-20% backend dev time | Essential for SaaS; retrofit is near-total rewrite |
| Turborepo monorepo | +5-10% initial setup | Right for multi-surface future |
| Supabase Edge Functions vs. direct client | +10% architecture decisions | Worthwhile for scalability |
| pgvector setup | +3-5% initial setup | Low overhead, high future value |
| **Total architecture overhead** | **+30-35%** | Justified by SaaS trajectory |

This 30-35% overhead is real but appropriate. Building a single-tenant app and later adding multi-tenancy would cost 2-3x more.

---

## The Biggest Cost Risk: Scope Creep

The PRD has no stated team size, timeline, or budget. Without a forcing constraint, scope will expand to fill all available time. The highest-risk scope additions:

1. **Community / social board:** Explicitly in the plan (Phase 2 marketing module). Building a functional social feed from scratch is a 2-4 month project. Given the current member base (~11 active), this investment will not be used.

2. **Automation flow builder (visual Zapier-like tool):** The Marketing module includes a "visual flow builder" with triggers and conditions. This is a product on its own. Estimated build: 6-10 weeks.

3. **Custom dashboard widget builder:** Listed in the Analytics module. Deferred in PRD Section 1.4. Keep it deferred — pre-built dashboards with good defaults are more valuable for a single-location studio.

4. **AI features before there's data:** The LLM-powered AI briefing needs context (member visit history, revenue trends) to be useful. Building the LLM integration before there's 3-6 months of data produces low-quality outputs and sets negative expectations.

---

## Infrastructure Cost at Scale

For the SaaS scenario (100 studios):

| Service | Cost at 1 Studio | Cost at 100 Studios |
|---|---|---|
| Supabase | $25/month | $500-1,000/month (scales with database size) |
| Netlify | $0-19/month | $99+/month (team plan + bandwidth) |
| Anthropic API | $20-100/month | $2,000-10,000/month (100 × daily briefings) |
| Resend | $20/month | $2,000/month (100 studios × email campaigns) |
| Stripe | 2.9% + $0.30 | 2.9% + $0.30 (doesn't scale with studios) |
| **Total infra** | ~$65-145/month | ~$4,600-11,100/month |

At 100 studios × $249/month = $24,900 MRR, infrastructure is 18-45% of revenue — high but manageable. Pricing must be at least $200/month to maintain viable margins at scale.

---

## Summary

Internal build economics: GO if founder-built, CONDITIONAL if hired team (requires SaaS path validation). The revenue upside (~$50K/yr midpoint) combined with fee elimination makes the internal case compelling for a technical founder. For a hired team, the SaaS path must deliver 50+ paying studios within 24 months of Phase 1 launch to justify the investment. The most important cost-management action is establishing a team size and timeline before writing a line of code — without a budget constraint, the scope will expand to consume all available resources.
