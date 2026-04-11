# Feature-Dev Backlog (out of QA pipeline scope)

**Filed:** 2026-04-10
**Owner:** Hand to feature-dev after QA pipeline completes

This is the backlog of items the QA pipeline surfaced that are NOT mechanical fixes — they require feature work, design decisions, schema work, or external integrations beyond the QA pipeline's mandate. These should be reviewed and prioritized after the QA pipeline closes (Tier 8 complete).

**REMINDER FOR FUTURE SESSIONS:** When the QA pipeline reaches Tier 8 / final wrap-up, surface this list to the user explicitly. Do NOT silently skip it.

---

## 🔴 CRITICAL — Missing core features (BUG-008 audit)

### B1 — Memberships: Cancel (BUG-008 GAP-6)

**State:** Feature absent at API + UI
**Source:** Tier 4.4 gap-file
**Filed in:** `specs/reports/memberships-cancel-report.md`

**What's needed:**
- New `POST /api/members/[id]/cancel` endpoint accepting `{ effective: 'immediate' | 'next_cycle' }`
- Verify `members.membership_status` enum includes `'cancelled'` (or migrate)
- Idempotent guard for already-cancelled
- New activity_log type `'membership_change'` with `metadata.action='cancelled'`
- Stripe `subscriptions.cancel` integration (depends on B5)
- New "Cancel Membership" button on MemberProfilePanel
- Confirmation dialog with effective-date selector
- Visual indication on profile that membership is cancelled

**Test scenarios already documented:** 4 (in the Tier 4.4 gap report)

---

### B2 — Revenue: Refund (BUG-008 GAP-1)

**State:** Feature absent at API + UI
**Source:** Tier 3.2 gap-file
**Filed in:** `specs/reports/revenue-refund-report.md`

**What's needed:**
- New `POST /api/transactions/[id]/refund` endpoint
- Stripe `refunds.create` integration (depends on B5)
- Validation: cannot refund already-refunded transactions
- Validation: cannot refund more than original amount
- Member transaction history sync
- Activity log entry
- New "Refund" button on transaction detail / row
- Confirmation dialog with amount + reason inputs

**Test scenarios already documented:** 6 (in the Tier 3.2 gap report)

---

### B3 — Revenue: Issue Credit (BUG-008 GAP-2)

**State:** Feature absent at API + UI
**Source:** Tier 3.3 gap-file
**Filed in:** `specs/reports/revenue-issue-credit-report.md`

**What's needed:**
- New `POST /api/members/[id]/credit` endpoint accepting `{ amount, type: 'cash' | 'credit_pack', reason }`
- Schema work: ensure `wallet_transactions` or `credit_packs` table can model both cash and pack credits
- 7-day grace period logic for credit packs (per CLAUDE.md edge case policy)
- Validation: negative amount guard
- Activity log entry
- Member credit history view
- New "Issue Credit" button in member detail / revenue
- Modal with amount + type + reason inputs

**Test scenarios already documented:** 5 (in the Tier 3.3 gap report)

---

### B4 — Schedule: Waitlist Add/Remove (BUG-008 GAP-3)

**State:** Backend partial (schema + display + cron exist; CRUD endpoints absent), UI absent
**Source:** Tier 3.11 gap-file
**Filed in:** `specs/reports/schedule-waitlist-report.md`

**What's needed:**
- New `POST /api/classes/[id]/waitlist` endpoint to add a member to waitlist
- New `DELETE /api/bookings/[id]` (or PUT to status='cancelled') for waitlist removal
- Auto-renumber `waitlist_position` on removal
- Duplicate-add validation (member already on waitlist)
- New "Add to Waitlist" button on ClassDetailPanel (visible when `booked_count >= capacity`)
- Member search dialog to pick the member
- Remove button next to each waitlisted attendee in the panel list
- Visual "Position X of N" indicator

**Existing infrastructure:**
- `bookings.status='waitlisted'` and `waitlist_position` columns exist
- `/api/cron/waitlist-promote` cron exists (but uses phantom `'confirmed'` status — fixed in F2 sweep)
- ClassDetailPanel already renders waitlisted attendees (read-only)

**Test scenarios already documented:** 5 (in the Tier 3.11 gap report)

---

## 🟠 HIGH — Critical schema gaps

### B5 — Stripe SDK integration (multiple endpoints stubbed)

