# Cost-Benefit Analysis

**Agent:** cost-benefit
**Plan:** Unified Member Data Architecture
**Complexity:** SIGNIFICANT
**Date:** 2026-04-04

---

## Agent Verdict

**GO** — The plan has a strongly positive cost-benefit profile when scoped correctly. The SQL backfill work is pure upside: low effort, fixes broken functionality, enables ClassPass segmentation. The higher-effort items (member_360 VIEW, new triggers, UI integration) have clear, measurable returns. The only cost concern is Phase B "mass pull" scope creep risk.

---

## Cost Estimate

### Development Time

| Work Item | Estimated Hours | Notes |
|-----------|----------------|-------|
| Backfill SQL (total_visits, last_visit, acquisition_source, engagement_status) | 2–4h | One migration file, well-understood data |
| glofox_plan_map table + populate | 2–4h | New table + one Inngest call |
| Trigger existing transactions backfill | 1–2h | Function exists, may just need triggering |
| member_360 VIEW (thin JOIN) | 3–5h | SQL + RLS + types |
| cron-member-enrichment Inngest function | 4–8h | New function, multi-tenancy aware |
| Check-in real-time total_visits update | 2–4h | Modify existing check-in handler |
| New trigger types (6) in evaluate-triggers.ts | 4–8h | 6 new switch cases, some with complex queries |
| Pre-built automation flow templates | 4–8h | Seed data + UI scaffolding |
| UI: member profile enrichment | 3–6h | Add fields to existing component |
| UI: campaign builder segments | 4–8h | Filter UI for new segment types |
| Testing + validation | 4–8h | Verify backfill correctness, trigger firing |
| **Total** | **33–65h** | |

Midpoint estimate: ~50 hours of development work.

---

## Benefit Estimate

### Direct Revenue Impact

**ClassPass conversion campaign:**
- Estimated ClassPass users: 60–180 (5–15% of 1,199 profiles — pattern-based estimate)
- Conservative conversion rate: 5–10% → 3–18 new direct members
- Average membership value: $80–150/month → $4–32k annualized recurring revenue
- One-time setup cost: ~4–6 hours of development for the tagging + 2–4 hours to design the campaign
- ROI: Even 3 conversions pays for this work many times over

**Automation flows becoming functional:**
- Currently 0 active flows, so immediate revenue from fixing triggers is $0
- Value is option value: once flows are created, they work correctly
- Failed payment dunning (once transactions table is populated) is a direct revenue recovery mechanism. Studios typically recover 15–25% of failed payments through automated dunning sequences.
- At The Sauna Guys' scale, recovering even 1–2 failed memberships/month via dunning automation is worth $80–300/month.

### Indirect Value

**Staff time savings:**
- Member profile enrichment: staff currently have to manually calculate engagement patterns. Automating this saves time on every member interaction.
- Estimated: 30–60 minutes/week in admin time → ~$500–1,000/year in staff time

**Phase 2 enablement:**
- Phase 2 (Marketing & Engagement) cannot function correctly without accurate member data. This plan is a prerequisite, not optional. The cost of NOT doing it is delayed Phase 2 delivery.
- Phase 2 automation flows, segmented campaigns, and behavioral targeting all require what this plan provides.

**Platform quality:**
- Numeric plan codes visible in UI are a quality signal. For a platform being evaluated as a SaaS product to sell to other studios, data accuracy and display quality matter for demos and evaluations.

---

## Cost Risks

**Phase B scope creep (medium probability, high impact)**

The "mass pull" of "all available data" from Glofox is the cost wildcard. If "activity/history" resolves to per-member API calls for 1,199 members (like credits), that's 1,199+ API calls with retry overhead. The time cost of building, testing, and running this safely is non-trivial.

Recommendation: cap Phase B to transactions (already implemented in backfill function) + plan_map. Defer interaction/activity pull to a separate scoped item.

**member_360 VIEW performance rework (low probability if caught early)**

If the VIEW is implemented as full aggregation (as described in the plan), a performance rework will be required after the first slow query is noticed. The rework cost (moving to pre-computed columns + changing the VIEW definition) is 8–16 hours if discovered late. This cost is avoidable by implementing correctly from the start.

---

## Net Assessment

| Category | Value |
|----------|-------|
| Development investment | ~50 hours |
| Direct revenue (ClassPass conversions) | $4–32k/year annualized |
| Revenue recovery (dunning automation) | $1–3k/year |
| Phase 2 enablement (option value) | High — blocks $X in future phase value |
| Staff time savings | $500–1,000/year |
| Reputational (SaaS quality signal) | Low–Medium |

The investment is justified by ClassPass conversion opportunity alone, before counting automation enablement and Phase 2 unblocking.

---

## Verdict Confidence: HIGH
