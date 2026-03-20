# Competitive Context Analysis
**Agent:** competitive-context
**Plan:** Meridian Phase 3 — Analytics & Intelligence
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**GO**

Phase 3 builds a genuinely differentiated analytics layer in an area where incumbent platforms are demonstrably weak. The combination of trainer economics tracking, AI-driven insights, and migration tooling is not replicated by any competitor at this market tier. The custom dashboard builder is the one area where competitors have more mature offerings — which reinforces the case for deferring it rather than trying to out-build BI tools in Phase 3.

---

## Competitive Landscape

### Glofox (Primary Competitor Being Replaced)

**Analytics capabilities:**
- Basic reporting: class attendance, membership stats, revenue summaries
- Reports are largely static — no custom configurations, no CSV export on lower tiers
- No AI features
- No trainer performance tracking beyond class attendance counts
- No pricing simulation tools
- Data export is a pain point documented in the CLAUDE.md and referenced in `dashboard-research.md`

**Migration relevance:** The fact that Phase 3 includes Glofox migration tooling is itself a competitive action — it removes the switching cost barrier that keeps studios locked in Glofox.

**Gap Meridian fills:** Everything in Phase 3 is a gap that Glofox does not fill. This is not exaggeration — Glofox's analytics are a documented pain point across the 15+ platforms surveyed in `dashboard-research.md`.

---

### Mindbody (Largest Player)

**Analytics capabilities:**
- Mindbody has more mature reporting than Glofox
- "Insights" dashboard shows revenue, retention, and booking trends
- PDF and CSV export available on higher tiers
- No AI narrative or AI-driven anomaly detection
- Trainer performance reporting exists but is basic (classes led, revenue attributed)
- Custom dashboards: not available in standard plans; requires "Business Intelligence" add-on (separate purchase)
- No pricing simulator

**Relevance to Phase 3:** Mindbody's analytics are the closest competitor benchmark. Meridian's AI layer (churn prediction surfaced as insights, revenue anomaly detection, trainer narratives) will exceed Mindbody's capability if executed well.

**Key differentiator to emphasize:** Mindbody's "Insights" are static charts. Meridian's AI insights are narrative, prioritized by urgency, and include recommended actions with deep links. This is a qualitatively different user experience, not just a feature gap.

---

### Pike13

**Analytics capabilities:**
- Staff reporting and client retention reports
- Basic CSV export
- No AI features
- Trainer compensation tracking exists but requires manual formula setup
- No custom dashboards

**Relevance:** Pike13 targets smaller boutique studios — same market as The Sauna Guys. Meridian will exceed Pike13 on every analytics dimension in Phase 3.

---

### Wodify / Zen Planner (Niche Competitors)

Both have basic attendance and revenue reporting, no AI, no custom dashboards, no pricing simulation. Not materially relevant to Phase 3 competitive positioning.

---

### BI / Analytics Tools (Tableau, Looker, Metabase)

If a studio wanted serious custom dashboards, they could connect Supabase directly to Metabase (open-source BI, free self-hosted) and build any dashboard they want. This makes Meridian's custom dashboard builder a "nice to have" compared against a free and more capable alternative — another argument for deferring the custom builder.

However, connecting Metabase to Supabase requires technical setup that the average studio operator will not do. Meridian's built-in dashboards (even just the 3 pre-built ones) win on accessibility.

---

## Phase 3 Competitive Differentiators

### Differentiator 1: Trainer Economics as First-Class Analytics

No competing platform at the boutique fitness market tier has trainer economics tracking with:
- Promo code attribution (conversions traceable to individual trainers)
- Check-in-based bonus threshold calculations (not just bookings)
- Per-trainer revenue attribution
- AI narrative performance summaries
- Compensation calculation (base + bonus + promo commission) in one report

This is a genuine competitive moat. Studio owners who care about their trainer relationships — and all of them do — will see this as a reason to adopt Meridian over any incumbent.

### Differentiator 2: AI Insights That Are Actionable, Not Decorative

