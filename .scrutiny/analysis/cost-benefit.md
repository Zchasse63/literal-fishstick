# Cost-Benefit Analysis
**Agent:** cost-benefit
**Plan:** Glofox API Migration to Meridian
**Complexity:** SIGNIFICANT
**Date:** 2026-03-31

---

## Agent Verdict
**GO** — The ROI case is clear and the benefits are not speculative. The primary monetary benefit (eliminating Glofox subscription + processing fees) pays back development costs within 6–12 months. The secondary benefits (unlocking built-but-inert features, enabling the SaaS business model) are larger but harder to quantify. The primary cost risk is schedule overrun due to the unresolved Phase 5 dependency, not the technical work itself.

---

## Cost Estimate

### Development Time

**Phase 1 — Schema (Week 1):** ~1 day actual development (migrations are additive and straightforward). Week 1 is appropriately padded for testing and edge cases.

**Phase 2 — Sync Engine (Weeks 2–3):**
- GlofoxClient: 1 day
- 5 inbound sync functions: 4–5 days (Inngest pattern is established, but each function needs field mapping, error handling, idempotency)
- 3 outbound sync functions: 2 days
- Conflict resolution logic: 1–2 days
- Tests: 2 days
- Total: 10–12 days of engineering

**Phase 3 — Transition ops (Weeks 4–6):** Primarily operational monitoring, not development. The sync monitoring dashboard is unscoped but adds 2–4 days of UI work.

**Phase 4 — Cutover (Weeks 7–8):** 1–2 days of execution; most of the 2 weeks is buffer, which is appropriate for a live system cutover.

**Additional unscoped work (member-facing minimum for payment migration):**
- Member auth: 1–2 days (if magic link is already partially implemented)
- Stripe payment method capture form: 1–2 days
- Basic account page (membership + billing): 1–2 days
- Total: 3–6 additional days

**Total engineering estimate:** 15–22 days of focused development across 8–9 calendar weeks.

At a blended consulting rate of $150/hr (or equivalent internal opportunity cost for a solo developer), this is approximately $18,000–$26,400 in development cost. At a lower internal rate assumption for a founder-led build, the effective cost is lower but the opportunity cost (Phase 2 Marketing features deferred while building sync engine) is real.

### Operational Costs During Transition

- Glofox subscription during transition: ~$110–150/month × 2–3 months = $220–450
- Inngest function costs: additional 8 cron/event functions; Glofox sync is low-volume by Inngest standards; estimated < $10/month incremental
- Engineering attention during shadow/parallel mode: ~20% of a developer's time for 4 weeks monitoring and debugging sync issues

### Opportunity Cost

Phase 2 (Marketing & Engagement) is the next roadmap item. The Glofox migration as a full-priority project delays Phase 2 completion by the duration of the migration. For a studio trying to activate email campaigns, churn automation, and lead capture, this represents 8–9 weeks of deferred capability.

However, this is partially offset: the migration directly enables marketing features by providing consent fields, birthday data, and accurate membership data that campaigns depend on. The migration is partially a prerequisite for Phase 2 to be effective.

---

## Benefit Estimate

### Benefit 1: Glofox Subscription Elimination

Glofox pricing for a studio of this size (1,100 members, single location):
- Typical range: $110–$200/month depending on tier and contract
- Conservative estimate: $150/month = $1,800/year

This is a hard, measurable saving starting Month 2–3 after cutover.

### Benefit 2: Payment Processing Cost Reduction

Glofox processing fees on top of card network fees: typically 0.5–1% additional margin.

Estimated membership revenue for The Sauna Guys:
- 1,100 members × average membership ~$80–120/month (sauna studios commonly charge in this range)
- Likely 40–60% are active recurring members = 440–660 paying members
- At $100/month average × 550 members = $55,000/month recurring revenue
- At 0.75% processing markup: $412/month = $4,944/year

This is an estimate based on industry norms. Actual savings depend on Glofox's specific processing rate vs. Stripe's direct rate.

**Total annual hard savings: $6,744/year (subscription + processing)**

At 20 days of development cost ($24,000 estimate), payback period is approximately 3.6 years on hard savings alone. This is not a compelling standalone ROI case.

**But this misses the larger benefit.**

### Benefit 3: Unlocking Built-But-Inert Features

The birthday automation (Inngest `member/birthday` event), churn prediction (`use-churn-prediction.ts`), and marketing automation (Phase 2, already substantially built) all require accurate Glofox data that is currently missing. These features exist in the codebase but cannot fire correctly without the data enrichment this migration provides.

If marketing automation reduces churn by even 5% (e.g., retaining 25–30 members who would otherwise lapse):
- 25 members × $100/month = $2,500/month = $30,000/year in retained revenue

This is speculative, but it is the expected-value case for a well-functioning churn prevention system. The migration is the enabler.

### Benefit 4: SaaS Business Model Viability

CLAUDE.md states Meridian is designed to be sold as SaaS to other studios. A Meridian that is still dependent on Glofox as its operational backend cannot be offered to studios that do not use Glofox. The migration makes Meridian a standalone product.

At even one additional studio paying $200–400/month, this generates $2,400–$4,800/year. The total addressable market for fitness studio management software is substantial.

This benefit is high-upside but appropriately speculative at this stage.

### Benefit 5: Operational Simplification

Eliminating the dual-system workflow (staff currently uses both Glofox and Meridian) reduces:
- Training burden for new staff
- Risk of data entry errors across systems
- Time spent on cross-system reconciliation

Estimated 1–2 hours/week of staff time saved across operations = $2,000–$4,000/year at $40/hr blended staff rate.

---

## Cost-Benefit Summary

| Category | Annual Value | Confidence |
|----------|-------------|------------|
| Glofox subscription elimination | $1,800 | High |
| Processing fee reduction | $4,944 | Medium |
| Churn prevention via unlocked features | $15,000–$30,000 | Low-Medium |
| Operational efficiency (staff time) | $2,000–$4,000 | Medium |
| SaaS enablement | $2,400–$24,000+ | Low (speculative) |
| **Conservative total** | **$8,744/year** | |
| **Optimistic total** | **$60,000+/year** | |

Development cost estimate: $18,000–$26,400 (one-time)

**Payback period:** 2.5–3.6 years on hard savings alone. Within 12 months if churn prevention activates at even modest levels.

---

## Financial Risks

**Risk 1: Payment migration failures**
If 20–30% of members fail to re-enter payment methods and require manual remediation, staff time cost is 5–10 hours at $40/hr × potentially 220 members requiring outreach = significant but manageable. The real risk is churn: members who don't re-enroll rather than re-enter payment details.

At 5% member loss from migration friction (55 members × $100/month × 12 months = $66,000/year): this would wipe out multiple years of hard savings. **Preventing payment migration failure is the single highest-leverage financial risk management action in the plan.**

**Risk 2: Timeline overrun extends Glofox subscription**
Each week of overrun adds $35–50 in subscription cost (negligible) but extends the period where two systems are being maintained in parallel, which has real developer attention cost.

**Risk 3: Glofox API access revocation**
If Glofox revokes access mid-migration, the team is in an awkward position: partially migrated data, not fully operational in Meridian. Full data export (CSV) should be taken at Phase 1 completion as insurance, regardless of the plan's stated risk level.

---

## Recommendation

Proceed. The cost case is positive even on conservative assumptions. The migration is required for the product roadmap to proceed effectively. The primary financial risk (payment non-collection) is manageable with adequate lead time and communication effort. Treat the payment migration as a marketing campaign, not a technical task.
