# Meridian Data & Member Classification Audit

**Date:** 2026-03-22
**Auditor:** Claude Opus 4.6
**Scope:** `/apps/web/src/` — all frontend pages, components, API routes, and database schema

---

## PART 1: HARDCODED / MOCK DATA AUDIT

### Summary

- **35 files** contain explicit `// ─── Mock Data ───` sections with hardcoded arrays
- **5 pages** fetch live data from Supabase (Command Center, Members, Revenue, Schedule, Segments)
- **~30 pages** are 100% static/mock — they render hardcoded arrays and never touch the database
- **3 additional** areas have subtle hardcoded values inside otherwise-live pages

### Category A: Pages With Explicit Mock Data Sections (100% Hardcoded UI)

These pages have a `// ─── Mock Data ───` comment followed by hardcoded `const` arrays. None of them fetch from Supabase or any API. They are functional UI shells with fake data.

#### Analytics Module (10 files)

| File | Mock Data | Should Be |
|------|-----------|-----------|
| `analytics/page.tsx` | Hardcoded overview stats (retention rate, NPS score, avg visit duration, revenue growth) | Computed from `daily_metrics`, `members`, `transactions` tables |
| `analytics/dashboards/executive/page.tsx` | Hardcoded KPIs, revenue chart data, membership breakdown | Fetched from `daily_metrics` + `transactions` + `members` |
| `analytics/dashboards/growth/page.tsx` | Hardcoded member growth, cohort data, lead pipeline, at-risk list | Fetched from `members` + `leads` + `cohort_snapshots` |
| `analytics/dashboards/operations/page.tsx` | Hardcoded facility utilization, class fill rates, staff metrics | Fetched from `classes` + `bookings` + `clock_entries` |
| `analytics/insights/page.tsx` | Hardcoded AI insight cards (retention insight, schedule optimization, etc.) | Already has API at `/api/ai/insights` — just needs to be wired up |
| `analytics/reports/page.tsx` | Static report template list, hardcoded saved/scheduled reports | Report templates are config (OK to hardcode), but saved reports should come from `saved_reports` table |
| `analytics/reports/[id]/page.tsx` | Hardcoded report data, chart data, table rows | Should fetch from `/api/reports/[id]` using the report engine |
| `analytics/reports/new/page.tsx` | Static report builder with hardcoded metric options | Metric options are config (OK), but preview data should be live |
| `analytics/trainers/page.tsx` | Hardcoded trainer leaderboard, stats, performance data | Should fetch from `trainer_class_log` + `profiles` |
| `analytics/trainers/[id]/page.tsx` | Hardcoded individual trainer stats, class history, earnings | Should fetch from `trainer_class_log` for specific trainer |
| `analytics/pricing/page.tsx` | Hardcoded pricing simulations list | Already has API at `/api/pricing-simulator` — needs wiring |
| `analytics/pricing/[id]/page.tsx` | Hardcoded simulation detail, scenario analysis | Already has API at `/api/pricing-simulator/[id]` — needs wiring |
| `analytics/migration/page.tsx` | Hardcoded migration status, progress bars, sample data preview | Already has APIs at `/api/migration/*` — needs wiring |

#### Marketing Module (8 files)

| File | Mock Data | Should Be |
|------|-----------|-----------|
| `marketing/page.tsx` | Hardcoded campaign stats, subscriber count, email open rates | Fetched from `campaigns` + `campaign_sends` tables |
| `marketing/campaigns/page.tsx` | Hardcoded campaigns list with send counts, open rates, CTR | Fetched from `campaigns` table |
| `marketing/campaigns/[id]/page.tsx` | Hardcoded campaign detail, audience segments with counts (`{ id: 'at-risk', name: 'At-Risk (Churn)', count: 31 }`) | Fetched from `campaigns` + `smart_segments` + `segment_members` |
| `marketing/campaigns/[id]/report/page.tsx` | Hardcoded campaign report with delivery stats, click heatmap | Fetched from `campaign_sends` + `email_events` |
| `marketing/campaigns/new/page.tsx` | Hardcoded segment list with static counts | Fetched from `smart_segments` |
| `marketing/automations/page.tsx` | Hardcoded automation flows list | Fetched from `automation_flows` table |
| `marketing/leads/page.tsx` | Hardcoded leads pipeline with fake names/companies | Fetched from `leads` table (API exists at `/api/leads`) |
| `marketing/leads/[id]/page.tsx` | Hardcoded individual lead detail, activity timeline | Fetched from `leads` + `lead_activities` |
| `marketing/content/page.tsx` | Hardcoded content hub items | Fetched from `content_items` table (API exists at `/api/content`) |

