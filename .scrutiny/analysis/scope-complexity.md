# Scope & Complexity Analysis
**Agent:** scope-complexity
**Plan:** Meridian Phase 3 — Analytics & Intelligence
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

The 9–10 week estimate for a single developer is optimistic by 30–40%. The plan packages five distinct product areas (reporting engine, AI hub, dashboard builder, pricing simulator, data migration tooling) into a sequential sprint structure with no buffer. Sprint 2 (reports engine) alone is likely a 3-week effort, not 1.5 weeks. The plan should be restructured to either extend the timeline or cut scope by deferring the custom dashboard builder and/or the pricing simulator to Phase 4.

---

## Scope Assessment

### Actual Line Count Estimate

| Sprint | Plan Claims | Realistic Estimate |
|--------|-------------|-------------------|
| Sprint 1: DB + Metric Pipeline | 2 weeks | 2 weeks (reasonable — mostly SQL + 1 analytics page) |
| Sprint 2: Reports Engine | 1.5 weeks | 3 weeks (PDF generation, 13 templates, scheduler, export history) |
| Sprint 3: AI Hub + Trainer Dashboards | 1.5 weeks | 2–2.5 weeks (6 new AI functions, insights UI, 3 trainer pages) |
| Sprint 4: Dashboards + Pricing Sim | 1.5 weeks | 2.5–3 weeks (drag-and-drop builder is genuinely complex, Stripe integration) |
| Sprint 5: Migration + Polish | 1 week | 2 weeks (6 CSV parsers, validation engine, rollback, integration tests) |
| **Total** | **9–10 weeks** | **13–15 weeks** |

### Why the Reports Engine (Sprint 2) Is Underestimated

The plan lists 13 tasks in Sprint 2 for 1.5 weeks. These include:
- Installing and validating `@react-pdf/renderer` on Netlify (this alone is a spike, not a half-day task)
- Building a "query builder that translates report config (columns, filters, time range, grouping) into Supabase queries" — this is a mini query compiler. For 13 report types, each with variable column sets, filter types, and grouping options, this is a 3–5 day task on its own
- PDF template with Meridian branding for all 13 report types
- Cursor-based streaming CSV for large datasets
- Supabase Storage integration (upload, signed URLs, expiry)
- Scheduled email delivery via Resend with report attachments
- Three UI pages (library, viewer, builder with 4-step wizard)

Each of these is a meaningful engineering task. The aggregation into 1.5 weeks assumes every task completes without friction. Reports engines routinely become the longest phase of analytics builds.

### Why the Dashboard Builder (Sprint 4) Is Underestimated

The drag-and-drop dashboard builder is described as:
- 12 widget types (metric_card, line_chart, bar_chart, pie_chart, area_chart, heatmap, cohort_chart, table, leaderboard, ai_insight, funnel, gauge)
- Per-widget configuration panel (data source, metric, time range, grouping, colors)
- Auto-save on drag/resize
- "Export Dashboard as PDF" (renders all widgets)
- 3 pre-seeded dashboard configurations
- Share toggle

Building a widget resolver that maps any widget config to the correct data query and chart format is a non-trivial abstraction. Twelve widget types means 12 data-fetching paths and 12 rendering paths, plus a configuration UI for each. The "widget data resolver" task in Sprint 4 is worth 3–5 days by itself.

