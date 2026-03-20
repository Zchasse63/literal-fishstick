Design the revenue and financial analytics dashboard for "Meridian" — a premium fitness studio management platform. This page gives operators complete financial visibility with AI-powered insights.

DESIGN LANGUAGE:
- Deep indigo (#4F46E5) primary, emerald (#10B981) for growth/positive, coral (#F97316) for decline/concern, amber (#F59E0B) for attention items
- Data visualization should be clean and modern — think Stripe Dashboard quality
- Inter or SF Pro typography

LAYOUT:

TOP BAR:
- Left: "Revenue" page title
- Right: Date range selector (This Month | Last 30 Days | This Quarter | This Year | Custom), Compare toggle ("vs. Previous Period"), Export button

ROW 1 — Hero Metrics (5 cards):
Large number, label below, comparison badge (▲ 12% or ▼ 3%), micro sparkline.
- Monthly Recurring Revenue: $18,420
- Total Revenue (period): $24,670
- Avg Revenue Per Member: $127
- Revenue Churn: 2.1%
- Net Revenue Retention: 108%

ROW 2 — Revenue Chart (full width, hero chart):
Stacked area chart showing revenue over time (30-day default), broken down by:
- Subscriptions (indigo fill)
- Credit Packs (blue fill)
- Drop-ins (violet fill)
- Add-ons (teal fill)
- Corporate (amber fill)
Hovering any point shows a tooltip with exact breakdown for that day.
Below the chart: a row of small toggles to show/hide each revenue category.

AI INSIGHT (below chart, subtle card):
"Credit pack revenue increased 23% this month, driven by the new 20-pack introduction. Members purchasing 20-packs visit 40% more frequently than 10-pack buyers and have 60% lower churn. Recommendation: Consider making the 20-pack the default promoted option."

ROW 3 — Two-column layout:

LEFT (50%) — "Membership & Pack Performance" table:
Table with columns: Plan Name | Active Count | MRR Contribution | Avg. Lifetime | Churn Rate (30d) | Trend
Each row is a membership or credit pack. Churn rate cells are color-coded (green < 3%, amber 3-5%, red > 5%).
Sort by any column. Click any row to drill into that plan's detailed analytics.

RIGHT (50%) — "Failed Payments & Recovery" card:
- Outstanding: $2,340 across 14 members
- Aging breakdown: 1-7 days (8 members, $1,120), 8-14 days (4, $780), 15+ days (2, $440)
- Recovery rate this month: 72%
- Visual horizontal stacked bar showing the aging distribution
- [View All Failed Payments] button
- [Send Recovery Campaign] quick action

ROW 4 — Transaction Feed (compact table, full width):
Most recent transactions with: Timestamp, Member Name, Type (Subscription/Credit Pack/Drop-in/Add-on), Amount, Payment Method, Status badge (Completed in green, Failed in red, Refunded in amber).
Filterable by type and status. Paginated. [Export CSV] button.

DESIGN DETAILS:
- The stacked area chart should be the visual centerpiece — large, beautiful, smooth curves
- Color coding should be consistent and meaningful — you should be able to read the financial health at a glance
- The failed payments section should feel urgent but not alarming — it's an action item, not a crisis
- Overall feel: Stripe Dashboard meets Bloomberg Terminal for fitness — serious about money, beautiful about data