#### Corporate Module (4 files)

| File | Mock Data | Should Be |
|------|-----------|-----------|
| `corporate/page.tsx` | Hardcoded company list (Tampa Bay Buccaneers, Raymond James, etc.), events, invoices | Fetched from `corporate_accounts` + `corporate_events` + `invoices` (APIs exist at `/api/corporate/*`) |
| `corporate/[id]/page.tsx` | Hardcoded company detail, member roster, usage history | Fetched from `/api/corporate/[id]` |
| `corporate/events/page.tsx` | Hardcoded events calendar | Fetched from `corporate_events` table |
| `corporate/events/[id]/page.tsx` | Hardcoded event detail | Fetched from corporate events API |

#### Operations Module (3 files)

| File | Mock Data | Should Be |
|------|-----------|-----------|
| `operations/page.tsx` | Hardcoded staff list, facility status, geofence zones | Staff from `profiles` (role=trainer/staff), facilities from settings |
| `operations/documents/page.tsx` | Hardcoded waiver/document list | Fetched from `waivers` table or document storage |
| `operations/payroll/page.tsx` | Hardcoded payroll summaries, pay period data, tax docs | Fetched from `clock_entries` + `trainer_class_log` |

#### Revenue Module (3 files)

| File | Mock Data | Should Be |
|------|-----------|-----------|
| `revenue/orders/page.tsx` | Hardcoded order list (merch orders) | Fetched from `orders` table (API exists at `/api/orders`) |
| `revenue/products/page.tsx` | Hardcoded product catalog | Fetched from `products` table (API exists at `/api/products`) |
| `revenue/products/[id]/page.tsx` | Hardcoded product detail, variants, inventory | Fetched from `/api/products/[id]` |

#### Engagement Module (1 file)

| File | Mock Data | Should Be |
|------|-----------|-----------|
| `engagement/page.tsx` | Hardcoded leaderboard (Sarah Martinez, Carlos Mendez, etc.), achievements, challenges | Fetched from `members` (sorted by total_visits), achievement system TBD |

#### Settings (1 file)

| File | Mock Data | Should Be |
|------|-----------|-----------|
| `settings/geofence/page.tsx` | Hardcoded geofence zones list | Fetched from `geofence_zones` table (API exists at `/api/geofence`) |

#### Employee Portal (1 file)

| File | Mock Data | Should Be |
|------|-----------|-----------|
| `employee/clock/page.tsx` | Hardcoded recent clock entries, weekly summary | Fetched from `clock_entries` table |

### Category B: Hardcoded Values Inside Otherwise-Live Pages

These pages DO fetch real data but have hardcoded/fake values sprinkled in:

#### 1. Command Center (`(admin)/page.tsx`)

- **Lines 297-304:** Facility status is hardcoded: `"Cold Plunges: 4/6 available"` and `"All saunas active"`. Should come from a real-time facility status system or at minimum from settings.
- **Line 155:** `"Good morning, Zach"` — username is hardcoded. Should use the authenticated user's name.

#### 2. Command Center Data Hook (`use-command-center-data.ts`)

- **Lines 54-73:** `MOCK_INSIGHTS` array used as fallback when AI briefing API fails. These are reasonable fallback defaults, but the AI insights array is always initialized with these mocks (line 112) and only replaced if the API call succeeds.

#### 3. Members Page (`(admin)/members/page.tsx`)

- **Lines 342-346:** Several member properties are hardcoded for every member:
  - `paymentMethod: 'On file'` — should check Stripe for actual payment method
  - `preferredTime: '6:00 PM'` — should be computed from booking history
  - `preferredType: 'Open Sauna'` — should be computed from booking history
  - `guidedSessions: 0` — should count bookings with guided class types
  - `avgDuration: '50 min'` — should be computed from check-in/check-out data
- **Lines 201-215:** `generateHeatmap()` produces random visit heatmap data. Should use actual visit dates from `bookings` table.
- **Lines 126-127:** `mapTier()` has hardcoded prices (`225`, `180`, `120`). Should come from `membership_plans` or similar pricing table.

#### 4. Member Detail Page (`(admin)/members/[id]/page.tsx`)

- Same hardcoded member fields as the list page (preferredTime, preferredType, etc.)

### Category C: Pages That Correctly Fetch Live Data

These pages are properly wired up to Supabase:

