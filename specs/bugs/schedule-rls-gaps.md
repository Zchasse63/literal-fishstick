# BUG-016 — Schedule Subsystem RLS Gaps

**Filed:** 2026-04-10 by Tier 3.8 Analyst
**Severity:** Medium — defense-in-depth failure, mitigated in practice by app-layer studio_id lookups
**Discovered by:** `pg_policies` probe during Tier 3.8 (Schedule: Create Class) Analyst phase
**Status:** OPEN — 3 sub-findings, documented, NOT fixed in Tier 3.8 per architect scope
**Related:** BUG-015 (Tier 3.8 4-layer POST handler fix — closed by Tier 3.8 run)

---

## Summary

The `pg_policies` probe during Tier 3.8 Analyst phase surfaced three RLS policy issues on the schedule subsystem (`classes` and `class_types` tables). All three are defense-in-depth failures that are mitigated in practice by Meridian's app layer but represent security posture gaps.

## Sub-findings

### L6 — `classes_write` operator precedence allows cross-tenant admin/manager writes

The current policy:

```sql
CREATE POLICY classes_write ON classes FOR INSERT
WITH CHECK (
  ((studio_id = get_user_studio_id()) AND user_has_role('owner'::text))
  OR user_has_role('admin'::text)
  OR user_has_role('manager'::text)
)
```

Due to SQL operator precedence (AND binds tighter than OR), this parses as:

```
( (studio_id = X AND owner) OR admin OR manager )
```

Which means:

- An **owner** of studio X can INSERT classes only into studio X ✅ correct
- An **admin** can INSERT classes into ANY studio 🚫 cross-tenant
- A **manager** can INSERT classes into ANY studio 🚫 cross-tenant

### Mitigation in practice

The app layer (POST `/api/classes`) fetches `studio_id` from the caller's `profile.studio_id` and passes it to the insert — so in the current codebase, admin/manager users can only write classes to their own studio at the API layer. A malicious user bypassing the API layer and hitting Supabase directly as an admin could theoretically write cross-tenant.

### Correct policy

```sql
CREATE POLICY classes_write ON classes FOR INSERT
WITH CHECK (
  studio_id = get_user_studio_id()
  AND (
    user_has_role('owner'::text)
    OR user_has_role('admin'::text)
    OR user_has_role('manager'::text)
  )
)
```

---

### L7 — `classes_update` has no role restriction

The current policy:

```sql
CREATE POLICY classes_update ON classes FOR UPDATE
USING (studio_id = get_user_studio_id())
```

**Any authenticated user in the studio can UPDATE any class** — including regular members. A member could (in theory) change a class's start time, capacity, trainer, or cancel it via direct Supabase write.

### Mitigation in practice

The app layer (PUT `/api/classes/[id]`) has a role check for owner/manager. Regular members using the UI cannot modify classes. The gap is only exploitable by a user hitting Supabase directly as an authenticated member.

### Correct policy

```sql
CREATE POLICY classes_update ON classes FOR UPDATE
USING (
  studio_id = get_user_studio_id()
  AND (
    user_has_role('owner'::text)
    OR user_has_role('admin'::text)
    OR user_has_role('manager'::text)
  )
)
```

**Note:** The app layer role check for UPDATE is in `apps/web/src/app/api/classes/[id]/route.ts` PUT handler — confirm before closing this finding.

---

### L8 — `class_types_studio_write` has no role restriction

The current policy:

```sql
CREATE POLICY class_types_studio_write ON class_types FOR INSERT
WITH CHECK (studio_id = get_user_studio_id())
```

**Any authenticated user in the studio can create class_types** — including regular members. A member could (in theory) spam class_types via direct Supabase write.

### Mitigation in practice

No admin UI exists for creating class_types (as of 2026-04-10). Class types are seeded via migrations and managed via Supabase Studio. Regular members would need to construct a direct Supabase call. Low likelihood but worth fixing for symmetry with `classes_write`.

### Correct policy

```sql
CREATE POLICY class_types_studio_write ON class_types FOR INSERT
WITH CHECK (
  studio_id = get_user_studio_id()
  AND (
    user_has_role('owner'::text)
    OR user_has_role('admin'::text)
    OR user_has_role('manager'::text)
  )
)
```

Also consider adding a DELETE policy (none exists currently).

---

## Recommended fix window

All three policies should be updated in a single migration to avoid RLS churn. The migration should:

1. Drop the three existing policies
2. Re-create them with the correct WITH CHECK / USING clauses
3. Apply via Supabase MCP `apply_migration`
4. Verify via `pg_policies` probe

### Scheduled for: Tier 3.10 (Reschedule Class)

Tier 3.10 will exercise `classes_update` end-to-end via a new PUT route test — at that point, the L7 app-layer role check (in the PUT handler) can be verified and the RLS gap can be closed in the same tier. Since all three policies are related, handle them together.

Alternatively, if Tier 3.10 reveals that the app-layer PUT role check is missing, handle the RLS fix alongside it as a full BUG-016 remediation.

---

## Out-of-scope remediation

The following would also be nice-to-have but are not blocking:

- Add a DELETE policy on `classes` (currently missing — any authenticated studio user can DELETE a class via direct Supabase write). Tier 3.9 (Cancel Class) uses a status update, not a DELETE, so this is NOT blocking.
- Add a DELETE policy on `class_types`.
- Audit every other table in the `public` schema for similar RLS precedence bugs — it's possible the pattern `(A AND B) OR C OR D` was copy-pasted to other policies.

---

## Detection credit

Discovered by the `pg_policies` probe added to the standing Tier 3+ Analyst checklist after Tier 3.5 (BUG-010 Layer 5 was the first RLS gap caught at Analyst-time). This is the fourth tier where the probe surfaced a finding (3.5 profiles INSERT, 3.6 profiles UPDATE, 3.7 confirmation, 3.8 the three above).
