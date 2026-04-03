# Scope Decomposition: Glofox API Migration to Meridian
**Date:** 2026-03-31

---

## Revised Scope Map

The plan's 5-phase structure is largely correct. This decomposition adds missing scope items and clarifies ambiguous ones.

---

## Phase 1: Schema Preparation (Week 1) — AS PLANNED + 2 ADDITIONS

### Planned work (execute as written):
- `ALTER TABLE` additions for `glofox_id` on 7 tables
- `glofox_synced_at` on 4 tables
- 27 new data fields across 6 tables
- 3 new tables: `glofox_sync_state`, `glofox_sync_conflicts`, `lead_interactions`
- API credentials in Netlify environment variables

### Additions required:
- **Add `UNIQUE(studio_id, entity_type)` constraint to `glofox_sync_state`** (required for upsert to function)
- **Add RLS policies for all 3 new tables** (consistent with existing schema pattern)
- **Verify staff profiles:** Check that all ~10 Glofox staff have Meridian profiles with `glofox_id` set; create any missing mappings manually
- **Verify glofox_id coverage on existing members:** Run count query to confirm CSV import captured Glofox IDs
- **Take a full Glofox data export (CSV):** Insurance against API access revocation; do this before any API work begins
- **Validate glofox_id on profiles already exists** (noted as confirmed in plan; verify in schema)
- **Run full test suite (all 229 tests) before applying migrations** to establish clean baseline
- **Run full test suite after applying migrations** to confirm no regressions

### Gate to Phase 2: All tests pass. glofox_id coverage confirmed. Rate limits obtained or empirically tested.

---

## Phase 2: Sync Engine Build (Weeks 2–3) — AS PLANNED + ADDITIONS

### Planned work (execute as written):
- `GlofoxClient` TypeScript class
- 5 inbound Inngest cron functions
- 3 outbound event-driven Inngest functions
- Per-field conflict resolution
- Tests for sync logic

### Additions required:
- **Define outbound sync trigger mechanism** (application-level: API routes call `inngest.send()` after writes)
- **Add loop-prevention logic** (check `glofox_synced_at` before triggering outbound; skip if updated within last 60 seconds from inbound sync)
- **Add Glofox event types to `MeridianEvents`** in `lib/inngest/client.ts` (`glofox/sync_member`, `glofox/sync_booking`, `glofox/sync_attendance`)
- **Fix name-splitting bug** in `pushMemberUpdate` (read `first_name`/`last_name` directly from schema)
- **Fix URL construction bug** in `fetchAll` (ensure `/prod` base path is not dropped)
- **Fix `sold_by_profile_id`** to be nullable with null-on-no-match logic
- **Add new member registration outbound sync** (`POST /2.0/register` when new member created in Meridian without `glofox_id`)
- **Add credit pack inbound sync** to full-refresh job (per-member `GET /2.0/credits` call; include in daily 3am refresh)
- **Build plan code → Stripe price ID mapping** (table or config object mapping Glofox plan codes to Stripe price IDs)
- **Build sync monitoring dashboard** (admin page showing sync state, error counts, active conflicts with resolution UI) — needed before parallel mode

### Gate to Phase 3: Sync engine runs correctly for 48+ hours in dev/staging. All mapping tests pass. Rate limit behavior confirmed safe.

---

## Phase 3: Transition Period (Weeks 4–6) — AS PLANNED + CLARIFICATIONS

### Week 4 — Shadow Mode (inbound only):
- Enable inbound sync on all entity types
- Run daily integrity checks (automated queries comparing counts + sums)
- Manual spot-check 10 random member records per day
- Staff continues on Glofox exclusively

**Clarification:** Shadow mode should run until success criteria are met for 5+ consecutive days (not just 1 week). If integrity issues are found, Week 5 should not begin.

