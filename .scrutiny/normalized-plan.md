# Normalized Plan: Unified Member Data Architecture

## Plan Classification
- **Complexity Class:** SIGNIFICANT
- **Analysis Mode:** Deep (all 7 agents)
- **Type:** Data architecture enhancement + backfill + automation integration
- **Scrutiny Session:** 2026-04-04

---

## Summary

Build a unified member data layer in Meridian that surfaces coherent member intelligence from fragmented Glofox-synced data. Currently 1,199 profiles and 5,427 bookings exist but computed fields (total_visits, last_visit, engagement_status) are all null/zero, ClassPass users are untagged, and plan codes are opaque Glofox numeric IDs. The plan adds a queryable member_360 VIEW, backfill jobs, acquisition source detection, new automation trigger types, and UI integration across 4 phases.

---

## Problem Statement

1. **Data incoherence:** members.total_visits = 0 and members.last_visit = null despite 5,427 bookings existing in the bookings table. Computed fields are never populated.
2. **Invisible segments:** ClassPass users are identifiable (lead_source='U' + phone='+10000000000') but not tagged, making them indistinguishable from organic members in campaigns.
3. **Opaque plan codes:** Glofox plan IDs are numeric strings with no human-readable mapping stored in Meridian.
4. **Siloed data:** No single query surface joins profiles + members + bookings + classes + membership_plans into actionable member intelligence.
5. **Stale automation triggers:** evaluate-triggers.ts reads members.total_visits and members.last_visit (both 0/null), so milestone and inactivity triggers never fire correctly. failed_payment reads transactions table which is EMPTY.
6. **40+ empty tables:** transactions, activity_log, campaigns, automations — Phase B proposes pulling this from Glofox.

---

## Proposed Solution (as submitted)

### Phase A: Database Foundation
1. Create `member_360` PostgreSQL VIEW joining profiles + members + bookings + classes + membership_plans with computed fields: acquisition_channel, computed_engagement, behavior_segment, favorite_class_type, days_since_last_visit
2. Create `glofox_plan_map` table mapping Glofox plan codes to human-readable names and types
3. Add `profiles.acquisition_source` column and backfill from lead_source + phone pattern
4. Backfill `members.total_visits` and `members.last_visit` from actual booking data
5. Backfill `members.engagement_status` from visit patterns

### Phase B: Mass Glofox Data Pull
6. Pull ALL available data from Glofox API: transactions, activity/history, subscriptions
7. Create new `cron-member-enrichment` Inngest function (daily) to keep computed fields current
8. Create `glofox_plan_map` table and populate from Glofox memberships endpoint
9. Update Glofox sync pipeline to tag ClassPass acquisition source and resolve plan codes

### Phase C: Automation Triggers
9. Add new trigger types to evaluate-triggers.ts: never_booked, classpass_repeat, one_and_done, cooling_off, plan_upgrade_candidate, class_type_fan
10. Create pre-built automation flow templates

### Phase D: UI Integration
11. Update member profile page to show unified data from member_360
12. Add acquisition source badges, engagement status indicators
13. Update campaign builder with behavior-based segments

---

## Existing System Context

### Tech Stack
- **Monorepo:** Turborepo (apps/web, packages/types, packages/utils)
- **Frontend:** Next.js App Router (apps/web), deployed to Netlify
- **Database:** Supabase (PostgreSQL) with RLS via studio_id isolation
- **Background jobs:** Inngest (event-driven + cron functions, 13 functions exist)
- **Glofox API:** Read-only sync client (GlofoxClient class). Has retry/backoff, 200-page safety cap, rate-limit handling.
- **AI:** Anthropic SDK (Claude Sonnet 4.6)
- **Email:** Resend
- **Payments:** Stripe

### Existing Data Infrastructure
- **profiles table:** 1,199 rows — has glofox_id, lead_source, phone. acquisition_source column ALREADY added in phase2-migration.sql (column exists but not backfilled)
- **members table:** 1,183 rows — has total_visits (all 0), last_visit (all null), engagement_status, membership_status
- **bookings table:** 5,427 rows — has member_id (Meridian UUID), class_id, checked_in_at, status
- **classes table:** 1,645 rows — has trainer_id, class_type_id, start_time
- **membership_plans table:** populated via glofox backfill (glofox_id stored)
- **transactions:** EMPTY — backfill exists in glofox-backfill.ts step 5 using POST Analytics/report endpoint
- **credit_packs:** populated per-member via backfill (per-member API calls required — no bulk endpoint)
- **leads:** populated via backfill

### Existing Inngest Functions (relevant)
- `glofox-backfill.ts`: Full historical import — 9 steps: staff, members, events, bookings, transactions, credit_packs, leads, membership_plans, sync-state. Already handles transactions via Analytics/report.
- `glofox-sync-hourly.ts`: Incremental delta sync
- `evaluate-triggers.ts`: 12 trigger types evaluated every 10 minutes. milestone reads members.total_visits (currently 0 — broken). inactivity queries bookings.checked_in_at directly (works). failed_payment reads transactions (empty — broken).
- `cron-daily-metrics.ts`: Exists (scope unknown)

### Existing Migration Files (already applied or planned)
- `scripts/phase2-migration.sql`: Already adds profiles.acquisition_source column, creates campaigns, automation_flows, automation_enrollments, leads, content, email_preferences tables
- `scripts/audit-fixes-migration.sql`: Adds check_booking_capacity trigger, fixes automation_enrollments unique constraint to partial index

### Key Schema Patterns
- Every table has studio_id for multi-tenancy
- RLS policies use current_setting('app.studio_id')::uuid
- Inngest functions use service-role client (bypasses RLS), must filter by studio_id explicitly
- glofox_id stored on profiles, members, classes, bookings — used for sync idempotency
- Upsert pattern: batchUpsert() with onConflict='glofox_id,studio_id'

### Glofox API Constraints
- Rate limiting: 429 responses handled with retry/backoff in GlofoxClient
- Safety cap: 200 pages max per fetchAll (20,000 records)
- Transactions endpoint: POST Analytics/report (not a standard paginated GET — date range required)
- Credits: Per-member fetch required (no bulk endpoint) — already causes N+1 in backfill
- Glofox writes: PROHIBITED by project memory (reads only until explicitly approved)

---

## Goals
1. Fix broken computed fields (total_visits, last_visit) so automation triggers work
2. Enable ClassPass member segmentation for targeted campaigns
3. Make plan names human-readable throughout the UI
4. Provide a single queryable surface (member_360) for member intelligence
5. Enable 6 new behavior-based automation trigger types
6. Fill empty tables (primarily transactions) from Glofox historical data

---

## Constraints
- Glofox is read-only — no writes to Glofox (architectural constraint, enforced in project memory)
- RLS must be maintained on all new tables/views
- Inngest is the deployment mechanism for all background jobs
- Multi-tenancy: single studio today, all new artifacts must include studio_id
- Phase 2 (Marketing) is the current active phase — this is a data foundation prerequisite

---

## Risks Identified by Submitter
1. member_360 VIEW with LATERAL join may be slow at scale
2. Glofox API rate limits during mass pull
3. Plan code mapping may be incomplete
4. acquisition_source detection pattern (lead_source + phone) may have false positives

---

## Out of Scope (Per Plan)
- Any writes to Glofox API
- Member-facing surfaces (Phase 5)
- iOS app changes
- SMS provider selection (stubbed)