Mindbody has "Insights" that are charts. Meridian's AI insights have:
- Urgency levels (Info / Suggestion / Attention / Urgent)
- Recommended action with deep link to the relevant page
- Dismiss and "mark as done" lifecycle
- Daily automated generation with deduplication

The difference is: Mindbody shows you a chart and makes you figure out what to do. Meridian tells you what the chart means and gives you a button to act on it. For a 1–2 person admin team running a studio, this is the difference between analytics being a dashboard you look at versus a system that actively manages the business.

### Differentiator 3: Pricing Simulator With AI Projections

No boutique fitness platform offers a pricing scenario simulator. Studio owners currently make pricing decisions based on intuition or informal surveys. A tool that says "if you raise Unlimited from $149 to $169, we project +$2,400/month revenue at +3.2% churn risk" — even if the projections are rough estimates — is a decision support tool that no competitor provides.

**Caveat:** The value of this differentiator depends on the accuracy and credibility of the AI projections. If the AI consistently overestimates revenue impact or underestimates churn risk, it will damage trust. The UI must communicate uncertainty ranges, not point estimates.

### Differentiator 4: Migration Tooling as a Switching Cost Eliminator

No competitor offers migration tooling that imports Glofox data and maintains wellness history, booking history, and credit balances. The migration tooling in Phase 3 is a direct competitive action against Glofox's lock-in strategy.

---

## Competitive Risks

### Risk 1: Custom Dashboard Builder Competes With Established BI Tools

The custom dashboard builder (react-grid-layout, 12 widget types) is the one Phase 3 feature that competes directly with mature BI tools (Metabase, Looker Studio). These tools have years of polish, larger widget libraries, and better rendering. Meridian will not match their quality with 2 weeks of development.

**Implication:** If Meridian's custom dashboard builder is visibly inferior to Metabase (which is free), sophisticated studio operators will connect Supabase to Metabase instead. This undermines the investment in the builder.

**Recommendation:** Do not build the custom dashboard builder in Phase 3. Instead, provide excellent pre-built dashboards (Executive Overview, Daily Operations, Growth & Retention) and add a "Connect to BI Tool" guide (Metabase + Supabase connection instructions) for power users. Build the custom builder in Phase 4 with proper design resources.

### Risk 2: AI Insight Quality Is the Moat — Also the Risk

The competitive differentiation from Mindbody and others rests on AI insights being genuinely useful. If insights are generic ("Your busiest day is Saturday"), obvious ("Members who book more than 3 times/month have lower churn"), or wrong ("Revenue anomaly detected" when it was just a holiday), the feature becomes noise.

**Mitigation:** The plan's deduplication logic and urgency levels are good foundations. The insight prompts sent to Claude must be carefully engineered to produce specific, evidence-based, studio-size-aware insights — not boilerplate MBA advice.

### Risk 3: Pricing Simulator Overconfidence

If the pricing simulator AI projects "+$2,400/month revenue" with high confidence and the actual result is flat or negative, the feature damages trust in all AI features. Studios run by non-analysts may take the AI projection at face value.

**Mitigation:** Display projections as ranges with explicit uncertainty caveats ("estimated $1,800–$3,000/month, based on historical retention elasticity of ±15%"). Never show a single-point estimate for a projection. The UI should use language like "estimated impact" and "model confidence: moderate."

---

## Competitive Positioning Summary

| Phase 3 Feature | Glofox | Mindbody | Pike13 | Meridian (Phase 3) |
|----------------|--------|----------|--------|---------------------|
| Live analytics overview | Basic | Good | Basic | Better |
| CSV/PDF report export | Limited | Good (high tiers) | Basic | Better |
| AI insights | None | None | None | Best in class |
| Trainer economics tracking | Basic | Moderate | Basic | Best in class |
| Custom dashboard builder | None | Add-on | None | Comparable (if built) |
| Pricing simulator | None | None | None | Best in class |
| Migration tooling | None | None | None | Unique |

**Overall competitive verdict:** Phase 3 moves Meridian from "a platform with a nice UI" to "an AI-powered operating system." The trainer economics and AI insights features in particular are difficult for incumbents to replicate quickly — they require deep integration with operational data that Glofox and Mindbody do not have at this granularity.
