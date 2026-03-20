# User Value Analysis
**Agent:** user-value
**Plan:** Meridian Phase 3 — Analytics & Intelligence
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

Phase 3 delivers genuine high-value features — live analytics, report exports, and trainer dashboards will be used daily. But the feature set is unequally valuable: three items (live analytics overview, reports engine, trainer dashboards) are high-frequency, high-value admin tools, while two items (custom dashboard builder, pricing simulator) are lower-frequency and serve a narrower use case. The plan should reorder priority to ship the high-frequency items first and treat the builder and simulator as secondary.

---

## User Segments Affected

**Primary users:** Studio owner/admin (The Sauna Guys: ~1–2 people)
**Secondary users:** Trainers (3–5 people who check their own dashboards)
**Future users:** Other studio operators who adopt Meridian as SaaS

---

## Value Assessment by Feature

### Live Analytics Overview — HIGH VALUE

The current analytics page is entirely mock data. Studio owners have no way to see real attendance trends, member movement, or revenue breakdown in the dashboard. Replacing mock data with live charts is the highest day-1 value delivery in Phase 3.

**Daily usage:** Yes — the Command Center is the morning routine; Analytics Overview is the second page visited.
**Decision impact:** Fill rate trends reveal which time slots to add or remove. Member movement charts surface churn before it becomes a revenue problem.
**Current workaround:** None — owners currently have no aggregate view of their own data.

---

### Reports Engine (CSV + PDF Export) — HIGH VALUE

Studio owners are currently unable to generate financial reports, payroll reports, or attendance summaries from Meridian. They are presumably either using Glofox's export tools (which will be deprecated at cutover) or maintaining manual spreadsheets.

The 13 pre-built templates cover the highest-frequency reporting needs:
- **Trainer Payroll Report** — needed at the end of every month, every month. Currently requires manual calculation.
- **Attendance Report** — used weekly to review fill rates and plan schedule changes.
- **Transaction Log** — needed for accounting and tax purposes.
- **Failed Payments Report** — used weekly for dunning follow-up.

**Frequency:** Payroll report runs monthly. Attendance and transaction reports run weekly. Failed payments run weekly.
**Pain level without this:** High. Manual payroll calculation for trainers (bonus threshold + promo commission + base pay) is error-prone and time-consuming.

The scheduled email delivery feature is particularly valuable for the Trainer Payroll Report — a monthly automated email to each trainer with their performance summary reduces admin overhead.

---

### Trainer Performance Dashboards — HIGH VALUE

The Sauna Guys has trainers (Whitney Cooper is named in the CLAUDE.md). Trainer performance tracking — bonus hit rate, avg attendance, promo conversions — directly affects compensation decisions. The AI narrative on the trainer deep-dive page ("4–6 sentence performance narrative") replaces a manual monthly review conversation with data.

**Decision impact:** Whether to give a trainer more prime-time slots, whether a bonus threshold has been met, whether a promo code is driving conversions — these are real operational decisions made monthly.
**Frequency:** Monthly for formal review; weekly for quick leaderboard checks.

---

### AI Insights Hub — MODERATE-HIGH VALUE (with caveats)

The AI insights hub surfaces patterns from across the business in one place. The insight types are relevant: scheduling gaps, pricing suggestions, retention signals, revenue anomalies.

**Value ceiling:** The hub is only as useful as the insights are accurate and actionable. With 1,103 members and a relatively small class schedule, the AI may generate generic insights ("Class at 7pm has higher fill rate than 5pm") that are already obvious to the owner. The value scales with data volume and business complexity.

**Risk of noise:** The plan generates 3–8 insights per daily cron run. If the deduplication fingerprint logic is imperfect, the hub can become noisy. The "dismiss" and "mark as done" actions are the right escape valves.

**Most valuable insight types:** Retention (churn prediction surfaced proactively), Revenue anomaly (unexpected drop in MRR), and Scheduling (optimal time slots). These three justify the feature. Pricing and Seasonal insights are less reliable at small data volumes.

---

### Pricing Simulator — MODERATE VALUE (narrow use case)

The pricing simulator is used when the studio considers a price change. For a studio with 3–4 membership tiers, this happens perhaps once or twice a year. The AI projections (churn risk estimate, revenue impact) are genuinely useful for that decision — replacing gut-feel with a data-anchored estimate.

