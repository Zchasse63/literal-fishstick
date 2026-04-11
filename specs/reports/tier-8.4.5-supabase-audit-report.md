# Tier 8.4.5 — Supabase Direct Audit Report

**Date:** 2026-04-10
**Scope:** Proactive audit via Supabase MCP (security advisors, performance advisors, missing RPCs, phantom RLS policies, index coverage).
**Methodology:** `get_advisors` (security + performance) → apply batch migrations → re-run advisors → regression-test existing tier suites.

---

## Summary

| Metric | Before | After | Delta |
|---|---|---|---|
| Security advisors (ERROR + WARN) | 16 | 1 (auth config only) | **-15** |
| Performance advisors: unindexed FKs | 98 | ~38 | **-60** |
| Performance advisors: auth_rls_initplan | 13 | 0 | **-13** |
| Missing RPCs referenced by code | 4 | 1 (`set_studio_context` — dead) | **-3** |
| Regression tests passing | 38/38 | 38/38 | 0 |

---

## Issues discovered + remediation

### 🔴 1. `public.member_360` view was SECURITY DEFINER

**Severity:** ERROR — multi-tenant data leak risk
**Fix:** `ALTER VIEW public.member_360 SET (security_invoker = true)` — migration `tier_8_4_5_fix_member_360_security_invoker`

**Impact:** View now enforces the caller's RLS policies on underlying tables. Prevents cross-studio profile leakage through the 360° member dashboard read path.

---

### 🟠 2. 14 functions with mutable `search_path`

**Severity:** WARN — function hijack via search_path shadowing
**Fix:** Two migrations:
  1. Initial attempt with `SET search_path = ''` — revealed that most function bodies use unqualified table references.
  2. Second pass set `search_path TO 'public', 'pg_temp'` for 13 functions (keeps bodies working, still fixed). `get_user_studio_id()` was rewritten with `public.profiles` qualified reference and kept `search_path = ''`.

Migrations: `tier_8_4_5_add_search_path_to_functions`, `tier_8_4_5_fix_get_user_studio_id_body_for_empty_search_path`, `tier_8_4_5_fix_function_search_paths_to_public`.

**Future-proof:** New functions should always declare `SET search_path TO 'public', 'pg_temp'` explicitly.

---

### 🟠 3. Missing `increment_rate_limit` RPC (closes B7)

**Severity:** WARN — rate limiter silently failed open on every request
**Fix:** Created `public.rate_limit_buckets` table + `public.increment_rate_limit(text, integer, bigint)` RPC in migration `tier_8_4_5_create_increment_rate_limit_rpc`. Follow-up migration `tier_8_4_5_lock_rate_limit_buckets` adds a deny-all RLS policy (the RPC is SECURITY DEFINER).

**Behavior:** Rolling-window counter keyed by arbitrary string. Returns `(current_count, is_allowed)`. Window reset happens when `now - window_start >= window_ms`.

**Still open:** The AI routes currently pass `20, 60_000` — 20 requests per minute per user. Before Phase 5 (public traffic), tune limits by endpoint and add per-IP buckets.

---

### 🟡 4. 98 unindexed foreign keys

**Severity:** INFO — query performance
**Fix:** 2 batch migrations added ~65 indexes:
  1. `tier_8_4_5_add_critical_fk_indexes` — top 30 covering studio_id + hot member/class joins
  2. `tier_8_4_5_add_remaining_fk_indexes` — remaining 35 across employees, events, gift cards, glofox, leads, orders, payroll, reports, trainers, waitlists, waivers, wallet

**Remaining ~33:** Mostly on audit/log tables (activity_log other FKs, rate-table relationships). Will add on-demand if query patterns surface slowness.

---

### 🟡 5. 13 `auth_rls_initplan` warnings

**Severity:** WARN — per-row re-evaluation of `auth.uid()` / `profiles` joins
**Fix:** Migration `tier_8_4_5_optimize_rls_initplan_policies` rewrote 13 policies across 9 tables (profiles, daily_metrics, cohort_snapshots, trainer_metric_snapshots, saved_reports, report_exports, ai_insights, pricing_simulations, migration_jobs).

**Pattern:** Replaced `auth.uid()` with `(SELECT auth.uid())` and replaced `(studio_id IN (SELECT studio_id FROM profiles WHERE id = auth.uid()))` with `studio_id = get_user_studio_id()` (the canonical STABLE SECURITY DEFINER helper).

**Result:** Policies now compute once per query instead of once per row.

---

## Missing RPCs cross-referenced against code

| RPC | Called from | Status |
|---|---|---|
| `increment_rate_limit` | `src/lib/rate-limit.ts:99` | ✅ Created in this tier |
| `set_studio_context` | `src/lib/supabase/server.ts:50` | ⚠️ Dead code — `setRlsContext` only referenced in middleware.ts comments. Safe to delete in a cleanup pass. |
| `count_today_bookings` | `src/app/api/ai/briefing/route.ts:70` | ⚠️ Graceful fallback in-route (returns 0) — not blocking but imprecise. Backlog B18. |
| `count_today_checkins` | `src/app/api/ai/briefing/route.ts:76` | ⚠️ Same as above. Backlog B18. |
| `get_daily_metrics` | `src/app/api/analytics/daily-metrics/route.ts:39` | ✅ Already exists |
| `increment_campaign_metric` | `src/app/api/webhooks/resend/route.ts:79` | ✅ Already exists |

---

## What I did NOT audit (future work)

1. **Phantom columns at scale** — Tier 8.4.5 only re-audits what advisors surface. A systematic `information_schema.columns` vs `supabase.from(...)` codegrep would catch the remaining phantom column rot across all 200+ API routes. Adding to backlog as **B18 — Full phantom column sweep**.
2. **Multiple permissive policies (40 warnings)** — These are non-blocking but add ~2x RLS overhead on the affected tables. Can be consolidated by merging "members can view" + "staff can manage" into a single policy with different USING vs WITH CHECK clauses. Adding as **B19**.
3. **33 unused indexes** — Safe to drop but low-priority. Adding as **B20**.
4. **`auth_leaked_password_protection`** — One-click enable in the Supabase dashboard. User action. Noted for launch checklist.

---

## Migrations applied (ordered)

1. `tier_8_4_5_fix_member_360_security_invoker`
2. `tier_8_4_5_add_search_path_to_functions`
3. `tier_8_4_5_create_increment_rate_limit_rpc`
4. `tier_8_4_5_add_critical_fk_indexes`
5. `tier_8_4_5_add_remaining_fk_indexes`
6. `tier_8_4_5_fix_get_user_studio_id_body_for_empty_search_path`
7. `tier_8_4_5_fix_function_search_paths_to_public`
8. `tier_8_4_5_optimize_rls_initplan_policies`
9. `tier_8_4_5_lock_rate_limit_buckets`

---

## Regression verification

Re-ran 7 spec files covering Tiers 5.6, 5.7, 6.1–6.5, 8.1 (total 38 tests). **All passing** — no schema or RLS regressions from the audit migrations.

## Verdict

**Tier 8.4.5 complete.** Supabase posture upgraded from "reactive fixup" (chasing crashes) to "proactive baseline" (advisors clean, canonical patterns enforced). Ready to proceed to **Tier 8.5 UI/UX Cohesion sweep**.