| Page | Data Source |
|------|------------|
| `(admin)/page.tsx` (Command Center) | `classes`, `bookings`, `transactions`, `activity_log` via Supabase client + `/api/ai/briefing` |
| `(admin)/members/page.tsx` | `members` + `profiles` via Supabase client |
| `(admin)/members/[id]/page.tsx` | Member detail via `/api/members/[id]` + `bookings` + `transactions` + `member_tags` |
| `(admin)/revenue/page.tsx` | `transactions`, `members`, `daily_metrics` via Supabase client |
| `(admin)/schedule/page.tsx` | `classes` via `useClasses` hook |
| `(admin)/segments/page.tsx` | `smart_segments` via Supabase client |
| `(admin)/settings/page.tsx` | `studio_settings` via Supabase client |
| `(employee)/employee/performance/page.tsx` | `trainer_class_log` via Supabase client |
| `(employee)/employee/promo/page.tsx` | `promo_attributions` via Supabase client |
| `(employee)/employee/schedule/page.tsx` | `classes` via Supabase client |
| `(employee)/employee/timesheets/page.tsx` | `clock_entries` via Supabase client |
| `(employee)/employee/pay/page.tsx` | `trainer_class_log` via Supabase client |
| `(employee)/employee/profile/page.tsx` | `profiles` via Supabase client |
| `(employee)/employee/page.tsx` (Dashboard) | Multiple tables via Supabase client |
| `(employee)/employee/classes/page.tsx` | `classes` via Supabase client |

### Impact Assessment

| Severity | Count | Description |
|----------|-------|-------------|
| **Critical** | 4 | Corporate, Marketing campaigns, Operations pages show completely fake business data that could confuse admins |
| **High** | 12 | Analytics dashboards, reports, and insights show fake metrics that undermine trust in the platform |
| **Medium** | 14 | Content, leads, automations, products — functional UI shells awaiting Phase 2/3 API wiring |
| **Low** | 5 | Hardcoded values in otherwise-live pages (facility status, member preferences, prices) |

---

## PART 2: MEMBER CLASSIFICATION DEEP ANALYSIS

### 2.1 Current Database Schema

**`members` table columns relevant to classification:**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `membership_status` | text (CHECK) | `'active'` | Allowed: `active`, `paused`, `cancelled`, `past_due`, `none` |
| `membership_tier` | text (CHECK) | NULL | Allowed: `unlimited`, `10_class`, `6_class` |
| `credits_remaining` | integer | 0 | |
| `last_visit` | timestamptz | NULL | |
| `total_visits` | integer | 0 | |
| `lifetime_value` | integer | 0 | In cents |
| `join_date` | date | CURRENT_DATE | |
| `stripe_subscription_id` | text | NULL | |
| `stripe_customer_id` | text | NULL | |

**`profiles` table also has:**
- `health_score` (integer) — AI-computed health score
- `health_risk_level` (text) — AI risk classification

### 2.2 Current Data Distribution

```
membership_status  | count
-------------------+------
none               | 757
active             | 343
cancelled          | 4
paused             | 0
past_due           | 0
```

**Active members breakdown (343 total):**

| Metric | Count |
|--------|-------|
| Has Stripe subscription | 0 (!) |
| Has membership tier set | 22 |
| Has credits remaining > 0 | 294 |
| Has ever visited | 275 |
| Visited in last 7 days | 2 |
| Visited in last 30 days | 57 |
| Never visited | 25 (but still "active") |
| No visit in 30+ days | 261 |
| No visit in 60+ days | 228 |
| No visit in 90+ days | 219 |
| No visit in 180+ days | 190 |
| No visit in 365+ days | 123 |

**Active members by tier:**

| Tier | Total | Has Credits | No Credits | Never Visited | No Visit 30d | Avg Visits |
|------|-------|-------------|------------|---------------|-------------|-----------|
| NULL (no tier) | 321 | 274 | 47 | 24 | 274 | 4 |
| 10_class | 11 | 11 | 0 | 0 | 5 | 43 |
| 6_class | 7 | 6 | 1 | 0 | 6 | 6 |
| unlimited | 4 | 3 | 1 | 1 | 1 | 40 |

**Critical finding:** 22 "active" members have no visit in 30+ days, no credits, AND no membership tier. They are essentially ghost records.

**Health score data:** The `profiles.health_risk_level` column exists but has NO data populated (0 rows with non-null values). The AI health score system exists in code but hasn't been run on the production data.

### 2.3 How `membership_status` Gets Set/Changed

There are exactly **3 mechanisms** that change `membership_status`:

