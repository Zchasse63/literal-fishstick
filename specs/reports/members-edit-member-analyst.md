# QA Council — Members: Edit Member (Tier 3.6) — ANALYST

**Pipeline ID:** `members-edit-member`
**Tier:** 3.6 (Core Writes — 6 of 12)
**Project:** `admin`
**Phase:** 1 — Analyst
**Date:** 2026-04-09
**Status:** ✅ Scope decision: BUILD INLINE (not gap-file). 6-layer bug stack documented. Hand-off to Architect.

---

## Scope decision (up front)

BUG-008 listed Tier 3.6 as one of the seven "fully testable" tiers. **Direct code inspection contradicts that classification.** No edit UI exists anywhere in `/members/*`:

- `MemberProfilePanel.tsx` has Pause / Upgrade / Archive buttons but **no Edit**.
- `MemberProfileClient.tsx` (the `/members/[id]` detail route) is read-only — `useState(initialMember)` is never updated, and the only `PUT` call on the route is to `/api/email-preferences/[id]`, which is unrelated.
- The generic `PUT /api/members/[id]` endpoint exists but is **broken at 6 layers** and is not called from any UI today.

The three options on the table for handling the gap:

| Option | Description | Verdict |
|---|---|---|
| (a) Gap-file like 3.2/3.3 | Document missing UI, defer until built outside the council | ❌ Leaves 6-layer write bug unpatched indefinitely; Edit Member is the most basic admin CRUD op and admins NEED it |
| (b) **Build inline** (BUG-009 / BUG-010 pattern) | Create `EditMemberModal`, add Edit button, fix the 6 layers, write tests | ✅ Aligns with the standing directive ("Work through all tiers until 100% complete"), matches the Tier 3.5 pattern (which built `AddMemberModal` from scratch + fixed 5 layers), keeps the council loop closed |
| (c) API-only test plan | Hit `PUT /api/members/[id]` directly with `page.request.put(...)` | ⚠️ Catches the 6 layers but leaves the UI gap. Half-measure. |

**Decision: (b) — Build inline.** The new modal is small (4 fields, ~150 lines), mirrors `AddMemberModal` almost exactly, and the 6 layer fixes are isolated to one route file + one new RLS policy migration.

This run will be filed as a **full pipeline** (not gap-filed).

---

## Feature summary

Admin opens a member's profile panel (or detail page), clicks an Edit pencil icon, and a modal appears pre-filled with the member's `full_name`, `email`, `phone`, and `notes`. Admin makes changes, hits Save. The modal validates required fields, calls `PUT /api/members/[id]`, closes on success, and the profile panel refreshes with the new values.

**Field set (4 fields):**

| Field | Required | Lives on table |
|---|---|---|
| `full_name` | ✅ | `profiles` |
| `email` | ✅ (with format check) | `profiles` |
| `phone` | optional | `profiles` |
| `notes` | optional | `members` ⚠️ NOT profiles |

**Excluded fields (handled by other routes):**
- `membership_tier` → `/api/members/[id]/upgrade` (MemberUpgradeModal)
- `membership_status` → `/api/members/[id]/pause` (MemberPauseModal)
- `credits_remaining` → managed by booking flow + upgrade modal
- `exclude_from_analytics` → Tier 3.7 GAP-5 scope

---

## Code map (current state)

| File | Role | Status |
|---|---|---|
| `src/app/api/members/[id]/route.ts` PUT (lines 139–255) | Generic member update endpoint | ❌ Broken at 6 layers (see Bug Inventory) |
| `src/app/api/members/[id]/route.ts` GET (lines 10–131) | Single member fetch | ✅ Works (used by detail route) |
| `src/app/(admin)/members/_components/MemberProfilePanel.tsx` | Side panel with Pause / Upgrade / Archive buttons | ❌ No Edit button — must add one |
| `src/app/(admin)/members/_components/AddMemberModal.tsx` | Tier 3.5 modal — template for the new modal | ✅ Reference pattern |
| `src/app/(admin)/members/[id]/_components/MemberProfileClient.tsx` | Detail page (read-only) | ⚠️ Out of scope for Tier 3.6 — focus on the panel modal |
| `e2e/pages/MembersPage.ts` | Tier 3.5 POM with Add Member helpers | ✅ Extend with Tier 3.6 section |

---

## Database schema audit

Three mandatory probes were run (per the standing Analyst checklist established in Tier 3.5).

