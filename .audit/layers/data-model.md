# Data Model Audit Report

**Agent**: data-model
**Model**: claude-sonnet-4-6
**Timestamp**: 2026-04-02T00:00:00Z

---

## Scope

- **SQL files analyzed**: 17 (13 in `scripts/`, 1 embedded in `apps/web/src/lib/glofox/migration.sql`, 3 Glofox batch import helpers)
- **TypeScript files analyzed**: ~391 (all API routes, hooks, types packages, Inngest functions, lib modules)
- **Schema discovery method**: Phase 1 schema was applied directly to Supabase — no DDL file exists in the repo. Schema was reconstructed from: (a) API route `.from()` calls and `.select()` field lists, (b) seed SQL INSERT column lists, (c) `SCHEMA_CONTEXT` string in `lib/anthropic.ts`, (d) shared types in `packages/types/src/`, (e) Inngest function query patterns, (f) `use-supabase.ts` hook definitions.
- **Phase 2 DDL**: Fully defined in `scripts/phase2-migration.sql` and `scripts/phase2-rpc-functions.sql`.
- **Glofox sync DDL**: Defined in `apps/web/src/lib/glofox/migration.sql`.

---

## Executive Summary

Meridian's data model is architecturally sound — multi-tenant isolation via `studio_id`, RLS enabled on all Phase 2 tables, service-role client correctly isolated to background jobs. However, there are five categories of findings that require immediate attention before the system can safely scale or onboard a second tenant:

1. **Critical schema drift on the `classes` table** — the actual database column is `starts_at`/`ends_at` (confirmed by seed SQL, Inngest cron, and `SCHEMA_CONTEXT`), but the `/api/classes` route handler reads and writes `start_time`/`end_time`. This means the class creation API is silently writing to non-existent columns.

2. **218 hardcoded occurrences of the sentinel studio ID** `11111111-1111-1111-1111-111111111111` across 179 source files, including API route handlers, Inngest background jobs, and client-side hooks. The utility function `get-studio-id.ts` exists to fix this but has not been applied (tracked as MED-008).

3. **Phase 1 schema has no DDL file** — the canonical table definitions for `studios`, `profiles`, `members`, `classes`, `bookings`, `transactions`, `credit_packs`, `membership_plans`, `waitlist_entries`, `activity_log`, and ~20 other tables exist only in the live Supabase instance. Any rollback, migration to a new environment, or onboarding of a new developer requires manual reverse-engineering.

4. **`automation_cooldowns` schema drift** — the Phase 2 migration defines `last_automation_email_at`/`last_automation_sms_at` columns but the Inngest helper queries `channel` + `last_sent_at` columns. One of these is wrong and the cooldown system will not function correctly.

5. **`/api/members/[id]` joins a `memberships` table** that does not appear anywhere in the type definitions, seed data, or migration files — this is an undocumented table or a stale query against a table that was dropped/renamed.

---

## 1. Entity Discovery

The following tables were identified from SQL files, API query patterns, and type definitions. Phase 1 tables are reconstructed; Phase 2+ tables have authoritative DDL.

### Core / Phase 1 Tables (reconstructed from usage)

