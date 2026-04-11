# QA Council — Members: Archive / Exclude from Analytics (Tier 3.7) — ANALYST

**Pipeline ID:** `members-archive-exclude`
**Tier:** 3.7 (Core Writes — 7 of 12)
**Project:** `admin`
**Phase:** 1 — Analyst
**Date:** 2026-04-09
**Status:** ✅ Scope decision: BUILD INLINE. **4-layer bug stack** in DELETE handler (BUG-014) plus one missing UI surface (BUG-008 GAP-5). Hand-off to Architect.

---

## Scope decision (up front)

Tier 3.7 covers two distinct admin actions on the Members module:

1. **Archive member** — soft-delete a member so they stop showing as "active." Has a button in `MemberProfilePanel.tsx` (the panel that opens from the directory), wired to `DELETE /api/members/[id]`. **Route is broken at 4 layers.**
2. **Exclude from Analytics** — set `profiles.exclude_from_analytics = true` so comped members (e.g., former owners) don't skew revenue and attendance reports. **UI does not exist anywhere.** The API already accepts this field in the PUT allowlist (added in Tier 3.6). BUG-008 GAP-5 filed this as "PARTIAL (API exists, UI missing)."

Three scope options:

| Option | Description | Verdict |
|---|---|---|
| (a) Gap-file both | Defer to "UI gap" follow-up | ❌ Both have clear execution paths — gap-filing would duplicate BUG-008 GAP-5 without progress |
| (b) **Build inline** (BUG-009 / BUG-010 / BUG-012 pattern) | Fix DELETE handler, wire Archive button to `profileId`, add exclude-from-analytics toggle to `EditMemberModal`, write tests | ✅ Matches the Tier 3.5 / 3.6 pattern — when the route/DB ground truth is well-defined, inline is cheaper than gap-filing + returning later |
| (c) Split — Archive inline, Exclude gap-file | Only fix Archive this run | ⚠️ Leaves BUG-008 GAP-5 open for no reason — the toggle is literally one checkbox in the existing modal |

**Decision: (b) — Build inline.** The DELETE handler fix is mechanical (3 DB layers + 1 BUG-013 call-site update). The exclude-from-analytics toggle extends the `EditMemberModal` we just built in Tier 3.6 — it's a 4-line addition to the delta-payload logic plus one checkbox. This run will be filed as a **full pipeline** (not gap-filed).

---

## Feature summary

**Archive flow:** Admin opens a member's profile panel from the directory, clicks the red "Archive" button in the Active Membership card, confirms the browser `confirm()` dialog, and the panel closes. `DELETE /api/members/[id]` flips `profiles.is_active = false` and writes an activity_log row with `type='member_deleted'`.

**Exclude from Analytics flow:** Admin opens the Edit Member modal via the Pencil icon (Tier 3.6 entry point), checks the new "Exclude from analytics" checkbox, and submits. The PUT call already supports `exclude_from_analytics` in the allowlist (Tier 3.6 fix). The profile row gets `exclude_from_analytics = true`. Activity_log records the change in `metadata.fields`.

**Out of scope for Tier 3.7:**
- Visual filtering of archived members from the directory list (the admin will still see them; directory list ordering is BUG-011 and not touched here either)
- A dedicated "archived members" tab / recovery flow
- Changing `confirm()` to a shadcn `AlertDialog` (UI polish — Playwright handles `confirm()` natively)
- Membership `paused_at` / `cancelled_at` fields — Pause/Upgrade/Cancel are Tier 4.2/4.3/4.4 Memberships work
- Fixing BUG-011 (directory order) — Tier 3.5/3.6 tests already work around this via search; folding into 3.7 would risk regressing them

---

## Code map (current state)

