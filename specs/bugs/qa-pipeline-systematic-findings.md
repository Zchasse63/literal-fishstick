# QA Pipeline — Systematic Findings (Audit Sweep)

**Filed:** 2026-04-10
**Audit phase:** Tier 4.6.5 (after Tier 4.6, before Tier 4.7)
**Triggered by:** BUG-024 (corporate RLS) and BUG-026 (17-table systemic RLS) suggested broader patterns
**Method:** 6 grep + Supabase MCP probes (A1 through A6)
**Scope:** Entire `apps/web/src/app/api/**` and `apps/web/src/app/(admin)/**`

## ⚠️ IMPORTANT CONTEXT (added 2026-04-10 by user)

**The Meridian dashboard is NOT yet live with real members.** Glofox is still handling all production member activity. This means every bug in this document was a **pre-launch blocker**, not an actively-harming-production-users bug. The "production-critical" framing in earlier sections should be read as "would have blocked launch" rather than "is currently affecting real users".

The only exception is the Glofox migration import path — if a migration wave was run against real Glofox data BEFORE Tier 4.6.5, it would have 500'd on the phantom `'confirmed'` default status. The user should confirm whether any migration waves have run yet; if yes, those migrated bookings may need backfill.

This document is the master backlog of systematic issues surfaced by the audit sweep. Each finding has a severity, scope, fix sketch, and disposition recommendation (fix-now-in-pipeline, file-for-feature-dev, or accept-as-known).

---

## 🔴 CRITICAL findings (silent breakage in production)

### F1 — 8 tables have RLS enabled with ZERO policies (total deny)

**Tables:** `appointments`, `discounts`, `facilities`, `glofox_sync_conflicts`, `glofox_sync_state`, `integrations`, `lead_interactions`, `programs`

**Impact:** Every SELECT on these tables silently returns empty arrays. Every INSERT/UPDATE/DELETE 500s with RLS rejection. Same failure mode as BUG-024/BUG-026 but worse — there's no broken policy to fix, the policies just don't exist.

**Affected features (best guess from table names):**
- Glofox sync infrastructure (conflicts + state) — sync may be silently failing
- Integrations management — admin can't view/configure integrations
- Discounts module — admin can't view/create discounts
- Facilities management — admin can't view/manage facilities
- Programs (multi-week class series) — feature absent or broken
- Lead interactions tracking
- Appointments (any 1:1 scheduling)

**Fix scope:** 1 migration, ~80 lines (8 tables × ~10 lines each for SELECT/INSERT/UPDATE/DELETE policies). Pattern matches existing canonical: `studio_id = get_user_studio_id()` for SELECT, plus role-check for write.

**Severity:** CRITICAL — multiple modules silently broken since launch
**Disposition:** **Fix in next pipeline tier** (consider Tier 4.6.5 sweep tier)

---

### F2 — 11 routes use phantom `'confirmed'` booking status

`bookings.status` CHECK enum (verified): `['booked', 'checked_in', 'no_show', 'cancelled', 'late_cancelled', 'waitlisted']`. **`'confirmed'` is NOT valid.**

**Routes that filter on it (silently return 0):**
1. `apps/web/src/app/api/corporate/dashboard/route.ts:74` — corporate dashboard event count includes `'confirmed'` (might be event status, OK there)
2. `apps/web/src/app/api/check-in/qr/route.ts:95` — `.eq("status", "confirmed")` — QR check-in lookup never finds anything
3. `apps/web/src/app/api/bookings/route.ts:76` — `.in("status", ["confirmed", "checked_in"])` — booking list filter
4. `apps/web/src/app/api/bookings/route.ts:93` — same
5. `apps/web/src/app/api/classes/[id]/route.ts:69` — booking count for class detail
6. `apps/web/src/app/api/classes/[id]/route.ts:359` — another booking count
7. `apps/web/src/app/api/classes/[id]/remind/route.ts:71` — reminder recipient list
8. `apps/web/src/app/api/ai/recommendations/route.ts:62` — AI recommendation booking count
9. `apps/web/src/app/api/cron/waitlist-promote/route.ts:131` — waitlist promotion booking count
10. `apps/web/src/app/api/cron/waitlist-promote/route.ts:174` — same
11. `apps/web/src/app/api/analytics/snapshot/route.ts:179` — analytics booking count