**State:** TODO comments in routes; SDK call placeholders only
**Sources:** Tier 4.1 (upgrade), Tier 4.2 (upgrade-with-proration), Tier 4.3 (downgrade), would also block B1+B2 above

**What's needed:**
- Real `Stripe` SDK import + client initialization (Stripe is in package.json — `stripe: ^20.4.1`)
- Subscription update with proration on upgrade (`stripe.subscriptions.update` with `items` + `proration_behavior: 'create_prorations'`)
- Subscription downgrade scheduled for next cycle (`proration_behavior: 'none'`, `billing_cycle_anchor: 'unchanged'`)
- Subscription cancel for B1
- Refund creation for B2
- Webhook handlers may already exist — needs verification at `/api/webhooks/stripe/route.ts`
- Stripe customer + subscription ID lookup logic
- Price ID resolution (likely from a `membership_plans` table or env)

**Affected QA tiers (will gain real test coverage once integrated):**
- Tier 4.1 — Memberships: Assign (currently API-tested without Stripe)
- Tier 4.2 — Memberships: Upgrade with proration (currently gap-filed)
- Tier 4.3 — Memberships: Downgrade (currently API-tested without Stripe)
- B1, B2 above

---

### B6 — `promo_codes` table missing (F3 from audit)

**State:** Route `/api/promo-codes` exists and writes to `promo_codes` table that doesn't exist in schema. Every operation 500s.
**Source:** Audit sweep F3
**Filed in:** `specs/bugs/qa-pipeline-systematic-findings.md`

**What's needed:**
- Schema migration to create `promo_codes` table
- Columns based on the route's insert body — fields include `code`, `trainer_id`, `discount_percent`, `max_uses`, `expires_at`, `is_active`, etc.
- Cross-reference with `promo_attributions` table (which exists and tracks usage)
- The Trainer Promo Code feature is documented in CLAUDE.md "Trainer / Instructor Features" — codes for membership/class pack purchases, attribution tracking, one-use-per-member

**Note:** This is a real production gap, not a stub. Trainers (TRENT60, WHITNEY60 mentioned in CLAUDE.md) are referenced as already populated in Glofox migration data, so the codes ARE in use somewhere — possibly purely client-side or in an unmigrated table.

---

### B7 — Missing `public.increment_rate_limit` RPC (F14 from audit)

**State:** Code calls `supabase.rpc('increment_rate_limit', ...)` which fails-open. Rate limiting is silently disabled.
**Source:** Audit sweep F14

**What's needed:**
- Either: Create the SQL function `public.increment_rate_limit(p_key, p_limit, p_window_ms)` returning a boolean
- Or: Replace the rate-limit calls with an alternative implementation (e.g., Supabase Edge Function, Upstash Redis, in-memory)
- Identify which endpoints rely on this — likely auth, AI, marketing send

---

## 🟡 MEDIUM — Architectural / design decisions

### B8 — Systemic role-check absence on RLS write policies (F6 from audit)

**State:** ~50 tables have INSERT/UPDATE policies with just `studio_id = get_user_studio_id()` and no role check
**Source:** Audit sweep F6

**Why deferred to feature-dev:** Some tables (e.g., `bookings`, `waitlist_entries`, `community_posts`) need MEMBER write access for the future iOS app + web booking portal (Phase 5). Adding strict admin-only role checks would break those flows when they ship. **Need to decide which tables are admin-only vs. member-writable BEFORE adding role checks.**

**What's needed:**
- Design review: enumerate every table and tag as `admin-only`, `member-writable`, or `system-only` (cron/webhooks)
- For admin-only tables: add role check to INSERT/UPDATE policies (canonical pattern from `company_accounts_studio_write`)
- For member-writable: keep permissive but ensure no sensitive columns are exposed (e.g., `bookings.status` filter to prevent self-checkin)
- For system-only: revoke all client roles, use service role + RLS bypass

**Estimated effort:** Large — touches every table. Best as a dedicated security tier OR a multi-day feature-dev sprint.

---

### B9 — BUG-013 Option A full fix (Pause/Upgrade panel modals + sidebar)

**State:** 3 modal mounts + 1 sidebar component pass `member.id` instead of `profileId`
**Source:** Filed Tier 3.6, partially mitigated Tier 3.7 + 4.1, audit F9 confirmed scope