| Table | Key Columns (inferred) | Primary Key Strategy | Relationships |
|---|---|---|---|
| `studios` | id, name, created_at | UUID gen_random_uuid() | Referenced by profiles, all studio-scoped tables |
| `profiles` | id, studio_id, email, full_name, phone, roles TEXT[], is_active, exclude_from_analytics, health_score, health_risk_level, date_of_birth, avatar_url, glofox_id, timezone, acquisition_source | UUID (mirrors Supabase Auth uid) | Parent to members (1:1 via profile_id) |
| `members` | id, profile_id, studio_id, membership_tier, membership_status, membership_plan_id, stripe_customer_id, stripe_subscription_id, credits_remaining, wallet_balance, lifetime_value, total_visits, last_visit, join_date, glofox_id | UUID | Belongs to profiles, has many bookings |
| `classes` | id, studio_id, location_id, class_type_id, trainer_id, title, **starts_at** TIMESTAMPTZ, **ends_at** TIMESTAMPTZ, capacity, booked_count, checked_in_count, status, is_recurring, recurrence_rule, glofox_id | UUID | Belongs to class_types, has many bookings |
| `class_types` | id, studio_id, name, description, color | UUID | Has many classes |
| `bookings` | id, studio_id, class_id, member_id, status, credits_deducted, checked_in_at, cancelled_at, cancellation_type, is_late_cancellation, is_walk_in, is_guest, guest_id, booked_by_user_id, glofox_id, glofox_write_status, glofox_write_error, attended, is_from_waitlist, payment_method | UUID | Belongs to classes and members |
| `waitlist_entries` | id, studio_id, class_id, member_id, status, position, offered_at, claim_deadline, claimed_at, expired_at, booking_id | UUID | Belongs to classes and members |
| `transactions` | id, studio_id, member_id, amount INT (cents), type, status, currency, tax_amount, discount_id, promo_code, glofox_id, glofox_charge_id | UUID | Belongs to members |
| `membership_plans` | id, studio_id, name, tier, price, credits_per_cycle, guest_passes_per_cycle, stripe_price_id, is_active, sort_order, glofox_id | UUID | Has many members |
| `credit_packs` | id, studio_id, member_id, pack_type, credits_total, credits_remaining, expires_at, grace_period_ends_at, purchased_at, glofox_id | UUID | Belongs to members |
| `gift_cards` | id, studio_id, code, amount, redeemed_by_member_id, purchased_by_email, is_redeemed, stripe_payment_intent_id | UUID | |
| `products` | id, studio_id, name, description, price, sku, inventory_count, inventory_hold_count, is_active, weight_oz, requires_shipping | UUID | Has many order_items |
| `orders` | id, studio_id, member_id, status, fulfillment_type, subtotal, discount_amount, total, payment_id, shipping_address, tracking_number | UUID | Has many order_items |
| `order_items` | id, order_id, product_id, product_name, quantity, unit_price, total | UUID | |
| `trainers` | id, studio_id, profile_id, promo_code, bonus_threshold, glofox_id | UUID | Belongs to profiles |
| `trainer_bonuses` | id, studio_id, trainer_id, class_id, check_in_count, threshold, status | UUID | |
| `trainer_metric_snapshots` | id, studio_id, trainer_id, classes_led, total_checkins, avg_attendance, bonus_eligibility_rate, ai_summary, ai_last_generated_at | UUID | |
| `employees` | id, studio_id, user_id, employee_id_number, employment_type, status, hire_date, hourly_rate | UUID | |
| `clock_entries` | id, studio_id, employee_id, clock_in, clock_out, break_start, break_end, total_hours, geofence_verified_in, latitude_in, longitude_in, status | UUID | |
| `geofence_locations` | id, studio_id, name, latitude, longitude, radius_meters, is_active | UUID | |
| `locations` | id, studio_id, name, address | UUID | Referenced by classes, clock |
| `studio_settings` | id, studio_id, late_cancel_window_minutes, strike_window_days, strike_penalties JSONB, strike_system_enabled, unlimited_members_warning_only, credit_grace_period_days, waitlist_claim_window_minutes, inventory_hold_minutes | UUID | 1:1 per studio |
| `activity_log` | id, studio_id, actor_id, type, subject_type, subject_id, metadata JSONB | UUID | |
| `member_tags` | id, studio_id, member_id, tag, metadata JSONB | UUID | |
| `smart_segments` | id, studio_id, name, description, type, rules JSONB, member_count, color, icon | UUID | |
| `daily_metrics` | id, studio_id, metric_date, revenue_total, revenue_memberships, revenue_credit_packs, revenue_drop_ins, revenue_merch, revenue_gift_cards, refunds_total, total_bookings, total_checkins, total_no_shows, classes_held, avg_attendance | UUID | |
| `ai_cache` | id, studio_id, cache_key, data JSONB, expires_at | UUID | |
| `invoices` (corporate) | id, studio_id, member_id, corporate_account_id, amount, status, due_date, stripe_invoice_id | UUID | |
| `corporate_invoices` | id, studio_id, company_id, invoice_number, status, subtotal, tax_rate, total | UUID | Belongs to company_accounts |
| `company_accounts` | id, studio_id, name, contact_name, contact_email, stripe_customer_id, monthly_credit_allocation, credits_remaining, status | UUID | |
| `company_members` | id, studio_id, company_id, member_id, role, is_active | UUID | M:N junction |
| `events` | id, studio_id, name, event_type, start_time, end_time, min_guests, max_guests, company_id, status, assigned_staff TEXT[], resources_reserved JSONB | UUID | |
| `event_guests` | id, studio_id, event_id, member_id, guest_name, guest_email, rsvp_status | UUID | |
| `payroll_periods` | id, studio_id, period_start, period_end, pay_date, status, approved_by | UUID | |
| `payroll_line_items` | id, studio_id, payroll_period_id, employee_id, regular_hours, overtime_hours, gross_pay, net_pay_estimate | UUID | |
| `employee_documents` | id, studio_id, employee_id, document_type, name, file_url, status, expires_at | UUID | |
| `check_in_tokens` | id, studio_id, booking_id, token, expires_at | UUID | |
| `email_send_log` | id, studio_id, recipient_email, status, opened_at, clicked_at, campaign_recipient_id | UUID | |
| `email_templates` | id, studio_id, name, subject, body_html, body_text | UUID | |
| `saved_reports` | id, studio_id, name, type, config JSONB | UUID | |
| `report_exports` | id, studio_id, report_id, status, file_url, format | UUID | |
| `migration_jobs` | id, studio_id, status, entity_type, total_records, processed_records, errors JSONB | UUID | |
| `pricing_simulations` | id, studio_id, name, config JSONB, results JSONB | UUID | |
| `discounts` | id, studio_id, name, rate_type, rate_value, num_cycles, glofox_id, active | UUID | |
| `tax_configurations` | id, studio_id, name, rate, is_default, active | UUID | |
| `programs` | id, studio_id, name, description, glofox_id, active | UUID | |
| `facilities` | id, studio_id, name, description, capacity, glofox_id, active | UUID | |
| `integrations` | id, studio_id, provider, status, config JSONB | UUID | |
| `appointments` | id, studio_id, member_id, trainer_id, title, start_time, end_time, status, price, glofox_id | UUID | |
| `membership_events` | id, studio_id, member_id, event_type, created_at | UUID | Used by revenue-anomaly AI |
| `campaign_replies` | id, studio_id, member_id, email_send_log_id, reply_text, ai_reply JSONB | UUID | Used by auto-reply AI |
| `staff` | id, studio_id, full_name, role, email | UUID | Legacy/parallel to profiles? |

