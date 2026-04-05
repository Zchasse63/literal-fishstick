# Meridian KPI Framework

**Created:** 2026-04-05
**Sources:** Existing PRD/research + bsport Insights 2025 + Mariana Tek Insights 2.0 + industry benchmarks
**Purpose:** Define all KPIs, their data sources, display locations, and comparison periods for the Meridian dashboard

---

## Industry Benchmarks (2025-2026)

Sources: [Mariana Tek Boutique Fitness Trends Report](https://www.marianatek.com/resources/2025-boutique-fitness-trends-report/), [StudioStackPro Retention Statistics](https://studiostackpro.com/blog/member-retention-statistics/), [Exercise.com Gym KPI Metrics](https://www.exercise.com/grow/best-gym-kpi-metrics/), [Christa Gurka Top 5 Metrics](https://www.christagurka.com/blog/5-fitness-studio-metrics)

| Metric | Industry Average | Top Performers | Sauna Guys Current |
|---|---|---|---|
| Monthly retention | 90-93% | 95-97% | TBD (needs computation) |
| Yearly retention | ~80% | 85%+ | TBD |
| Class fill rate | 75% average | 90%+ peak | 2.9 avg/class (24% of 12 capacity) |
| Revenue per visit | $21-25 drop-in | $30+ premium | ~$17.74 (Mar 2026) |
| Member tenure | 12-18 months | 18-24 months | TBD |
| Avg monthly sessions/member | 4-6 | 8+ (power users) | 6.0 (overall avg) |
| New member conversion (trial → paid) | 25-40% | 50%+ | TBD |
| Drop-in avg price | $25 | $35+ premium | $39-$40.66 |
| Annual revenue per member | ~$2,100 | $3,000+ | TBD |

---

## Competitor KPI Features Comparison

### bsport — Insights (2025)
Source: [bsport 2025 Product Review](https://pro.bsport.io/en/blog/taking-a-look-back-at-bsports-2025-season)
- Pre-built interactive dashboards focused on "real business questions"
- Subscription health and recurring revenue tracking
- Risk and opportunity identification
- Purchase and gift card revenue visibility
- AI-powered CoachMail for personalized engagement
- Marketplace integration tracking (ClassPass, Wellhub, Urban Sports Club)

### Mariana Tek — Insights 2.0 (Sep 2025)
Source: [Mariana Tek Insights 2.0](https://www.marianatek.com/features/insights-and-analytics/), [Athletech News](https://athletechnews.com/xplor-mariana-tek-insights-2-0/)
- **6 core KPIs** (developed with 100+ studios): total sales, active memberships, intro offers sold, attendance, first visits, class utilization
- Real-time dashboard updating every 20-30 minutes
- Revenue sorted by type (memberships, products, gift cards)
- First visit tracking (new face detection)
- Churn rate monitoring with lifecycle tracking
- Class utilization rate

### Mindbody
- Black-box engagement scoring (not transparent)
- Visit frequency reporting
- Campaign targeting by visit frequency
- Basic churn prediction

### What Meridian Should Beat All Of Them On
- **Transparent, SQL-accessible metrics** (not black-box scores)
- **ClassPass acquisition source tracking** (no competitor has this as first-class)
- **Behavior-based segmentation** with 10-category member status
- **AI-powered insights** with actionable recommendations (not just data display)
- **Revenue per visit trending** (none show this prominently)
- **New face vs returning ratio** (Mariana Tek has "first visits" but not the ratio)

---

## Meridian KPI Hierarchy

### Tier 1 — Daily Glance (Command Center hero metrics)
These appear at the top of the Command Center. Owner sees them every morning.

| KPI | Formula | Data Source | Comparison |
|---|---|---|---|
| **Today's Revenue** | SUM(transactions.amount) WHERE today | `transactions` | vs same day last week |
| **Today's Attendance** | COUNT(bookings) WHERE today AND non-cancelled | `bookings` + `classes` | vs same day last week |
| **Live Class Fill** | current_booked / capacity for active class | `classes` (real-time) | N/A |
| **New Faces This Week** | Members who booked this week but NOT in prior 30 days | `bookings` + `member_360` | vs last week |
| **Member Health** | Engagement status distribution bar | `members.engagement_status` | vs last week |

### Tier 2 — Weekly Review (Owner reviews every Monday)

| KPI | Formula | Data Source | Comparison |
|---|---|---|---|
| **Weekly Revenue** | SUM(transactions.amount) for the week | `transactions` | WoW (vs prior week) |
| **Weekly Attendance** | COUNT non-cancelled bookings for the week | `bookings` | WoW |
| **New Signups** | COUNT members WHERE join_date in week | `members` | WoW |
| **New Face Ratio** | New faces / total unique attendees | `bookings` + `member_360` | WoW |
| **Revenue Per Visit** | Weekly revenue / weekly attendance | `transactions` / `bookings` | WoW |
| **Class Fill Rate** | AVG(booked_count / capacity) across all classes | `classes` | WoW |
| **Returning Members** | Members who attended this week AND last week | `bookings` | WoW |
| **Cancellation Rate** | Cancelled / total bookings | `bookings` | WoW |

### Tier 3 — Monthly Deep Dive (Analytics dashboard)

| KPI | Formula | Data Source | Comparison |
|---|---|---|---|
| **MRR** | SUM(plan_price) WHERE subscription active | `members` + `membership_plans` | MoM, YoY |
| **ARPM** | Total revenue / active member count | `transactions` / `members` | MoM |
| **Churn Rate** | Lost members / start-of-month active | `members` status changes | MoM |
| **Net Revenue Retention** | (MRR + upgrades - downgrades - churn) / prev MRR | `transactions` + `members` | MoM |
| **LTV by Acquisition Source** | Lifetime revenue per source | `transactions` + `member_360` | Quarterly |
| **ClassPass Conversion Rate** | ClassPass members who bought direct / total ClassPass | `member_360` | MoM |
| **Credit Pack Usage Rate** | Credits used / credits purchased | `credit_packs` + `bookings` | MoM |
| **Trial-to-Member Conversion** | Trial → paid membership / total trials | `members` | MoM |

### Tier 4 — Strategic (Quarterly/Annual)

| KPI | Formula | Data Source | Comparison |
|---|---|---|---|
| **Cohort Retention Curves** | % retained at month 1, 3, 6, 12 by signup month | `members` + `bookings` | Cohort vs cohort |
| **Revenue Per Square Foot** | Monthly revenue / facility size | `transactions` | QoQ |
| **Trainer Revenue Attribution** | Revenue from members who attend trainer's classes | `bookings` + `transactions` + `trainers` | QoQ |
| **Promo ROI** | Revenue from promo-acquired members / promo cost | `members` + `transactions` + `promo_attributions` | Per promo |
| **Seasonal Patterns** | MoM variance with same-month-prior-year overlay | All | YoY |

---

## Comparison Periods

Every KPI should support these comparison modes:

| Period | Display | Use Case |
|---|---|---|
| **Day over Day** | Today vs yesterday, vs same day last week | Daily operations |
| **Week over Week** | This week vs last week | Weekly performance review |
| **Month over Month** | This month vs last month | Monthly business review |
| **Year over Year** | This month vs same month last year | Seasonal pattern detection |
| **Custom Range** | Any date range vs any other | Ad-hoc analysis |
| **Since Takeover** | Mar 1, 2026+ vs all prior data | "How are we doing since we took over?" |

### The "Since Takeover" View
This is the most important comparison for Sauna Guys right now. It should show:
- **Mar 1 - Now** as the "current period"
- **All historical data (Jan 2024 - Feb 2026)** as the "baseline period"
- Delta percentages for every metric
- Trend direction arrows (improving/declining/stable)

---

## Current Data Availability

### Available Now (can display today)
- Revenue (daily, weekly, monthly from `transactions`)
- Attendance (from `bookings` + `classes`)
- New signups (from `members.join_date`)
- Engagement status distribution (from `members.engagement_status`)
- Class fill rates (from `classes.booked_count` / `classes.capacity`)
- Credit pack balances (from `credit_packs`)
- Revenue by type (membership, credit_pack, drop_in, gift_card, event)
- Acquisition channel breakdown (from `profiles.acquisition_source`)
- Behavior segments (from `member_360.behavior_segment`)

### Needs Computation (build the query)
- Revenue per visit (revenue / attendance for period)
- New face ratio (unique first-time attendees / total unique attendees)
- Week-over-week / month-over-month deltas
- Cohort retention curves
- MRR from active subscriptions
- Churn rate
- Trial-to-member conversion rate
- ClassPass conversion rate

### Needs Data Pipeline (Phase 2/3)
- NPS / post-session feedback
- Streak tracking (consecutive weeks of attendance)
- Referral tracking
- Campaign attribution (which campaign drove which booking)
- Trainer revenue attribution

---

## Dashboard Layout Recommendation

Based on [UXPin Dashboard Design Principles](https://www.uxpin.com/studio/blog/dashboard-design-principles/) and [Pencil & Paper Dashboard UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards):

### Command Center (Daily View)
```
┌─────────────────────────────────────────────────────────────┐
│  Today's Revenue     Attendance     Fill Rate    New Faces  │
│  $234.56 (+12%)      8 (+3)         67%          3 new     │
│  vs same day LW      vs same day    vs avg       vs LW     │
├─────────────────────────────────────────────────────────────┤
│  Engagement Health Bar                                       │
│  [███ 6 sub][████ 21 active][███ 49 engaged][██ 27 cool]...│
├─────────────────────────────────────────────────────────────┤
│  Today's Classes          │  Recent Activity               │
│  12pm Guided (7/12) 🟢   │  Sim Harmon checked in         │
│  1pm Open (3/12) 🟡      │  Parker Lee → 6 Classes/Month  │
│  2pm Open (2/12) 🟡      │  Ben Kniesly → drop-in         │
├─────────────────────────────────────────────────────────────┤
│  This Week vs Last Week                                     │
│  Revenue: $1,005 → TBD (+X%)                               │
│  Attendance: 41 → TBD (+X%)                                │
│  New Faces: 21 → TBD (+X%)                                 │
│  Avg Fill: 2.9 → TBD                                       │
└─────────────────────────────────────────────────────────────┘
```

### Analytics Deep Dive
```
┌─────────────────────────────────────────────────────────────┐
│  Period Selector: [Week] [Month] [Quarter] [Since Takeover] │
│  Compare To: [Prior Period] [Same Period Last Year] [Custom]│
├─────────────────────────────────────────────────────────────┤
│  Revenue Trend (line chart)    │  Attendance Trend (line)   │
│  ──────── this period          │  ──────── this period      │
│  - - - - comparison period     │  - - - - comparison        │
├─────────────────────────────────────────────────────────────┤
│  New vs Returning (stacked bar)│  Revenue Per Visit (line)  │
│  [■ New ■ Returning] per week  │  $17.74 current            │
│                                │  $34.16 peak (Aug 2024)    │
├─────────────────────────────────────────────────────────────┤
│  Class Fill Rate Heatmap       │  Member Status Funnel      │
│  Time → Day of Week grid       │  Sub → Active → Cooling →  │
│  Color intensity = fill %      │  At Risk → Lapsed → Churn  │
└─────────────────────────────────────────────────────────────┘
```

---

## Priority Implementation Order

1. **Command Center hero metrics** — Revenue, attendance, fill rate, new faces (Tier 1)
2. **Week-over-week comparison bar** — WoW deltas for the 8 Tier 2 KPIs
3. **"Since Takeover" view** — Mar 2026 vs historical baseline
4. **Revenue per visit trending** — Critical insight (declining from $34 to $18)
5. **New face ratio** — Key leading indicator
6. **Class fill rate heatmap** — Scheduling optimization
7. **Cohort retention curves** — Strategic (Tier 4)
8. **Full analytics deep dive** — Complete Tier 3 dashboard
