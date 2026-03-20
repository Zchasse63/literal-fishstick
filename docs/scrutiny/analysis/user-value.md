# User Value Analysis — Meridian PRD v1.0

**Agent:** user-value
**Complexity:** MAJOR (Deep+ mode)
**Date:** 2026-03-20
**Source:** meridian-prd.md v1.0, edge-case-policies.md, CLAUDE.md

---

## Agent Verdict

**GO** (on core value proposition) / **MODIFY** (on execution priorities)

Meridian's core value is real, specific, and daily. The pain points it solves — dual-role account restrictions, no self-service upgrades, no proration, no trainer economy, no live revenue visibility — are not theoretical complaints. They are active friction points that cost The Sauna Guys time, money, and member satisfaction every week. The highest-value features (single account/multi-role, self-service upgrades, trainer promo codes, live Command Center) are also among the lowest build-cost items relative to their impact. The plan's value delivery is front-loaded in the right direction. The modifications needed are: Phase 1 must include a minimal member portal (members have no booking surface otherwise), the trainer features deserve more prominent Phase 1 placement, and the community/social board should be deferred indefinitely.

---

## User Value by Stakeholder

### Studio Admin / Owner

**Immediate, daily-impact wins:**

**1. Single account, multiple roles**
The owner cannot currently book their own classes using the same email as their admin login — a daily operational absurdity. Fix is immediate and table-stakes. Build cost: LOW. Daily friction eliminated: HIGH.

**2. Live revenue on Command Center**
Glofox's home screen shows no revenue data. The owner navigates to Reports to find basic figures. A live MRR + revenue-today metric on the Command Center is checked 5-10 times daily. Build cost: LOW (single Stripe query). Value: HIGH.

**3. AI Briefing Card (even rules-based v1)**
"3 members haven't visited in 14 days. Tuesday 6pm has been at capacity for 3 weeks. One payment failed last night." A rules-based version of this brief has enormous daily value for a solo operator. Does not require LLM to be useful. Build cost: MEDIUM. Value: VERY HIGH.

**4. Analytics exclusion flag per profile**
Former owners with comped memberships are currently skewing MRR and attendance metrics. A single boolean toggle on the profile fixes this. Build cost: VERY LOW. Value: HIGH for data integrity. This is one of the fastest wins in the entire plan.

**5. Automated dunning**
Failed payment follow-up is currently manual. Stripe webhooks + Resend = automated retry sequence with email escalation. Recovers 20-40% of at-risk subscriptions. Build cost: MEDIUM. Value: HIGH (direct revenue impact).

**Second tier:**
- Waitlist auto-promotion (saves staff manual waitlist management)
- Walk-in kiosk (reduces front-desk friction)
- Trainer performance reports (payroll calculation currently manual)

**Low value relative to build cost:**
- Custom analytics widget builder (pre-built dashboards are higher value for a single-location studio)
- Corporate Wellness Portal (zero value until there is a corporate client)
- Weather correlation analysis (not actionable for a single studio)
- IoT equipment logging (sauna has no sensors)

---

### Members

**High-value features:**

**1. Self-service membership management**
Members cannot currently upgrade, pause, or cancel their membership without contacting the studio. This is unacceptable UX for any subscription product in 2026. It directly causes churn — members who can't easily manage their subscription cancel it or abandon it. Build cost: MEDIUM. Value: VERY HIGH. This is the single most impactful member-facing feature.

**2. Passwordless magic link auth**
Members use this app 1-3 times per week. Password friction generates "forgot password" flows and abandonment. Magic link removes this entirely. Supabase Auth makes this low effort. Build cost: LOW. Value: HIGH.

**3. Proration preview at upgrade**
When a member upgrades mid-cycle, showing them exactly what they pay today ("You'll be charged $35.00 now. Your next full billing is $225 on April 15.") builds trust and removes the "unknown charge" anxiety that causes members to abandon upgrades. The edge case policies document defines this precisely. Build cost: MEDIUM (Stripe proration preview API call). Value: HIGH.

