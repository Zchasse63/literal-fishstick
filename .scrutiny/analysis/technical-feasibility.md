# Technical Feasibility Analysis

**Agent:** technical-feasibility
**Plan:** Unified Member Data Architecture
**Complexity:** SIGNIFICANT
**Date:** 2026-04-04

---

## Agent Verdict

**MODIFY** — The plan is technically sound at its core but contains implementation traps that will cause real failures if not addressed. The fundamental approach fits cleanly into the existing architecture. Three specific issues need redesign: the member_360 VIEW performance model, the cron-based computed field update strategy, and the underspecified Phase B "mass pull" scope.

---

## Feasibility Assessment

### What Is Technically Correct

**Backfilling members.total_visits and members.last_visit**

This is straightforward. The data exists in `bookings` (5,427 rows with member_id UUIDs and checked_in_at). A single SQL UPDATE resolves both fields in one pass. This is the highest-priority fix in the entire plan — it unblocks milestone and inactivity automation triggers immediately with no code changes.

**acquisition_source backfill**

The `profiles.acquisition_source` column already exists (phase2-migration.sql applied it). The ClassPass detection pattern (lead_source='U' + phone='+10000000000') is specific enough to have a low false positive rate — '+10000000000' is a synthetic Glofox placeholder, not a real number. Feasible as a one-time migration UPDATE.

**glofox_plan_map table**

Creating a lookup table for plan codes is straightforward. getMemberships() already exists in GlofoxClient and is used in the backfill. membership_plans already stores glofox_id. This is a simple enrichment layer with no architectural friction.

**New automation trigger types**

The existing switch-statement pattern in evaluate-triggers.ts is extensible. All 6 proposed triggers (never_booked, classpass_repeat, one_and_done, cooling_off, plan_upgrade_candidate, class_type_fan) are expressible as SQL queries against existing tables. No structural changes to evaluate-triggers.ts required.

**Transactions backfill**

The Analytics/report endpoint, transformTransaction(), and batchUpsert() pattern already exist in glofox-backfill.ts (step 5). The transactions table schema is defined. This is partially implemented — the function exists but may never have been triggered against production data. Running the existing backfill function handles this.

---

### Technical Issues

**Issue 1: member_360 as a VIEW with aggregation is the wrong data structure**

A PostgreSQL VIEW with LATERAL joins aggregating across profiles, members, bookings, classes, and membership_plans will execute the full aggregation on every query. Even at current scale (1,199 members, 5,427 bookings), every campaign builder segment query will scan the bookings table. Supabase does not support auto-refreshing materialized views.

The correct approach: computed fields (total_visits, last_visit, engagement_status, behavior_segment) belong as real columns on the `members` table, kept current by the enrichment cron. The member_360 VIEW should be a thin JOIN surface across pre-computed columns — not an aggregation layer. This changes the VIEW from a performance liability to a convenience layer.

**Issue 2: Daily cron for computed fields creates correctness lag for automation triggers**

evaluate-triggers.ts runs every 10 minutes. If total_visits is updated once per day via cron, milestone triggers will miss visits that occurred in the last 0–23 hours. A member hitting their 10th visit at 10am won't trigger the milestone email until the next morning.

The fix: increment members.total_visits and update members.last_visit at check-in time (where bookings.checked_in_at is written). The daily cron becomes a reconciliation/catch-all, not the primary update path.

**Issue 3: Phase B "mass pull" scope is underspecified**

The plan mentions pulling "activity/history" and "subscriptions." GlofoxClient has no getActivity() or getSubscriptions() methods. "Activity" likely refers to getInteractions(userId) — a per-member endpoint requiring 1,199 individual API calls (N+1 problem identical to credit_packs). "Subscriptions" is ambiguous — possibly getMemberships() (already done) or per-member membership details. This needs explicit endpoint mapping before Phase B begins or it will block during implementation.

**Issue 4: member_360 RLS behavior with Supabase**

Views in Supabase with RLS have subtle behavior. The member_360 VIEW accessing multiple tables will inherit the RLS of underlying tables when queried by the UI (anon/service key). Since Inngest uses the service-role client (bypasses RLS), but the UI may query member_360 directly, the VIEW definition must document which security context it operates in. This is not a blocker but needs explicit attention in the migration.

---

## Dependency Order (Corrected)

1. Run backfill SQL (total_visits, last_visit, acquisition_source, engagement_status) — unblocks automation triggers immediately. Pure SQL, no code changes.
2. Run existing transactions backfill (trigger glofox/backfill or step 5 in isolation) — fills transactions table, unblocks failed_payment trigger.
3. Create glofox_plan_map + populate — standalone migration + one Inngest call.
4. Add check-in handler to increment total_visits/last_visit in real time.
5. Create member_360 VIEW (thin JOIN over pre-computed columns, no aggregation).
6. Add new automation trigger types — after data is populated.
7. UI integration — after data layers are stable.

Steps 1–2 are independently deployable today with no dependencies on each other.

---

## Verdict Confidence: HIGH
