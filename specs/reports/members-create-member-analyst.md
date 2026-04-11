# QA Analyst — Members: Create Member (Tier 3.5)

**Pipeline ID:** `members-create-member`
**Tier:** 3.5 (Core Writes — 5 of 12)
**Project:** `admin`
**Run date:** 2026-04-09
**Phase:** 1 — Analyst

---

## Scope

Full admin "Add Member" write flow from the `/members` directory page through `POST /api/members`. Covers:
- Clicking "Add Member" on `/members` opens the `AddMemberModal`
- Filling `full_name` + `email` + optional `phone`, submitting the form
- Creating a `profiles` row **and** a `members` row (join target of the directory list query)
- Writing an `activity_log` entry keyed to the new member
- Modal closes, directory refetches, new member appears in the list

Out of scope for this tier:
- Editing an existing member (Tier 3.6)
- Archiving / deleting a member (Tier 3.7)
- Email magic-link invitation (Tier 3.5 is DB-only; the modal does not trigger a send today)
- Custom `roles` values — modal hardcodes `roles: ['member']` via API default

## Current state (audit findings)

**BUG-010 filed — feature is non-functional end-to-end.** See `specs/bugs/members-create-schema-divergence.md` for the full 4-layer bug.

TL;DR: `POST /api/members` writes to a phantom `profiles.status` column, never inserts the required `members` row, logs activity with an invalid `type` enum value, and omits the NOT-NULL `description` field. Production evidence: 17 profile-only rows exist (no matching `members`), and **all 17 are `{trainer}` or `{owner}` profiles — not a single `{member}`**. The modal has never successfully produced a member record. Mirrors the BUG-009 (products) pattern: multiple schema-divergent layers that silently fail because the Supabase JS client does not throw on insert errors.

Before any test can run, BUG-010 must be fixed inline. The Engineer phase will apply the code fix first, then write tests.

### Four layers (see BUG-010 spec for full detail)

1. **Phantom `profiles.status` column** — insert includes `status: 'active'`, the column does not exist. Direct INSERT probe via Supabase MCP: `ERROR: 42703: column "status" of relation "profiles" does not exist`.
2. **Missing `members` row** — directory list query at `page.tsx:200` reads from `members` joined to `profiles!inner`, but the POST handler only writes to `profiles`. Even with Layer 1 fixed, newly "added" members would never render.
3. **Invalid `activity_log.type = 'member_created'`** — not in the CHECK constraint. Valid options are `new_member` (legacy) or extending the enum to add `member_created/updated/deleted` (matching the BUG-009 product pattern).
4. **Missing `activity_log.description`** (NOT NULL) — insert omits the required field; the Supabase client silently swallows the NOT NULL violation.

## Data-testid inventory

### Already present
- `members-page-root` on the directory root (`page.tsx:419`) — ✅
- `members-detail-root` on the detail route (existing) — ✅
- `members-detail-not-found` on the detail-not-found branch (existing) — ✅

### [NEEDS SEEDING] for scenarios below

**Directory page (`/members`):**
- `members-add-btn` on the "Add Member" header button (`page.tsx:434`)

**Add Member modal (`AddMemberModal.tsx`):**
- `members-add-modal-dialog` on the outer `DialogContent` (line 34) — use in addition to `getByRole('dialog')` because the dialog title "Add New Member" may be animated in by Radix
- `members-add-modal-name-input` on the `full_name` input (line 72)
- `members-add-modal-email-input` on the email input (line 84)
- `members-add-modal-phone-input` on the phone input (line 95)
- `members-add-modal-error` on the error `<p>` alert block (line 105)
- `members-add-modal-cancel-btn` on the Cancel button (line 109)
- `members-add-modal-submit-btn` on the "Add Member" submit button (line 116)

## Scenarios

