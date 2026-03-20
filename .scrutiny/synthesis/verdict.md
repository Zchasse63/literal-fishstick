# Verdict: Meridian Phase 3 — Analytics & Intelligence
**Synthesized:** 2026-03-20
**Input agents:** 7 (technical-feasibility, scope-complexity, user-value, cost-benefit, architecture-impact, edge-cases, competitive-context)

---

## Final Verdict: MODIFY

**Confidence:** High

Phase 3 is the right phase to build. The core features (live analytics, report engine, trainer dashboards, AI insights hub, migration tooling) are high-value, well-designed in their foundations, and deliver genuine competitive differentiation that no incumbent platform provides. The verdict is not about whether to build — it is about how to restructure the scope and fix concrete technical issues before starting.

The plan as written will take 13–15 weeks, not 9–10. It contains a critical SQL performance bug in two RPC functions, an unaddressed Stripe immutability constraint that will cause a Sprint 4 failure, and a dual-cron infrastructure that adds operational complexity without benefit. Additionally, two features (custom dashboard builder, two AI functions) are disproportionately expensive relative to their near-term value.

---

## Agent Verdicts

| Agent | Verdict | Key Issue |
|-------|---------|-----------|
| technical-feasibility | MODIFY | RPC correlated subquery bug, PDF library trap, Stripe price immutability, React 19/react-grid-layout risk |
| scope-complexity | MODIFY | 9–10 week estimate is 13–15 weeks realistic; reports engine underscoped; custom dashboard builder should defer |
| user-value | MODIFY | High-value core features confirmed; custom dashboard builder and two AI functions have low near-term value |
| cost-benefit | MODIFY | Positive ROI on core features; 3–4 week savings by cutting dashboard builder and two thin AI functions |
| architecture-impact | MODIFY | Dual cron smell; widget resolver needs capability matrix; migration rollback SQL anti-pattern; 5 RLS/security gaps |
| edge-cases | MODIFY | 5 high-severity unhandled cases: empty state, cron gaps, trainer schema assumption, concurrent migration, pricing rollback |
| competitive-context | GO | Genuine differentiation; trainer economics + AI insights are best-in-class; custom dashboard builder competes poorly vs. free BI tools |

---

## What Must Change Before Building

### Fix Before Sprint 1 Starts

**1. Rewrite both RPC functions (blocking bug)**
`get_attendance_heatmap` and `get_trainer_leaderboard` use correlated subqueries inside aggregate functions. This will be visibly slow on real data. Rewrite using CTEs before Sprint 1 ships.

**2. Verify trainer self-exclusion column name**
The leaderboard RPC references `t.trainer_id` but the `staff` table column is likely `profile_id`. This will produce a Postgres error. Confirm actual column name before writing the RPC.

**3. Consolidate all 6 cron jobs to Inngest**
Remove Netlify Scheduled Functions from the plan. Write all 6 cron jobs as Inngest functions with cron triggers. Netlify Scheduled Functions have 10-second timeouts, no retry logic, and no monitoring — Inngest is already integrated and superior.

**4. Pin the "active member" definition for cohort snapshots**
Before writing the `cron/cohort-refresh` job, define precisely what "active" means for retention cohort purposes. Does it mean: any booking in the measurement month, an active paid membership, or any check-in? An incorrect definition produces cohort charts that misrepresent reality.

### Fix Before Sprint 2 Starts

**5. Spike PDF generation on Netlify (timebox: 2 days)**
Validate that `@react-pdf/renderer` works in a Netlify Node.js function with `export const runtime = 'nodejs'`. If it fails or exceeds the 50 MB function size limit, switch to `pdfmake`. Do not commit 3 weeks of report engine work to an unvalidated dependency.

**6. Add Supabase Storage bucket to schema design**
The schema section omits the Storage bucket configuration for report exports. Add: bucket name, RLS policy on the bucket, signed URL TTL (recommend 1-hour), and UI handling for expired export links.

**7. Switch CSV export to priority over PDF**
Ship CSV export first. CSV delivers 80% of report value and has no compatibility risk. PDF follows after the spike validates the approach.

### Fix Before Sprint 4 Starts

**8. Design the Stripe price update flow**
Stripe `Price` objects are immutable — you cannot update a price's `unit_amount`. The "Apply Changes" button must: (1) create a new Price, (2) update the Product's default_price, (3) offer a toggle for migrating existing subscribers. Store `previous_price_id` in `pricing_simulations` to enable reverting. Design this before Sprint 4, not during.

**9. Replace custom dashboard builder with 3 pre-built dashboards only**
Defer the full drag-and-drop widget builder to Phase 4. Ship the three pre-built dashboards (Executive Overview, Daily Operations, Growth & Retention) with the correct live data. This saves ~2–3 weeks and removes the `react-grid-layout` React 19 compatibility risk. The pre-built dashboards deliver 90% of the value.