### Probe 1: `information_schema.columns` for `profiles`

39 columns. Critical findings for Tier 3.6:
- ✅ `full_name`, `email` — NOT NULL — both edit form fields exist
- ✅ `phone` — nullable — exists
- ❌ **`notes` is NOT a column on `profiles`** — see Bug Layer 1
- ❌ **`membership_tier`, `membership_status`, `credits_remaining` are NOT on `profiles`** — see Bug Layer 2
- ✅ `updated_at` — NOT NULL with `default now()` — exists; the route's `updates.updated_at = new Date().toISOString()` is fine
- ✅ `is_active` — NOT NULL default true — exists (used for archive in Tier 3.7, NOT for status='archived')
- ⚠️ **`status` does NOT exist on `profiles`** — surfaces the same Layer 1 bug pattern in the DELETE handler (Tier 3.7 scope)

### Probe 2: `information_schema.columns` for `members`

34 columns. Critical findings:
- ✅ `notes` exists on `members` (text, nullable) — this is where notes ACTUALLY live
- ✅ `membership_tier`, `membership_status`, `credits_remaining` all live on `members`
- ✅ `updated_at` exists

**Schema truth:** `notes` belongs to the `members` table, NOT `profiles`. The current PUT handler writes it to the wrong table.

### Probe 3: `pg_constraint` (CHECK constraints)

`activity_log_type_check` already includes `member_updated` (added in Tier 3.5 BUG-010 Layer 3 fix). ✅ No new constraint work needed for Tier 3.6.

`activity_log.description` is NOT NULL (verified via `information_schema.columns` for activity_log in Tier 3.5). The current PUT handler omits it — see Layer 4.

### Probe 4: `pg_policies` for `profiles` (the Tier 3.5 standing checklist item)

Three policies on `profiles`:

| Name | Cmd | USING | WITH CHECK |
|---|---|---|---|
| `profiles_read` | SELECT | `studio_id = get_user_studio_id()` | — |
| `profiles_update_own` | UPDATE | `id = auth.uid()` | (defaults to USING) |
| `profiles_write` | INSERT | — | `studio_id = get_user_studio_id()` (added in Tier 3.5) |

**Critical gap:** The only UPDATE policy is `profiles_update_own` with `USING (id = auth.uid())`. **An admin trying to update another member's profile gets zero rows affected — silent denial.** Supabase doesn't throw on RLS denial, it just returns no rows. Same detection blind spot as BUG-010 Layer 5 (Analyst probes via Supabase MCP run as superuser and bypass RLS).

This is **Layer 5** of the bug stack — invisible to the SQL probe layer, surfaces only when a real session cookie hits `auth.uid()`.

### Probe 5: `pg_policies` for `members`

| Name | Cmd | USING | WITH CHECK |
|---|---|---|---|
| `members_read` | SELECT | `studio_id = get_user_studio_id()` | — |
| `members_update` | UPDATE | `studio_id = get_user_studio_id()` | (defaults to USING) |
| `members_write` | INSERT | — | `studio_id = get_user_studio_id()` |

✅ `members_update` already exists with the correct studio scope. Writing `notes` to `members` from the admin session will pass RLS.

### Probe 6: Unique constraints on `profiles`

```
profiles_pkey  PRIMARY KEY (id)
```

**No unique constraint on `profiles.email`.** The POST handler has an explicit duplicate-email check before insert (lines 73–86 of the create route). The PUT handler has **no equivalent check** — see Layer 6.

---

## Bug inventory (BUG-012 — 6 layers)

This is filed as a single multi-layer bug parallel to BUG-009 (products) and BUG-010 (members create). **All 6 layers will be fixed inline by the Engineer.**

### Layer 1 — `notes` written to the wrong table
- **Where:** `route.ts:183` — `notes` is in `allowedFields` for the `profiles.update()` call
- **Why broken:** `notes` does not exist on `profiles`. It lives on `members`.
- **Symptom:** Any PUT call including `notes` returns 500 with `column "notes" of relation "profiles" does not exist`. Confirms this code path has never been exercised in production (no UI calls it).
- **Fix:** Split incoming fields between two updates. Fields belonging to `profiles` (full_name, email, phone) → `profiles.update()`. Fields belonging to `members` (notes) → `members.update().eq('profile_id', id)`. Pattern matches the Tier 3.5 dual-write for create.

