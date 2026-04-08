# Layer Report: Data Model

**Agent:** data-model
**Date:** 2026-04-08
**Status:** Complete

---

## Executive Summary

Meridian uses Supabase Postgres as its sole database. The schema is well-structured with proper UUID primary keys, multi-tenant isolation via `studio_id` on every table, and typed foreign key relationships. No ORM is used — queries are written directly against the Supabase JS client. The type system is defined in `packages/types/` with 13 domain modules. Key concerns include missing DB-level capacity constraint on bookings (partially addressed in audit-fixes migration), a partially-resolved reenrollment constraint on automation_enrollments, and the `email_hash` column added post-initial migration. The data model is comprehensive and well-thought-out for Phase 1+2, with several forward-looking fields (shipping infrastructure, glofox_id columns) that demonstrate planned evolution.

---

## Entity Inventory

### Core Entities (Inferred from types + SQL)

| Entity | Table | Key Relationships |
|--------|-------|-------------------|
| profiles | profiles | Central user table; related to members, employees, trainers |
| studios | studios | Root tenant entity |
| members | members | FK → profiles (profile_id), wallet balance, strike system |
| classes | classes | FK → trainers, holds glofox_id |
| bookings | bookings | FK → classes, members, credit_packs |
| waitlist_entries | waitlist_entries | FK → classes, members |
| credit_packs | credit_packs | FK → members |
| wallet_transactions | wallet_transactions | FK → members |
| family_accounts | family_accounts | FK → members (parent) |
| member_strikes | member_strikes | FK → members, classes |
| member_segments | member_segments | Rules-based + manual grouping |
| payments | payments | FK → members, Stripe references |
| membership_plans | membership_plans | Stripe price_id linkage |
| gift_cards | gift_cards | Wallet-based redemption system |
| invoices | invoices | FK → members OR corporate_accounts |
| dunning_records | dunning_records | FK → members, Stripe subscription |
| employees | employees | FK → profiles (user_id) |
| clock_entries | clock_entries | FK → employees, geolocation |
| timesheet_periods | timesheet_periods | FK → employees |
| employee_documents | employee_documents | FK → employees |
| trainer_profiles | trainer_profiles | FK → profiles |
| trainer_payouts | trainer_payouts | FK → trainers |
| promo_attributions | promo_attributions | FK → trainers, members |
| company_accounts | company_accounts | Corporate tenant entity |
| company_members | company_members | FK → companies, members |
| events | events | FK → companies, invoices |
| event_guests | event_guests | FK → events, members |
| campaigns | campaigns | FK → segments, email_templates |
| campaign_recipients | campaign_recipients | FK → campaigns, members |
| automation_flows | automation_flows | JSON steps array |
| automation_enrollments | automation_enrollments | FK → automation_flows, members |
| leads | leads | FK → members (converted) |
| lead_activities | lead_activities | FK → leads |
| content_posts | content_posts | FK → profiles |
| content_comments | content_comments | FK → content_posts, profiles |
| email_preferences | email_preferences | FK → members |
| daily_metrics | daily_metrics | Time-series aggregates |
| cohort_snapshots | cohort_snapshots | Retention tracking |
| trainer_metric_snapshots | trainer_metric_snapshots | Monthly trainer aggregates |
| saved_reports | saved_reports | Report configuration |
| report_exports | report_exports | Async export tracking |
| ai_insights | ai_insights | AI-generated insights with fingerprint dedup |
| ai_briefings | ai_briefings | Cached AI daily briefings |
| pricing_simulations | pricing_simulations | Pricing change scenarios |
| migration_jobs | migration_jobs | Glofox migration tracking |
| rate_limit_entries | rate_limit_entries | Supabase-backed rate limiting |
| activity_log | activity_log | Audit trail |
| products | products | Merchandise |
| orders | orders | FK → members, payments |
| order_items | order_items | FK → orders, products |
| inventory_holds | inventory_holds | 15-min checkout holds |
| shipping_labels | shipping_labels | EasyPost integration |
| geofence_locations | geofence_locations | Studio geofencing |
| payroll_periods | payroll_periods | Corporate payroll |
| payroll_line_items | payroll_line_items | Per-employee payroll |

---

## Schema Design Observations

### Multi-Tenancy
Every table appears to have `studio_id UUID NOT NULL`. Multi-tenancy is enforced at:
1. Application level (every query filters by studioId from `requireRole()`)
2. RLS level (Phase 2 tables use `current_setting('app.studio_id')::uuid`)
3. Defense-in-depth: manual studio_id filtering even when RLS is active

### Type Patterns
- All PKs use `UUID DEFAULT gen_random_uuid()` — correct for Postgres
- Monetary values stored as integer cents throughout — no floating point money
- Timestamps are ISO 8601 strings in TypeScript types, TIMESTAMPTZ in SQL
- JSON fields (steps, flow_snapshot, etc.) for flexible schema areas like automation steps
- `glofox_id TEXT | null` on classes and members for bidirectional sync

### Interesting Design Decisions
- **Wallet balance** stored directly on members table (denormalized from wallet_transactions) — fast reads, risk of drift if transactions fail mid-write
- **Campaign metrics** stored denormalized on campaigns row (recipient_count, open_count, etc.) — fast reads, updated via Resend webhooks
- **automation_enrollments** stores a full `flow_snapshot` JSON — immutable snapshot at enrollment time prevents flow edits from breaking active enrollments (good design)
- **ai_insights.fingerprint** for dedup — prevents re-emitting identical insights within 7 days
- **member_strikes** has rolling 30-day expiry with `expires_at` — implements the edge case policy correctly
- **inventory_holds** table with 15-min expiry — reservation system for checkout races