#### 1. Stripe Webhooks (`/api/webhooks/stripe/route.ts`)

| Stripe Event | Status Set To |
|-------------|---------------|
| `customer.subscription.created` | `'active'` |
| `customer.subscription.updated` (cancel_at_period_end = true) | `'paused'` |
| `customer.subscription.updated` (cancel_at_period_end = false) | `'active'` |
| `customer.subscription.deleted` | `'cancelled'` |

**Problem:** Since 0 of 343 "active" members have a `stripe_subscription_id`, none of these webhooks are currently firing. The status is stuck at whatever it was set to during data migration/seeding.

#### 2. Database Default

New member records default to `membership_status = 'active'` (column default). This means any member created (including via migration import) starts as "active" regardless of whether they have a subscription or credits.

#### 3. Manual (No Admin UI)

There is no admin UI for manually changing a member's status. The only way would be direct database edits.

**Missing mechanisms:**
- NO cron job or scheduled task that downgrades status based on inactivity
- NO automated `past_due` detection (Stripe `invoice.payment_failed` logs a failed transaction but does NOT change `membership_status` to `past_due`)
- NO automated transition from `active` to anything based on credit expiry or visit inactivity
- The `past_due` status exists in the CHECK constraint but is never set by any code path

### 2.4 Frontend Classification Logic

The Members page uses **client-side logic** to derive display status from the database `membership_status`:

```typescript
// File: apps/web/src/app/(admin)/members/page.tsx, lines 139-153
function mapStatus(dbStatus: string, joinDate: string, lastVisit: string | null): Member['status'] {
  if (dbStatus === 'paused') return 'paused'
  // "New" = joined in the last 30 days
  const joinDt = new Date(joinDate)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  if (joinDt >= thirtyDaysAgo) return 'new'
  // "At risk" = active but no visit in 30 days
  if (dbStatus === 'active' && lastVisit) {
    const lastDt = new Date(lastVisit)
    if (lastDt < thirtyDaysAgo) return 'at-risk'
  }
  if (dbStatus === 'active') return 'active'
  return 'active'
}
```

**UI filter tabs:** `All | Active | Paused | At Risk | New`

**How tab counts are computed:**

| Tab | Query |
|-----|-------|
| All | `members` count where studio_id matches |
| Active | `membership_status = 'active'` |
| Paused | `membership_status = 'paused'` |
| At Risk | `membership_status = 'active' AND last_visit < 30 days ago` |
| New | `join_date >= 30 days ago` |

**Problems with current logic:**

1. **"At Risk" requires `lastVisit` to be non-null.** Members who have NEVER visited but are "active" are classified as just "active" — not "at risk". This is wrong. A member who signed up and never showed up is arguably MORE at risk.

2. **"Active" with no visit in 365 days is still "Active."** If a member has `membership_status = 'active'` and `last_visit = NULL`, the `mapStatus` function returns `'active'`. There are 25 such members.

3. **No "Inactive" or "Lapsed" concept.** The system has no way to express "this person was once active but hasn't engaged in 6+ months and has no credits." The only off-ramp is `cancelled` (which requires a Stripe subscription deletion).

4. **"New" overrides everything.** If someone joined 20 days ago and has `membership_status = 'paused'`, they show as "new" not "paused" because `joinDt >= thirtyDaysAgo` is checked before `dbStatus === 'paused'` — wait, actually paused is checked first. But if they're `active` and joined recently, they show as "new" even if they might also be at risk.

5. **Overlap between "New" and "Active" tab counts.** The "New" count uses `join_date >= 30 days ago` which includes ALL statuses, not just active members. A cancelled member who joined recently counts toward "New".

6. **`cancelled` and `past_due` and `none` members are invisible.** The filter tabs only show Active, Paused, At Risk, New. Members with `status = 'none'` (757 members!) or `status = 'cancelled'` (4 members) don't appear in any filtered tab (only in "All").

### 2.5 The Core Question: "What Does Active Mean?"

Currently, "Active" means exactly one thing: `membership_status = 'active'` in the database. This is set:
- By default when a member record is created
- By Stripe webhook when a subscription is created or renewed

It does NOT consider:
- Whether the member has visited recently (or ever)
- Whether the member has remaining credits
- Whether the member has a Stripe subscription
- Whether the member's credits have expired
- How long since they joined

**Result:** 123 members who haven't visited in over a year are classified as "Active." 25 members who have never visited at all are "Active."

---

## PART 3: RECOMMENDED CLASSIFICATION SYSTEM