### Phase 2 Tables (authoritative DDL in `scripts/phase2-migration.sql`)

| Table | Studio ID | RLS | Notes |
|---|---|---|---|
| `campaigns` | YES | YES | Denormalized metrics updated by Resend webhooks |
| `campaign_recipients` | YES | YES | Per-member send tracking with A/B variant |
| `automation_flows` | YES | YES | Steps stored as JSONB array |
| `automation_enrollments` | YES | YES | UNIQUE(automation_id, member_id) replaced by partial index for active-only |
| `leads` | YES | YES | UNIQUE(studio_id, email) |
| `lead_activities` | YES | YES | Append-only timeline |
| `content_posts` | YES | YES | Author can be NULL (anonymized on delete) |
| `content_comments` | YES | YES | |
| `content_likes` | YES | YES | UNIQUE(post_id, author_id) |
| `email_preferences` | YES | YES | UNIQUE(member_id, studio_id) |
| `automation_cooldowns` | YES | YES | Schema mismatch with helper code — see Findings |

### Glofox Sync Tables (DDL in `apps/web/src/lib/glofox/migration.sql`)

| Table | Studio ID | RLS | Notes |
|---|---|---|---|
| `glofox_sync_state` | YES | YES (role-based) | Uses `auth.uid()` pattern, not `app.studio_id` |
| `glofox_sync_conflicts` | YES | YES (role-based) | |

---

## 2. Relationship Mapping

```
studios
  ├── profiles (studio_id FK, 1:many — all members, staff, owners)
  │    └── members (profile_id FK, 1:1 — membership record)
  │         ├── bookings (member_id FK, 1:many)
  │         │    └── waitlist_entries (booking_id FK, optional)
  │         ├── credit_packs (member_id FK, 1:many)
  │         ├── transactions (member_id FK, 1:many)
  │         └── orders (member_id FK, 1:many)
  │              └── order_items (order_id FK)
  ├── classes (studio_id FK, 1:many)
  │    ├── class_types (class_type_id FK — lookup)
  │    ├── bookings (class_id FK, 1:many)
  │    └── trainer_bonuses (class_id FK)
  ├── trainers (profile_id FK → profiles, 1:1 per trainer profile)
  │    └── trainer_bonuses (trainer_id FK)
  ├── membership_plans (studio_id FK, 1:many)
  ├── company_accounts (studio_id FK, 1:many)
  │    └── company_members (company_id FK + member_id FK — M:N junction)
  ├── events (studio_id FK, 1:many)
  │    └── event_guests (event_id FK)
  ├── employees (studio_id FK, 1:many)
  │    ├── clock_entries (employee_id FK)
  │    └── payroll_line_items (employee_id FK)
  ├── payroll_periods (studio_id FK)
  │    └── payroll_line_items (payroll_period_id FK)
  ├── automation_flows (studio_id FK — Phase 2)
  │    └── automation_enrollments (automation_id FK)
  └── campaigns (studio_id FK — Phase 2)
       └── campaign_recipients (campaign_id FK)
```

**Notable relationship concerns:**

- `bookings.member_id` references `members.id` (not `profiles.id`). The Booking type definition confirms this. However, several API queries (e.g., `/api/bookings`) use `profiles!bookings_member_id_fkey` in the join hint, which only works if the FK on `bookings.member_id` points to `profiles.id`. This is a contradiction that may cause query failures depending on which schema is actually deployed.

- `staff` table (in SCHEMA_CONTEXT) appears to be a separate entity from `profiles` with role staff. Whether this is a legacy table or an active separate entity is unclear — no migration DDL exists for it.

- `memberships` table is joined in `/api/members/[id]/route.ts` (`.select("*, memberships(id, type, status, started_at, expires_at)")`) but does not appear anywhere else — no DDL, no type definition, no seed data. It may be an alternative name for `members` or a Supabase implicit view. If it does not exist, this API will fail silently on member detail pages.

- `appointments` table is listed in SCHEMA_CONTEXT but never referenced in any API route or type file — it appears to be schema scaffolding without application code.

---

## 3. Migration Analysis

### Migration File Inventory

| File | Phase | Applied How | Notes |
|---|---|---|---|
| `scripts/phase2-migration.sql` | Phase 2 | Manual / psql | Full DDL in BEGIN/COMMIT transaction |
| `scripts/phase2-rpc-functions.sql` | Phase 2 | Manual | Two GDPR functions, one lead scoring function |
| `scripts/audit-fixes-migration.sql` | Phase 1 patch | Manual | 3 bug fixes: leads.email_hash, booking capacity trigger, automation_enrollments partial index |
| `apps/web/src/lib/glofox/migration.sql` | Phase 1 | Manual | Glofox sync columns + 2 tables |
| `scripts/seed-members.sql` | Data import | Manual | 1,103 members |
| `scripts/classes_batch_1.sql` through `classes_chunk_6.sql` | Data import | Manual | 7 class import files |
| `scripts/seed-bookings-transactions.sql`, `v2`, `fixed` | Data import | Manual | 3 versions of booking/transaction seed (v2 and fixed supersede original) |
| No Phase 1 DDL file | Phase 1 | Unknown | Tables exist only in live Supabase |