---

## Index Analysis

### Phase 2 Migration Indexes (Confirmed)
```sql
idx_campaigns_studio_status        (studio_id, status)
idx_campaigns_scheduled            (scheduled_at) WHERE status = 'scheduled'
idx_campaign_recipients_campaign   (campaign_id)
idx_campaign_recipients_member     (member_id)
idx_campaign_recipients_status     (campaign_id, status)
idx_automation_flows_studio        (studio_id)
idx_automation_enrollments_member  (member_id)
idx_automation_enrollments_status  (automation_id, status)
idx_leads_studio_status            (studio_id, status)
idx_leads_source                   (studio_id, source)
idx_leads_score                    (studio_id, score DESC)
idx_leads_follow_up                (next_follow_up_at) WHERE status NOT IN ('converted', 'lost')
idx_leads_email                    (studio_id, email)
idx_lead_activities_lead           (lead_id)
idx_content_posts_studio           (studio_id, is_published, created_at DESC)
idx_content_comments_post          (post_id)
idx_email_prefs_member             (member_id, studio_id)
idx_cooldowns_member               (member_id, studio_id)
idx_leads_email_hash               (email_hash) — added via audit-fixes migration
```

### Index Gaps Identified
- **bookings table**: No composite index on `(studio_id, class_id, status)` — every capacity check requires a full table scan filtered by these three columns
- **members table**: No index on `(studio_id, membership_status)` — member directory filtering will degrade at scale
- **daily_metrics table**: No index on `(studio_id, metric_date)` — time-series queries for analytics dashboards will be slow
- **activity_log table**: No index on `(studio_id, created_at)` — activity feed queries degrade as log grows
- **ai_insights table**: No index on `(studio_id, status, created_at)` — insight listing queries unindexed
- **rate_limit_entries**: Has `idx_rate_limit_expires` (confirmed in code) — good for cleanup

---

## Potential Issues

### N+1 Query Patterns
- Member directory query: `select "*, profiles:profile_id (id, full_name, email, phone, avatar_url)"` — this is a single Supabase join, not N+1
- Booking creation: fetches class → counts bookings → checks duplicate → inserts booking (4 sequential DB round-trips) — not N+1 but sequential
- AI briefing endpoint: gathers metrics via parallel Promise.all — good

### Orphaned Migration Risk
- `audit-fixes-migration.sql` adds `email_hash` to leads but the Phase 2 migration creates the leads table without this column. If Phase 2 migration ran without the audit-fixes migration, the leads table would be missing this column — a schema drift risk.
- The `automation_enrollments` `UNIQUE(automation_id, member_id)` constraint from Phase 2 migration is dropped and replaced by a partial index in `audit-fixes-migration.sql` — order dependency must be respected.

### Schema Drift
- The TypeScript types in `packages/types/src/` may not match the live database schema 1:1. There is no automated schema generation (no Supabase type generation script configured). Types are hand-maintained.
- `CorporateInvoice` type references `InvoiceLineItem` from revenue.ts (imported cross-module) — fragile if revenue types are refactored.

---

## Findings

### CRITICAL
None identified.

### HIGH
- **HIGH-DM-001:** No index on bookings `(studio_id, class_id, status)`. Every capacity check at booking creation runs `SELECT COUNT(*) FROM bookings WHERE class_id = ? AND studio_id = ? AND status IN (...)`. As bookings grow, this becomes a sequential scan. Add: `CREATE INDEX idx_bookings_class_status ON bookings(class_id, studio_id, status)`.
- **HIGH-DM-002:** No automated Supabase type generation. TypeScript types in `packages/types/` are hand-maintained and can drift from the actual database schema. At minimum, configure `supabase gen types typescript` in the CI pipeline.

### MEDIUM
- **MED-DM-001:** `wallet_balance` is stored denormalized on the `members` table. If a wallet transaction fails mid-write (after crediting but before updating balance), the wallet balance will be incorrect. Should use a DB trigger or enforce balance updates within a single transaction.
- **MED-DM-002:** No index on `members(studio_id, membership_status)`. The member directory filter by status (`?status=active`) runs against unindexed columns — will degrade as member count grows.
- **MED-DM-003:** Missing indexes on `daily_metrics(studio_id, metric_date)` and `activity_log(studio_id, created_at)` — analytics dashboard and activity feed queries lack index support.
- **MED-DM-004:** Schema drift risk: `audit-fixes-migration.sql` must run after `phase2-migration.sql`. No migration runner or migration order file exists in the repo. An out-of-order deployment would leave the schema inconsistent.

### LOW
- **LOW-DM-001:** `automation_flows` stores steps as JSONB rather than a normalized steps table. Complex step queries (e.g., "which flows have email steps?") require JSONB containment queries. Acceptable for the current scale but will complicate future step-level analytics.
- **LOW-DM-002:** `AutomationEnrollment.flow_snapshot` stores the complete flow as JSON on each enrollment row. At large automation scale (thousands of enrollments), this will create significant storage overhead.
- **LOW-DM-003:** `leads.email_hash` description says "lowercase SHA-256 for dedup lookups" but there is no application-level enforcement that the hash is computed consistently (lowercase normalization before hashing must be applied correctly at every write path).

### INFO
- **INFO-DM-001:** The data model is forward-looking: shipping fields on orders/products (Phase 5), glofox_id on classes/members (sync layer), multi-currency prep via integer cents. Good architectural discipline.
- **INFO-DM-002:** 50+ distinct entities identified. This is a comprehensive domain model for Phase 1+2.
- **INFO-DM-003:** The `exclude_from_analytics` flag on members is an elegant solution to the "comped member skewing data" business problem noted in the PRD.
