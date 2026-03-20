# Cost-Benefit Analysis — Phase 4: Corporate & Operations

**Agent:** cost-benefit
**Plan:** Meridian Phase 4
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

The core Phase 4 features (corporate accounts, events, employee payroll, merch shipping) have a clear and justifiable cost-benefit ratio. The SaaS onboarding and custom dashboard builder have negative ROI in the near term — they consume significant developer time to serve a customer base that does not yet exist. Splitting Phase 4 into 4A (operations-focused) and 4B (SaaS platform) would preserve the high-ROI work and defer the speculative work.

---

## Development Cost Estimate

Based on the scope-complexity analysis (realistic timeline):

| Component | Plan Estimate | Realistic Estimate | Risk Multiplier |
|---|---|---|---|
| Corporate Accounts + Invoicing | 2 weeks | 2.5 weeks | Low |
| Events Management | 2 weeks | 3 weeks | Low-Medium |
| Employee Enhancements | 3 weeks | 3 weeks | Medium |
| Merch + Shipping | 2 weeks | 3 weeks | Medium |
| SMS/Twilio | Bundled in Sprint 5 | 0.5 weeks | Very Low |
| SaaS Onboarding | Bundled in Sprint 5 | 4–5 weeks | High |
| API Keys + Docs | Sprint 6 | 1.5 weeks | Low |
| Custom Dashboard Builder | Sprint 6 | 3–4 weeks | Medium |
| Polish + Integration | Sprint 6 | 1.5 weeks | Low |
| **Total** | **12–14 weeks** | **22–23 weeks** | — |

At a blended developer rate of $100–150/hour (40h/week), the realistic Phase 4 total is:
- **Plan cost:** $48,000–$84,000
- **Realistic cost:** $88,000–$138,000

The gap is primarily SaaS onboarding ($40–60k of effort serving no current customer) and the dashboard builder ($12–24k for a feature with low marginal value).

---

## New Operating Cost: Third-Party Services

### Twilio (SMS)

- Outbound SMS: ~$0.0075 per message in the US
- For a studio sending reminders to 200 members per class, 3 times/week: ~600 SMS/week = $4.50/week = $18/month
- Campaign sends (burst to full member list of, say, 500 members): $3.75 per campaign
- At scale with multi-tenancy: each studio contributes $20–50/month in SMS costs
- **Assessment:** Low cost, high value. SMS open rates (~98%) vs email (~25%) make this efficient marketing spend.

### EasyPost (Shipping)

- Label creation: $0 for the label itself — you pay the carrier rate
- EasyPost's margin on USPS rates vs commercial rates is minimal for low-volume studios
- For a boutique studio shipping maybe 10–20 orders/month: carrier costs $40–120/month, EasyPost overhead negligible
- **Assessment:** Pass-through cost. Studios charge shipping to customers, so this is revenue-neutral or positive.

### SaaS Stripe Billing

- Stripe billing: 0.5–0.8% of subscription revenue (standard billing tier)
- For a starter plan at $149/month with 50 studios: $7,450/month revenue, $37–60/month Stripe fees
- **Assessment:** Acceptable at scale. Irrelevant until there are paying SaaS customers.

### Supabase Storage (Employee Documents)

- Free tier: 1 GB. Pro: 100 GB at $25/month
- W4/W9/I9 documents are small PDFs (50–200 KB each). A studio with 20 employees and 5 documents each = ~100 files = ~10–20 MB
- **Assessment:** Trivially small storage cost. Well within free tier for a single studio.

---

## Revenue Impact: Corporate & Events

This is the most direct ROI in Phase 4.

**Corporate wellness contracts:** A single company with 20 employees on a $200/month membership allocation is $4,000/month recurring corporate revenue. If The Sauna Guys closes even 2–3 such contracts, Phase 4 pays for itself quickly. Without Phase 4, these contracts are managed via spreadsheet and at risk of churn due to poor tracking.

**Event management:** A birthday party or corporate event at The Sauna Guys (private venue rental + instructor) likely prices at $500–1,500 depending on group size. If Phase 4 enables them to handle 2 additional events/month that were previously turned away due to operational friction, that is $1,000–3,000/month additional revenue. The invoice PDF and deposit workflow makes it professional and defensible to charge premium rates.

**Estimated annual revenue uplift attributable to Phase 4 for The Sauna Guys:** $60,000–$120,000 (conservative, based on 3 corporate contracts + 2 events/month). This easily justifies the development cost.

---

## Cost of Not Building Phase 4

**Status quo cost (The Sauna Guys):**
- Corporate accounts managed in spreadsheets → risk of lost deals, no visibility
- Events managed via email → opportunity cost of deals not closed, invoicing delays
- Payroll calculated manually → 2+ hours/biweekly period, error risk, employee friction
- Merch orders tracked manually → staff time, fulfillment errors
- No tax document system → compliance risk, paper forms in drawers

**Opportunity cost of delay:** Each month without corporate account management is a month where The Sauna Guys cannot scale their B2B revenue confidently. Corporate wellness is a growing market segment and early operational infrastructure creates a competitive moat.

---

## ROI by Feature

| Feature | Dev Cost | Annual Value | Payback Period |
|---|---|---|---|
| Corporate Accounts + Events | ~$40,000 | $60,000–120,000 | 4–8 months |
| Employee Payroll | ~$20,000 | $5,000 (owner time saved) + compliance risk reduction | 4 years (time savings alone) |
| Merch Shipping | ~$15,000 | $5,000–15,000 incremental merch revenue | 1–3 years |
| SMS/Twilio | ~$2,500 | Hard to isolate; contributes to retention and conversion | 1–2 years |
| SaaS Onboarding | ~$40,000–60,000 | $0 until first SaaS customer acquired | Unknown |
| Custom Dashboard Builder | ~$15,000–24,000 | Marginal — existing dashboards are comprehensive | Very long |

---

## Budget Recommendation

**Build Phase 4A** (corporate, events, employee, merch, SMS, API keys/docs) with a budget of $60,000–80,000 and timeline of 14–16 weeks.

**Defer Phase 4B** (SaaS onboarding, Stripe Billing for SaaS, custom dashboard builder) until:
1. The first non-Sauna Guys studio has signed up for a pilot, OR
2. The owner explicitly decides to invest in SaaS positioning

This approach delivers the features with clear ROI now, and avoids spending $50,000+ building an onboarding wizard for a customer who doesn't exist yet.

---

## Financial Risk Flags

**Twilio pricing volatility:** Twilio has raised prices multiple times. The SMS factory pattern correctly keeps the provider swappable. Don't hard-code Twilio pricing assumptions into the cost model.

**EasyPost rate changes:** EasyPost's commercial rates are generally below retail, but USPS rates change annually. The shipping cost passed to customers should be calculated at label generation time, not estimated in advance.

**SaaS pricing strategy:** The plan shows starter/growth/enterprise tiers but no pricing is defined. This is a business decision that must be made before Sprint 5. Building the billing infrastructure without knowing what to charge is technically possible but creates rework risk if the pricing model changes (per-location vs per-member vs flat rate).