### Weeks 5–6 — Parallel Mode:
- Enable outbound sync
- Staff uses Meridian for check-ins; Glofox for schedule management (no write endpoint for classes)
- **Begin payment method collection campaign via Resend** — target 4 weeks before cutover (earlier than plan's 2 weeks)
- Staff training (all ~10 staff)

**Additions:**
- **Class management is Meridian-primary in parallel mode** — staff must create all new classes in Meridian only (Glofox schedule will not receive new classes); communicate this explicitly in training
- **Establish conflict resolution workflow** — who reviews and resolves items in `glofox_sync_conflicts`? Define a daily review process
- **Check Glofox contract cancellation terms** — if 30-day notice required, give notice during Week 6

### Minimum member surface (parallel workstream, target completion by Week 5):
- Member auth (magic link login via Supabase)
- Stripe payment method capture form
- Basic account page (membership status, billing method)

This is the minimum needed for payment collection. Without it, the payment migration step in Phase 4 has no surface for members to act on.

**Gate to Phase 4:** 14+ consecutive days of parallel mode with zero integrity issues. All Stripe subscriptions created and verified. Staff trained and operational.

---

## Phase 4: Cutover (Weeks 7–8) — AS PLANNED + CLARIFICATIONS

### Pre-cutover checklist additions:
- [ ] Glofox contract cancellation notice given (or confirmed not required)
- [ ] DNS TTL reduced to 300 seconds 48 hours before cutover
- [ ] Plan code → Stripe price ID mapping verified for all active plans
- [ ] Credit balances verified for all members with active credit packs
- [ ] Staff accounts in Glofox confirmed to have Meridian profile mappings
- [ ] Full Glofox data export archived
- [ ] Billing cycle dates pulled; members with billing date within 7 days of cutover identified and handled manually

### Cutover sequence (as written with one addition):
- 22:00: Freeze Glofox
- 22:15: Final full sync (Glofox → Meridian)
- 22:30: Verify integrity (member counts, booking counts, transaction totals, credit balances)
- 22:45: **No new classes can be created in Meridian until Glofox is confirmed frozen** (prevents rollback sync issues)
- 23:00: DNS switch
- 23:15: Enable Stripe payment processing
- 23:30: Smoke test (booking, check-in, payment)
- 00:00: Go live

---

## Phase 5: Post-Cutover Cleanup (Week 9+) — AS PLANNED + PRECISION

### Retain (permanent value):
- All `glofox_id` columns on all tables (audit trail of Glofox origin)
- All data fields that have intrinsic Meridian value (birth_date, address_*, consent_*, is_late_cancellation, is_first_booking, etc.)
- `lead_interactions` table and data
- `lib/glofox/` module (reusable for future Meridian SaaS customers migrating from Glofox)

### Archive (keep data, remove from active schema):
- `glofox_sync_state` table (move to archive schema or CSV export)
- `glofox_sync_conflicts` table (move to archive schema or CSV export)

### Remove (no value after cutover):
- `glofox_plan_code` column (Glofox-internal, meaningless post-cutover)
- `glofox_provider_id` column in transactions (Stripe is now the provider)
- `glofox_paid` column in transactions (Stripe handles payment state)
- `glofox_synced_at` columns (no more sync happening)
- All Inngest Glofox sync functions (unregister from functions index)
- `GLOFOX_API_TOKEN` and `GLOFOX_API_KEY` env vars

### Refactors required post-cutover:
- **Member classification logic:** Replace Glofox membership status with Stripe subscription status as the source of truth
- **Engagement status backfill:** Re-run engagement scoring with clean Stripe data
- **Churn prediction:** Verify it uses Meridian booking records, not Glofox-synced data

---

## Descoped (Out of This Plan)

- iOS member app (Phase 5, separate project)
- Full web booking portal (Phase 5, separate project)
- Glofox-to-Meridian migration tooling for other studios (future SaaS feature, preserve the library)
- Staff payroll and tax features (Phase 4, separate module)
- Trainer promo code attribution system (already partially designed; not changed by this migration)