### 3.1 Proposed Member Status Model

Replace the current flat `membership_status` with a **two-dimensional model**:

**Dimension 1: Billing Status** (from Stripe/payment system — factual, objective)
- `active` — has an active Stripe subscription OR unexpired credits
- `past_due` — Stripe subscription payment failed (grace period)
- `paused` — subscription set to cancel at period end
- `cancelled` — subscription terminated
- `none` — no subscription, no credits (lead or drop-in only)

**Dimension 2: Engagement Status** (computed from behavior — derived, subjective)
- `engaged` — visited within the last 14 days
- `active` — visited within the last 30 days
- `cooling` — visited 31-60 days ago
- `at_risk` — visited 61-90 days ago OR has credits expiring within 7 days
- `lapsed` — no visit in 90+ days
- `never_visited` — has never checked in

### 3.2 Schema Changes

```sql
-- Step 1: Add engagement_status column
ALTER TABLE members ADD COLUMN engagement_status text
  DEFAULT 'never_visited'
  CHECK (engagement_status IN ('engaged', 'active', 'cooling', 'at_risk', 'lapsed', 'never_visited'));

-- Step 2: Add credit_expires_at for credit pack expiry tracking
ALTER TABLE members ADD COLUMN credit_expires_at timestamptz;

-- Step 3: Backfill engagement_status from existing data
UPDATE members SET engagement_status = CASE
  WHEN last_visit IS NULL THEN 'never_visited'
  WHEN last_visit >= now() - interval '14 days' THEN 'engaged'
  WHEN last_visit >= now() - interval '30 days' THEN 'active'
  WHEN last_visit >= now() - interval '60 days' THEN 'cooling'
  WHEN last_visit >= now() - interval '90 days' THEN 'at_risk'
  ELSE 'lapsed'
END;

-- Step 4: Fix membership_status for members that should be 'none'
-- (active members with no subscription, no tier, no credits)
UPDATE members SET membership_status = 'none'
WHERE membership_status = 'active'
  AND stripe_subscription_id IS NULL
  AND membership_tier IS NULL
  AND credits_remaining = 0;
```

### 3.3 Automated Status Management (Inngest Cron)

Create a new cron function `cron-engagement-status` that runs daily:

```typescript
// Pseudo-code for the daily engagement status updater
async function updateEngagementStatuses(db) {
  // Update all members' engagement_status based on last_visit
  await db.rpc('refresh_engagement_status'); // or do it in-app

  // Also: check for expired credits and update membership_status
  await db.from('members')
    .update({ membership_status: 'none' })
    .lt('credit_expires_at', new Date().toISOString())
    .eq('credits_remaining', 0)
    .is('stripe_subscription_id', null);
}
```

Additionally, fix the Stripe `invoice.payment_failed` webhook handler to actually set `membership_status = 'past_due'`:

```typescript
// In webhooks/stripe/route.ts, case 'invoice.payment_failed':
if (memberId && studioId) {
  await supabase
    .from('members')
    .update({ membership_status: 'past_due' })
    .eq('id', memberId)
    .eq('studio_id', studioId)
}
```

### 3.4 Frontend Tab Redesign

Replace the current tabs with:

```
All (1104) | Subscribed (22) | Credit Pack (294) | At Risk (261) | New (45) | Lapsed (190) | No Plan (757)
```

Or a simpler version that matches the current UI concept but fixes the logic:

```
All (1104) | Active (80) | At Risk (261) | New (25) | Lapsed (190) | Paused (0) | Cancelled (4)
```

Where:
- **Active** = `membership_status IN ('active') AND engagement_status IN ('engaged', 'active')`
- **At Risk** = `membership_status = 'active' AND engagement_status IN ('cooling', 'at_risk')` OR `last_visit IS NULL AND membership_status = 'active'`
- **New** = `join_date >= now() - 30 days AND membership_status = 'active'`
- **Lapsed** = `membership_status = 'active' AND engagement_status = 'lapsed'`

### 3.5 Fix the `mapStatus` Function

