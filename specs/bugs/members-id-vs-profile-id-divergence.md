# BUG-013 — Members ID vs Profile ID Divergence

**Status:** OPEN — partial mitigation in Tier 3.6 (Edit Member only)
**Severity:** High — silently breaks Pause, Upgrade, Archive in production
**Surfaced by:** Tier 3.6 council run, Engineer Step 3 investigation
**Filed:** 2026-04-09
**Affected files:**
  - `apps/web/src/app/(admin)/members/page.tsx`
  - `apps/web/src/app/(admin)/members/_components/MemberProfilePanel.tsx`
  - `apps/web/src/app/api/members/[id]/pause/route.ts`
  - `apps/web/src/app/api/members/[id]/upgrade/route.ts`
  - `apps/web/src/app/api/members/[id]/route.ts` (PUT, DELETE, GET)

---

## Summary

`members.id` and `members.profile_id` are 100% distinct UUIDs across all 1,188 production rows. The directory query in `members/page.tsx:258` maps `id: row.id` (the `members.id` PK) into `Member.id`, but every per-member API route at `/api/members/[id]/*` expects URL `[id]` to be a `profile_id` (i.e., `profiles.id`).

The result: every action button in `MemberProfilePanel.tsx` that calls `/api/members/${member.id}/...` is silently broken in production. The route looks up `.eq('profile_id', memberId)` against a value that is actually a `members.id`, returns zero rows, and the UI surfaces a "member not found" error or worse, fails silently.

This has been broken for an unknown duration. No test had ever exercised the panel action buttons end-to-end against the database before Tier 3.6.

---

## How it was discovered

During Tier 3.6 (Edit Member) Engineer Step 3, the new Edit modal needed to call `PUT /api/members/[id]`, where `[id]` is the URL parameter. Reading the existing PUT handler showed `.eq('id', id)` against `profiles`, meaning the URL parameter must be a `profile_id`. Reading the panel showed it passes `member.id`, which is `members.id`.

A direct SQL probe via Supabase MCP confirmed:

```sql
SELECT count(*)
FROM members
WHERE id::text = profile_id::text;
-- → 0
```

All 1,188 rows have `members.id ≠ members.profile_id`.

Cross-checking the FK structure:
- `bookings.member_id` → `members.id` (NOT `profiles.id`)
- `transactions.member_id` → `members.id`
- `member_tags.member_id` → `members.id`

So the data-fetching path (`fetchMemberDetail`, which queries bookings/transactions/tags) is **correct** in passing `members.id`. The action-mutation path (`/pause`, `/upgrade`, `/archive`, `/PUT`, `/DELETE`) is **wrong** in passing `members.id`.

---

## Concrete impact

| Flow | UI passes | Route expects | Outcome |
|---|---|---|---|
| Pause membership | `member.id` (members.id) | `profile_id` | Silent no-op or 404 |
| Upgrade membership | `member.id` | `profile_id` | Silent no-op or 404 |
| Archive (DELETE) | `member.id` | `profile_id` | Silent no-op or 404 |
| Edit member (Tier 3.6 NEW) | `member.profileId` ✅ | `profile_id` | **Works** — narrow fix in Tier 3.6 |
| View Full Profile link | `member.id` | `profile_id` (in `/members/[id]` page) | Probably broken too — needs verification |
| `fetchMemberDetail` for bookings/transactions/tags | `member.id` | `members.id` (FK) | **Correct** — DO NOT change |

---

## Tier 3.6 partial mitigation (Option B — narrow blast)

Added `profileId: string` to the `Member` interface (`types.ts`) and set `profileId: row.profile_id` in `page.tsx:262`. The new `EditMemberModal` is the only call site that uses `member.profileId`. All other call sites (Pause, Upgrade, Archive, Full Profile link) still pass `member.id` and remain broken.

This was the right scope for Tier 3.6 because:
1. The Tier 3.6 contract is "Edit Member" — fixing the broader UI breakage would balloon the council run.
2. Pause/Upgrade are scheduled for Tier 3.7 (Members: Lifecycle) which will exercise them end-to-end, surface the bug deterministically, and fix it in scope.
3. The narrow fix avoids touching files unrelated to Edit Member, keeping the Sentinel diff small and the code review focused.

---

## Recommended full fix (for Tier 3.7 or a dedicated PR)

**Option A — Cheapest, right thing.** Update every panel call site to use `member.profileId`:

```diff
- fetch(`/api/members/${member.id}/pause`, ...)
+ fetch(`/api/members/${member.profileId}/pause`, ...)

- fetch(`/api/members/${member.id}`, { method: 'DELETE' })
+ fetch(`/api/members/${member.profileId}`, { method: 'DELETE' })
```

In:
- `MemberProfilePanel.tsx` (Pause, Upgrade, Archive buttons + the modals it mounts)
- `MemberPauseModal.tsx`, `MemberUpgradeModal.tsx`, `AIDetailModal.tsx` — change the `memberId` prop name to `profileId` and update all call sites to pass `member.profileId`
- The "View Full Profile" `<Link href={\`/members/${member.id}\`}>` — needs investigation (the `/members/[id]` detail page may also expect profile_id; verify before flipping)

**Option B — Worse, but possible.** Refactor every action route at `/api/members/[id]/*` to look up by `members.id` instead of `profile_id`. Wider blast radius — would break any external API consumer that hits these routes today. Not recommended.

**Option C — Hybrid.** Add a route helper that accepts either ID and resolves it. Adds complexity without clear benefit.

**Recommendation: Option A**, scheduled for Tier 3.7 (Members: Lifecycle — Pause/Upgrade/Archive). The Tier 3.7 Sentinel will surface every broken call site and the fix will land alongside the test coverage that proves it works.

---

## Why no test caught this earlier

Tier 2.3 (members smoke) only mounted the directory and asserted the not-found page. It never clicked Pause/Upgrade/Archive. Tier 3.5 (Create Member) only exercised the POST route, not the per-member action routes. The bug has been present since the original divergence — `git blame` would tell us when, but the impact today is that every panel action button has been silently broken for an unknown duration.

The lesson for the Analyst phase going forward: **for any feature that mounts a button calling `/api/${entity}/[id]/...`, sanity-check that the UI's `${id}` matches the route's expected key.** Add this as a standing Tier 3+ Analyst checklist item alongside the schema/RLS probes already in place.

---

## Tracking

| Field | Value |
|---|---|
| Tier scoped to fix | 3.7 (Members: Lifecycle) |
| Mitigation in 3.6 | Narrow — Edit Member only, via `member.profileId` |
| Production impact | High — Pause/Upgrade/Archive all broken silently |
| Detection gap | No Tier 2/3 test exercised panel action buttons end-to-end |
| Recommended Analyst checklist update | "For each panel action button, trace `${id}` from UI through to the route's WHERE clause" |
