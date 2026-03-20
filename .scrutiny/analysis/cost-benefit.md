# Cost-Benefit Analysis
**Agent:** cost-benefit
**Plan:** Meridian Phase 3 — Analytics & Intelligence
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

Phase 3 delivers positive ROI on its core features (live analytics, reports, trainer dashboards, migration tooling). The cost concern is not whether to build Phase 3, but whether to build all of it at the claimed pace. The custom dashboard builder and two underscoped AI functions carry high build cost relative to their near-term value. The plan should trim these to reduce the total cost by ~20% while retaining 95% of the delivered value.

---

## Cost Estimate

### Developer Time

Plan claims 9–10 weeks (single developer). Based on scope analysis:

| Feature | Plan (weeks) | Realistic (weeks) |
|---------|-------------|-------------------|
| Sprint 1: DB + metric pipeline | 2 | 2 |
| Sprint 2: Reports engine | 1.5 | 3 |
| Sprint 3: AI hub + trainer dashboards | 1.5 | 2.5 |
| Sprint 4: Custom dashboards + pricing sim | 1.5 | 3 |
| Sprint 5: Migration + polish | 1 | 2 |
| **Total** | **9–10** | **12.5–13** |

At a solo developer rate of ~$100–150/hr (internal or contractor), this is:
- **Plan estimate:** $36,000–$60,000 (9–10 weeks at 40 hrs/week)
- **Realistic estimate:** $50,000–$78,000 (12.5–13 weeks)

The delta is $14,000–$18,000 of unplanned cost if the timeline slips to the realistic estimate.

### Infrastructure Cost (Ongoing)

**Anthropic API (new AI functions):**
- 6 new AI functions, 1 daily insight generation cron, batch churn prediction
- `generateInsights()` runs daily on 6 AM cron: roughly 2,000–4,000 input tokens + 1,000 output tokens per run
- At Claude Sonnet pricing (~$3/MTok input, $15/MTok output): ~$0.05–$0.10/day = ~$1.50–$3/month
- Batch churn prediction (1,103 members, monthly): ~500 tokens/member = ~$1.65–$3.30/month
- Total new AI cost: ~$5–10/month at current data volume

**Supabase Storage (report exports):**
- 30-day retention on exports
- Assuming 50 exports/month × 500 KB avg = 25 MB/month active storage
- Cost: negligible (<$0.10/month)

**Inngest/Netlify functions:**
- 6 cron jobs daily + weekly. At Inngest free tier (50K function runs/month): free
- If on paid tier: ~$12/month

**Total new monthly infrastructure cost:** ~$15–25/month — negligible.

---

## Benefit Analysis

### Benefit 1: Trainer Payroll Automation — $500–1,000/month saved

Currently, trainer compensation (base pay + bonus threshold check + promo commission) requires manual calculation. For a studio with 3–5 trainers running 15–20 classes/week, this is a 2–4 hour monthly task. The Trainer Payroll Report automates this to a one-click export.

At $50–75/hour of owner time: $100–300/month saved per payroll run × 2 owners = $200–600/month.

Additionally, the bonus threshold tracking eliminates disputes about whether a class qualified (it is now auditable from the dashboard). This has soft value in trainer retention.

### Benefit 2: CSV Data Export for Accounting — reduces 3rd-party bookkeeping cost

Transaction Log, Revenue Report, and Failed Payments exports are needed monthly for bookkeeping. If the studio currently exports from Glofox and reformats manually, this is a 2–4 hour task per month. The automated reports eliminate this.

Savings: $100–200/month in owner/bookkeeper time.

### Benefit 3: Churn Detection Leads to 1–2 Retained Members/Month (conservative)

The AI insights hub surfaces retention signals. If it identifies 5 at-risk members per month and the studio acts on 2 (outreach, offer), retaining 1 at $129/month unlimited = $129/month × 12 months = $1,548/year in retained revenue per recovered member.

Conservative assumption: Phase 3 AI retention tools contribute to retaining 1 additional member per month vs. no action. Annual value: ~$1,500.

### Benefit 4: Glofox Migration Risk Reduction — avoids double-billing incidents