| File | Role | Status |
|---|---|---|
| `src/app/api/members/[id]/route.ts` DELETE (lines 384–456) | Soft-delete route | ❌ Broken at 4 layers (see Bug Inventory) |
| `src/app/api/members/[id]/route.ts` PUT (lines 146–378) | Generic member update — already accepts `exclude_from_analytics` | ✅ Works (Tier 3.6 fix) |
| `src/app/(admin)/members/_components/MemberProfilePanel.tsx` (lines 326–344) | Archive button — inline `fetch` + `confirm()` | ⚠️ Uses `member.id` (BUG-013) + needs `data-testid` |
| `src/app/(admin)/members/_components/EditMemberModal.tsx` | Tier 3.6 modal — 4 fields today | ⚠️ Needs extension — add `exclude_from_analytics` checkbox + delta logic |
| `src/app/(admin)/members/_components/types.ts` (`Member` interface) | Member type | ⚠️ Needs `excludeFromAnalytics?: boolean` field |
| `src/app/(admin)/members/page.tsx` (directory mapper, lines 199–291) | Directory query + mapping | ⚠️ `select()` must add `profiles.exclude_from_analytics`; mapper must populate `excludeFromAnalytics` |
| `e2e/pages/MembersPage.ts` | Tier 3.5+3.6 POM | ✅ Extend with Tier 3.7 section |

---

## Database schema audit

Three mandatory probes were run (per the standing Analyst checklist established in Tier 3.5, refined in Tier 3.6 with the "panel action button ID trace" addition).

### Probe 1: `information_schema.columns` for `profiles` + `activity_log`

Critical findings for Tier 3.7:
- ✅ **`profiles.exclude_from_analytics`** — `boolean NOT NULL DEFAULT false` — exists, accepting writes via PUT allowlist
- ✅ **`profiles.is_active`** — `boolean` (not strictly NOT NULL but defaults to `true`) — exists; this is the column the DELETE handler SHOULD be writing
- ❌ **`profiles.status` does NOT exist.** The DELETE handler tries to `.update({ status: 'archived' })`. The column does not exist on `profiles`. **This is BUG-014 Layer 1.**
- ✅ `activity_log.description` — `text NOT NULL` with no default — exists; must be provided on insert
- ❌ DELETE handler's activity_log insert at line 439–446 omits `description`. **This is BUG-014 Layer 2** — same "silent swallow" pattern that bit Tiers 3.1 / 3.4 / 3.5 / 3.6.
- ✅ `activity_log.type` — `text NOT NULL`
- ✅ `activity_log.metadata` — `jsonb NOT NULL default '{}'` — safe

### Probe 2: `pg_constraint` for `activity_log.type` CHECK

```
CHECK (type = ANY (ARRAY[
  'check_in', 'booking', 'cancellation', 'payment', 'failed_payment',
  'membership_change', 'walk_in', 'new_member', 'refund', 'strike',
  'clock_in', 'clock_out',
  'product_created', 'product_updated', 'product_deleted',
  'member_created', 'member_updated', 'member_deleted'
]))
```

❌ **The DELETE handler writes `type: "member_archived"`** — not in the enum. CHECK constraint violation → silent swallow (via missing description too). **This is BUG-014 Layer 3.**

**Fix choice:** use the existing canonical value `'member_deleted'` (added in Tier 3.5 BUG-010 migration). "Archived" and "deleted" are synonyms in this soft-delete model — the row stays in the database with `is_active=false`, so we're not really "deleting" anything. Reusing `member_deleted` avoids another migration and keeps the enum tight.

### Probe 3: `pg_policies` for `profiles` + `activity_log`

| Table | Policy | Command | Qual / With check |
|---|---|---|---|
| `profiles` | `profiles_read` | SELECT | `studio_id = get_user_studio_id()` |
| `profiles` | `profiles_update_own` | UPDATE | `id = auth.uid()` |
| `profiles` | `profiles_update_admin` | UPDATE | `studio_id = get_user_studio_id()` ✅ (added in Tier 3.6 BUG-012 L5) |
| `profiles` | `profiles_write` | INSERT | `studio_id = get_user_studio_id()` |
| `activity_log` | `activity_read` | SELECT | `studio_id = get_user_studio_id()` |
| `activity_log` | `activity_write` | INSERT | `studio_id = get_user_studio_id()` |

