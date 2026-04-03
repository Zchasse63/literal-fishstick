# Competitive Context Analysis
**Agent:** competitive-context
**Plan:** Glofox API Migration to Meridian
**Complexity:** SIGNIFICANT
**Date:** 2026-03-31

---

## Agent Verdict
**GO** — This migration is not a competitive decision in isolation; it is a necessary enabling step for the broader Meridian product to function. From a competitive positioning standpoint, completing the migration cleanly is table-stakes for Meridian to differentiate from Glofox and similar platforms. The strategic risk is not "should we migrate?" — it is "what happens to competitive position if the migration is delayed or botched?"

---

## Context: This Is an Internal Migration, Not a Market Move

The Glofox → Meridian migration is an internal infrastructure decision for The Sauna Guys. It has no direct competitive implications for Meridian in the fitness software market — unless the migration serves as a proof-of-concept that Meridian can operate as a complete replacement for a studio's existing platform (which it does).

However, the competitive analysis matters in two ways:
1. **Risk framing:** What do other studios do when migrating away from Glofox? What failure modes are common?
2. **Positioning:** What does successfully completing this migration enable Meridian to credibly claim?

---

## The Glofox Migration Landscape

Glofox is a well-documented source of migration pain in the fitness studio industry. Studio operators who have migrated away from Glofox consistently report:

**Common migration failure modes (from fitness studio forums and industry discussion):**
1. Payment method re-collection failure rates of 15–30% — members churn rather than re-enroll
2. Historical data loss — particularly for attendance history, credit balances, and waiver records
3. Member confusion during parallel operation periods
4. Schedule/booking continuity gaps where classes appear in one system but not the other

**The plan addresses most of these correctly:**
- Two-phase transition (shadow then parallel) reduces data loss risk
- Credit pack sync is partially addressed (gap identified in edge-cases analysis)
- Waiver/agreements data is included in the API read capabilities
- The parallel period gives members time to adapt

**What competitors typically do differently:**
Most Glofox-to-competitor migrations use a "big bang" approach: export CSV from Glofox on a specific date, import into new system, go live. The plan's incremental API-driven approach is meaningfully superior — it maintains data freshness throughout the transition rather than accepting a data snapshot that immediately goes stale.

---

## What This Migration Enables Competitively

### 1. Meridian Can Credibly Claim It Replaced Glofox

The SaaS pitch for Meridian requires proof that it can fully replace an incumbent platform. Having run The Sauna Guys on Meridian end-to-end (post-cutover) provides that proof. A live production installation handling $55k+/month in transactions, 1,100 members, and all studio operations is a meaningful reference customer — even if that customer is the founder's own studio.

### 2. The Migration Tooling Becomes a Moat

The Glofox API client and sync engine being built here is directly reusable for any future Meridian customer who is migrating from Glofox. Glofox claims ~2,000+ studio customers. A "migrate from Glofox in 8 weeks" offering is a meaningful differentiator for Meridian's SaaS go-to-market when the time comes. No other fitness studio platform appears to offer a managed Glofox migration path.

**Recommendation:** Treat the `lib/glofox/` module as a permanent, maintained library (not purely cleanup-target code), even if The Sauna Guys will no longer use it post-cutover.

### 3. Demonstrates Multi-Tenant Architecture Readiness

Every migration table and sync function includes `studio_id` correctly. When Meridian onboards Studio #2, the Glofox migration tools work for them immediately. This is a technical moat that takes 8 weeks to build once and then scales.

---

## Competitive Risk If Migration Is Delayed

**Risk A: Glofox improves their product**
Glofox has been adding features (including recent AI marketing tools). If The Sauna Guys remains on Glofox during a delayed migration, the gap between what Meridian offers and what they already have from Glofox may close, reducing the business case for internal investment.

**Risk B: Staff inertia deepens with time**
Every week of parallel mode that extends beyond the plan builds institutional reliance on Glofox workflows. The longer the transition, the harder the final cutover.

**Risk C: Glofox API access is a gift that can be revoked**
Glofox granted API access. This is not standard for all customers. If The Sauna Guys becomes adversarial with Glofox (e.g., by publicly describing the migration for SaaS marketing purposes before it is complete), access could be revoked. The migration should be completed before any public communication about Meridian's Glofox migration capabilities.

---

## Alternative Competitive Strategies Considered (and Rejected)

**Alternative: Stay on Glofox, use Meridian as a read-only analytics layer**
This is the current state. It permanently caps Meridian's capabilities and prevents the differentiated features (trainer promo codes, proration, dual-role accounts) from being delivered. Not a viable long-term position.

**Alternative: Use a third-party migration tool (e.g., Migrateful, custom ETL)**
No credible off-the-shelf Glofox migration tools exist. Building a custom ETL is essentially what this plan does. The plan's choice to use Inngest rather than a one-off ETL script is better for maintainability.

**Alternative: Hard cutover with data export only (no sync engine)**
Faster (2–3 weeks instead of 8), but risks data loss for any bookings/transactions created between the export date and cutover. Given Glofox has live transactions happening daily, a snapshot migration loses recent data. The incremental sync approach is the right call.

---

## Strategic Recommendation

Complete the migration. The migration tooling itself is a competitive asset for Meridian's future SaaS business. The migration validates Meridian as a full-stack replacement for studio management platforms. The longer it is deferred, the more entrenched Glofox becomes in the operational muscle memory of the studio.

One addition to the plan: document the migration methodology (not the code, just the process) as a future-facing asset. "Migrate from Glofox in 8 weeks" is a marketing claim that can be made with specificity once this is complete.