### Critical Migration Issues

**No migration versioning or ordering system.** There is no Flyway, Liquibase, Prisma Migrate, or even a simple numbered prefix scheme. Files are named descriptively but have no guaranteed execution order. If migrations are re-run, there is no idempotency guarantee on Phase 1 tables (whose DDL does not exist in the repo).

**Three versions of the booking/transaction seed exist.** `seed-bookings-transactions.sql`, `seed-bookings-transactions-v2.sql`, and `seed-bookings-transactions-fixed.sql` are all present. It is unclear which version was actually applied to the production database, and running all three would result in duplicate data (the v1 and v2 lack ON CONFLICT DO NOTHING).

**`audit-fixes-migration.sql` references columns that may not exist.** The file adds `email_hash` to `leads` and drops a UNIQUE constraint on `automation_enrollments`, but the Phase 2 migration that creates those tables was presumably run first. Order dependency is implicit and untracked.

**Duplicate GDPR functions.** `delete_member_phase2_data` (in `phase2-migration.sql`) and `cleanup_phase2_member_data` (in `phase2-rpc-functions.sql`) both handle Phase 2 member deletion but with different logic: the migration version anonymizes content posts (author_id = NULL), while the RPC version reassigns them to a hardcoded placeholder UUID `00000000-0000-0000-0000-000000000000`. Only one should be canonical.

---

## 4. Data Validation Analysis

### Validation at the Database Level (Phase 2 tables — well-covered)

- `campaigns.status` — CHECK constraint on allowed values
- `automation_flows.trigger_type` — CHECK constraint
- `leads.score` — CHECK (score >= 0 AND score <= 100)
- `leads` — UNIQUE(studio_id, email)
- `email_preferences` — UNIQUE(member_id, studio_id)
- `content_likes` — UNIQUE(post_id, author_id)
- `booking_capacity` trigger (via audit-fixes-migration.sql) — DB-level enforcement

### Validation at the API Level

- `POST /api/bookings` — uses Zod (`bookingCreateSchema`): validates class_id and member_id as UUIDs
- `POST /api/corporate` — uses Zod (`corporateCreateSchema`)
- `POST /api/events` — uses Zod (`eventCreateSchema`)
- Most other POST routes: **manual field checks only** (if/else), not Zod schemas

### Validation Gaps

- `POST /api/classes` — validates required fields manually but does not validate capacity bounds, time format, or class_type ownership at the Zod layer
- `POST /api/members` — validates email format with a regex but no Zod schema; phone is accepted as any string with no normalization
- Phone numbers in `seed-members.sql` are stored in mixed formats: `'9739432222'`, `'850-591-0208'`, `'971-270-6310'` — no normalization applied at import or at API layer
- **No input validation on `starts_at`/`ends_at` range** for class creation (the API uses wrong column names anyway — see findings)
- `PUT /api/members/[id]` — no Zod schema, all fields accepted from body

---

## 5. Query Pattern Analysis

### N+1 Query Risks

**`/api/trainers/performance/route.ts` — confirmed N+1 pattern:**
The route fetches all trainers, then for each trainer individually fetches classes, then for each class fetches bookings and transactions. For a studio with 5 trainers × 50 classes per trainer = 505+ sequential queries per request.

**`/api/ai/health-score/route.ts` (batch endpoint) — potential N+1:**
Fetches all members (up to 50 via BATCH_LIMIT), then calls `buildHealthScoreInput()` for each member — 6 parallel Supabase queries per member. For 50 members this is 300 queries per request. These are run via `Promise.all` per member but still 300 total roundtrips.

**`cron-daily-metrics.ts` Inngest function:**
For each missing date, runs 6 sequential Supabase queries (bookings, classes, transactions, refunds, new members, churn). For a backfill scenario spanning 30 days, this is 180 queries. Acceptable for a cron job but worth noting.

### Missing Indexes

Based on query patterns observed in API routes and Inngest functions:

| Table | Column(s) Used in WHERE/JOIN | Index Status |
|---|---|---|
| `bookings` | `class_id, status` | Unknown — no Phase 1 DDL to verify |
| `bookings` | `member_id, studio_id` | Unknown |
| `bookings` | `checked_in_at` (range queries) | Unknown |
| `members` | `membership_status, studio_id` | Unknown |
| `members` | `stripe_customer_id` | Unknown — used in Stripe webhook handler |
| `classes` | `starts_at, studio_id` | Unknown — used in every schedule query |
| `transactions` | `member_id, studio_id, status` | Unknown |
| `profiles` | `email, studio_id` | Unknown — used in duplicate-check queries |
| `profiles` | `glofox_id, studio_id` | Defined in glofox migration (conditional index) |
| `activity_log` | `studio_id, created_at DESC` | Unknown |

Phase 2 tables have explicit indexes defined in the migration. Phase 1 tables have no documented indexes.

### Unbounded Queries

- `/api/ai/auto-reply/route.ts` queries `email_send_log` without a LIMIT — if the log grows large, this will return all rows
- The `SCHEMA_CONTEXT` AI search prompt says "Limit results to 50 rows" but the actual SQL is LLM-generated and not guaranteed to include a LIMIT. No server-side enforcement exists.
- `/api/analytics/summary/route.ts` queries `daily_metrics` with a date filter but no explicit LIMIT — likely fine in practice but unbounded by contract