**Frequency:** Very low — 1–2 times per year at most.
**Decision impact:** High when used — pricing decisions have compounding revenue effects.
**Risk:** If the AI projections are materially wrong (overconfident churn estimates, unrealistic revenue projections), the feature could lead to worse decisions than intuition alone. The plan should be explicit that projections are estimates with uncertainty ranges, not predictions.

This is a low-volume, high-stakes feature. Its value is real but does not justify the same sprint priority as the report engine.

---

### Custom Dashboard Builder — LOWER VALUE (for current users)

The drag-and-drop dashboard builder with 12 widget types is the most technically complex feature and the lowest daily-use feature for a small studio. The three pre-built dashboards (Executive Overview, Daily Operations, Growth & Retention) cover the needs of a 1–2 admin team.

Custom dashboards become valuable at scale — when a business has multiple department heads who need different metric views, or when a SaaS customer wants to configure Meridian for their specific KPIs. For The Sauna Guys today, this is overkill.

**Frequency:** Low — initial setup plus occasional reconfiguration.
**Who benefits:** Primarily future SaaS customers with different analytics needs than The Sauna Guys.
**Value for current user:** The three pre-built dashboards provide 90% of the value at 10% of the build cost.

---

### Glofox Migration Tooling — HIGH VALUE (but narrow window)

The migration tooling is a one-time-use feature: import data from Glofox once, then it is never used again (except for rollback). But during that one use, it is extremely high value — a failed migration means lost customer history, incorrect billing, and a broken cutover.

The admin UI with validation, progress tracking, and rollback is the right approach. The wave-based migration with renewal date tracking is essential for the double-billing guard.

**Note:** Migration tooling being in Phase 3 (weeks 9–10) means the actual Wave 1 execution cannot happen until the end of Phase 3. If the studio wants to cut over before Phase 4 work begins, the migration tooling needs to be ready by end of Sprint 5. This is correctly positioned in the plan.

---

## User Needs Not Addressed by Phase 3

### No trainer-facing views
The trainer performance dashboards are built in the admin interface. Trainers currently have no self-service view of their own performance, upcoming classes, or bonus status. The plan mentions "trainer profiles" as a Phase 5 feature. But a simple trainer-facing summary view (not a full trainer portal) would be high-value for the trainer relationship and could be built as a lightweight addition to Phase 3.

### No export scheduling for trainers
The Trainer Payroll Report is designed to be exported by admins. The plan mentions "schedule_recipients" on `saved_reports`, which could include a trainer's email address. But there is no workflow for automatically sending each trainer their own monthly payroll summary. This would reduce a monthly admin task to a cron job. Worth noting as a gap.

### No alerting on critical metrics
The AI insights hub surfaces insights daily. But if MRR drops 20% day-over-day, or if a class has zero bookings 24 hours before it starts, the studio owner should be notified immediately — not at the next scheduled insight generation run. The plan has no urgent alerting mechanism. Email or push notification on threshold breaches is absent.

---

## Value Delivery Ordering Recommendation

The current sprint order (DB → Reports → AI Hub → Dashboards → Migration) is roughly correct but could be optimized:

**Higher priority:**
1. Live analytics overview (Sprint 1) — correct
2. Reports engine, but prioritize CSV export + Trainer Payroll + Transaction Log first — PDF and scheduler can follow
3. Trainer performance dashboards — before AI insights hub

**Lower priority (defer or descope):**
4. Custom dashboard builder — ship 3 pre-built dashboards only; custom builder is Phase 4
5. Pricing simulator — ship after trainer dashboards, not before
6. Seasonal Predictor and Cross-Sell Detection AI functions — defer until 12 months of live data exists

---

## User Value Verdict Summary

| Feature | Value to Current Users | Priority |
|---------|----------------------|----------|
| Live analytics overview | Very High | Must Ship |
| Reports engine (CSV + payroll + attendance) | Very High | Must Ship |
| Trainer performance dashboards | High | Must Ship |
| Glofox migration tooling | High (one-time) | Must Ship |
| AI insights hub | Moderate-High | Ship |
| Pricing simulator | Moderate (low frequency) | Ship — descope confidence display |
| Custom dashboard builder | Low (for current users) | Defer to Phase 4 |
| Seasonal predictor AI | Low (insufficient data) | Defer |
| Cross-sell detection AI | Low (thin at this scale) | Defer |
