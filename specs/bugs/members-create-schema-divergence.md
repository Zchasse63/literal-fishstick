# BUG-010 — Members Create schema divergence (POST /api/members broken)

**Filed:** 2026-04-09
**Severity:** Critical — admin Add Member flow completely broken, mirrors BUG-009 (products)
**Discovered during:** Tier 3.5 (Members: Create Member) Analyst phase
**Updated:** 2026-04-09 — Layer 5 (profiles RLS) discovered during Sentinel phase; spec now documents 5 layers, not 4
**Affected files:**
- `apps/web/src/app/api/members/route.ts` (POST handler)
- `apps/web/src/app/(admin)/members/_components/AddMemberModal.tsx` (calls broken route)
- `apps/web/src/app/(admin)/members/page.tsx` (list query — won't show new rows even if POST succeeded)

---

## Summary

The admin "Add Member" modal is wired to `POST /api/members`, which is broken at **four independent layers**. Not one of them is caught by TypeScript or surfaces in user-visible ways — the modal appears to load successfully, but the database insert fails, and there is no mechanism in the modal or the API route that would make the failure visible to the end user's eye until they refresh the page and notice the new member is missing.

Production evidence: 17 profile-only rows exist in `profiles` without a matching `members` row, but **all 17 are `{trainer}` or `{owner}` profiles** — none of them are `{member}` role. This is consistent with the modal having never successfully produced a member record in production. (Same failure signature as BUG-009: `products` table had 0 rows because every write path was broken.)

---

## The five layers

### Layer 0 (discovered during Sentinel) — Missing RLS INSERT policy on `profiles`

The `profiles` table has RLS enabled but only two policies: `profiles_read` (SELECT) and `profiles_update_own` (UPDATE). There is no INSERT policy, which means every client-session insert is denied by RLS with the error:

```
new row violates row-level security policy for table "profiles"
```

This layer was invisible to the Analyst probe because Supabase MCP `execute_sql` runs as superuser, which bypasses RLS. The first insert probe surfaced the phantom `status` column error (Layer 1) before it would have reached the RLS check. Only during the Sentinel-phase test run (which uses the admin session cookie and hits the real auth.uid()) did the RLS error surface.

Every other writable table in the codebase (`members`, `products`, `transactions`, `activity_log`) has a matching `INSERT` policy of the form `WITH CHECK (studio_id = get_user_studio_id())`. Profiles is the only outlier. Fix: add `profiles_write` policy matching the same pattern. Application-layer `requireRole(['owner','manager'])` enforces the authorization; RLS enforces the studio scope.

### Layer 1 — Phantom `status` column in `profiles` insert

`POST /api/members` at `route.ts:96` inserts into `profiles` with `status: "active"`. The `profiles` table has no `status` column. Direct probe via Supabase MCP:

```sql
INSERT INTO profiles(studio_id, email, full_name, phone, roles, status)
VALUES ('11111111-...', 'probe@test', 'Probe', null, '{member}', 'active');
-- ERROR: 42703: column "status" of relation "profiles" does not exist
```

The closest real columns are `is_active` (boolean, NOT NULL, default true) and `exclude_from_analytics`. The modal probably wants `is_active` or can drop the field entirely (the default is `true`).

### Layer 2 — Missing `members` table row

The admin `/members` list at `page.tsx:200` reads from the `members` table and joins `profiles` on `profile_id`. The POST handler only inserts into `profiles`. Consequence: a newly-added profile would not appear in the list, even if Layer 1 were fixed.

The `members` table has these NOT NULL columns without defaults that must be populated: `profile_id`, `studio_id`. Plus several with safe defaults: `membership_status='active'`, `credits_remaining=0`, `wallet_balance=0`, `join_date=CURRENT_DATE`, `total_visits=0`, `lifetime_value=0`, `strike_count=0`, `strike_penalty_exempt=false`, `waiver_signed=false`. The minimum viable insert is `{ profile_id, studio_id }`; everything else takes defaults.

### Layer 3 — Invalid `activity_log.type` value

`POST /api/members` at `route.ts:106` logs activity with `type: "member_created"`. The `activity_log.type` CHECK constraint allows 15 values; `member_created` is not one of them. The closest legal value is `new_member`. Either:
- Use `new_member` (legacy naming, already in the constraint)
- Extend the constraint to include `member_created` / `member_updated` / `member_deleted` (consistent with the Tier 3.4 products pattern)

Recommendation: extend. The codebase is moving toward `{subject}_{action}` naming (`product_created`, `product_updated`, `product_deleted` were added in BUG-009 Part A) and `new_member` is the only legacy holdout. Extending keeps the convention coherent.

### Layer 4 — Missing `activity_log.description` (NOT NULL)

`activity_log.description` is `NOT NULL` with no default. The POST handler's activity_log insert omits `description`, so the insert fails with a NOT NULL violation. The Supabase JS client does not throw on insert errors, so the failure is silent.

This is the same failure mode the Tier 3.4 products routes had — it is worth adding a lint rule or code-review checklist item: **every `activity_log` insert MUST pass `description`**.

---

## Reproduction

1. Seed the default studio with an admin user
2. Navigate to `/members`
3. Click "Add Member"
4. Fill in name/email/phone, submit
5. **Observed:** Modal shows an error (`column "status" does not exist` or a 500 error) — but only if you look at the DevTools Network panel. The `addError` state shows a generic "Something went wrong" unless the backend surfaces a useful message.
6. **Expected:** New member appears in the list table, activity_log shows a `member_created` (or `new_member`) row.

## Fix plan (handoff to Tier 3.5 Architect)

Single PR, inline fix, following the BUG-009 council-run pattern:

1. **Remove phantom `status` field** from the `profiles` insert in `route.ts`. Leave `is_active` to its default (`true`). If the UI wants to set an initial state, add a real boolean toggle.

2. **Also insert a `members` row** after the `profiles` insert succeeds. Minimum viable: `{ profile_id: profile.id, studio_id }`. Wrap in a try/catch and roll back the profile if the member insert fails.

3. **Extend `activity_log.type` CHECK constraint** to add `member_created`, `member_updated`, `member_deleted` (mirroring the product pattern). Keep `new_member` for legacy compatibility — do not rename.

4. **Add `description` to the activity_log insert** — `description: \`Member created: ${full_name}\``. Same pattern as the Tier 3.4 fix.

5. **[Optional, stretch]** Add a lint rule or test guard that checks every `activity_log.insert` call in the API surface includes a `description` field.

---

## Related

- **BUG-006** (Tier 3.1) — `RecordPaymentModal` FK mismatch, same "phantom columns, silent insert failures" pattern, discovered during the first Tier 3 council run
- **BUG-009** (Tier 3.4) — products schema divergence, 6-layer bug with the same `description` NOT NULL silent failure as layer 4 here
- **BUG-007** (Tier 3.1) — auth.setup.ts hardcoded wrong studio_id; not directly related but relevant context for Tier 3 runs

## Detection strategy going forward

The common theme across BUG-006, BUG-009, and BUG-010 is: **a feature's write path works at the TypeScript level but fails at the DB level, and the failure is never surfaced to the user**. Every future Tier 3 council run MUST:

1. Run `information_schema.columns` against every table the feature writes to, compare with the insert payload field-by-field
2. Run `pg_constraint` against every CHECK constraint on NOT NULL text columns, compare with the literal values the code writes
3. Assert activity_log rows exist for every write flow, keyed by `subject_type` + `subject_id`

Without step 3 specifically, BUG-009 layer 6 and BUG-010 layer 4 would never have been caught.