**Why deferred to feature-dev:** Could be done in pipeline mode but the modal interfaces (`MemberPauseModal`, `MemberUpgradeModal`, `AIDetailModal`, `EmailPreferencesPanel`) all need their `memberId` prop renamed to `profileId` and their internal `fetch` URLs updated. Touches 4-5 files. The pattern is well-known but the work is full feature-dev quality.

**What's needed:**
- Rename `MemberUpgradeModal.props.memberId` → `profileId`
- Update modal's internal `fetch('/api/members/${memberId}/upgrade')` → uses `profileId`
- Same for `MemberPauseModal`
- Verify `AIDetailModal` and `EmailPreferencesPanel` route shapes (may or may not be broken)
- Update parent: `MemberProfilePanel.tsx:585` and `:594` and `:602` to pass `member.profileId`
- Update `MemberProfileClient.tsx:593` similarly
- Run Tier 3.6/3.7 regression to verify no new breakage

**Estimated effort:** Medium. ~50 lines across 5 files.

---

## 🟢 LOW — Polish + cleanup

### B10 — Tier 4.5 sub-finding: corporate POST full-payload 500 (F13)

**State:** Some specific field combination in `/api/corporate` POST triggers a 500. Narrowed down to one of: `payment_terms`, `monthly_credit_allocation`, `auto_renew`, `notes`, `tags`, `company_size`. Tier 4.5 healed by removing the offending fields from the test.

**Why deferred:** Diagnosing requires 5 individual test runs to bisect. Trivial to fix once identified.

**Disposition:** Could be fixed in Tier 4.6.5 sweep if there's time. Otherwise feature-dev polish task.

---

### B11 — db.ts step 5 cleanup wrong FK target

**State:** Test infrastructure bug — `resetStudioTestData` step 5 uses wrong foreign key. Ineffective no-op (cascade saves it).
**Source:** Tier 3.9 inline finding, audit F11

**Disposition:** Trivial. Fix in next test infrastructure refactor.

---

### B12 — Campaigns subroutes wired to phantom schema — PARTIALLY FIXED

**Status (post-B22 session):**
- ✅ `/api/campaigns/route.ts` (Tier 5.1) — list + create
- ✅ `/api/campaigns/[id]/route.ts` — GET/PUT/DELETE now use `open_count`/`click_count`/`bounce_count`/`unsubscribe_count` + real allowedFields (`body_html`, `body_text`, `sms_body`, `ab_variants`, `recipient_filter`)
- ✅ `/api/campaigns/[id]/schedule/route.ts` — validates `ab_variants.a.body_html` + SMS branch
- ✅ `/api/campaigns/send/route.ts` — reads `ab_variants`, writes `send_completed_at` (no phantom `failed_count`/`completed_at`)
- ✅ Migration `b12_add_campaigns_deleted_at` adds the column so soft-delete actually works

**Still broken (6 files):** `process-scheduled`, `send-test`, `[id]/duplicate`, `[id]/select-winner`, `[id]/recipients`, `[id]/pause` routes, plus the unit test suite and reports/templates.ts. Each needs the same mapping: `body_template` → `body_html`/`body_text`/`sms_body`, per-variant columns → `ab_variants` jsonb, plural counters → singular.

**State (original):** Systemic phantom-column rot across 10 campaign route files referencing a deprecated column set.
**Source:** Tier 5.1 discovery while fixing `/api/campaigns/route.ts`

**What's broken:**
The following routes reference phantom columns (`body_template`, `variant_a_subject`, `variant_a_body`, `variant_b_subject`, `variant_b_body`, `ab_split_percentage`, `ab_auto_select_winner`, `opened_count`, `clicked_count`, `bounced_count`, `failed_count`, `unsubscribed_count`, and a `deleted_at` soft-delete column that also does not exist on `campaigns`):