### SQL Injection Risk

**`phase2-rpc-functions.sql` — `increment_campaign_metric` uses `format()` with `%I` for column name interpolation.** The `%I` format is identifier-safe (it quotes the identifier), so this is not technically SQL injection, but the `p_metric` argument is not validated against an allowlist of column names. A caller passing `'nonexistent_column'` would cause a runtime error rather than silent data corruption.

The `SCHEMA_CONTEXT` AI search generates raw SQL executed by `apps/web/src/lib/anthropic.ts`. The execution path uses parameterized queries via the PostgREST RPC mechanism, but the SQL string itself is LLM-generated and executed with `supabase.rpc('execute_query', ...)`. If this RPC function exists in Supabase and is accessible, it represents a potential injection surface. (No `execute_query` RPC definition was found in the repo — this may be dead code or handled by the AI search hook differently.)

---

## 6. State Management Analysis (Frontend)

### Pattern: 60-second polling via `useQuery` hook

All client-side data access goes through `apps/web/src/hooks/use-supabase.ts`. The hook builds Supabase queries directly from the browser client. This means:

- The browser client fetches data **directly from Supabase**, bypassing the Next.js API routes
- RLS is the only protection for browser-side reads
- `DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'` is hardcoded in the hook file

### Server State vs Client State

| Data | Where fetched | Cache duration |
|---|---|---|
| Members list | Direct Supabase (browser) | 60s polling |
| Classes/schedule | Direct Supabase (browser) | 60s polling |
| Activity log | Direct Supabase (browser) | 60s polling |
| Revenue metrics | Next.js API route | No caching |
| AI outputs | Next.js API route → `ai_cache` table | 24h per `cache_key` |
| Studio settings | Direct Supabase (browser) | No polling |

**State duplication concern:** The `campaign_recipients` table stores denormalized per-recipient metrics (sent_at, opened_at, clicked_at), and the `campaigns` table stores aggregate counts (open_count, click_count, etc.) updated by webhook. These two representations must stay in sync — currently maintained only by the Resend webhook handler, which has no retry/reconciliation mechanism if it misses an event.

### Auth Context

The `AuthProvider` (`contexts/auth-context.tsx`) stores the current user and profile in React context. The `profile.studio_id` is the source of truth for studio isolation in hook-based reads. However, the hooks currently use the hardcoded `DEFAULT_STUDIO_ID` constant rather than reading from auth context — making them single-tenant until MED-008 is resolved.

---

## 7. Data Flow Mapping

### Primary Write Path (Booking)

```
Member/Admin Browser
  → POST /api/bookings (Next.js route handler)
    → requireRole() → Supabase auth.getUser() + profile query
    → Supabase: classes SELECT (capacity check)
    → Supabase: bookings SELECT (duplicate check)  [potential race]
    → Supabase: bookings INSERT
    → Supabase: activity_log INSERT
    → Inngest: glofox/create-booking event (fire-and-forget)
      → Inngest function: Glofox API write-back (async)
      → Supabase: bookings UPDATE (glofox_write_status)
```

**Race condition note:** The audit-fixes-migration.sql adds a DB-level `enforce_booking_capacity` trigger for the race between count check and insert. However, the trigger and the API-level count check use different booking status sets — the trigger counts `('confirmed', 'checked_in')` while the API counts `in("status", ["confirmed", "checked_in"])`. These match, which is correct.

### Revenue Data Flow

```
Stripe event → POST /api/webhooks/stripe
  → members UPDATE (membership_status, stripe fields)
  → transactions INSERT
  → credit_packs INSERT (for credit pack purchases)
  → gift_cards INSERT (for gift card purchases)
  → ai_cache DELETE (invalidate AI cache for member)
  → activity_log INSERT
```

No retry mechanism exists for the Stripe webhook — if any DB write fails, partial data may be written without compensation.

### AI Briefing Flow

```
GET /api/ai/briefing
  → ai_cache SELECT (check for fresh cache)
  → if cache miss:
    → members, bookings, transactions SELECT (batch)
    → Anthropic API call (Claude)
    → ai_cache UPSERT
  → return cached or fresh result
```

---

## 8. RLS Policy Analysis

### Phase 2 Tables — RLS Coverage: Complete

All 11 Phase 2 tables have RLS enabled and a `FOR ALL` policy using `current_setting('app.studio_id')::uuid`. This is the preferred pattern for server-side routes that set the session variable before querying.

**Critical gap:** The `current_setting('app.studio_id')` pattern **requires the API layer to explicitly set this session variable** before any query. There is no evidence in the API route handlers that `SET app.studio_id = '...'` is called — the routes rely entirely on `.eq("studio_id", studioId)` application-level filters rather than the RLS `current_setting`. This means:

- If RLS is the only protection (e.g., a route accidentally omits the `.eq("studio_id")` filter), the Phase 2 RLS policies will **fail open** rather than fail safe — `current_setting('app.studio_id')` will return an error or empty string if not set, causing the policy check to fail and potentially blocking or exposing data depending on Postgres error handling mode.

**Recommendation:** Either (a) switch Phase 2 RLS policies to use `auth.uid()` → profile → studio_id lookup (same pattern as Glofox sync tables), or (b) ensure the Supabase client sets the session variable on every connection.

### Phase 1 Tables — RLS Coverage: Unknown