✅ **No RLS gap.** Tier 3.6's `profiles_update_admin` policy covers the DELETE handler's UPDATE on `profiles.is_active`. No migration needed this run. **The pg_policies probe is now a pure "confirm no gap" step — for the first time since it became mandatory.**

### Probe 4 (NEW — "panel action button ID trace")

The Tier 3.6 lesson: for every panel action button, trace `${id}` from the UI through to the route's WHERE clause. Added as a standing Analyst checklist item after BUG-013. Applied here:

| Panel button | `fetch()` URL | Route WHERE clause | Result |
|---|---|---|---|
| Archive (DELETE) | `/api/members/${member.id}` | `.eq('id', id).eq('studio_id', …)` against `profiles` | ❌ **BROKEN** — `member.id` is `members.id`, but the route expects `profile_id`. 0/1,188 rows match. **BUG-014 Layer 4 (inherits from BUG-013).** |
| Pause (POST) | `/api/members/${member.id}/pause` | `.eq('profile_id', memberId)` against `members` | ❌ BROKEN — out of scope for 3.7 (Tier 4.2 Memberships: Pause) |
| Upgrade (POST) | `/api/members/${member.id}/upgrade` | `.eq('profile_id', memberId)` against `members` | ❌ BROKEN — out of scope for 3.7 (Tier 4.2 Memberships: Upgrade) |
| Downgrade (POST) | `/api/members/${member.id}/downgrade` | `.eq('profile_id', memberId)` against `members` | ❌ BROKEN — out of scope for 3.7 (Tier 4.3 Memberships: Downgrade) |
| View Full Profile (Link) | `/members/${member.id}` | `[id]` in detail route | ⚠️ Unknown — not in Tier 3.7 contract |
| Edit (Pencil) | `/api/members/${member.profileId}` | `.eq('id', id)` against `profiles` | ✅ Works (Tier 3.6 fix) |

**Archive IS in Tier 3.7 scope.** Must flip `member.id` → `member.profileId` in the panel onClick. Pause/Upgrade/Downgrade stay broken at the same level they were before — they will be fixed in Tier 4.2/4.3 when those council runs exercise them end-to-end.

### Probe 5 (production state)

```sql
SELECT COUNT(*) total,
  COUNT(*) FILTER (WHERE is_active = true) active_true,
  COUNT(*) FILTER (WHERE is_active = false) active_false,
  COUNT(*) FILTER (WHERE exclude_from_analytics = true) excluded_true
FROM profiles WHERE studio_id = '<default studio>';
```

Result: **1,204 total · 1,204 active_true · 0 active_false · 0 excluded_true.**

