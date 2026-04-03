# User Value Analysis
**Agent:** user-value
**Plan:** Glofox API Migration to Meridian
**Complexity:** SIGNIFICANT
**Date:** 2026-03-31

---

## Agent Verdict
**GO** — This migration delivers concrete, high-value outcomes for the studio operator (Zach / The Sauna Guys) and is a necessary prerequisite for Meridian to function as the operating system the product is designed to be. The value is not speculative — it directly removes active operational pain, enables features that are currently blocked, and eliminates a recurring subscription cost. The member experience impact is neutral-to-positive if executed cleanly, or moderately negative if the payment migration is mishandled.

---

## Primary Value Delivered

### Value 1: Meridian Becomes Operationally Real

Currently, Meridian is a management dashboard connected to stale, incomplete data (one-time CSV import, 27 fields missing). Staff still lives in Glofox for actual operations. The sync engine transforms Meridian from a reporting dashboard into the actual system of record.

This is not incremental improvement — it is the enabling condition for every Phase 2, Phase 3, and Phase 4 feature to actually function. Marketing campaigns require accurate consent fields (being added). Churn prediction requires birthday and membership expiry data (being added). The trainer bonus system requires check-ins tracked in Meridian (currently tracked only in Glofox).

**Impact: High. This unlocks the entire product.**

### Value 2: 27 Missing Fields Become Available

The data enrichment in Phase 1 populates:
- Birthdays → birthday automation flows (already built in Inngest with `member/birthday` event)
- Consent fields → legal compliance for email/SMS campaigns (required for Phase 2)
- Membership expiry dates → accurate churn prediction (Phase 3 AI features)
- Address data → shipping infrastructure, demographics
- Emergency contacts → liability/safety (valuable for wellness studio context)
- Late cancellation / no-show flags → strike system enforcement (already policy-decided)
- `is_first_booking` → first-time member welcome flows

Several of these directly enable features that are already built but cannot fire without the data. The birthday automation event type already exists in the Inngest client. The churn prediction hook (`use-churn-prediction.ts`) already exists. The data is the last blocker.

**Impact: High. Unlocks built features that are currently inert.**

### Value 3: Eliminates Glofox Subscription Cost

Glofox pricing for fitness studios is typically $110–$150/month for a studio of this size, rising to $200+ at scale. Eliminating this subscription after cutover generates direct savings of $1,320–$2,400/year, plus removes Glofox's payment processing markup (typically 0.5–1% on top of card processing fees).

On $30–50k/month in membership revenue, even a 0.5% payment processing reduction saves $150–$250/month. Combined with the subscription cost, total annual savings are roughly $3,000–$5,000/year.

**Impact: Medium. Meaningful but not transformative at current scale.**

### Value 4: Removes Glofox's Operational Constraints

The CLAUDE.md explicitly documents pain points that Glofox imposes and Meridian is designed to solve. Several of these are blocked until Meridian is the operational system:
- Self-service membership upgrades (Glofox blocks this — requires contacting studio)
- Dual-role accounts (trainers who are also members cannot have one email in Glofox)
- Trainer promo code attribution (not supported in Glofox)
- "Exclude from analytics" flag for comped members (not supported in Glofox)
- Proration on upgrades (Glofox explicitly does not support this)

None of these can be fixed while Glofox remains the system of record. The migration is a precondition for delivering the differentiated product.

**Impact: High. Removes known friction points for both operators and members.**

---

## User Impact By Stakeholder

### Studio Owner (Zach)

**Gains:**
- Single system for all operations (no context-switching between Glofox and Meridian)
- Full data visibility — AI insights, churn prediction, marketing automation all become real
- Cost reduction on subscription and payment processing
- Product becomes SaaS-ready (direct value if future customers adopt Meridian)

**Risks:**
- If cutover is botched, operational disruption during the studio's actual business hours
- Payment migration failure causes member billing failures that require manual remediation

**Net value: Very high, contingent on clean execution.**

### Studio Staff (Trainers, Front Desk)

**Gains:**
- Single system to use instead of split workflow
- Check-in flow in Meridian (already built: QR check-in, kiosk)
- Trainer dashboard shows their own class metrics natively

**Risks:**
- Training period requires learning new workflows
- During parallel mode, confusion about which system is "correct" for any given action
- Class creation is Glofox-only during transition (no write endpoint), requiring staff to use Glofox for schedule management until cutover

**Net value: Positive post-training, friction during transition.**

### Members (~1,100)

**Gains:**
- Eventually: self-service membership upgrades, better booking experience, wellness journey tracking
- Eventually: magic link auth (no password to remember)

**Risks (this migration specifically):**
- Required to re-enter payment details before cutover — friction, and risk of non-compliance
- If cutover timing is bad (mid-billing-cycle failure), members may experience failed charges or booking errors
- If rollback is needed, members experience system unavailability and confusion

**The member experience during this migration is primarily negative in the short term** — they are asked to do extra work (re-enter payment methods) with limited benefit visible to them until the full member-facing portal launches (Phase 5).

**Net value: Neutral to slightly negative during migration, positive post-Phase 5.**

---

## Value Realization Timeline

```
Week 1: Schema enriched — birthday/consent/expiry data available immediately
Week 2-3: Sync engine built — live data starts flowing
Week 4: Shadow mode — data validation (no user-visible change)
Week 5-6: Parallel mode — staff begins using Meridian natively
Week 7-8: Cutover — Meridian is primary; Glofox subscription cancellation begins
Week 9+: Full value — AI features fire, campaigns use real data, processing cost reduced
Month 3+: Member-facing value — when Phase 5 portal launches
```

The core business value (single operational system, AI features activated) is realized at cutover. Member-facing improvements are deferred to Phase 5 launch. The two timelines are decoupled.

---

## Risk to Value Delivery

### Highest risk to value: Payment migration non-collection

If 20–30% of members don't re-enter payment methods, the first post-cutover billing run generates failures. This:
- Creates immediate manual work for staff
- Damages member trust if charges fail unexpectedly
- May cause members to cancel rather than re-enroll

Mitigation: proactive communication, sufficient lead time (4 weeks, not 2), multiple reminder touchpoints via email (Resend campaigns are already built), clear explanation of why re-entry is needed.

### Second highest risk to value: Staff training insufficient

If staff are not fluent in Meridian's booking and check-in flows before cutover, operational quality drops. The plan gives 2 weeks of parallel mode for training. For a studio with ~10 staff and a relatively simple operational workflow, this is likely sufficient — but it should not be abbreviated.

---

## Summary

The migration delivers clear, measurable value to the studio owner and is a necessary prerequisite for the entire product roadmap. The member impact during migration is a managed friction point, not a value problem. The plan correctly identifies this as infrastructure work, not a feature. The value case is solid.