No DDL exists for Phase 1 tables, so RLS status cannot be verified from the codebase. The Glofox sync tables use a `SELECT studio_id FROM profiles WHERE id = auth.uid()` pattern — if Phase 1 tables use the same pattern, they are protected. If Phase 1 tables have no RLS, the application-level `.eq("studio_id", studioId)` filter is the only protection.

### Glofox Sync Tables — RLS Coverage: Present but Inconsistent

`glofox_sync_state` and `glofox_sync_conflicts` use `auth.uid()` → profile → studio_id patterns. The SELECT policy and the ALL policy are separate, which means both fire — the ALL policy is a superset of SELECT, creating redundant evaluation.

---

## Findings by Severity

### CRITICAL

**C-001: Classes table column name mismatch — writes to non-existent columns**

- **Location**: `apps/web/src/app/api/classes/route.ts`, `apps/web/src/app/api/classes/[id]/route.ts`
- **Issue**: The actual database column is `starts_at`/`ends_at` (confirmed by seed SQL in `scripts/classes_batch_1.sql`, Inngest `cron-daily-metrics.ts` using `.gte('starts_at', dayStart)`, and `SCHEMA_CONTEXT` in `lib/anthropic.ts`). The API route reads/writes `start_time`/`end_time`.
- **Impact**: `POST /api/classes` silently inserts rows with NULL `starts_at`/`ends_at`. `GET /api/classes` orders by `start_time` (non-existent), likely returning results in creation order rather than chronological order. Class creation from the admin dashboard is broken.
- **Fix**: Change all references in `classes/route.ts` and `classes/[id]/route.ts` from `start_time`/`end_time` to `starts_at`/`ends_at`.

**C-002: `automation_cooldowns` schema drift — cooldown system non-functional**

- **Location**: `scripts/phase2-migration.sql` (DDL) vs `apps/web/src/lib/inngest/helpers.ts` (queries)
- **Issue**: The migration creates `last_automation_email_at` and `last_automation_sms_at` columns. The `helpers.ts` file queries `channel` and `last_sent_at` columns and upserts with `onConflict: 'member_id,studio_id,channel'` — a three-column constraint that does not exist on the table as defined.
- **Impact**: Every call to `checkAutomationCooldown()` or `updateCooldown()` will error at runtime. The 24-hour automation email/SMS cooldown is completely non-functional.
- **Fix**: Decide which schema is correct and update the other. The `channel`+`last_sent_at` approach (helpers.ts) is more normalized. If that's the intent, update the migration to add a `channel` column and rename to `last_sent_at`, adding a UNIQUE(member_id, studio_id, channel) constraint.

**C-003: `bookings.member_id` FK ambiguity — join hints reference wrong parent**

- **Location**: `apps/web/src/app/api/bookings/route.ts` line 24
- **Issue**: The query uses `profiles!bookings_member_id_fkey` but `bookings.member_id` references `members.id` per the type definition and seed data (which resolves member IDs via `profiles` table). If the FK is on `members.id`, the join hint name is wrong.
- **Impact**: The join `profiles!bookings_member_id_fkey(id, full_name, email)` may silently return null for every booking, breaking the bookings list display.
- **Fix**: Verify the actual FK definition in Supabase. If `bookings.member_id → members.id`, the join must go through members first: `members!inner(profile_id, profiles!inner(id, full_name, email))`.

---

### HIGH

**H-001: 218 hardcoded sentinel studio IDs — single-tenancy embedded in code**

- **Location**: 179 files across `apps/web/src/`
- **Issue**: `'11111111-1111-1111-1111-111111111111'` is hardcoded as a fallback in API routes, Inngest functions, and client-side hooks. The `getStudioId()` utility (tracked as MED-008) was created to fix this but has not been applied. At least one file (`apps/web/src/app/api/ai/health-score/route.ts`) declares `const STUDIO_ID = "11111111-1111-1111-1111-111111111111"` as a module-level constant, completely bypassing `requireRole`.
- **Impact**: Any second studio onboarded to Meridian will have their AI health-score calculations run against The Sauna Guys' data.
- **Fix**: Apply `getStudioId(profile)` everywhere. The health-score route must be refactored to use `requireRole` and pull studio_id from the authenticated profile.

**H-002: No Phase 1 DDL file — schema exists only in live Supabase**

- **Location**: `scripts/` directory (no Phase 1 migration file)
- **Issue**: The canonical table definitions for ~40 Phase 1 tables are not in source control. There is no way to reproduce the schema from the codebase alone.
- **Impact**: No disaster recovery path. No ability to set up a staging environment. No schema review process. Any change to Phase 1 tables is invisible in version history.
- **Fix**: Run `pg_dump --schema-only` against Supabase and commit the output as `scripts/phase1-schema.sql`. Add to repo ASAP.

**H-003: Phase 2 RLS uses `current_setting('app.studio_id')` but session variable is never set**

- **Location**: `scripts/phase2-migration.sql` (all 11 RLS policies)
- **Issue**: The `current_setting('app.studio_id')::uuid` RLS mechanism requires the API layer to call `SET app.studio_id = '...'` on the connection before queries. None of the server client wrappers in `lib/supabase/` do this.
- **Impact**: Phase 2 RLS policies rely on an unset session variable. Depending on Postgres configuration, this either raises an exception on every query to Phase 2 tables, or returns no rows (policy evaluates to false). Either way, Phase 2 API routes (campaigns, automations, leads, content) will fail or return empty results.
- **Fix**: Either update `lib/supabase/server.ts` to set `app.studio_id` after authentication, or migrate Phase 2 RLS policies to use `auth.uid()` lookups matching the Phase 1 pattern.