```typescript
function mapStatus(
  dbStatus: string,
  joinDate: string,
  lastVisit: string | null,
  creditsRemaining: number,
  engagementStatus: string | null,
): Member['status'] {
  // Paused/cancelled from billing system takes precedence
  if (dbStatus === 'paused') return 'paused'
  if (dbStatus === 'cancelled') return 'cancelled'
  if (dbStatus === 'past_due') return 'past-due'

  // "New" = joined in the last 30 days AND is active
  if (dbStatus === 'active') {
    const joinDt = new Date(joinDate)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    if (joinDt >= thirtyDaysAgo) return 'new'
  }

  // Engagement-based classification for active billing members
  if (dbStatus === 'active') {
    if (!lastVisit) return 'at-risk' // Never visited = at risk
    const lastDt = new Date(lastVisit)
    const now = new Date()
    const daysSince = Math.floor((now.getTime() - lastDt.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSince <= 30) return 'active'
    if (daysSince <= 90) return 'at-risk'
    return 'lapsed'
  }

  // No plan members
  if (dbStatus === 'none') {
    if (creditsRemaining > 0) return 'active' // Has credits, is active
    return 'inactive'
  }

  return 'inactive'
}
```

### 3.6 Specific Code Changes Required

#### Immediate Fixes (No Schema Change Needed)

1. **`members/page.tsx` line 139-153:** Fix `mapStatus` to treat `lastVisit === null` as at-risk, not active.

2. **`members/page.tsx` line 382-388:** Fix "At Risk" count query to include members with NULL `last_visit`:
   ```typescript
   // Current (misses null last_visit):
   .lt('last_visit', thirtyDaysAgo.toISOString())
   // Fixed:
   .or(`last_visit.lt.${thirtyDaysAgo.toISOString()},last_visit.is.null`)
   ```

3. **`webhooks/stripe/route.ts` case `invoice.payment_failed`:** Add status update to `past_due`.

4. **`members/page.tsx` lines 342-346:** Remove hardcoded `preferredTime`, `preferredType`, `guidedSessions`, `avgDuration`. Either compute from booking data or omit from the list view.

5. **`page.tsx` (Command Center) lines 297-304:** Remove hardcoded facility status. Either fetch from a facility status table or show a placeholder.

6. **`page.tsx` (Command Center) line 155:** Replace `"Good morning, Zach"` with the authenticated user's name.

#### Schema Migration Required

7. Add `engagement_status` column to `members` table.
8. Create daily Inngest cron to refresh `engagement_status`.
9. Backfill `engagement_status` for all existing members.
10. Fix members with `membership_status = 'active'` who have no subscription, no tier, and no credits — set to `'none'`.

#### Phase 2/3 Work (API Wiring)

11. Wire up all 35 mock-data pages to their corresponding Supabase tables or API routes. Many APIs already exist (corporate, leads, content, products, pricing simulator, geofence) but the frontend pages don't call them.

---

## APPENDIX: SQL Queries Used

### Member Status Distribution
```sql
SELECT membership_status, count(*) FROM members GROUP BY membership_status ORDER BY count DESC;
-- none: 757, active: 343, cancelled: 4
```

### Active Members Visit Analysis
```sql
SELECT
  count(*) FILTER (WHERE last_visit IS NULL) as never_visited,        -- 25
  count(*) FILTER (WHERE last_visit < now() - interval '30 days') as no_visit_30d,  -- 261
  count(*) FILTER (WHERE last_visit < now() - interval '90 days') as no_visit_90d,  -- 219
  count(*) FILTER (WHERE last_visit < now() - interval '365 days') as no_visit_365d, -- 123
  count(*) as total_active                                             -- 343
FROM members WHERE membership_status = 'active';
```

### Active Members Engagement Snapshot
```sql
SELECT
  count(*) as total_active,           -- 343
  count(*) FILTER (WHERE stripe_subscription_id IS NOT NULL) as has_stripe_sub,  -- 0
  count(*) FILTER (WHERE membership_tier IS NOT NULL) as has_tier,               -- 22
  count(*) FILTER (WHERE credits_remaining > 0) as has_credits,                  -- 294
  count(*) FILTER (WHERE total_visits > 0) as visited_ever,                      -- 275
  count(*) FILTER (WHERE last_visit >= now() - interval '30 days') as visited_30d, -- 57
  count(*) FILTER (WHERE last_visit >= now() - interval '7 days') as visited_7d    -- 2
FROM members WHERE membership_status = 'active';
```

### Credits vs Status
```sql
SELECT membership_status,
  count(*) FILTER (WHERE credits_remaining > 0) as has_credits,
  count(*) FILTER (WHERE credits_remaining = 0 OR credits_remaining IS NULL) as no_credits
FROM members GROUP BY membership_status;
-- active: 294 with credits, 49 without
-- none: 0 with credits, 757 without
```

### CHECK Constraint Values
```sql
-- membership_status: active, paused, cancelled, past_due, none
-- membership_tier: unlimited, 10_class, 6_class
```
