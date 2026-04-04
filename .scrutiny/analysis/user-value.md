# User Value Analysis

**Agent:** user-value
**Plan:** Unified Member Data Architecture
**Complexity:** SIGNIFICANT
**Date:** 2026-04-04

---

## Agent Verdict

**GO** — with a strong recommendation to sequence delivery to front-load the highest-value work. The plan fixes real, currently broken functionality (automation triggers that silently don't work), enables a segmentation capability that has direct revenue implications (ClassPass conversion), and provides the data foundation Phase 2 marketing features actually require. The user value is high and largely uncontroversial.

---

## Value Assessment

### Tier 1: Fixes Broken Things (Immediate Value)

**total_visits / last_visit backfill**

This is not a new feature — it's a bug fix. The milestone automation trigger currently fires for members with 0 visits because total_visits is 0 for everyone. The inactivity trigger's batched query against bookings works correctly, but it's the only trigger doing so. failed_payment never fires because transactions is empty.

Until this is fixed, the automation system is partially inoperable. Studio staff cannot trust that automation flows are running correctly, which means:
- Welcome series triggers may send milestone emails immediately at signup
- Members who legitimately haven't visited get missed by inactivity flows
- Failed payment dunning doesn't exist

The business impact of fixing this is proportional to how many automation flows are live. With 0 active flows in production, the immediate business impact is low — but the fix is necessary before any automation can be trusted.

**Value rating: HIGH (prerequisite to Phase 2 automation)**

---

### Tier 2: New Capability With Revenue Implication

**ClassPass acquisition_source tagging**

ClassPass members represent a specific conversion opportunity: they've already tried the facility, they have intent, but they're paying ClassPass instead of The Sauna Guys directly. Being able to segment and target these members with a specific offer ("skip ClassPass, get direct member pricing") is a credible revenue lever.

At 1,199 profiles, even a conservative estimate of 5–15% being ClassPass members (60–180 people) targeted with a conversion campaign has real revenue potential. A single conversion from ClassPass to a monthly membership is worth $80–150/month in direct revenue vs. the fractional ClassPass payout.

The plan correctly identifies this. The acquisition_source field already exists on profiles — this is purely a backfill + campaign targeting enablement.

**Value rating: HIGH (direct revenue conversion opportunity)**

**member_360 unified view**

For staff using the admin dashboard, a member profile page that shows engagement tier, behavior segment, acquisition source, favorite class type, and days since last visit in one place is a significant UX improvement. Currently staff have to infer this from raw booking counts and dates.

The value here is operational efficiency for whoever manages member relationships at The Sauna Guys.

**Value rating: MEDIUM (staff efficiency)**

---

### Tier 3: Foundation Enabling Future Value

**New automation trigger types**

never_booked, one_and_done, cooling_off, plan_upgrade_candidate, class_type_fan — these are all automation triggers that don't fire until someone creates a flow that uses them. The value is latent: the triggers themselves have no user-visible impact until flows are built.

The plan includes "pre-built automation flow templates" which addresses this — if the templates ship with the triggers, the value is immediate. If the triggers ship without flows, they're invisible.

**Value rating: MEDIUM (depends on template delivery)**

**glofox_plan_map**

This fixes UI display issues where plan names show as numeric IDs. For staff reviewing member plans, this is a quality-of-life fix. For members (if plan names appear in member-facing UI), it's more significant — but member-facing surfaces are Phase 5.

**Value rating: LOW–MEDIUM (staff display quality)**

---

### Who Experiences the Value

**Studio admin/owner:** Immediately experiences correct automation trigger behavior (once flows are live), ClassPass segment visibility in campaign builder, plan names in UI.

**Studio staff:** More informative member profile pages.

**Members:** No direct value from this plan (all admin-side). Member-facing impact comes in Phase 5.

**Phase 2 Marketing module:** This plan is a prerequisite. Campaign builder segments based on acquisition_source, engagement_status, and behavior_segment require this data to exist and be accurate.

---

### Value-to-Effort Ratio

The SQL backfill (Category 1 from scope analysis) is a few hours of work that fixes broken automation triggers and enables ClassPass segmentation. This has the best value-to-effort ratio of anything in the platform backlog.

The member_360 VIEW and new trigger types are medium effort for medium value.

The Phase B mass pull (transactions, interactions) is higher effort for lower immediate value — primarily populating tables that aren't yet used by live flows.

---

## Risks to Value Delivery

1. **Automation flows are currently inactive.** The plan's automation-related value is zero until flows are created and activated. The trigger fixes are necessary but not sufficient — someone needs to build the flows.

2. **ClassPass conversion campaign requires email content.** Tagging ClassPass members is the prerequisite, but the actual value requires someone to design a conversion campaign in the campaign builder (Phase 2 feature) with compelling copy. The data layer doesn't deliver value by itself.

3. **member_360 query performance.** If the VIEW is slow (as flagged in technical feasibility), UI pages using it will be slow, degrading the staff experience. This inverts the expected value.

---

## Verdict Confidence: HIGH