**H-004: `memberships` table join in member detail route — likely broken**

- **Location**: `apps/web/src/app/api/members/[id]/route.ts` line 49
- **Issue**: `.select("*, memberships(id, type, status, started_at, expires_at)")` references a `memberships` table. This table is not defined in any SQL file, type definition, or seed data. The actual membership data lives in the `members` table with columns like `membership_tier`, `membership_status`.
- **Impact**: Member detail page may load without membership information, or throw an error depending on how Supabase handles unknown relation references.
- **Fix**: Replace `memberships(...)` join with the actual `members` record data, or verify if a `memberships` view/table was created manually in Supabase.

**H-005: Three versions of the booking/transaction seed with no clear canonical version**

- **Location**: `scripts/seed-bookings-transactions.sql`, `seed-bookings-transactions-v2.sql`, `seed-bookings-transactions-fixed.sql`
- **Issue**: Three files importing overlapping booking and transaction data. No documentation on which was applied.
- **Impact**: If all three were run, the database has duplicate bookings for the imported period. Analytics (daily_metrics, trainer performance) are inflated.
- **Fix**: Document which version was applied and delete the others. Add a comment block at the top of the canonical file.

---

### MEDIUM

**M-001: Duplicate GDPR member deletion functions with different behavior**

- **Location**: `scripts/phase2-migration.sql` (`delete_member_phase2_data`) and `scripts/phase2-rpc-functions.sql` (`cleanup_phase2_member_data`)
- **Issue**: Two functions for the same purpose with different content post handling: one sets `author_id = NULL`, the other sets `author_id = '00000000-0000-0000-0000-000000000000'` (a magic UUID). Neither is documented as the one called by the API.
- **Fix**: Delete one, document the other as canonical, and ensure the API route calls it by name.

**M-002: `booked_at` column written but not in type definitions or seed data**

- **Location**: `apps/web/src/app/api/bookings/route.ts` line 113, `apps/web/src/app/api/cron/waitlist-promote/route.ts` line 190
- **Issue**: Both routes set `booked_at: new Date().toISOString()` when inserting bookings. The `Booking` type definition uses `created_at` for timestamp tracking. No seed SQL includes `booked_at`. Either this column does not exist (silent failure) or it exists undocumented.
- **Fix**: Verify if `booked_at` exists in Supabase. If not, remove from inserts. If yes, add to the Booking type definition and document it.

**M-003: `increment_campaign_metric` RPC uses dynamic column name without allowlist**

- **Location**: `scripts/phase2-rpc-functions.sql` lines 7-21
- **Issue**: The function uses `format('UPDATE campaigns SET %I = ...', p_metric)` where `p_metric` is caller-supplied. While `%I` prevents injection, any string (including valid-but-wrong column names) is accepted.
- **Fix**: Add a CASE statement or explicit allowlist check: `IF p_metric NOT IN ('sent_count', 'delivered_count', 'open_count', 'click_count', 'bounce_count', 'unsubscribe_count', 'conversion_count') THEN RAISE EXCEPTION 'Invalid metric'; END IF;`

**M-004: `@meridian/supabase` package is entirely unused**

- **Location**: `packages/supabase/`
- **Issue**: The package was created for shared Supabase client creation but has 0 imports from the web app. The app uses its own `lib/supabase/` implementations.
- **Impact**: Dead code. Any developer who discovers the package may incorrectly try to use it, creating a third client instantiation pattern.
- **Fix**: Either remove the package or update `lib/supabase/` to re-export from `@meridian/supabase`.

**M-005: `trainers` table has `bonus_threshold` column used in queries but not in type definitions**

- **Location**: `apps/web/src/app/api/trainers/[id]/performance/summary/route.ts` line 62, `packages/types/src/trainers.ts` (no TrainerRecord type)
- **Issue**: The query selects `bonus_threshold` from trainers but the `trainers` table schema is only described in `SCHEMA_CONTEXT` without `bonus_threshold`. The Trainer type is not defined in `packages/types/src/trainers.ts`.
- **Fix**: Add the trainers table definition to `packages/types/src/trainers.ts` and verify `bonus_threshold` exists in the schema.

**M-006: Phase 1 tables have no documented indexes on frequently queried columns**

- **Location**: `scripts/` (no Phase 1 DDL)
- **Issue**: Every query on `bookings`, `classes`, `members`, and `transactions` filters by `studio_id` + one or more columns. Without composite indexes, these queries degrade to full table scans as data grows. The 1,393-booking, 2,015-transaction import is small but will grow.
- **Fix**: At minimum, create indexes on: `bookings(studio_id, class_id)`, `bookings(studio_id, member_id)`, `bookings(studio_id, status, created_at)`, `classes(studio_id, starts_at)`, `members(studio_id, membership_status)`, `transactions(studio_id, status, created_at)`, `profiles(studio_id, email)`.

**M-007: `content_posts.author_id` allows NULL without DB constraint but code assumes NOT NULL**

