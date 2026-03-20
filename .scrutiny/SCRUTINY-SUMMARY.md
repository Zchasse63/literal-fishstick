# SCRUTINY SUMMARY
## Meridian Phase 3 — Analytics & Intelligence
**Date:** 2026-03-20
**Agents Run:** 7 (Deep mode)
**Plan Source:** `/Users/zach/Desktop/literal-fishstick/docs/phase-3-plan.md`

---

## Verdict: MODIFY

Build Phase 3. Build it differently. The core features are high-value and genuinely differentiated — no competitor at the boutique fitness market tier has trainer economics tracking, AI-driven actionable insights, and a pricing simulator. The plan's foundations are architecturally sound. The problems are concrete and fixable: a critical SQL bug in two RPC functions, a library compatibility trap for PDF generation, an unaddressed Stripe constraint, and a timeline that is 30–40% optimistic. Cut one overscoped feature (custom dashboard builder), fix the bugs before sprinting, and this is a strong phase.

---

## The 3 Most Important Things to Do Before Writing Code

**1. Fix the RPC correlated subquery bug.**
Both `get_attendance_heatmap` and `get_trainer_leaderboard` use correlated subqueries inside aggregate functions (`SUM((SELECT COUNT(*) FROM bookings...))`). This executes a separate database query for every class row — potentially 500+ queries per API call. Rewrite both using CTEs before Sprint 1 ships. This is not a performance tuning suggestion; it is a correctness issue that will make the analytics overview page visibly slow on real data.

**2. Spike PDF generation on Netlify in Week 1 (timebox: 2 days).**
`@react-pdf/renderer` has known issues with Next.js App Router server-side rendering and canvas globals. Before committing 3 weeks of report engine work to this library, validate it runs inside a Netlify Node.js function with `export const runtime = 'nodejs'`. If it fails, switch to `pdfmake`. Ship CSV export first regardless — CSV delivers 80% of report value.

**3. Design the Stripe price update flow before Sprint 4.**
Stripe `Price` objects are immutable — you cannot change a price's `unit_amount`. The plan's "Apply Changes" button will receive a Stripe API error if implemented naively. The correct flow is: create a new Price, update the Product's default_price, offer a migration modal for existing subscribers. Store `previous_price_id` in `pricing_simulations` to enable reverting. Design this explicitly before Sprint 4 starts.

---

## What to Cut / Defer

| Item | Action | Why |
|------|--------|-----|
| Custom dashboard builder (react-grid-layout, 12 widget types) | Defer to Phase 4 | 2–3 weeks for a feature used infrequently; pre-built dashboards deliver 90% of value; competes poorly with free BI tools |
| Seasonal Predictor AI function | Defer to Phase 4 | Requires 12+ months of live data that doesn't exist yet |
| Cross-Sell Detection AI function | Defer to Phase 4 | Thin output at 1,103 members and 2 primary product types |
| Dashboard Export as PDF | Cut | Render an arbitrary chart grid server-side is extremely complex for a low-frequency feature; use browser print instead |

Cutting/deferring these items saves **3–4 developer weeks** while retaining all high-value Phase 3 deliverables.

---

## Timeline Reality Check

| | Plan | Realistic |
|-|------|-----------|
| Total weeks | 9–10 | 13 (with cuts above) |
| Sprint 2 (Reports Engine) | 1.5 weeks | 3 weeks |
| Sprint 4 (Dashboards + Pricing) | 1.5 weeks | 1 week (pricing only, dashboards cut) |
| Opportunity cost of overrun | — | 3–4 week delay to Phase 4 SaaS onboarding |

---

## Bugs and Gaps to Fix Before Each Sprint

### Before Sprint 1
- Rewrite heatmap and leaderboard RPC functions (correlated subqueries → CTEs)
- Verify trainer self-exclusion column: `t.trainer_id` should be `t.profile_id` — confirm against actual `staff` schema
- Consolidate all 6 cron jobs to Inngest (remove Netlify Scheduled Functions)
- Pin "active member" definition for cohort retention calculations
- Design cron gap recovery: `cron/daily-metrics` must detect and backfill missing days