### Add to Any Sprint

**10. Add concurrent migration prevention**
`POST /api/migration/import` must check for any active (`importing` or `validating`) migration jobs for the same `studio_id` and `data_type`. Return HTTP 409 Conflict if one exists.

**11. Add cron gap recovery**
The `cron/daily-metrics` job must check `MAX(metric_date)` on startup and backfill any missing days before processing today. Silent cron failures must not create permanent data gaps.

**12. Add empty/first-run states to all analytics charts**
Every chart component must handle empty result sets gracefully. The analytics overview must distinguish "no data yet" from "data loading."

**13. Replace migration rollback SQL storage**
The `migration_jobs.rollback_sql TEXT` column for storing DELETE statements will hit size problems at scale. Add `migration_job_id UUID` to all tables receiving migrated data, or create a `migration_row_ids` junction table.

---

## What to Cut or Defer

| Item | Action | Reason |
|------|--------|--------|
| Custom dashboard builder (react-grid-layout) | Defer to Phase 4 | 2–3 weeks for low near-term value; competes poorly with free BI tools |
| Seasonal Predictor AI function | Defer to Phase 4 | Requires 12+ months of data that doesn't exist yet |
| Cross-Sell Detection AI function | Defer to Phase 4 | Thin output at 1,103 members; 2 primary product types |
| Dashboard Export as PDF | Cut | Disproportionate complexity vs. use frequency; use browser print |

---

## What to Build Exactly as Planned

- Sprint 1: DB migration (10 tables), metric pipeline, analytics overview with live data
- Reports engine: 13 templates, CSV export, scheduled email delivery (Sprint 2)
- AI Insights Hub: `generateInsights()`, `generateReportNarrative()`, `compareTrainers()` (Sprint 3)
- Trainer performance overview + individual trainer deep-dive pages (Sprint 3)
- Pricing simulator (without the Stripe Apply action until the price update flow is designed) (Sprint 4, now just 1 week)
- Glofox migration tooling: upload, validate, import, rollback, wave assignment (Sprint 5)

---

## Revised Sprint Structure

| Sprint | Weeks | Theme | Deliverables |
|--------|-------|-------|-------------|
| 1 | 1–2 | DB + Metric Pipeline | 10 tables, 6 Inngest cron jobs, analytics overview live |
| 1.5 | Week 1 | PDF Spike | Validate PDF approach on Netlify before Sprint 2 |
| 2 | 3–5 | Reports Engine | CSV export first, 13 templates, PDF (if spike passed), scheduler |
| 3 | 6–8 | AI Hub + Trainer | 4 AI functions (cut Seasonal + Cross-Sell), insights hub, trainer pages |
| 4 | 9–10 | Pricing Simulator | Pricing simulator only; 3 pre-built dashboards seeded |
| 5 | 11–13 | Migration + Polish | Glofox migration tooling, integration tests, Stripe price flow |

**Revised total: 13 weeks** (vs. 9–10 claimed)

---

## Key Assumptions Being Made

1. The Glofox seed data date range is sufficient to produce meaningful historical `daily_metrics` rows (unverified — date range not stated in plan)
2. The `staff` table has a `profile_id` column (not `trainer_id`) — must be verified against actual schema
3. Phase 2 `campaigns` and `leads` tables exist (claimed complete, but 2 report templates depend on them)
4. Netlify Business plan or Inngest paid tier is available for cron jobs
5. The AI churn prediction cost ($3–5/month at current data volume) is acceptable
6. The pricing simulator projections will be communicated as estimates with uncertainty, not point predictions

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PDF generation fails on Netlify | Medium | High | Spike Week 1; fallback to pdfmake |
| Reports engine takes 3+ weeks not 1.5 | High | High | Extend Sprint 2 to 3 weeks in revised plan |
| react-grid-layout incompatible with React 19 | Medium | Medium | Deferred — custom builder cut from Phase 3 |
| Stripe price update design is wrong | Medium | High | Design before Sprint 4; do not defer to during |
| Backfill produces incorrect historical data | Medium | High | Validation step: spot-check 5 dates post-backfill |
| AI insights are too generic to be useful | Medium | Medium | Careful prompt engineering; insight review before launch |
| Cron silent failures create data gaps | High | Medium | Gap detection + backfill in daily cron job |
| Concurrent migration jobs corrupt data | Low | High | Add 409 check in migration API route |

---

## Verdict Summary

**Build Phase 3. Build it differently.**

The plan's architecture is sound. The scope is too large for the stated timeline. The custom dashboard builder is the one feature to cut without hesitation. Three of the six new AI functions are ready to ship; the other two need 12 more months of live data before they produce reliable output. Fix the two RPC bugs before writing a line of application code. Design the Stripe price update flow before Sprint 4. Validate PDF generation in Week 1.

Do those things, and Phase 3 delivers a best-in-class analytics layer that no boutique fitness platform can match.