- **Location**: `scripts/phase2-migration.sql` line 256, `scripts/phase2-rpc-functions.sql` line 53
- **Issue**: The GDPR function sets `author_id = '00000000-0000-0000-0000-000000000000'` (a non-existent profile UUID) rather than NULL, but the original migration defined `author_id UUID NOT NULL REFERENCES profiles(id)`. Setting to a placeholder UUID that likely doesn't exist in `profiles` will violate the FK constraint.
- **Fix**: Either create a `deleted-user` placeholder profile in `profiles` with that UUID, or change the FK to allow NULL and use NULL for anonymized authors.

---

### LOW

**L-001: Phone numbers stored in inconsistent formats**

- **Location**: `scripts/seed-members.sql`
- **Issue**: Phone values include `'9739432222'` (10-digit), `'850-591-0208'` (dashes), `'971-270-6310'` (dashes with different format). No normalization at import or API layer.
- **Impact**: Phone-based deduplication and SMS targeting will miss duplicates stored in different formats.
- **Fix**: Normalize to E.164 format (`+1XXXXXXXXXX`) at API layer on write.

**L-002: `AppointmentTypeAPI` table in SCHEMA_CONTEXT not referenced anywhere else**

- **Location**: `lib/anthropic.ts` SCHEMA_CONTEXT: `appointments` table
- **Issue**: The `appointments` table is listed in the AI search schema but has no API routes, no type definitions, and no Inngest functions referencing it.
- **Impact**: Either a planned table with no application code yet, or a stale entry in SCHEMA_CONTEXT. If stale, AI-generated SQL may attempt to query it and fail.

**L-003: `staff` table in SCHEMA_CONTEXT is potentially redundant with `profiles`**

- **Location**: `lib/anthropic.ts` SCHEMA_CONTEXT
- **Issue**: `staff (id uuid, full_name text, role text, email text, studio_id uuid)` is listed as a separate table. The application manages staff through `profiles` with a `roles` array. No API route queries the `staff` table directly.
- **Impact**: AI search may generate incorrect SQL targeting `staff` instead of `profiles` for staff-related queries.

**L-004: `lead_activities.activity_type` CHECK values mismatch TypeScript `LeadActivityType`**

- **Location**: `scripts/phase2-migration.sql` vs `packages/types/src/marketing.ts`
- **Issue**: The DB CHECK allows `'created'`, `'status_change'`, `'note_added'`, `'email_sent'`, etc. The TypeScript type defines `'page_view'`, `'form_submit'`, `'email_opened'`, `'email_clicked'`, `'status_changed'`, etc. Overlap is partial.
- **Impact**: TypeScript type values like `'page_view'` and `'form_submit'` cannot be inserted without violating the DB constraint. DB allowed values like `'trial_booked'` are not in the TypeScript union.

**L-005: `AutomationCooldown` TypeScript type has `automation_id` column but DB table does not**

- **Location**: `packages/types/src/marketing.ts` `AutomationCooldown` vs `scripts/phase2-migration.sql` `automation_cooldowns`
- **Issue**: The TypeScript type includes `automation_id: string` but the DB table has no `automation_id` column — it's a global per-member-per-channel cooldown, not per-automation.
- **Impact**: Any code constructing an `AutomationCooldown` object with `automation_id` will produce data that cannot be stored as typed.

**L-006: `Campaign` TypeScript type has fields not in DB DDL**

- **Location**: `packages/types/src/marketing.ts` vs `scripts/phase2-migration.sql`
- **Issue**: The TypeScript `Campaign` type includes `unique_open_count`, `unique_click_count`, `spam_report_count`, `sent_count` (as separate field). The DB DDL has `open_count`, `click_count`, `bounce_count` but not the `unique_` variants or `spam_report_count`. Conversely, the DB has `sent_count` not in the type.
- **Impact**: Queries selecting these TypeScript-typed fields will return undefined for missing columns. Writes to these fields will silently fail.

---

## Diagram

See `.audit/diagrams/data-model.mmd` for the entity-relationship diagram.

---

## Summary Table

| Severity | Count | Items |
|---|---|---|
| Critical | 3 | C-001 (classes column mismatch), C-002 (cooldown schema drift), C-003 (bookings FK ambiguity) |
| High | 5 | H-001 (218 hardcoded IDs), H-002 (no Phase 1 DDL), H-003 (RLS session var), H-004 (memberships join), H-005 (duplicate seed files) |
| Medium | 7 | M-001 through M-007 |
| Low | 6 | L-001 through L-006 |
| **Total** | **21** | |

---

## Remediation Priority

1. **C-001** — Fix `start_time` → `starts_at` in classes API routes. This is a live data write bug.
2. **C-002** — Reconcile `automation_cooldowns` schema. Choose `channel`+`last_sent_at` or the two-column approach, update whichever is wrong.
3. **H-003** — Fix Phase 2 RLS: either set `app.studio_id` in server client or rewrite policies to use `auth.uid()` lookups.
4. **H-002** — Extract Phase 1 schema DDL from Supabase and commit to `scripts/phase1-schema.sql`.
5. **C-003** — Verify `bookings.member_id` FK target and fix the join hint.
6. **H-001** — Apply `getStudioId(profile)` across all 179 files via codemod or systematic search-replace. Target MED-008.
7. **H-004** — Fix or remove the `memberships` join in the member detail route.
8. **M-006** — Add Phase 1 indexes for the six most-queried column combinations.