### Layer 2 — Three phantom `members` columns in the profiles update
- **Where:** `route.ts:180–182` — `membership_tier`, `membership_status`, `credits_remaining` all in `allowedFields`
- **Why broken:** These all live on `members`, not `profiles`. Same 500 as Layer 1.
- **Why we don't dual-write them:** They have **dedicated routes** (`/api/members/[id]/upgrade`, `/api/members/[id]/pause`, etc.) that are already wired up to `MemberUpgradeModal` and `MemberPauseModal`. The generic PUT should NOT touch them.
- **Fix:** Remove from `allowedFields` entirely. Document that membership-state changes go through the dedicated routes.

### Layer 3 — `exclude_from_analytics` is allowed but not exposed in the modal
- **Where:** `route.ts:184` — currently in `allowedFields` and CORRECTLY lives on `profiles`
- **Why this is a layer:** It's not a bug per se — the field exists and the route can update it. But there's no UI for it (Tier 3.7 GAP-5). The Engineer should leave the field in `allowedFields` (the API contract is correct) but NOT add a checkbox for it in the new modal — that's Tier 3.7 scope.
- **Fix:** No code change. Documentation only — the new modal exposes 4 fields, not 5. The route accepts 5 (the legitimate four + exclude_from_analytics) so future Tier 3.7 work can wire the toggle without touching the route again.

### Layer 4 — Missing `activity_log.description` (NOT NULL) + silent error swallow
- **Where:** `route.ts:230–237`
- **Why broken:** The `activity_log` insert omits `description`, which is NOT NULL with no default. Supabase JS does not throw on insert errors. The `await ...insert()` return is discarded entirely. This is the same "silent swallow" pattern that bit Tier 3.1, 3.4, and 3.5.
- **Fix:** Add `description: \`Member updated: ${name}\`` (mirroring the POST handler at line 139). Capture `{ error: activityError }` and `console.error` on failure. **No rollback** — activity log is observability, not business-critical, and the user has genuinely been updated. Pattern matches the Tier 3.5 fix for the POST handler.

