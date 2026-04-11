# BUG-011 — Members directory list never shows newly created members

**Filed:** 2026-04-09
**Severity:** Medium — UX issue, not a data correctness bug
**Discovered during:** Tier 3.5 (Members: Create Member) Sentinel phase
**Affected files:**
- `apps/web/src/app/(admin)/members/page.tsx` (list query at line ~200)

---

## Summary

The admin Members directory at `/members` queries the `members` table with:

```ts
supabase
  .from('members')
  .select(...)
  .eq('studio_id', STUDIO_ID)
  .order('id', { ascending: true })
  .limit(50)
```

With ~1,187 existing member rows in production, this query returns the 50 members whose `id` UUIDs happen to sort earliest alphabetically. Newly-created members get a fresh `id`, which is **almost never** in the alphabetical top 50. Result: after an admin uses the "Add Member" modal to create a new member, the new row is **invisible** in the default directory view. The admin has to search by name to find it, which is unintuitive.

This was surfaced during the Tier 3.5 Sentinel phase when Scenario 4 (directory list refresh after create) failed deterministically. The test was adapted to use the search box, which is the current workable UX, but the underlying list ordering should be fixed.

---

## Reproduction

1. Navigate to `/members`
2. Click "Add Member", fill in name/email, submit
3. Modal closes successfully
4. **Observed:** New member does not appear in the list
5. **Expected:** New member visible, ideally at the top of the list

Direct DB verification confirms the member row exists in the `members` table with the correct `studio_id`; it just isn't in the first 50 rows returned by the query's ordering.

## Fix options

### Option A — Order by `created_at DESC` (preferred)

Change `.order('id', { ascending: true })` → `.order('created_at', { ascending: false })`. This puts the most recently created members at the top, which matches user expectations ("I just added her, she should be right there") and incidentally fixes a family of related paper cuts (renaming a member doesn't make them "jump" to a new position; imports don't confuse the first page).

`members.created_at` already exists with a `default now()` — zero migration cost.

### Option B — Increase the limit

Bump `limit(50)` → `limit(500)` or implement infinite scroll. This is a bandaid; it doesn't make new members visibly prominent, just makes them slightly easier to find.

### Option C — Post-create scroll-to / highlight

After a successful create, the modal's `onSuccess` could scroll the list to the new row and flash a highlight. More engineering work, unclear benefit given Option A achieves the same goal.

**Recommendation: Option A.** Single-line change to the list page, aligns with the mental model used everywhere else in Meridian ("most recent activity at the top").

## Related

- **BUG-010** (Tier 3.5) — Members Create schema divergence. Fixed inline. BUG-011 is the residual UX issue that surfaced once BUG-010 was fixed and real member writes started landing.

## Fix scope

Pending triage. Not in scope for Tier 3.5; queue for a dedicated single-line fix or roll into Tier 3.6 (Edit Member) which will likely touch the same file.