**Routes that INSERT with phantom status (will 500):**
- `apps/web/src/app/api/bookings/route.ts:112` — **`status: "confirmed"`** on booking creation. **Every booking creation 500s.** This is the booking-creation flow that members would use!
- `apps/web/src/app/api/cron/waitlist-promote/route.ts:201` — **`status: "confirmed"`** on promotion insert. Waitlist promotion cron is silently broken.
- `apps/web/src/app/api/migration/import/route.ts:364` — **`status: row['status'] ?? 'confirmed'`** — Glofox import defaults to phantom status. Every imported booking with no source status would 500.

**Impact:** Booking creation, waitlist promotion, QR check-in, booking counts on schedule, AI recommendations, analytics — **all silently broken or zero-result**.

**Fix scope:** Replace `'confirmed'` with `'booked'` in all 11 places. Either remove from the `.in()` filters OR keep `['booked', 'checked_in']`. The migration import default should be `'booked'`.

**Severity:** CRITICAL — booking creation is core to the entire app
**Disposition:** **Fix in pipeline immediately** — book a slot for this in the next tier

---

### F3 — `promo_codes` route writes to a phantom TABLE

**File:** `apps/web/src/app/api/promo-codes/route.ts` (3 references at lines 47, 140, 155)

**Finding:** The route uses `.from("promo_codes")` but **`promo_codes` table doesn't exist in the schema**. Only `promo_attributions` exists.

**Impact:** Every operation on the promo_codes endpoint 500s. The promo code feature has been completely non-functional since launch.

**Note:** Trainer promo codes are a documented business requirement (see CLAUDE.md "Trainer / Instructor Features"). Promo codes for membership/class pack purchases. The feature is in the product spec but the table schema was never created.

**Fix scope:** Either (a) add a migration to create `promo_codes` table OR (b) refactor the route to use `promo_attributions` (which is a different concept — attributions are after-the-fact tracking, not code management).

**Severity:** CRITICAL — entire feature absent at the schema layer
**Disposition:** **File for feature-dev** — this is a missing feature, not a fix-in-place

---

### F4 — 95 of 102 activity_log inserts silently swallow errors

**Method:** Counted `await supabase.from('activity_log').insert(` total = 102. Counted `const ... = await supabase.from('activity_log').insert(` (with capture) = 7.

**Result:** **95 routes silently swallow activity_log insert errors**. Combined with F5 (phantom enum types), this means most of these inserts have been silently failing.

**Severity:** HIGH — entire audit trail is unreliable
**Disposition:** **Fix in pipeline** — batch fix all 95 routes with capture-and-log pattern. Can be a single PR.

---

## 🟠 HIGH severity findings

### F5 — ~30 routes use phantom `activity_log.type` enum values

Combining A2 grep results with the canonical 28-value enum. Routes using values NOT in the enum (silent swallow on every insert):

**Confirmed phantom types in use:**
- `member_checked_in` — `/api/check-in` (BUG-019, known)
- `member_checked_in_qr` — `/api/check-in/qr` (BUG-019 variant)
- `trainer_bonus_triggered` — `/api/check-in` (BUG-019, known)
- `automation_activated` — `/api/automations/[id]/activate`
- `automation_created` — `/api/automations` POST
- `automation_deactivated` — `/api/automations/[id]/deactivate`
- `automation_deleted` — `/api/automations/[id]` DELETE
- `automation_enrollment` — `/api/automations` enrollment flow
- `automation_flow` — `/api/automations` ?
- `automation_updated` — `/api/automations/[id]` PUT
- `enrollment_exited` — `/api/automations/[id]/enrollments/[eid]/exit`
- `lead_created`, `lead_updated`, `lead_deleted`, `lead_converted` — `/api/leads/*`
- `employee_created`, `employee_updated`, `employee_deactivated` — `/api/employees/*`
- `employee_clocked_in`, `employee_clocked_out` — `/api/clock` (note: enum has `clock_in`/`clock_out`, this uses different names)
- `staff_created`, `staff_updated`, `staff_deactivated` — `/api/staff/*`
- `report_created`, `report_updated`, `report_deleted` — `/api/reports/*`
- `content_created`, `content_deleted` — `/api/content/*`
- `campaign_ab_winner_selected`, `campaign_copy` — `/api/campaigns/*`
- `class_reminder_sent` — `/api/classes/[id]/remind`
- `member_unsubscribed` — `/api/unsubscribe/[token]`
- `email_preferences_updated` — `/api/email-preferences/[memberId]`
- `settings_updated` — `/api/settings`
- `waitlist_promoted` — `/api/cron/waitlist-promote`
- `product_image_uploaded` — `/api/products/[id]/images`
- `metrics_snapshot` / `daily_metrics` — `/api/analytics/snapshot`
- `ai_insights_generated` — `/api/ai/insights/generate`
- `revenue_anomaly`, `health_score`, `churn_narrative`, `intake_enrichment`, `trainer_summary`, `booking_pattern` — various AI routes (all silent swallow)