1. `apps/web/src/app/api/campaigns/[id]/route.ts` — GET computes open/unsub rate from phantom columns; PUT has phantom fields in `allowedFields`.
2. `apps/web/src/app/api/campaigns/[id]/duplicate/route.ts` — Clones phantom columns into the copy.
3. `apps/web/src/app/api/campaigns/[id]/schedule/route.ts` — SELECTs phantom fields, branches on them for scheduling gate.
4. `apps/web/src/app/api/campaigns/[id]/select-winner/route.ts` — Reads phantom variants, writes phantom `body_template`.
5. `apps/web/src/app/api/campaigns/send/route.ts` — Selects phantom A/B split + variants.
6. `apps/web/src/app/api/campaigns/send-test/route.ts` — Selects phantom `body_template` and per-variant columns.
7. `apps/web/src/app/api/campaigns/process-scheduled/route.ts` — Reads phantom `body_template` and split.
8. `src/__tests__/unit/api/campaigns.test.ts` — Unit tests send phantom payload.
9. `src/lib/reports/templates.ts` — Report columns reference phantom `opened_count` / `unsubscribed_count`.

**Tier 5.1 narrow fix:** Fixed only `/api/campaigns/route.ts` (POST + GET) and rewrote the Tier 5.1 spec. All 9 other files remain wired to the phantom schema.

**Real schema (canonical):**
- Body content: `body_html`, `body_text` (email), `sms_body` (SMS)
- A/B: `ab_test_enabled` + `ab_variants jsonb` (flexible) + `ab_winner_metric` (`open_rate`|`click_rate`|`conversion_rate`)
- Counters: `open_count`, `click_count`, `bounce_count`, `unsubscribe_count`, `sent_count`, `delivered_count`, `conversion_count`
- No `deleted_at` on campaigns — soft delete not implemented

**What's needed:**
- Rewrite all 9 files to use real columns
- Decide whether to keep `ab_variants` jsonb or migrate to per-variant columns (AI hooks already use jsonb; consistency wins)
- Decide whether to add `deleted_at` soft delete or remove the filter entirely
- Rewrite campaigns unit test suite
- Rebuild report templates with real column names
- Sprint 3B automation code also calls into these routes — verify cascading impact

**Test scenarios:** Fresh QA council runs for campaigns detail, duplicate, schedule, select-winner, send, send-test, process-scheduled.

**Why not fixed in Tier 5.1:** Tier 5 tests only exercise the list + create endpoints. The 9 other routes are out of scope for the Tier 5 run. Fixing them would have required rewriting ~600 LOC of route code + unit tests + report templates — a significant refactor that belongs in feature-dev, not in the QA pipeline.

---

### B13 — `automation_flows.trigger_type` CHECK constraint narrower than app code

**State:** Schema drift — `VALID_TRIGGER_TYPES` in `/api/automations/route.ts` lists 30 values; DB CHECK constraint only allows 18. Code allows values DB rejects.
**Source:** Tier 5.3 discovery

**DB allows (18):** `signup`, `no_show`, `churn_risk`, `credit_expiry`, `birthday`, `milestone`, `membership_change`, `booking_completed`, `failed_payment`, `inactivity`, `referral`, `custom`, `never_booked`, `classpass_repeat`, `one_and_done`, `cooling_off`, `plan_upgrade_candidate`, `class_type_fan`.

**Code allows but DB rejects (12):** `member_created`, `membership_purchased`, `membership_cancelled`, `membership_expiring`, `check_in`, `tag_added`, `tag_removed`, `lead_created`, `lead_status_changed`, `credit_pack_low`, `credit_pack_expired`, `lapsed_with_credits`.

**Impact:** Any attempt to create an automation flow with one of the 12 code-only triggers will 500 with a CHECK constraint violation.

**Disposition:** Migration to extend `automation_flows_trigger_type_check` with the 12 missing values is the cleanest fix. Audit `evaluate-triggers.ts` and related cron jobs to confirm all 12 are actually emitted before adding them (or remove from `VALID_TRIGGER_TYPES`).

---

### B21 — Revenue page: add sort controls

**State:** `/api/transactions` orders by `created_at DESC` only. UI has no sort dropdown for amount / type / status / member.
**Source:** Tier 8.5.B audit

**Disposition:** Apply the same sort-dropdown pattern used in Tier 8.5.A1 for members. Add `SortKey` type, wire query.order dynamically. ~30 LOC change.

---

### B22 — AI insights generate route: 30s+ timeout + no client feedback

**State:** `POST /api/ai/insights/generate` runs ~10 sequential Supabase queries to build context, calls `generateInsights()` (Claude API), dedups, and inserts. Under normal load it exceeds 30 seconds. The AIInsightsClient shows no progress indicator during this time — user perceives "insights not loading."
**Source:** Tier 8.5.C audit (confirmed via live preview test)