Without the double-billing guard (Glofox renewal date tracking in the migration UI), a cutover error could result in charging members twice — once on Glofox, once on Meridian. One double-billing incident with a member who went to their credit card company costs: refund + chargeback fee ($15–25) + reputational damage.

The migration tooling reduces this risk substantially. Value: hard to quantify, but a single prevented chargeback cascade = $500–2,000 in direct costs.

### Benefit 5: SaaS Differentiation — analytics as a moat

For Meridian's future as a SaaS product, Phase 3's analytics module is a competitive differentiator. Competing platforms (Glofox, Mindbody, Pike13) either lack built-in analytics or require a premium add-on. Meridian with a full analytics engine — live dashboards, AI insights, CSV/PDF reports, trainer dashboards — justifies a higher SaaS price point.

If Meridian charges $300/month to 10 studio SaaS customers (vs. $200/month without analytics), the analytics module contributes $100/month × 10 = $1,000/month incremental SaaS revenue. This scales linearly.

---

## ROI Calculation (12-Month Horizon)

| Benefit | 12-Month Value | Confidence |
|---------|---------------|------------|
| Trainer payroll automation | $2,400–$7,200 | High |
| Accounting export time savings | $1,200–$2,400 | High |
| AI-assisted churn retention | $1,500–$3,000 | Medium |
| Double-billing risk avoidance | $500–$2,000 | Medium |
| SaaS differentiation premium (future) | $0–$12,000 | Low-Medium |
| **Total** | **$5,600–$26,600** | |

**Build cost (realistic):** $50,000–$78,000 (solo developer, 13 weeks)

**12-month ROI:** Negative on internal use alone. Breaks even only when SaaS customers are added. This is acceptable — Phase 3 is infrastructure investment, not an immediate revenue feature. The strategic case is sound; the financial case depends on SaaS adoption timeline.

---

## Cost-Benefit by Feature

| Feature | Build Cost (est.) | 12-Mo Value | Verdict |
|---------|------------------|-------------|---------|
| Live analytics overview | Low (2 days) | High (daily use) | Build |
| Reports engine — CSV + 13 templates | High (3 weeks) | Very High | Build |
| Trainer payroll + performance reports | Medium (within reports) | High | Build |
| Trainer performance dashboards | Medium (1 week) | High | Build |
| AI insights hub | Medium (1.5 weeks) | Medium-High | Build |
| Glofox migration tooling | Medium (1.5 weeks) | High (one-time) | Build |
| Pricing simulator | Medium (1 week) | Medium (1–2x/year use) | Build (descoped: no confidence intervals adds risk) |
| Custom dashboard builder | High (2–3 weeks) | Low (current scale) | Defer to Phase 4 |
| Seasonal Predictor AI function | Medium (3 days) | Low (insufficient data) | Defer |
| Cross-Sell Detection AI function | Medium (2 days) | Low (thin at scale) | Defer |
| Dashboard Export as PDF | High (complex) | Very Low | Cut |

**Cutting/deferring** the custom dashboard builder, seasonal predictor, cross-sell function, and dashboard PDF export saves approximately 3–4 developer weeks ($12,000–$18,000 at contractor rates) while retaining all high-value features.

---

## Cost Risk

**Largest cost risk:** Reports engine (Sprint 2). The query builder abstraction and PDF generation are the two most uncertain estimates. If either runs over by a week, the entire schedule shifts. Given the `@react-pdf/renderer` compatibility question with Netlify, Sprint 2 is the most likely source of cost overrun.

**Mitigation:** Timebox the PDF spike to 2 days in Week 1. If it proves problematic, switch to `pdfmake` or defer PDF export to Sprint 5. Ship CSV first — CSV delivers 80% of report value and is lower-risk.

---

## Opportunity Cost

Phase 4 (Corporate & Operations) is next. Phase 4 includes corporate portal, event management, employee portal enhancements, and SaaS onboarding. If Phase 3 runs 3–4 weeks over, Phase 4 starts late, which delays SaaS onboarding, which delays the SaaS revenue that makes the financial case for Phase 3 close.

Trimming Phase 3 scope (cut dashboard builder, defer 2 AI functions) accelerates the path to Phase 4 and SaaS revenue by 3–4 weeks. This is a meaningful opportunity cost consideration.