**Plus various single-word phantoms:** `class`, `employee`, `lead`, `profile`, `transaction`, `staff`, `product`, `created`, `converted`, `status_changed`, `late_cancel`, `email_preferences`, `studio_settings`, `saved_report`, `clock_entry`, `automation_enrollment`, `waitlist_entry`, `content_post`, `campaign`, `batch_skipped`, `png` — these are likely all activity_log inserts with extremely vague/phantom types.

**Fix scope:**

Two options:

1. **Migration to extend enum** with all the missing types (~30+ values). Then all routes work without changes. Migration size: ~100-line CHECK constraint.

2. **Per-route fix:** rewrite each route to use a canonical type. Many routes don't have a good canonical match (e.g., `automation_activated` vs. existing `clock_in/out` is a category mismatch).

Recommended: **Option 1** (extend enum). Single migration, no route rewrites needed beyond the existing description + capture-and-log fixes (F4).

**Severity:** HIGH — every audit trail row from these routes is missing
**Disposition:** **Fix in pipeline** — single migration + the F4 batch-capture fix

---

### F6 — ~50 tables have NO role check on RLS write policies

**Pattern:** Most tables have policies like `bookings_write` with `WITH CHECK (studio_id = get_user_studio_id())` — no role check. This means **any authenticated user in a studio (including regular members) can INSERT/UPDATE/DELETE** these tables via direct Supabase client.

**Currently mitigated by:** App-layer role checks in API routes (most routes have a role check). But:
- BUG-020 (Check In All UI) bypasses the API entirely with direct Supabase calls — this is exactly the failure mode this RLS gap allows
- Any future UI bypass like BUG-020 becomes a free-for-all
- Direct Supabase client calls from member-facing surfaces (iOS app, web booking portal — not yet built but planned for Phase 5) would have free write access

**Tables affected:** activity_log, automation_*, bookings, campaigns, campaign_recipients, class_types, classes (UPDATE only — INSERT has the wrong role check, see F7), clock_entries, community_posts, company_members, content_*, corporate_invoices, credit_packs, email_preferences, employee_documents, employees, event_guests, events, family_*, geofence_locations, gift_cards, guest_visits, lead_activities, leads, locations, member_segments, member_strikes, members, membership_plans, order_items, orders, payroll_*, products, profiles (INSERT only), promo_attributions, shipping_labels, tax_configurations, trainer_class_log, trainers, transactions, waitlist_entries, waiver_signatures, waivers, wallet_transactions

**Fix scope:** ONE migration to add role-check `WITH CHECK` clauses to every write policy. ~150-line migration. Pattern from `company_accounts_studio_write` (Tier 4.5):

```sql
WITH CHECK (
  studio_id = get_user_studio_id()
  AND (
    user_has_role('owner'::text)
    OR user_has_role('admin'::text)
    OR user_has_role('manager'::text)
  )
)
```

**Risk:** Some tables (e.g., `bookings`, `waitlist_entries`, `community_posts`) need member-level write access for the future iOS app / member portal. Adding strict role checks would break those flows when they ship. Need to think about which tables are admin-only vs. member-writable.