The "Export Dashboard as PDF" feature requires server-side rendering of an arbitrary React component tree. If `@react-pdf/renderer` is not suitable for this (it likely isn't — it renders its own DSL, not arbitrary React DOM), this feature requires either Puppeteer (heavyweight) or a custom multi-widget PDF layout using `pdfmake`. This is easy to underestimate.

### Scope Concentration Risk

Three of five sprints end with a meaningful integratred deliverable that depends on everything in that sprint being complete:
- Sprint 1 deliverable: analytics overview page live — requires DB migration + backfill + 7 API routes + page rewrite all working
- Sprint 2 deliverable: full report engine — requires query builder + PDF + CSV + storage + scheduler all working
- Sprint 5 deliverable: migration tooling ready for Wave 1 — requires all 6 parsers + validation + rollback all tested

If any task in a sprint slips, the entire sprint deliverable slips. There is no "partial sprint success" path designed into the plan.

---

## Scope Items That Should Be Cut or Deferred

### Cut: Dashboard "Export as PDF" (Sprint 4)
This feature requires rendering an arbitrary collection of chart widgets to a PDF. It is the hardest export problem in the plan (harder than report PDFs because the content is dynamic). It is also a low-frequency feature — studio owners export dashboards to PDF rarely. Cut it; add a "screenshot" browser-native print approach instead.

### Defer: Custom Dashboard Builder to Phase 4 (Sprint 4)
The custom dashboard builder (react-grid-layout, 12 widget types, per-widget config, auto-save, share toggle) is effectively a mini BI product. It is not required for Phase 3's core value delivery (live analytics, reports, AI insights, trainer dashboards, pricing simulator). The three pre-built dashboards (Executive Overview, Daily Operations, Growth & Retention) deliver 80% of the value. Deferring the custom builder to Phase 4 reduces Phase 3 by ~2–3 weeks.

If deferred, Sprint 4 becomes: Pricing Simulator only (1 week), which is much more achievable.

### Defer: Seasonal Predictor AI function
`predictSeasonalTrends()` requires "12+ months of historical data." The Glofox seed data is of unknown date range. If it covers less than 12 months (likely, given the studio's age), this AI function will produce low-quality or incoherent output. Defer until 12 months of live Meridian data exists.

### Defer: Cross-Sell Detection AI function
`detectCrossSellOpportunities()` is analytically interesting but not operationally urgent. At 1,103 members and with 2 primary product types (memberships + credit packs), the output will be thin. Defer to Phase 4 when the corporate/event module adds more cross-sell surface area.

---

## Hidden Complexity Items Not Called Out in the Plan

### 1. Report Query Builder
The plan treats this as a single Sprint 2 task: "query builder that translates report config (columns, filters, time range, grouping) into Supabase queries." For 13 report types, each with multi-field filters, date range logic, and grouping options, this is a significant abstraction. A dynamic query builder that handles all combinations correctly (especially NULL handling, date coercion, and type-specific aggregations) will take most of a full week to get right and test.

### 2. Cohort Retention Logic
`cohort_snapshots` requires knowing which members were "active" in each measurement month. The definition of "active" is non-trivial: does it mean any booking, any check-in, an active paid membership, or something else? The plan does not define "active" for cohort purposes. An incorrect definition produces cohort charts that look plausible but misrepresent reality. This definition must be pinned before writing the cron job.

### 3. Migration Rollback SQL Generation
The plan says: "rollback SQL: generated DELETE statements for this batch." Generating correct DELETE statements for a batch of UPSERT inserts requires capturing the IDs of inserted rows (using `RETURNING id`) and storing them. For 1,000-row batches, this generates potentially 1,000-row DELETE strings stored in a `TEXT` column. This approach will hit row size limits for large migrations. A better approach: store just the batch ID range or use a separate `migration_row_ids` table with a foreign key to `migration_jobs`.

### 4. Glofox CSV Date Format Variations
The plan notes "date format normalization (Glofox exports use various formats)." The existing seed scripts (`seed-bookings-transactions-v2.sql`) have already handled one set of date formats from a specific Glofox export. The migration UI will accept new CSV uploads from potentially different Glofox export versions or date ranges, which may have different column orders or date formats. The parsers must be defensive. This is a known unknown that cannot be fully resolved until a real Glofox export CSV is in hand.

---

## Scope That Is Correctly Scoped

- Sprint 1 DB migration and analytics page live data: well-scoped
- AI insights hub page (Sprint 3): correctly scoped — largely a feed UI over existing AI infrastructure
- Trainer performance pages (Sprint 3): correctly scoped — the data models are well-defined
- Migration admin page UI (Sprint 5): correctly scoped — it's a CRUD UI over the migration_jobs table

---

## Recommendations

1. **Extend the timeline to 13 weeks** or cut the custom dashboard builder to Phase 4
2. **Add one buffer week** after Sprint 2 (reports engine) — this is the highest-risk sprint
3. **Pin the "active member" definition** for cohort logic before Sprint 1
4. **Eliminate the 2 AI functions** with data availability problems (Seasonal Predictor, Cross-Sell Detection) until more Meridian-native data exists
5. **Cut Dashboard Export as PDF** — replace with browser print
6. **Validate `@react-pdf/renderer` on Netlify as a Week 1 spike** — not a mid-sprint assumption

---

## Scope Verdict Summary

| Feature | Scope Assessment |
|---------|-----------------|
| DB + metric pipeline | Correctly scoped |
| Analytics overview (live data) | Correctly scoped |
| Reports engine (13 templates + CSV + PDF + scheduler) | Underscoped by ~1.5 weeks |
| AI insights hub | Correctly scoped |
| Trainer performance dashboards | Correctly scoped |
| Custom dashboard builder | Underscoped by ~1 week; consider deferring |
| Pricing simulator | Correctly scoped (1 week) |
| Glofox migration tooling | Correctly scoped |
| Seasonal Predictor AI | Data availability problem — defer |
| Cross-Sell Detection AI | Thin output at current scale — defer |
| Dashboard PDF export | Disproportionate complexity for use frequency — cut |