**4. Wellness journey tracking**
Visit streaks, monthly summaries, "longest cold plunge" personal records — this makes members feel the studio cares about their progress. It also drives retention via streak mechanics (members don't cancel when they have a 12-week streak). This is low build cost against existing visit data. Build cost: MEDIUM. Value: HIGH for retention.

**5. Credit balance visibility**
Members should see their remaining credits on every screen. Knowing "I have 3 credits left" drives booking behavior. Currently Glofox buries this. Build cost: VERY LOW (surface existing data). Value: MEDIUM-HIGH.

**Risky / potentially negative value:**

**Community / social board**: A members-only social feed requires critical mass to feel alive. At ~11 active memberships + class pack users, the community board will be empty. An empty social feed makes the product feel abandoned — worse than not having the feature. The Instagram embed (SnapWidget) is a much better interim solution: it shows real, active content without requiring member participation. Defer the interactive community board until membership exceeds 100+ active members who are engaged.

---

### Trainers

**High-value features:**

**1. Promo code tracking dashboard**
Trainers share their referral code on social and with clients. Currently they have zero visibility into whether anyone used it. A simple dashboard showing "code used 14 times, 9 converted to memberships, $270 earned in commissions" is enormously motivating and builds trainer loyalty. Build cost: LOW. Value: VERY HIGH for trainer satisfaction.

**2. Bonus threshold visibility ("2 more members = bonus")**
If trainers can see their class fill count in real time before their session (e.g., in the employee portal), they're motivated to recruit. "You're at 5/7 for tonight's class — 2 more bookings hit your bonus." This requires no new data — just surface the existing class capacity count in the trainer view. Build cost: VERY LOW. Value: HIGH.

**3. Clear payroll breakdown**
"Base pay: $35. Bonus: $20 (8 check-ins). Promo commissions: $30 (3 conversions). Total this period: $85." Trainers currently calculate this manually or wait for the owner to tell them. Transparent automated payroll builds trust. Build cost: LOW. Value: HIGH for trainer retention.

**4. Public trainer profile**
A professional profile tied to the studio (bio, photo, upcoming schedule, specialty) that members can browse builds trainer brand within the studio ecosystem. Simple to build. Drives trainer loyalty and member class selection. Build cost: LOW. Value: HIGH.

---

## Value Delivery Timeline Analysis

Current PRD phase structure maps value to phases as follows:

| Phase | Admin Value | Member Value | Trainer Value |
|---|---|---|---|
| Phase 1 | Command Center, live metrics, member management, Stripe billing, analytics exclusion | None (no member surface per Section 13) | Partial — trainer assignment exists but promo/bonus dashboards unclear |
| Phase 2 | Marketing, automations, employee portal full | Walk-in kiosk (staff-facing), marketing emails | Promo codes, bonus dashboards |
| Phase 3 | Analytics dashboards, AI insights, churn prediction | None added | Performance reports |
| Phase 4 | Corporate portal, events | iOS app, wellness tracking, trainer profiles | Public profiles |

**Critical gap:** Members get no value upgrade until Phase 4 (iOS app, wellness tracking). During Phase 1-3, members interact with Meridian only through the web booking portal (which Section 13 excludes from this build). If the web portal is truly deferred, members cannot interact with Meridian at all during Phase 1.

**Trainer gap:** The trainer promo code dashboard and bonus visibility features are among the highest-value, lowest-cost features in the plan. They should be in Phase 1, not Phase 2. A trainer who can see their earnings and code performance from day one of Meridian launch is an internal champion for the platform.

---

## Value-to-Build-Cost Scoring

| Feature | Admin Value | Member Value | Trainer Value | Build Cost | V/C Ratio |
|---|---|---|---|---|---|
| Analytics exclusion toggle | HIGH | — | — | VERY LOW | EXCELLENT |
| Live revenue on Command Center | HIGH | — | — | LOW | EXCELLENT |
| Single account, multi-role | HIGH | HIGH | HIGH | LOW | EXCELLENT |
| Trainer bonus visibility | — | — | VERY HIGH | VERY LOW | EXCELLENT |
| Credit balance display | MEDIUM | HIGH | — | VERY LOW | EXCELLENT |
| Trainer promo code dashboard | HIGH | — | VERY HIGH | LOW | EXCELLENT |
| Trainer public profiles | — | MEDIUM | HIGH | LOW | EXCELLENT |
| AI briefing (rules-based v1) | HIGH | — | — | MEDIUM | VERY GOOD |
| Waitlist auto-promotion | MEDIUM | MEDIUM | — | LOW | VERY GOOD |
| Self-service membership upgrades | HIGH | VERY HIGH | — | MEDIUM | VERY GOOD |
| Proration preview at upgrade | MEDIUM | HIGH | — | MEDIUM | GOOD |
| Wellness journey tracking | MEDIUM | HIGH | — | MEDIUM | GOOD |
| Automated dunning | HIGH | — | — | MEDIUM | GOOD |
| Walk-in kiosk | HIGH | MEDIUM | — | MEDIUM | GOOD |
| Merch inventory + sales | MEDIUM | MEDIUM | — | HIGH | MODERATE |
| Gift cards | LOW | MEDIUM | — | MEDIUM | MODERATE |
| Marketing campaigns | MEDIUM | LOW | — | HIGH | MODERATE |
| Automation flow builder | MEDIUM | LOW | — | HIGH | LOW |
| Community board | LOW | LOW (risky) | — | VERY HIGH | LOW |
| Corporate portal | LOW (now) | — | — | HIGH | LOW (now) |
| IoT equipment logging | NONE | — | — | MEDIUM | NONE |
| Weather correlation | LOW | — | — | MEDIUM | NONE |

---

## Specific Recommendations

1. **Include a minimal member portal in Phase 1.** Even if it's just: view schedule, book a slot, see credit balance, show QR code for check-in, manage payment method. This is the difference between "we can turn off Glofox" and "we can't."

2. **Pull trainer promo code dashboard and bonus visibility into Phase 1.** These are 1-2 week builds with outsized trainer satisfaction impact. Trainers who see their earnings from day one become Meridian advocates.

3. **Move wellness journey tracking to Phase 2 (not Phase 4).** The data already exists after Phase 1 (visit history is in the database). The UI is a 1-2 week build. Waiting until Phase 4 is a missed retention opportunity.

4. **Defer the community board.** At current scale, it will be empty. The SnapWidget Instagram embed delivers more community feel with zero engineering cost. Revisit when membership exceeds 100+ active members.

5. **Build AI briefing as rules-based v1 in Phase 1.** "3 members at churn risk. Tuesday 6pm at 95% capacity for 3 weeks. 2 failed payments last night." This is a SQL query dressed up with a friendly message. It establishes the AI narrative without LLM cost or complexity.

---

## Summary

The core value proposition is real, well-specified, and achievable. The highest-value features are among the lowest build-cost items. The primary execution risk is that members have no booking surface in Phase 1 (as currently written in Section 13), and trainer features are misphased into Phase 2 when they should be Phase 1. Both of these are correctable without scope changes — they are phasing decisions, not build complexity decisions.