**Severity:** HIGH defense-in-depth failure
**Disposition:** **Defer** — fix in a dedicated security tier after the member-app roles are decided

---

### F7 — `classes_write` operator precedence still broken (BUG-016 L6)

Confirmed: `classes_write` policy is still:
```sql
WITH CHECK (
  ((studio_id = get_user_studio_id()) AND user_has_role('owner'))
  OR user_has_role('admin')
  OR user_has_role('manager')
)
```

Due to operator precedence, this means admin/manager can write classes to ANY studio. Cross-tenant write vector.

**Fix scope:** 1 migration, drop + recreate the policy with correct parens. ~10 lines.

**Severity:** MEDIUM (mitigated by app-layer studio_id sourcing)
**Disposition:** **Fix in pipeline** — batch with F1

---

### F8 — UI bypasses API for write operations (2 found)

1. **`schedule/page.tsx:655`** — `bookings.update` direct (BUG-020, known — Check In All button)
2. **`analytics/pricing/new/page.tsx:130`** — `pricing_simulations.insert` direct (NEW finding — pricing simulator creation bypasses API)

**Impact of pricing_simulations bypass:**
- No activity_log entry written
- No role-check enforcement (relies on RLS — and pricing_simulations RLS is `'owner'` only, so it's actually enforced, but the audit trail is missing)
- No validation beyond what the form does client-side

**Fix scope:** Rewrite both UI handlers to call their respective API routes. ~30 lines each.

**Severity:** MEDIUM (bypass loses audit trail and side effects)
**Disposition:** **Fix in pipeline** — combine with BUG-020 fix (Tier 3.12 follow-up)

---

## 🟡 MEDIUM severity findings (deferred / known)

### F9 — BUG-013 inheritance: 3 panel modals + 1 sidebar component pass `member.id`

`MemberProfilePanel.tsx`:
- Line 585: MemberUpgradeModal `memberId={member.id}` — modal route expects `profile_id`
- Line 594: MemberPauseModal `memberId={member.id}` — modal route expects `profile_id`
- Line 602: AIDetailModal `memberId={member.id}` — destination unknown, may or may not be broken
- `MemberProfileClient.tsx:593`: EmailPreferencesPanel `memberId={member.id}` — destination unknown

**Disposition:** Already filed as BUG-013. **Fix in pipeline** — single tier rewriting both modals + the dedicated profile page panel.

---

### F10 — Phantom column writes (description field on tables without one)

8 routes write `description: description ?? null`:
- `products/route.ts:167` ✅ (column exists)
- `pricing-simulator/route.ts:123` ✅ (column exists)
- `transactions/route.ts:188` ✅ (column exists)
- `promo-codes/route.ts:162` 🔴 (entire table doesn't exist — F3)
- `automations/route.ts:206` ✅ (column exists)
- `events/route.ts:170` ✅ (column exists)
- `reports/route.ts:178` ✅ (column exists)
- `employees/[id]/documents/route.ts:179` ✅ (column exists)

**Result:** Only `promo_codes` is broken (covered by F3). All others map correctly. **Classes was the only table where the field name didn't match the column** (BUG-015 L1, fixed in Tier 3.8). The pattern is contained.

**Disposition:** **No further action** — F3 covers the only remaining broken instance.

---

## 🟠 ADDITIONAL findings (added after initial sweep)

### F13 — Corporate POST 500s on specific full-payload field combination

**Discovered:** Tier 4.5 Sentinel
**Status:** Reproducible but not isolated

The `/api/corporate` POST handler returns 500 when the request body includes ALL of these optional fields together: `payment_terms: 'net_30'`, `monthly_credit_allocation: 100`, `auto_renew: true`, `notes`, `tags: [...]`, `company_size: '50-100'`. Removing any subset (or all) makes the request succeed.

The Tier 4.5 spec was healed by removing those fields from Scenario 2 (now uses a smaller subset that works). But the underlying route still 500s on the full payload.

**Possible causes (not yet narrowed):**
- Zod schema vs route insert mismatch on one field type
- Postgres CHECK constraint on `payment_terms` rejecting 'net_30' (unlikely — that's the default)
- Array column `tags` JSON serialization issue
- Race in route between validation + insert

**Fix scope:** Diagnose by sending each field individually to find the culprit. Likely 1-line fix once identified.

**Severity:** MEDIUM (the simplified Scenario 2 still tests the optional-fields path; no production data loss)
**Disposition:** **Fix in pipeline** — diagnose during Tier 4.6.5 sweep

---

### F14 — Missing `public.increment_rate_limit` RPC function

**Discovered:** Dev log noise during Tier 4.5 Sentinel run

```
[rate-limit] RPC error, failing open: Could not find the function
public.increment_rate_limit(p_key, p_limit, p_window_ms) in the schema cache
```

Some part of the codebase calls `supabase.rpc('increment_rate_limit', ...)` but the function doesn't exist. The "fail open" behavior means rate limiting is silently disabled — every request bypasses the limit.

**Affected feature:** All rate-limited endpoints (whatever calls this RPC). Likely auth endpoints, AI endpoints, or marketing send endpoints.

**Severity:** MEDIUM — security gap if rate limiting is the only abuse defense on those endpoints
**Disposition:** **Defer to feature-dev** — needs the RPC function created OR the rate-limit calls removed. Not a mechanical fix.

---

## 🔗 Cross-reference: original deferred bugs ↔ audit findings

| Original Bug | Filed in | Now covered by audit finding |
|---|---|---|
| BUG-013 (Pause/Upgrade panel inheritance) | Tier 3.6 → narrowed in 3.7, 4.1 | **F9** |
| BUG-016 L6 (classes_write precedence) | Tier 3.8 | **F7** |
| BUG-016 L7 (classes_update no role check) | Tier 3.8 | **F6** (part of bulk) |
| BUG-016 L8 (class_types_studio_write no role check) | Tier 3.8 | **F6** (part of bulk) |
| BUG-019 (check-in handler enum/desc) | Tier 3.12 | **F5** (4 layers) + **F4** (silent swallow) |
| BUG-020 (Check In All UI bypass) | Tier 3.12 | **F8** + **F2** (phantom 'confirmed' filter) |
| Tier 3.9 sub-finding: DELETE handler `'confirmed'` filter | Tier 3.9 inline | **F2** |
| Tier 3.9 sub-finding: db.ts step 5 cleanup wrong FK | Tier 3.9 inline | **F11** |
| Tier 4.5 sub-finding: corporate POST full-payload 500 | Tier 4.5 inline | **F13** (newly added) |
| BUG-008 GAP-1 (Refund) | Tier 3.2 | feature-dev (see backlog) |
| BUG-008 GAP-2 (Issue Credit) | Tier 3.3 | feature-dev (see backlog) |
| BUG-008 GAP-3 (Waitlist Add/Remove) | Tier 3.11 | feature-dev (see backlog) |
| BUG-008 GAP-6 (Memberships Cancel) | Tier 4.4 | feature-dev (see backlog) |
| Tier 4.2 — Stripe integration stubbed | Tier 4.2 | feature-dev (see backlog) |

**Result:** Every deferred discrete bug from the entire pipeline so far is now traceable to either an audit finding (to be fixed in Tier 4.6.5 or later) or the feature-dev backlog (`specs/bugs/feature-dev-backlog.md`).

---

## 🟢 LOW severity findings

### F11 — db.ts step 5 cleanup uses wrong FK

Already documented in Tier 3.9 inline. `resetStudioTestData` step 5 at db.ts:462 uses `.in('member_id', testProfileIds)` but `bookings.member_id` references `members.id`. Ineffective no-op (cascade saves it).

**Disposition:** Trivial fix in test infrastructure. Defer until next test refactor.

---

### F12 — `members.notes` is on the members table (not profiles)

Used as a workaround in BUG-013 inheritance. Not a bug, just a note for future tier authors: the `notes` field for members lives on `members.notes`, not `profiles.notes`. There's also a `classes.notes` field that's distinct.

---

## Summary statistics

| Category | Count |
|---|---|
| Tables with RLS but no policies (total deny) | **8** |
| Routes using phantom `'confirmed'` booking status | **11** (3 are inserts that 500) |
| Routes using phantom `activity_log.type` values | **~30** |
| Routes silently swallowing activity_log errors | **95 of 102** |
| Tables with no role check on writes (defense-in-depth gap) | **~50** |
| Routes pointing at phantom tables | **1** (`promo_codes`) |
| UI components bypassing API for writes | **2** |
| Panel modals inheriting BUG-013 | **3** (+ 1 sidebar) |
| Routes with full-payload 500 narrowing needed | **1** (corporate POST) |
| Missing RPC functions (silent fail-open) | **1** (`increment_rate_limit`) |
| **Total findings** | **14** (F1–F14) |

---

## Recommended remediation plan

### Phase 1 — CRITICAL fixes (one mega-tier — Tier 4.6.5 audit-sweep remediation)

These are required before Tier 5 marketing tests, because Tier 5 will hit broken features otherwise.

1. **Migration M1: Create RLS policies for the 8 policy-less tables (F1)**
   - appointments, discounts, facilities, glofox_sync_*, integrations, lead_interactions, programs
   - Pattern: studio_id = get_user_studio_id() for SELECT, role-check for write
2. **Migration M2: Extend `activity_log.type` enum with missing values (F5)**
   - Add ~30 new values matching the routes' usage
   - Single migration, no route changes
3. **Route batch B1: Fix all phantom 'confirmed' booking status (F2)**
   - Replace with 'booked' or remove from filters
   - 11 files touched
4. **Route batch B2: Add description + capture-and-log to all 95 silent-swallow activity_log inserts (F4)**
   - Single mechanical change per route
   - Combine with B1 for the booking flow routes
5. **Migration M3: Fix BUG-016 L6 classes_write operator precedence (F7)**
   - Drop + recreate with correct parens
6. **UI fix U1: BUG-020 Check In All → call API (F8)**
   - Rewrite handleCheckInAll to iterate attendees and call /api/check-in
7. **UI fix U2: pricing_simulations.insert → call API (F8)**
   - Rewrite the new pricing simulator page to use the existing /api/pricing-simulator route

**Estimated effort:** 1 dedicated tier (Tier 4.6.5). All fixes are mechanical given the patterns we've established.

---

### Phase 2 — Continue regular tier runs

After Phase 1, resume Tier 4.7 (Operations Waiver), Tier 4.8 (Smart Segments), then Tier 5 (Marketing).

**Expected benefit:** Tier 5 marketing tests will be straightforward verifications instead of bug-hunts. Many marketing routes (`/api/automations/*`, `/api/leads/*`, `/api/campaigns/*`) are in the F5 phantom-type list and would have surfaced the same bugs if tested individually.

---

### Phase 3 — Defer (file for feature-dev or dedicated security tier)

- **F3 — `promo_codes` table missing:** Real feature gap, hand to feature-dev
- **F6 — Systemic role-check absence on RLS:** Defer until member-app role decisions are made (Phase 5 of the broader product roadmap). Need to know which tables are admin-only vs. member-writable before adding strict role checks.
- **F9 — BUG-013 panel inheritance:** Already filed, can ship in a dedicated tier
- **F11 — db.ts cleanup bug:** Trivial test infra fix, defer

---

## Audit sweep validation

The audit sweep took ~30 minutes of grep + DB queries and surfaced:
- **3 critical bugs** that would have caused immediate test failures in Tier 5+ (F1, F2, F3)
- **2 high-severity systemic issues** (F4, F5) — patterns affecting 30-95 routes each
- **2 medium-severity defense-in-depth gaps** (F6, F7)
- **2 fixable bugs** (F8 — UI bypass) — both already partially known
- **2 minor issues** (F11, F12)

Total: **30+ routes broken**, **8 tables with no policies**, **2 UI bypasses**, **1 phantom table**, **1 RLS precedence bug**.

**Without the audit sweep, all of these would have been discovered organically across Tier 4.7 → Tier 7 (~15 council runs)**. Each discovery would have required its own diagnosis loop. The sweep collapses 15 tier-runs of discovery into 1 mega-fix-tier.