**No member has ever been successfully archived through the DELETE route** (the 4 layers above guarantee it was broken since inception). **No member has ever been excluded from analytics** (the PUT allowlist only accepted this field starting in Tier 3.6, and there's no UI toggle). Both writes are truly unexercised in production.

---

## BUG-014 — DELETE handler 4-layer divergence (pre-existing)

**Severity:** High — `Archive` button has been silently returning 500 on every click in production since inception. Admin UX shows a generic "Failed to archive member" toast and no action taken.

**File:** `apps/web/src/app/api/members/[id]/route.ts` lines 384–456
**Related:** BUG-008 GAP-5 (Exclude from Analytics UI missing, wired in this run), BUG-013 (Layer 4 is the narrow-blast inheritance from BUG-013)

### Layer 1 — Phantom `profiles.status` column
```ts
const { data: updated, error } = await supabase
  .from("profiles")
  .update({
    status: "archived",  // ❌ column does not exist
    updated_at: new Date().toISOString(),
  })
  .eq("id", id)
  ...
```
`profiles.status` does not exist (confirmed via Probe 1). Supabase JS / PostgREST returns `{ error: 'column "status" of relation "profiles" does not exist' }`. The `if (error)` branch returns 500. Every archive click fails.

**Fix:** Replace `status: 'archived'` with `is_active: false`. The column `is_active` exists on `profiles` and is the conventional soft-delete flag.

### Layer 2 — Missing `activity_log.description` (NOT NULL)
```ts
await supabase.from("activity_log").insert({
  studio_id: studioId,
  actor_id: user.id,
  type: "member_archived",
  subject_type: "profile",
  subject_id: id,
  metadata: {},  // ❌ no description
});
```
Same silent-swallow pattern as Tier 3.1 / 3.4 / 3.5 / 3.6. `activity_log.description` is NOT NULL with no default. Insert fails silently (Supabase JS client doesn't throw on insert errors; the `await` discards `{ error }`).

**Fix:** Add `description: \`Member archived: ${memberName}\``. Fetch `existingProfile.full_name` upfront (mirrors Tier 3.6 PUT handler pattern) so we always have a real name in the log entry.

### Layer 3 — Invalid `activity_log.type` enum value
`"member_archived"` is not in the CHECK constraint enum. The canonical enum values after Tier 3.5's migration are `member_created / member_updated / member_deleted`. "Archived" is a synonym for "deleted" in this soft-delete model (row stays in the DB, just flagged).

**Fix:** Change to `type: 'member_deleted'`. Reuse existing enum value. No migration needed.

### Layer 4 — BUG-013 inheritance (panel passes `members.id`)
`MemberProfilePanel.tsx` lines 327–340:
```ts
const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' })
```
`member.id` is `members.id` per the directory mapping (`page.tsx:258 id: row.id`). The route does `.eq('id', id)` against `profiles`, expecting a `profile_id`. 0/1,188 rows match. Even if Layers 1-3 were fixed, the route would return 404 "Member not found" for every click.

**Fix:** Change the `fetch()` URL to `/api/members/${member.profileId}`. Narrow-blast Option B fix, same pattern as Tier 3.6 used for the Edit button. Pause/Upgrade/Downgrade buttons still pass `member.id` — will be fixed in Tier 4.2/4.3 (Memberships work) when those run.

---

## BUG-008 GAP-5 — Exclude from Analytics UI missing (pre-existing, closed by this run)

**Current state:** `PUT /api/members/[id]` allows `exclude_from_analytics` in the `profileAllowedFields` list (Tier 3.6 fix). The column exists on `profiles` with `default false`. **Zero members in production have this flag set** — because no UI toggle exists anywhere in the app.

**Fix:** Add a checkbox to the existing `EditMemberModal`. The modal already handles profile-field edits with delta-payload submission. This is a minimal extension:
1. Add `exclude_from_analytics: boolean` to `EditFields` and `EditableInitial` types
2. Add a labeled `<input type="checkbox">` after the Notes field
3. Add the delta check: `if (form.exclude_from_analytics !== (initial.exclude_from_analytics ?? false)) payload.exclude_from_analytics = form.exclude_from_analytics`
4. Re-seed in the useEffect on modal open

On the Member type side:
1. Add `excludeFromAnalytics?: boolean` to the `Member` interface in `types.ts`
2. Extend `page.tsx` directory query `select()` to include `profiles!inner ( full_name, email, phone, avatar_url, exclude_from_analytics )`
3. Map `excludeFromAnalytics: profile.exclude_from_analytics` in the mapper

On the `MemberProfilePanel` mount:
- Pass `exclude_from_analytics: member.excludeFromAnalytics ?? false` in the `initial` prop to `EditMemberModal`

**Why the checkbox belongs in the existing modal:** `EditMemberModal` is already the "edit profile fields" surface. Both `full_name` and `exclude_from_analytics` live on the same `profiles` row. Adding a second modal for a single boolean would be over-engineering. The toggle is admin-only and the modal is admin-only, so permission scoping is identical.

---

## Test scenarios (5 total, 3 P0 + 2 P1)

### P0-1 — Archive happy path writes `profiles.is_active = false`
- **Arrange:** Seed a known member via `seedMember({ fullName, email, studioId })`. Visit `/members`. Search for the seeded name. Open the profile panel.
- **Act:** Set up `page.on('dialog', d => d.accept())`. Click the Archive button. Wait for panel to close.
- **Assert:**
  - `profiles.is_active = false` for the seeded profileId (Layer 1 fix proof)
  - `profiles.exclude_from_analytics` still `false` (regression — archiving is distinct from excluding)
  - `activity_log` row with `subject_id = profileId`, `type = 'member_deleted'`, `description` non-null and containing "archived"
- **Implicitly proves:** Layer 1 (column), Layer 3 (enum), Layer 4 (BUG-013 / profileId), activity_log write lands

### P0-2 — Archive activity_log has non-null description and valid type (Layer 2+3 explicit proof)
- **Arrange:** Same seed as P0-1
- **Act:** Accept dialog + click Archive
- **Assert:**
  - `activity_log.description` is not null, is truthy, contains "Member archived" OR "archived"
  - `activity_log.type = 'member_deleted'` (not `'member_archived'`)
  - `activity_log.metadata` contains a `profile_id` or similar marker
- **Proves:** Layer 2 (description NOT NULL swallow), Layer 3 (enum mismatch swallow)

### P0-3 — Exclude from Analytics toggle writes `profiles.exclude_from_analytics = true`
- **Arrange:** Seed a member with `exclude_from_analytics = false` (default). Open panel → click Pencil → Edit modal opens.
- **Act:** Check the `exclude-analytics-checkbox`, click Save.
- **Assert:**
  - Modal closes
  - `profiles.exclude_from_analytics = true` for the seeded profileId
  - Other profile fields (`full_name`, `email`, `phone`) unchanged (delta-payload regression)
  - `activity_log` row with `type = 'member_updated'`, `metadata.fields` includes `exclude_from_analytics`
- **Proves:** BUG-008 GAP-5 closed — the toggle UI is wired end-to-end

### P1-1 — Cancel archive dialog leaves member active
- **Arrange:** Seed a member
- **Act:** Set `page.on('dialog', d => d.dismiss())`. Click Archive.
- **Assert:**
  - Panel stays open (no close navigation)
  - `profiles.is_active` still `true`
  - No new `activity_log` row with `type = 'member_deleted'` for this subject
- **Proves:** the `if (!confirm(...)) return` guard still works after layer fixes

### P1-2 — Exclude toggle persists through modal reopen
- **Arrange:** Seed a member. Open edit modal, check exclude-analytics, submit.
- **Act:** Close panel, re-open member panel, re-open edit modal.
- **Assert:**
  - Checkbox is checked on reopen (initial state reflects the DB state post-update)
  - No duplicate `activity_log` row if the user submits without changes (no-op short-circuit from Tier 3.6)
- **Proves:** the `initial` prop flows through the directory refresh → `fetchMembers()` → `Member.excludeFromAnalytics` → modal re-seed chain

---

## Testid seed list

| Testid | Location | Purpose | Status |
|---|---|---|---|
| `members-archive-btn` | `MemberProfilePanel.tsx` Archive button at line ~327 | Click target | `[NEEDS SEEDING]` |
| `members-edit-modal-exclude-analytics-checkbox` | `EditMemberModal.tsx` new checkbox | Form field | `[NEEDS SEEDING]` |
| `members-edit-modal-exclude-analytics-label` | `EditMemberModal.tsx` label for the checkbox | Helpful for `getByLabel` fallback | `[OPTIONAL]` |

All other testids already exist from Tier 3.5/3.6:
- `members-edit-btn` (panel Pencil icon) ✅
- `members-edit-modal-dialog` ✅
- `members-edit-modal-{name,email,phone,notes}-input` ✅
- `members-edit-modal-{submit,cancel}-btn` ✅
- `members-edit-modal-error` ✅
- `members-directory-row` + `data-row-key` ✅

---

## Files to edit (Architect handoff)

| # | File | Change |
|---|---|---|
| 1 | `src/app/api/members/[id]/route.ts` (DELETE handler only, lines 384–456) | Rewrite: fetch existing profile up-front for name + studio check, use `is_active: false` instead of `status: 'archived'`, include `description` + `type: 'member_deleted'` in activity_log insert, capture `activityError` and console.error on failure (no rollback — observability) |
| 2 | `src/app/(admin)/members/_components/MemberProfilePanel.tsx` (line 330) | Change `fetch(\`/api/members/${member.id}\`, ...)` to `fetch(\`/api/members/${member.profileId}\`, ...)`. Add `data-testid="members-archive-btn"` to the Archive button element. |
| 3 | `src/app/(admin)/members/_components/types.ts` (Member interface) | Add `excludeFromAnalytics?: boolean` after `notes: string \| null` |
| 4 | `src/app/(admin)/members/page.tsx` (directory mapper, lines 199–291) | Extend `profiles!inner (...)` select to include `exclude_from_analytics`. Add `excludeFromAnalytics: profile.exclude_from_analytics ?? false` to the Member mapper. |
| 5 | `src/app/(admin)/members/_components/EditMemberModal.tsx` | Extend `EditFields` and `EditableInitial` with `exclude_from_analytics: boolean`. Add useEffect re-seed. Add checkbox UI after Notes field. Extend delta-payload logic. |
| 6 | `src/app/(admin)/members/_components/MemberProfilePanel.tsx` (EditMemberModal mount at line 604) | Pass `exclude_from_analytics: member.excludeFromAnalytics ?? false` in the `initial` prop |
| 7 | `e2e/pages/MembersPage.ts` | Tier 3.7 section: locators for `members-archive-btn` + `members-edit-modal-exclude-analytics-checkbox`. Helpers: `archiveMember({ accept: boolean })` with `page.on('dialog', ...)`, `toggleExcludeFromAnalytics()`, `expectExcludeCheckboxState(checked: boolean)`. |
| 8 | `e2e/members-archive-exclude.spec.ts` (NEW) | 5 tests |
| 9 | `src/__tests__/unit/components/member-profile-panel.test.tsx` | No change needed — `excludeFromAnalytics` is optional on the type. |

**Database migrations:** none needed this run. (First Tier 3+ run since 3.1 that doesn't need a migration.)

---

## Risk register

| Risk | Mitigation |
|---|---|
| `page.on('dialog')` is event-based — if the dialog fires before the listener attaches, Playwright times out | Attach the listener BEFORE clicking the Archive button in the POM helper. Standard Playwright pattern. |
| BUG-013 narrow fix means Pause/Upgrade/Downgrade still pass `member.id` — Tier 4.2/4.3 tests will surface the same bug | Explicitly documented. BUG-013 bug doc already references Option A fix for Tier 4.2. |
| Adding a new field to `EditMemberModal` could break Tier 3.6's 9-test spec if any scenario submits the modal without expecting exclude_from_analytics in the activity_log metadata | Delta-payload logic means the field only enters the PUT body if the user actually toggled it. Tier 3.6 tests never touch the checkbox, so metadata.fields will not include `exclude_from_analytics`. Regression-safe. |
| Cancelling the `confirm()` dialog in P1-1 may race the panel's onClick handler in CI | Use Playwright's `dialog` event listener with `.dismiss()` before the click, then assert no state change. Proven pattern from other test suites. |
| Tier 3.6 dup-email test had one transient failure in round-1 admin regression (noted in pipeline log) | Re-running Tier 3.7's admin regression twice if flakiness reappears is the accepted mitigation. No action needed at Analyst time. |

---

## Handoff to Architect

**Build inline.** 9 files to touch, 0 migrations, 5 tests. BUG-014 is a clean 4-layer stack that mirrors BUG-012's 6-layer stack from Tier 3.6 (same failure modes, same fix patterns). BUG-008 GAP-5 closes cleanly with a single checkbox addition to an existing modal. Expected duration: single session.

**Hand-off checklist:**
- [ ] Architect produces 8-step blueprint with explicit order (DELETE handler rewrite first — it's the blocker for P0-1 through P0-2; modal extension second — unblocks P0-3)
- [ ] Architect names the exact function to edit in each file (no "add to SettingsClient" ambiguity from Tier 2.9)
- [ ] Architect confirms POM extension pattern (extend `MembersPage.ts` with `// ─── Tier 3.7: Archive / Exclude ───` section header)
- [ ] Architect confirms test scenarios 1:1 match the 5 listed above

**Standing directive:** "Work through all tiers until 100% complete." This is Tier 3.7. Tier 3 counter advances to **7/12** on completion.