### Layer 5 — RLS UPDATE policy `profiles_update_own` blocks admin from updating other members
- **Where:** `pg_policy` table — `profiles_update_own` with `USING (id = auth.uid())`
- **Why broken:** The policy restricts UPDATE to rows where `id = auth.uid()` — i.e., the user can only update their own profile. When an admin tries to PUT another member's profile, the policy denies the row, and Supabase returns zero rows affected. The route's check `if (!updated) return 404` then misfires as "Member not found" — but the row exists, it's just that RLS blocked the update.
- **This layer is invisible to the Analyst SQL probes** for the same reason BUG-010 Layer 5 was invisible: Supabase MCP `execute_sql` runs as service-role and bypasses RLS. The standing checklist item (`pg_policies` audit) flagged the gap, but only because we knew to look for it after BUG-010.
- **Fix:** Add a new policy `profiles_update_admin` matching the pattern from `members_update`:
  ```sql
  CREATE POLICY profiles_update_admin ON profiles
    FOR UPDATE
    USING (studio_id = get_user_studio_id())
    WITH CHECK (studio_id = get_user_studio_id());
  ```
  This **coexists** with `profiles_update_own` (Postgres OR's matching policies). Members keep self-update; admins gain studio-wide update. Application-layer `requireRole(['owner','manager'])` still gates the route.
- **Note on `profiles_update_own`:** This policy has no explicit `WITH CHECK`, so it inherits the USING clause. Both pre-update and post-update rows must satisfy `id = auth.uid()`. No privilege escalation risk — out of scope for Tier 3.6.

### Layer 6 — No duplicate-email check in PUT
- **Where:** `route.ts:174–213` — the entire PUT handler
- **Why broken:** `profiles.email` has NO unique constraint (only `profiles_pkey` on `id`). The POST handler does an explicit `select id where email = ? and studio_id = ?` check before insert and returns 409 on duplicate. The PUT handler has no equivalent check, so an admin can change a member's email to one that already exists on another profile in the same studio.
- **Fix:** Add a duplicate check after parsing the body and before the update:
  ```ts
  if (updates.email !== undefined) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", updates.email)
      .eq("studio_id", studioId)
      .neq("id", id)  // exclude the current profile
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "A member with this email already exists" },
        { status: 409 },
      );
    }
  }
  ```
  Same shape as the POST handler check, with the added `.neq("id", id)` to allow keeping the same email (idempotent update).

---

## Test scenarios (9 — 4 P0, 5 P1)

Mirroring the Tier 3.5 cadence for predictability.

| # | Pri | Scenario | Key assertion |
|---|---|---|---|
| 1 | P0 | End-to-end happy path | `profiles` row updated (name, email, phone) + `members` row updated (notes) + `activity_log` row with `type='member_updated'` and non-null `description` |
| 2 | P0 | Dual-write proof (Layer 1) | Update `notes`, then read it back via `members.notes` (NOT `profiles`); assert exact match |
| 3 | P0 | RLS proof (Layer 5) | Without the `profiles_update_admin` policy, the test fails. With it, the test passes. (Implicit — covered by Tests 1 + 2 succeeding under a real admin session.) |
| 4 | P0 | Modal pre-fills existing values | Open Edit modal, assert inputs reflect current `full_name`, `email`, `phone`, `notes` |
| 5 | P1 | Blank name blocks submit | Submit button disabled + zero DB mutation |
| 6 | P1 | Blank email blocks submit | Submit button disabled + zero DB mutation |
| 7 | P1 | Duplicate email returns 409 (Layer 6) | Two members exist; PUT one to the other's email; assert 409 + error visible + zero mutation |
| 8 | P1 | Invalid email format returns 400 (server regex) | Direct `page.request.put('/api/members/[id]', ...)` bypasses HTML5 validation; assert `res.status() === 400` and `body.error === 'Invalid email format'` |
| 9 | P1 | Cancel closes modal without writing | Make changes, hit Cancel, assert modal closed + DB unchanged |

**Note on Test 3:** Layer 5 is intrinsically validated by Tests 1, 2, 4 succeeding. The admin session in Playwright uses a real `auth.uid()` distinct from the test member's `id`, so any update that lands proves RLS isn't blocking. Adding a separate "Layer 5 proof" test is redundant.

---

## Testid inventory

8 testids needed in the new `EditMemberModal.tsx`. All `[NEEDS SEEDING]` since the file does not exist yet:

| Testid | Element |
|---|---|
| `members-edit-modal` | Dialog container |
| `members-edit-name-input` | Full name input |
| `members-edit-email-input` | Email input |
| `members-edit-phone-input` | Phone input (optional) |
| `members-edit-notes-input` | Notes textarea (optional) |
| `members-edit-error` | Error alert (409 / 400 / 500 messages) |
| `members-edit-cancel-btn` | Cancel button |
| `members-edit-submit` | Save button |

Plus 1 testid in `MemberProfilePanel.tsx`:

| Testid | Element |
|---|---|
| `members-edit-btn` | Edit pencil icon button (top of profile header card, next to Close X) |

**Total seeds:** 9 testids across 2 files (1 new, 1 modified).

---

## Decisions for the Architect

1. **EditMemberModal placement:** Add as a peer to `AddMemberModal.tsx` in `_components/`. Imported by `MemberProfilePanel.tsx`. State managed locally in `MemberProfilePanel`.

2. **Edit button location:** Top-right of the profile header card, as a small pencil icon button next to the X close button. This keeps the diff minimal (one new icon button), is visually obvious as "edit profile" affordance, and doesn't disturb the existing Email/Call/Tag layout.

3. **Migration name:** `bug012_profiles_update_admin_policy` — single new RLS policy. No table or column changes.

4. **Refresh strategy after save:** The current panel uses live data from props passed by the parent page. The parent (`members/page.tsx`) refetches via the existing `loadMembers()` function. Pattern: call `onSuccess?.()` from the modal, parent refetches the list, and the panel's `member` prop updates on the next render. This matches the AddMemberModal pattern and avoids inventing a new state-management path.

5. **`exclude_from_analytics`:** Leave in `allowedFields` (it's correct). Do NOT add a checkbox to the modal. That's Tier 3.7 GAP-5 scope.

6. **Test data setup for Test 7 (duplicate email):** Need TWO seeded members in `db.ts` — one to edit, one whose email is the duplicate target. Extend `seedMember()` to allow seeding two and return both IDs. Or seed twice in the test directly with different `E2E_MEMBER_NAME_PREFIX` suffixes.

---

## Hand-off

Architect: please produce the 8-step blueprint covering migration → API fix → testid seeds → POM extension → modal component → Edit button wiring → spec file → flake check + admin regression. Reference the Tier 3.5 architect report for shape.