| # | Scenario | Priority | Project |
|---|---|---|---|
| 1 | Create member happy path — `full_name + email + phone`; assert `profiles` row with correct `email`, `full_name`, `roles=['member']`, `studio_id=DEFAULT_STUDIO_ID`, `is_active=true`; **and** `members` row with matching `profile_id`, default `membership_status='active'`, `credits_remaining=0`, `join_date=today` | P0 | admin |
| 2 | Create member writes **both** `profiles` AND `members` rows — explicit assertion that `members.profile_id = profiles.id` (Layer 2 fix proof) | P0 | admin |
| 3 | Create member writes `activity_log` row with non-null `description`, valid `type` (accept either `new_member` or `member_created` per Architect's enum decision), `subject_type='profile' \| 'member'`, `subject_id=profile.id` (Layers 3 + 4 fix proof) | P0 | admin |
| 4 | Directory list refetches after create and renders the new member row — `members-page-root` contains a row whose email matches the test prefix | P0 | admin |
| 5 | Blank email blocks submission — native HTML `required` prevents submit, zero DB mutation on the `profiles` table keyed by test prefix | P1 | admin |
| 6 | Blank name keeps Submit disabled — assert `members-add-modal-submit-btn` has `[disabled]` attribute when `full_name === ''`, zero DB mutation | P1 | admin |
| 7 | Duplicate email returns 409 and surfaces error in modal — `members-add-modal-error` becomes visible with the server's message, modal stays open, only one `profiles` row exists for that email | P1 | admin |
| 8 | Invalid email format returns 400 — `members-add-modal-error` visible, zero `profiles` row for that literal | P1 | admin |
| 9 | Cancel button closes modal without writing — click cancel after typing, dialog closes, zero `profiles` row for the typed email | P1 | admin |

Scenarios 1–4 are P0 (happy path + write-integrity proofs for all four BUG-010 layers). 5–9 are P1 validation edges.

## Test data strategy

- All test rows use the prefix `E2ETestMember_` (pattern matches `E2E_PRODUCT_NAME_PREFIX` from Tier 3.4 — add `E2E_MEMBER_NAME_PREFIX` to `apps/web/e2e/fixtures/test-data.ts`).
- Emails use `e2e-member-${Date.now()}@test.meridian.local` to avoid collision with the existing 1,187 production member rows.
- Setup: no seeding required — the scenarios exercise the create path itself. The duplicate-email scenario (7) seeds one profile via `testDb` before the test and relies on the scoped prefix.
- Teardown: extend `resetStudioTestData` with a scoped members cleanup step:
  ```ts
  // Delete members + profiles + activity_log scoped to the test prefix
  const { data: testProfiles } = await testDb
    .from('profiles')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('full_name', `${E2E_MEMBER_NAME_PREFIX}%`)
  const ids = (testProfiles ?? []).map(p => p.id)
  if (ids.length) {
    await testDb.from('activity_log').delete().in('subject_id', ids)
    await testDb.from('members').delete().in('profile_id', ids)
    await testDb.from('profiles').delete().in('id', ids)
  }
  ```
- Order matters: activity_log → members → profiles (FK cascade order).

## Assertions pattern (DB)

```ts
// Scenario 1 + 2 — profile AND member row proof
const { data: profile } = await testDb
  .from('profiles')
  .select('*')
  .eq('studio_id', DEFAULT_STUDIO_ID)
  .eq('email', testEmail)
  .single()

expect(profile?.full_name).toBe(testName)
expect(profile?.roles).toContain('member')
expect(profile?.is_active).toBe(true)

const { data: member } = await testDb
  .from('members')
  .select('*')
  .eq('profile_id', profile!.id)
  .single()

expect(member).not.toBeNull()
expect(member?.studio_id).toBe(DEFAULT_STUDIO_ID)
expect(member?.membership_status).toBe('active')
expect(member?.credits_remaining).toBe(0)

// Scenario 3 — activity_log + description populated
const { data: logs } = await testDb
  .from('activity_log')
  .select('*')
  .eq('subject_id', profile!.id)

const createLog = logs?.find(l =>
  l.type === 'new_member' || l.type === 'member_created'
)
expect(createLog).toBeDefined()
expect(createLog?.description).toBeTruthy() // NOT NULL constraint proof
expect(createLog?.description).toContain(testName)
```

## Pre-requisites

1. **BUG-010 must be fixed inline before Engineer can write tests.** All four layers in a single PR, following the BUG-009 council-run pattern.
2. Testids must be seeded in Engineer Step 1 (8 new testids on `AddMemberModal.tsx` + `members/page.tsx`).
3. `apps/web/e2e/pages/MembersPage.ts` POM already exists — extend it with `openAddMemberModal()`, `fillMemberForm({ name, email, phone })`, `submitAddMemberModal()`, `expectAddMemberModalError()`, etc. (The POM header comment at line 16 explicitly anticipates this Tier 3.5 extension.)
4. `apps/web/e2e/fixtures/test-data.ts` must export `E2E_MEMBER_NAME_PREFIX = 'E2ETestMember_'`.
5. `apps/web/e2e/fixtures/db.ts` must extend `resetStudioTestData` with the scoped members cleanup step shown above, and add a `seedProfileOnly(email)` helper for the duplicate-email scenario.

## Clarification log

**Activity log enum decision (blocking the Architect phase):** The Architect must decide between:

- **Option A (preferred)** — Extend the `activity_log.type` CHECK constraint to add `member_created`, `member_updated`, `member_deleted`. Keep `new_member` as a legacy alias (do not drop). This matches the BUG-009 Part A product pattern (`product_created`/`product_updated`/`product_deleted` already added) and keeps the `{subject}_{action}` naming convention coherent across subject types.
- **Option B** — Reuse the existing legacy `new_member` value. No migration needed, but Members is then the only subject using the old naming, which will confuse Tier 3.6 (Edit Member) and 3.7 (Archive Member).

Recommendation: **Option A.** The scenario assertions above accept either so the test suite doesn't block on the decision, but the Architect should call the shot in the blueprint.

**Dual-role accounts (out of scope for this tier):** The Meridian edge-case policies (see `CLAUDE.md`) note that a single account may carry `{admin, member}` or `{trainer, member}` roles. This tier only covers the default `roles: ['member']` insert. Multi-role testing belongs in a dedicated Tier 3.x run — flag but do not block.

**Member `profile_id` uniqueness:** The `members` table has a unique constraint on `profile_id` (enforced by the existing 1,187 rows). Re-creating a member for a profile that already has one will 409/500. This is correct behavior; Scenario 7 covers the duplicate path at the email level which triggers the pre-insert 409 check before reaching the members insert.

## Next phase

Architect: design the inline BUG-010 fix plan + testid seeding plan + POM extension + test plan as a single Engineer-phase checklist. Follow the Tier 3.4 Engineer-phase checklist format (`revenue-products-crud-architect.md`) as the template.
