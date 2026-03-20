# Technical Feasibility Analysis
**Agent:** technical-feasibility
**Plan:** Meridian Phase 3 — Analytics & Intelligence
**Complexity Class:** SIGNIFICANT
**Date:** 2026-03-20

---

## Agent Verdict

**MODIFY**

The plan is technically grounded and largely implementable, but contains a critical RPC performance bug, a library compatibility trap, an unaddressed Stripe immutability constraint, and a dual-infrastructure smell. These are concrete issues, not speculative risk. Fix them before or during Sprint 1 — none require rescoping the phase, but two of them (RPC bug, Stripe price flow) will cause implementation failures if left to encounter in sprint.

---

## Findings

### Finding 1: Heatmap and leaderboard RPC functions use correlated subqueries inside aggregates — will be slow (CRITICAL)

The `get_attendance_heatmap` function does this:

```sql
SUM((SELECT COUNT(*) FROM bookings b WHERE b.class_id = c.id AND b.status = 'checked_in'))
```

And `get_trainer_leaderboard` does the same pattern three times. This is a correlated subquery inside an aggregate function. Postgres executes a separate subquery for every row in the outer scan. For 500 classes in a 90-day window, that is 500+ separate index seeks per API call — before grouping. This will be visibly slow (1–5 seconds on real data) and will get worse as data grows.

**Fix:** Rewrite both RPCs using a CTE or lateral join to pre-aggregate bookings once:

```sql
WITH booking_counts AS (
  SELECT class_id, COUNT(*) AS checked_in_count
  FROM bookings
  WHERE studio_id = p_studio_id
    AND status = 'checked_in'
  GROUP BY class_id
)
SELECT ... FROM classes c
LEFT JOIN booking_counts bc ON bc.class_id = c.id
WHERE ...
```

This is a one-pass scan instead of N scans. The fix is straightforward — the SQL must be corrected before Sprint 1 ships, not after profiling.

---

### Finding 2: `@react-pdf/renderer` cannot run server-side in Next.js App Router without explicit workarounds (HIGH)

The plan says "server-side PDF report generation" using `@react-pdf/renderer`. This library uses `canvas` during module initialization. In Next.js 14+ App Router, it will throw `ReferenceError: canvas is not defined` or similar errors when imported at the module level in a Server Component or Edge Function.

**What actually works:** Import it dynamically inside a Node.js runtime API route:

```typescript
// app/api/reports/[id]/export/route.ts
export const runtime = 'nodejs'; // Required — not 'edge'

export async function POST(req: Request) {
  const { pdf, Document, Page, Text } = await import('@react-pdf/renderer');
  // ... rest of PDF generation
}
```

This works but must be validated on Netlify's function runtime before Sprint 2 builds the full PDF layer. Netlify Node.js functions have a 50 MB compressed size limit. `@react-pdf/renderer` + its font dependencies can approach this limit depending on what fonts are embedded.

**Alternative to evaluate:** `pdfmake` is lighter and Node-native without canvas dependency. If PDF output does not need custom React component trees (just tables and headers), `pdfmake` avoids the compatibility minefield entirely.

**Action:** Spike this in Week 1 before Sprint 2 commits to the approach.

---

### Finding 3: Stripe Price objects are immutable — "Apply Changes" cannot update an existing price amount (HIGH)

The plan states: "Apply Changes button — confirms, then updates the actual membership plan prices via Stripe. Sets `applied_at`."

Stripe `Price` objects are immutable. `stripe.prices.update()` accepts only metadata, nickname, and lookup_key — not the `unit_amount`. Attempting to update the amount will return a Stripe API error.

The correct Stripe pattern for a price change:
1. `stripe.prices.create()` with the new amount and same currency/product
2. `stripe.products.update(productId, { default_price: newPriceId })` — new subscribers use this price
3. Existing subscribers continue on old price until their subscription is explicitly migrated: `stripe.subscriptions.update(subId, { items: [{ id: itemId, price: newPriceId }], proration_behavior: 'none' })`

The plan has no design for step 3. This is the critical question: when an admin clicks "Apply Changes," do existing 87 unlimited members automatically get the new price at their next billing cycle, or only new members? This is a real-money decision that must be explicitly designed before Sprint 4.

**Required design decision:** Add a migration modal to the pricing simulator "Apply" flow with: (a) count of affected existing subscribers, (b) toggle for "apply to existing subscribers at next renewal" vs "new subscribers only," (c) confirmation with irreversibility warning.

---

### Finding 4: `react-grid-layout` and React 19 compatibility is uncertain (MODERATE)

The codebase runs React 19.2.4. `react-grid-layout` at its latest stable version (1.4.x at time of writing) uses `ReactDOM.findDOMNode()` internally, which is deprecated and removed in React 19 strict mode. This will produce errors or silent failures in development mode and may produce failures in production.

