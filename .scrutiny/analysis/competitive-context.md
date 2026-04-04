# Competitive Context Analysis

**Agent:** competitive-context
**Plan:** Unified Member Data Architecture
**Complexity:** SIGNIFICANT
**Date:** 2026-04-04

---

## Agent Verdict

**GO** — The capabilities this plan enables (behavior-based segmentation, unified member intelligence, ClassPass conversion targeting) are differentiators against the platforms Meridian is replacing. The plan is correctly calibrated to the current competitive situation: Meridian doesn't need to out-feature enterprise CRM systems, it needs to out-perform Glofox on the specific pain points that drove the replacement decision.

---

## Competitive Landscape Assessment

### Meridian vs. Glofox (the primary comparison)

Glofox's core member data limitations (as documented in glofox-feature.md and the migration plan) include:
- No behavior-based segmentation in campaign targeting
- No unified member intelligence view
- Member data siloed across separate screens (profile, bookings, transactions are separate UX contexts)
- No ClassPass acquisition source tracking built in
- Numeric internal IDs exposed in UI in some contexts

This plan directly addresses all of these. Meridian's member_360 VIEW, acquisition_source tagging, and behavior-based automation triggers are capabilities Glofox either doesn't have or handles poorly.

**Competitive verdict:** This plan advances Meridian's position against Glofox on data intelligence. The capabilities are clearly superior in the context of replacing Glofox for The Sauna Guys specifically.

---

### Meridian vs. Mindbody / Mariana Tek (broader SaaS comparison)

Mindbody and Mariana Tek have more mature member intelligence features. Mindbody has:
- Built-in client engagement scores
- Reporting on visit patterns by member
- Campaign targeting by visit frequency
- Basic churn prediction

However, Meridian's value proposition is not feature parity with Mindbody — it's: (a) better pricing (no platform fee + standard Stripe rates), (b) AI-native architecture, (c) direct database access, and (d) a custom platform built exactly for how studios actually operate.

The member_360 approach (surfacing intelligence from the owner's own data, not opaque platform scores) is actually a stronger value proposition for the SaaS pitch than trying to replicate Mindbody's black-box engagement scores. Studio owners who care about data want SQL access and transparency — not a numeric score they can't explain.

**Competitive verdict:** The plan's approach (transparent, SQL-based, owner-accessible data) is a differentiator, not a catch-up play.

---

### ClassPass as a Channel

ClassPass integration is a specific competitive consideration. Glofox has some ClassPass integration features. What Glofox does NOT do well:
- Track which members came via ClassPass as a persistent acquisition source
- Enable studios to run targeted conversion campaigns at ClassPass users
- Show ClassPass revenue vs. direct revenue in analytics

This plan's ClassPass acquisition_source tagging enables exactly what Glofox lacks. For studios that use ClassPass as a customer acquisition channel (many do), the ability to identify, target, and convert ClassPass users to direct members is a significant operational capability.

The potential revenue implication is real: ClassPass pays studios a fractional rate compared to direct memberships. A single ClassPass-to-direct conversion is worth $80–150/month vs. the $10–30 ClassPass payout per visit.

**Competitive verdict:** This is a genuine differentiator. No major studio management platform has this as a first-class feature.

---

### What Competitors Have That This Plan Doesn't Address

**Third-party CRM integrations:** Mindbody integrates with Hubspot, Salesforce, Mailchimp. Meridian's marketing module is self-contained. For studios that want to pipe data to existing CRM tools, this matters. The plan doesn't address this — correctly so, since it's out of scope for Phase 2.

**Advanced predictive scoring:** Some platforms use ML-based churn prediction with multi-factor models. Meridian's behavior_segment field is rules-based (visit frequency + recency). This is appropriate for the current scale and explicitly fits the "LLM + rules-based from day one" architecture stated in CLAUDE.md. The AI sophistication can increase as data volume grows.

**Real-time behavioral triggers:** Platforms like Salesforce Marketing Cloud can trigger automations in milliseconds based on behavioral events. Meridian's 10-minute polling approach is less real-time. For a sauna studio at current scale, this is not a competitive gap that matters.

---

### SaaS Positioning Implications

If Meridian is evaluated by potential studio customers as a Glofox/Mindbody replacement, the member intelligence capabilities this plan delivers are table-stakes for the SaaS pitch:
- "We show you who your members are, not just their booking history" — enabled by member_360
- "We tell you which members came from ClassPass so you can convert them" — enabled by acquisition_source
- "Our automation flows fire correctly because we maintain accurate visit counts" — enabled by the backfill

A platform where automation triggers silently don't work is not a credible SaaS product. This plan fixes that.

---

## Verdict Confidence: MEDIUM-HIGH

The competitive analysis is based on documented Glofox limitations and general knowledge of the market. Specific Mindbody/Mariana Tek capabilities may have changed. The competitive conclusion (GO) is robust to reasonable uncertainty about exact competitor feature sets.
