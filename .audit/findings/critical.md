# Critical Findings

**Generated:** 2026-04-05
**Deduplicated and cross-referenced from 10 layer audit reports.**

---

## CRIT-001: daily_metrics revenue data is wrong across all historical dates

**ID:** DM-001
**Corroborated by:** data-model, user-flow, ui-ux, ai-layer, performance-infra (5/10 layers)
**Layer:** data-model

**Summary:** The `daily_metrics` table was computed before 1,894 Glofox transactions were inserted. The cron only processes forward — historical rows will never be corrected. Every revenue metric on the Command Center, Revenue dashboard, executive analytics, and AI briefing context is displaying incorrect (zero or near-zero) historical revenue.

**Evidence:**
- `cron-daily-metrics.ts`: only processes dates after the last computed row
- `transactions` table: 1,894 rows with historical timestamps inserted after metrics were computed
- `daily_metrics` rows: exist for historical dates but contain zero revenue

**Fix:**
1. Run one-time backfill: DELETE all `daily_metrics` rows for affected date range, re-aggregate from `transactions`
2. Add reconciliation: if `revenue_total = 0` but `transactions` exist for that date, re-compute
3. Interim: have Command Center revenue widgets read directly from `transactions`

**Effort:** Low (1-2 hours for backfill script). High urgency.

---

## CRIT-002: credit_packs table is empty — member credit features are non-functional

**ID:** DM-002
**Corroborated by:** data-model, user-flow, integration (3/10 layers)
**Layer:** data-model

**Summary:** The `credit_packs` table has never been populated. The Glofox backfill function has a step for credits (`backfill-credits`) but it has apparently never been triggered or completed successfully. Members with credit packs in Glofox show zero credits in Meridian. The `credit_expiry` automation trigger can never fire.

**Evidence:**
- `credit_packs` table: empty
- `glofox-backfill.ts` step 6: code exists to fetch credits per member but table remains empty
- `GET /api/members/[id]`: queries `credit_packs`, always returns empty array

**Fix:**
1. Trigger the backfill: `POST /api/glofox/backfill` with the `credit_packs` step enabled
2. Monitor Inngest function execution and `credit_packs` row count post-run
3. Verify `credit_expiry` automation can now fire for eligible members

**Effort:** Low (trigger existing backfill). Medium urgency (members losing credit expiry reminders).