**Root causes:**
1. Sequential Supabase queries (lines 71-237 of `/api/ai/insights/generate/route.ts`) — should be `Promise.all`
2. Single large Claude call on ~4KB of JSON context — can take 15-25s
3. Client calls `generate` then immediately refetches list; no streaming

**Fixes:**
- Parallelize the 10 DB queries with `Promise.all` → ~2-3s instead of ~10s
- Add a "Generating…" toast + spinner on the generate button
- Consider making generate a background Inngest job that writes to `ai_insights` table; client polls + shows live results
- Add an in-memory cache so repeated clicks within 5 minutes don't re-run

**Disposition:** This is the #1 UX regression from the user's original "AI insights not loading" feedback. High priority.

---

### B23 — AI insights currently zero rows for default studio

**State:** `/api/ai/insights?limit=5` returns `{ data: [], count: 0 }`. The generate endpoint hasn't been run successfully (see B22) so the table is empty.
**Source:** Tier 8.5.C audit

**Disposition:** Once B22 is fixed, run generate once manually or via cron to seed. Consider adding a `/api/cron/daily-insights` that fires at 6am studio time.

---

### B24 — Dark mode polish sweep

**State:** Most new Tier 8.5 components have dark mode classes, but a full visual audit has not been done. Cards, modals, borders, and focus rings may be inconsistent across `(admin)/*` pages.
**Source:** Tier 8.5 session observation

**Disposition:** Tier 9 candidate — dedicated pass with screenshot comparison across light/dark for every page.

---

### B25 — Preview_start shell-init warnings

**State:** `preview_start` logs reveal a recurring `shell-init: error retrieving current directory` error. Non-blocking (server still runs) but pollutes logs and indicates a working-directory state issue in the preview server wrapper.
**Source:** Tier 8.5 preview tool observation

**Disposition:** Cosmetic. Investigate if it relates to the `tsc` hang or Turbopack behavior. Low priority.

---

### B18 — Full phantom column sweep across all routes

**State:** Tier 8.4.5 only caught phantom columns that Supabase advisors or failing tests surfaced. A proactive sweep would cross-reference every `.from(...).select/insert/update` call against `information_schema.columns`.
**Source:** Tier 8.4.5 discovery

**Also creates:** `count_today_bookings(uuid)` and `count_today_checkins(uuid)` RPCs. Both are referenced in `/api/ai/briefing/route.ts` with graceful fallback — but that fallback returns 0, making the briefing numbers inaccurate.

**Disposition:** Medium priority. Phantom columns bite hardest when real traffic hits. Best timed before Phase 5 member-facing launch.

---

### B19 — Consolidate 40 `multiple_permissive_policies` warnings

**State:** Many tables have separate "members can view" + "staff can manage" permissive SELECT policies for the same role. Postgres evaluates both per row, doubling RLS overhead.
**Source:** Tier 8.4.5 advisor output

**Disposition:** Merge into single policies using `USING (... OR ...)`. Low-priority perf win; no correctness risk.

---

### B20 — Drop 33 unused indexes

**State:** Performance advisor flagged 33 indexes with zero read usage in the sample window. Safe to drop to reduce write amplification.
**Source:** Tier 8.4.5 advisor output

**Disposition:** Low-priority cleanup. Verify each index's usage pattern before dropping — some may be dormant but important for rarely-executed paths (annual reports, migration jobs, etc).

---

### B17 — Booking capacity check is not truly atomic

**State:** `/api/bookings` POST uses a count-then-insert pattern. Two concurrent requests can both read the same count, both pass the capacity check, and both insert — leading to over-booking.
**Source:** Tier 8.2 review

**What's needed:**
- Convert capacity check + insert into a single SQL transaction, OR
- Add a DB-level constraint (`CHECK (booked_count <= capacity)`) with a trigger that increments `booked_count`
- OR use a Postgres function / RPC that wraps count + insert in a BEGIN/COMMIT with row-level lock

**Edge-case policy:** `edge-case-policies.md` specifies atomic insert for booking races (no hold pattern). The current implementation does not honor this.

**Disposition:** Medium priority — race is only visible under concurrent load (multiple clients booking the same class within ~100ms). Prior to the member-facing iOS app, serial admin bookings won't hit this. Must be fixed before Phase 5.

---

### B15 — Employee self-service profile update missing

