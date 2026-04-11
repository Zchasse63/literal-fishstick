# BUG-007 — Auth test users seeded into wrong studio (silent RLS blockade for every write spec)

**Status:** Fixed in Tier 3.1 council run (2026-04-09)
**Severity:** High (blocks every Tier 3+ write flow — silently returns empty results instead of erroring)
**Discovered by:** QA pipeline Tier 3.1 (Revenue: Record Payment — the FIRST data-bound write spec)
**Related:** `apps/web/e2e/auth.setup.ts`, `apps/web/e2e/fixtures/test-data.ts`, BUG-001 (`revenue-default-studio-coupling.md`)

---

## Summary

`auth.setup.ts` created the admin and employee Playwright auth users (`meridian-e2e-admin@test.meridian.app`, `meridian-e2e-employee@test.meridian.app`) in the **legacy** isolated studio id `00000000-0000-4000-a000-000000000000`, while:

- The entire admin UI hardcodes `DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'` (BUG-001, 43 pages)
- The shared seed helpers in `e2e/fixtures/db.ts` write to `E2E_STUDIO_ID` (which resolves to `DEFAULT_STUDIO_ID` until BUG-001 is fixed)
- All RLS policies on `profiles`, `members`, `transactions`, `activity_log`, and `studios` are gated by `get_user_studio_id()`, which reads the authenticated user's profile.studio_id

Net effect: **the test admin user could not see any rows seeded by the tests** (and vice versa for inserts from the UI). The admin's `get_user_studio_id()` returned the legacy studio; every `from('members').select()` against `DEFAULT_STUDIO_ID` was filtered out at the RLS layer and returned an empty set. No error, just silent emptiness.

This was hidden through all 11 Tier 2 smoke runs because those tests only asserted that the admin shell / layout mounted — they never actually queried data.

## Why it stayed hidden until Tier 3.1

| Tier | What the tests actually query | Did they hit the studio mismatch? |
|---|---|---|
| 1 (auth) | Session cookies + `/login` form + middleware redirects | No — no data reads |
| 2 (smoke) | `data-testid="*-page-root"` landmarks only | No — layouts mount before data loads; KPI/data hooks fail silently to empty states |
| 3.1 (Record Payment) | `from('profiles').select()` then `from('members').select()` from the **browser** (RLS-scoped) client | **Yes — empty results broke the modal search** |

The two-query pattern in `RecordPaymentModal` is subject to RLS because it uses `createBrowserClient`. Service-role seeding (`testDb` in `e2e/fixtures/db.ts`) bypasses RLS, so the seeded member was in the DB but invisible to the authenticated admin's browser session.

## Root cause

`apps/web/e2e/auth.setup.ts` hardcoded its own constant:

```ts
const TEST_STUDIO_ID = '00000000-0000-4000-a000-000000000000'
```

and then both created the studio AND inserted/updated the two test user profiles pointed at that id. The value happened to match the **deprecated** `ISOLATED_TEST_STUDIO_ID` from `test-data.ts`, which the rest of the test harness had already moved away from when `E2E_STUDIO_ID` was introduced and aliased to `DEFAULT_STUDIO_ID`.

```ts
// test-data.ts — the "correct" value
export const E2E_STUDIO_ID: string =
  process.env.E2E_STUDIO_ID ?? DEFAULT_STUDIO_ID  // resolves to 11111111...
```

`auth.setup.ts` was the last holdout on the legacy id, and the one place where the mismatch mattered because it defined the authenticated user's studio.

## Reproduction (pre-fix)

```
# 1. Seed a member (service-role bypasses RLS → lands in 11111111)
const { memberId } = await seedMember({ fullName: 'E2E RP test' })

# 2. From the authenticated browser context (admin user, studio 00000000), query:
await supabase
  .from('members')
  .select('id, profile_id')
  .eq('studio_id', DEFAULT_STUDIO_ID)  // 11111111

# → RLS rewrites this to: WHERE studio_id = '11111111...'
#   AND studio_id = '00000000...' (from get_user_studio_id())
# → 0 rows
```

## Fix (this council run)

### `apps/web/e2e/auth.setup.ts`

1. Import `E2E_STUDIO_ID` from `./fixtures/test-data`:
   ```ts
   import { E2E_STUDIO_ID } from './fixtures/test-data'
   const TEST_STUDIO_ID = E2E_STUDIO_ID
   ```
   The local constant name is preserved to minimize the diff; its value now resolves to `DEFAULT_STUDIO_ID` via the existing alias chain.

2. Changed the `studios` upsert to `ignoreDuplicates: true`:
   ```ts
   await supabase.from('studios').upsert({ id: TEST_STUDIO_ID, ... }, {
     onConflict: 'id',
     ignoreDuplicates: true,  // ← new
   })
   ```
   This prevents auth-setup from renaming the real "The Sauna Guys" studio row to "E2E Test Studio" on every run. If the row already exists (it does — it's the dev-data studio), the upsert becomes a no-op.

3. `ensureTestUser`'s existing UPDATE branch (`.update({ roles, studio_id: TEST_STUDIO_ID, full_name })`) now migrates the existing admin/employee profiles to the new studio_id on the next auth-setup run. No one-off migration needed.

### Behavioral consequences

- The admin and employee Playwright auth profiles now live in `DEFAULT_STUDIO_ID`, matching the dev data and matching what the admin UI queries.
- `get_user_studio_id()` returns `DEFAULT_STUDIO_ID` for the test admin → RLS allows reads/writes against dev-data rows.
- All existing Tier 1/Tier 2 tests continue to pass (verified: 79/79 admin, 11/11 employee).
- The test admin user now has `roles: ['owner']` inside the real "The Sauna Guys" studio. This is intentional — the test must share the same RLS identity as a real owner to exercise owner-only flows. The isolated dev-data studio already contains only test data.

## Why not fix BUG-001 instead?

BUG-001 (43 admin pages hardcode `DEFAULT_STUDIO_ID`) is the true root cause. Fixing it means introducing a real `StudioContext` / session-scoped studio resolver and touching 43 files. That's a separate, much larger refactor — the roadmap calls out that Tier 3+ tests were always going to proceed using the `DEFAULT_STUDIO_ID` workaround and revisit BUG-001 later.

This BUG-007 fix is the **minimum** change required to unblock Tier 3 write flows under that workaround. Once BUG-001 ships a real StudioContext, BUG-007 can be revisited: the test admin can move back into an isolated studio, and `DEFAULT_STUDIO_ID` references in fixtures / tests can be swept.

## Follow-up

- Any future test user added to `auth.setup.ts` MUST use `E2E_STUDIO_ID` — never hardcode a UUID locally. The pattern is established in the file comments.
- When BUG-001 lands, revisit this and move the test users into a dedicated isolated studio. Keep the fixtures pointed at the real studio only as long as the admin UI does.