### Before Sprint 2
- Spike `@react-pdf/renderer` on Netlify (timebox 2 days) — validate or switch to `pdfmake`
- Add Supabase Storage bucket to schema: bucket config, RLS policy, signed URL TTL (1 hour)
- Design async export path for reports >500 rows (Inngest job + status polling)
- Add `data_freshness` field to analytics API responses

### Before Sprint 4
- Design Stripe price update flow (new price → update product default → subscriber migration modal → revert path)
- Verify `react-grid-layout` React 19 compatibility (if custom builder re-evaluated)

### Across All Sprints
- Add empty/first-run states to every chart component (EC-1)
- Add concurrent migration prevention — HTTP 409 if active job exists (EC-4)
- Replace `rollback_sql TEXT` with `migration_row_ids` junction table (architecture smell)
- Add `concurrency: { limit: 10 }` to Inngest batch churn prediction
- Add own RLS INSERT/UPDATE policies to `dashboard_widgets` table
- Revenue anomaly bridge: write detections to `ai_insights`, not just `ai_cache`

---

## What the Plan Gets Right

- **Materialized snapshot tables** — the correct architecture for analytics. Pre-computed daily rows mean chart rendering is fast regardless of data volume.
- **AI insight deduplication via fingerprint** — prevents noise accumulation in the insights hub.
- **Graceful degradation for Phase 2 tables** — 2 of 13 report templates that need `campaigns`/`leads` show "Requires Marketing module" rather than breaking.
- **RLS on all 10 new tables** — correct multi-tenant security posture.
- **AI rules-based fallback** — all AI functions work without Anthropic API key.
- **Rollback design for migration** — per-job rollback is the right approach (storage mechanism needs adjustment, but the concept is correct).
- **Build order** — DB schema first, then API routes, then UI pages is the correct sequence.
- **Trainer bonus threshold excludes trainer self check-in** — the business logic is correct.

---

## Competitive Position

Phase 3 moves Meridian past every boutique fitness platform on analytics:
- **Trainer economics** (promo code attribution, check-in-based bonus, compensation calculation) — no competitor has this as first-class
- **AI insights with urgency + recommended action + deep links** — Mindbody shows charts; Meridian tells you what to do
- **Pricing simulator** — unique in the market
- **Migration tooling** — removes the switching cost barrier from Glofox

The custom dashboard builder is the one Phase 3 feature where competitors (particularly BI tools like Metabase) are more capable. This reinforces the case for deferring it.

---

## Key Assumptions to Validate

1. Glofox seed data spans enough date range to produce meaningful historical `daily_metrics` rows (date range not stated in plan)
2. `staff` table has a `profile_id` column linking to `profiles.id` (RPC column name must be verified)
3. Phase 2 `campaigns` and `leads` tables are complete (2 report templates depend on them)
4. `@react-pdf/renderer` is compatible with Netlify function runtime (validate in Week 1 spike)
5. AI pricing projections will be displayed as ranges with uncertainty caveats, not point estimates

---

## Full Report Locations

- Technical Feasibility: `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/technical-feasibility.md`
- Scope & Complexity: `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/scope-complexity.md`
- User Value: `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/user-value.md`
- Cost-Benefit: `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/cost-benefit.md`
- Architecture Impact: `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/architecture-impact.md`
- Edge Cases: `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/edge-cases.md`
- Competitive Context: `/Users/zach/Desktop/literal-fishstick/.scrutiny/analysis/competitive-context.md`
- Full Verdict: `/Users/zach/Desktop/literal-fishstick/.scrutiny/synthesis/verdict.md`
- Scope Decomposition: `/Users/zach/Desktop/literal-fishstick/.scrutiny/planning/scope-decomposition.md`