**State:** `/employee/profile` page is read-only — no API route or Supabase write path exists for employees to update their own profile fields.
**Source:** Tier 7.4 discovery

**What's missing:**
- `PATCH /api/auth/profile` or `PUT /api/profile` route (owner/admin/manager/trainer/staff)
- Row-level constraint: employee may only update their own profile
- Editable fields: `phone`, `emergency_contact_*`, `avatar_url`, `bio` (trainer)
- UI flow: modal on profile page's pencil icon, validation, optimistic update

**Disposition:** Needed before member-facing iOS app launch (employees will expect profile self-service). Log and move on — not a pipeline fix.

---

### B16 — Clock in/out FK bug (FIXED in Tier 7.1)

**State:** FIXED. Documented here for historical record.
**Source:** Tier 7.1 discovery

`POST /api/clock` was inserting `employee_id: user.id` (auth user id) into `clock_entries`, which violates `clock_entries_employee_id_fkey` (→ `employees.id`). The route had never worked against the real schema. Fixed by looking up `employees.id` via `profile_id`, with an explicit 403 when no employees row exists for the user. Activity log inserts also gained capture-and-log + descriptions.

---

### B14 — `content_posts.author_role` CHECK excludes `admin` and `staff`

**State:** Schema/code drift — route logic picks `authorRole` from `['admin','manager','trainer','staff']` but DB CHECK only allows `['owner','manager','trainer','member']`.
**Source:** Tier 5.4 discovery

**Tier 5.4 narrow fix:** Constrained `VALID_AUTHOR_ROLES` to `['owner','manager','trainer']` and added `'owner'` to `STAFF_ROLES` for auto-approval. This prevents the CHECK violation.

**Open question:** If admins/staff post content, what author_role should be recorded? Options:
- Migrate CHECK to include `admin` and `staff`
- Keep mapping admin→manager (current workaround via priority list doesn't include admin)
- Add explicit mapping in route

**Disposition:** Review once content hub has real UI traffic. Not urgent.

---

## ✅ Summary

**14 items in the feature-dev backlog:**

| # | Item | Severity | Type |
|---|---|---|---|
| B1 | Memberships: Cancel | 🔴 | Missing feature |
| B2 | Revenue: Refund | 🔴 | Missing feature |
| B3 | Revenue: Issue Credit | 🔴 | Missing feature |
| B4 | Schedule: Waitlist Add/Remove | 🔴 | Missing UI + API |
| B5 | Stripe SDK integration (5 routes) | 🟠 | External integration |
| B6 | `promo_codes` table missing | 🟠 | Schema gap |
| B7 | `increment_rate_limit` RPC missing | 🟠 | Schema gap |
| B8 | Systemic RLS role-check absence (~50 tables) | 🟡 | Design decision |
| B9 | BUG-013 Pause/Upgrade panel full fix | 🟡 | Refactor |
| B10 | Corporate POST full-payload 500 narrowing | 🟢 | Diagnose + fix |
| B11 | db.ts cleanup wrong FK | 🟢 | Test infra |
| B12 | Campaigns subroutes phantom-column rot (9 files) | 🔴 | Refactor |
| B13 | automation_flows trigger_type CHECK drift | 🟠 | Schema drift |
| B14 | content_posts author_role CHECK drift | 🟢 | Schema drift |
| B15 | Employee self-service profile update missing | 🟠 | Missing feature |
| B16 | Clock in/out FK bug (FIXED in Tier 7.1) | ✅ | Historical |
| B17 | Booking capacity check not atomic under concurrency | 🟠 | Refactor |
| B18 | Full phantom column sweep + missing count RPCs | 🟡 | Audit |
| B19 | Consolidate 40 multiple_permissive_policies warnings | 🟡 | Perf cleanup |
| B20 | Drop 33 unused indexes | 🟢 | Cleanup |
| B21 | Revenue page: add sort controls | 🟢 | Enhancement |
| B22 | AI insights generate 30s+ timeout + no feedback | 🔴 | Perf + UX |
| B23 | AI insights table empty (depends on B22) | 🟡 | Data seeding |
| B24 | Dark mode polish sweep | 🟢 | Polish |
| B25 | Preview shell-init warnings | 🟢 | Cosmetic |

**REMINDER**: Surface this list to the user explicitly when the QA pipeline reaches Tier 8 / final wrap-up. Do NOT silently skip it.