**Mitigation:** The codebase already has `@dnd-kit/core ^6.3.1`, `@dnd-kit/sortable ^10.0.0`, and `@dnd-kit/utilities ^3.2.2` installed. These are React 19-native. A grid layout system can be built using `@dnd-kit` with CSS Grid positioning — more work than dropping in `react-grid-layout`, but no new dependency and no compatibility risk.

**Recommendation:** Check `react-grid-layout` releases before Sprint 4 for a React 19-compatible version. If one doesn't exist, build the grid system with `@dnd-kit` — the library is already installed and the team has used it (it's in `package.json`).

---

### Finding 5: Six cron jobs via Netlify Scheduled Functions creates a fragile dual-infrastructure setup (MODERATE)

The plan uses Netlify Scheduled Functions for 6 daily/weekly cron jobs and Inngest for batch churn prediction (Sprint 3). Inngest is already integrated (`inngest ^4.0.2`) and offers native cron scheduling via `{ cron: "0 2 * * *" }` triggers.

Netlify Scheduled Functions have a 10-second execution timeout on Starter/Pro plans (26 seconds on Business). The `cron/daily-metrics` job must aggregate the previous day's bookings, transactions, and member state across potentially thousands of rows. As data grows, this will exceed 10 seconds.

Inngest functions have no timeout problem (they run as background tasks with step-based execution), provide retries, provide a dashboard for monitoring execution history, and are already integrated.

**Recommendation:** Use Inngest `cron` triggers for all 6 scheduled jobs. Remove Netlify Scheduled Functions from the plan. This eliminates the dual-infrastructure smell and the timeout risk.

---

### Finding 6: Daily metrics backfill has undefined correctness requirements (MODERATE)

Sprint 1 includes "Backfill script: generate `daily_metrics` rows for all historical data." The seed data includes 1,103 members, 1,393 bookings, and 2,015 transactions, but:

- The date range of the seed data is not stated in the plan
- `daily_metrics.churned_members` requires knowing which members transitioned from active to inactive on each day — this requires member status history, not just a point-in-time snapshot
- `daily_metrics.active_members` on any given historical date requires reconstructing active membership state from transaction and membership records, which is non-trivial if the seed data doesn't include cancellation events

If the backfill produces incorrect numbers, every chart on the analytics overview page will display bad data from day one. The plan should include a validation step: after backfill, spot-check 5 specific dates by running raw queries against source tables and comparing totals to the generated `daily_metrics` rows.

---

### Finding 7: No mention of Supabase Storage configuration for report exports (LOW)

The plan references storing CSV and PDF exports in Supabase Storage with signed download URLs. This requires:
- A storage bucket to be created (e.g., `report-exports`)
- Bucket RLS policies configured (authenticated users from the correct studio only)
- Signed URL generation in the API route (time-limited, e.g., 1-hour TTL)

None of this is mentioned in the database schema section or the API route section. It's likely assumed but should be called out explicitly in the Sprint 2 checklist to avoid it being an integration surprise.

---

### Finding 8: `get_trainer_leaderboard` joins through `staff` table, not `profiles` directly — join path must match actual schema (LOW)

The RPC joins `classes.trainer_id -> staff.id -> profiles.id`. The plan's existing staff API (`/api/staff/route.ts`) and trainer summary AI (`trainer-summary.ts`) also reference this join path, so it is likely correct. But the trainer leaderboard RPC uses `b.member_id != t.trainer_id` to exclude the trainer's own check-in — this comparison uses `t.trainer_id` (from the `staff` table) against `b.member_id` (from the `bookings` table). If `bookings.member_id` references `profiles.id` and `staff.trainer_id` is a UUID that maps to `profiles.id`, the comparison is valid. If there is any mismatch in the join chain, the trainer self-exclusion logic will silently include or exclude wrong rows.

**Action:** Verify the exact column names during Sprint 1 schema migration before shipping the RPC.

---

## Technical Verdict Summary

| Area | Status |
|------|--------|
| DB schema design | Sound — well-indexed, RLS pattern matches existing tables |
| RPC heatmap + leaderboard | BUG — correlated subqueries must be rewritten before Sprint 1 ships |
| PDF generation | RISK — validate on Netlify in Week 1 before Sprint 2 commits |
| Stripe pricing apply | DESIGN GAP — immutable prices not addressed; design before Sprint 4 |
| react-grid-layout + React 19 | VERIFY — check compatibility; @dnd-kit is the fallback |
| Cron infrastructure | SMELL — consolidate all 6 crons to Inngest |
| Backfill script | UNDERSTATED — needs validation step and churn definition |
| Supabase Storage for exports | MISSING from schema section — add to Sprint 2 checklist |

**Overall:** Implementable. No architectural blockers. The RPC bug and Stripe flow gap are the two items that will cause Sprint failures if not addressed proactively.
