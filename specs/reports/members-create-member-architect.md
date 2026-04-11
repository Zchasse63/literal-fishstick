# QA Architect — Members: Create Member (Tier 3.5)

**Pipeline ID:** `members-create-member`
**Tier:** 3.5
**Phase:** 2 — Architect
**Run date:** 2026-04-09

---

## Input

- Analyst scenarios: `specs/reports/members-create-member-analyst.md`
- BUG-010 (inline fix required): `specs/bugs/members-create-schema-divergence.md`

## Decision log

**Activity log enum — Option A chosen.** Extend the `activity_log.type` CHECK constraint to add `member_created`, `member_updated`, `member_deleted`. Keep `new_member` as a legacy alias for compatibility — do NOT drop it (an unknown number of legacy rows and third-party pipelines may reference it). This mirrors the BUG-009 Part A product pattern and keeps the `{subject}_{action}` convention coherent across all future member write flows (Tier 3.6 Edit, 3.7 Archive).

**Minimum viable `members` insert**: `{ profile_id, studio_id }`. Every other column has a DB default. Explicitly pass `join_date: today` and `membership_status: 'active'` because those are the two fields the admin UI surfaces, and surfacing them in the API makes the write path self-documenting.

**No separate `seedProfileOnly` helper.** The existing `seedMember()` in `fixtures/db.ts` already creates both rows correctly. For Scenario 7 (duplicate email), call `seedMember({ email: dupEmail, fullName: 'E2ETestMember_dup' })` before the test — the POST handler's 409 check runs before any inserts.

**Activity-log cleanup gap.** `resetStudioTestData` currently deletes test profiles via the `e2e-member-%` email pattern but does NOT delete any `activity_log` rows keyed to those profiles. Before BUG-010 is fixed, this is fine because the inserts are silently failing. After the fix, each created member produces an activity_log row and those rows will leak after cleanup. Fix: add an `activity_log` cleanup step keyed to `subject_id IN (testProfileIds)` before the profile delete.

## Blueprint

### Step 0 — Database migration (BUG-010 Layer 3)

Apply via Supabase MCP `mcp__eb733721-...__apply_migration` — matches the Tier 3.4 migration path.

```sql
-- BUG-010 Layer 3: extend activity_log.type CHECK to include member events
-- Mirrors BUG-009 Part A for products.
ALTER TABLE activity_log DROP CONSTRAINT activity_log_type_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_type_check CHECK (type = ANY (ARRAY[
  'check_in'::text, 'booking'::text, 'cancellation'::text, 'payment'::text,
  'failed_payment'::text, 'membership_change'::text, 'walk_in'::text,
  'new_member'::text, 'refund'::text, 'strike'::text, 'clock_in'::text,
  'clock_out'::text,
  'product_created'::text, 'product_updated'::text, 'product_deleted'::text,
  'member_created'::text, 'member_updated'::text, 'member_deleted'::text
]));
```

**Pre-flight verification:** query `pg_constraint` before and after to confirm the constraint now has 18 values. Tier 3.4 added 3 (products), this adds 3 (members), baseline was 12.

### Step 1 — Fix API route `/api/members` POST handler (BUG-010 Layers 1, 2, 4)

**File:** `apps/web/src/app/api/members/route.ts`

#### Layer 1 — remove phantom `status` column

Delete `status: "active"` from the `profiles.insert(...)` payload. The `profiles` table has `is_active boolean NOT NULL DEFAULT true` — leave it to the default.

#### Layer 2 — insert `members` row after profile insert succeeds

After `profiles.insert().select().single()` returns the new profile, add:

```ts
const { error: memberInsertError } = await supabase
  .from("members")
  .insert({
    profile_id: member.id,
    studio_id: studioId,
    membership_status: "active",
    join_date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  });

if (memberInsertError) {
  // Roll back the profile we just created so we don't leak orphan rows.
  await supabase.from("profiles").delete().eq("id", member.id);
  return NextResponse.json(
    { error: `Failed to create member row: ${memberInsertError.message}` },
    { status: 500 }
  );
}
```

Roll-back-on-partial-failure is critical — without it, every failure case leaks a profile row, which is the production symptom that produced BUG-010 in the first place (17 trainer/owner profiles with no members row).

#### Layer 3 — use the new enum value

Change `type: "member_created"` → will now succeed after Step 0 migration.

#### Layer 4 — add `description` field to activity_log insert

```ts
await supabase.from("activity_log").insert({
  studio_id: studioId,
  actor_id: user.id,
  type: "member_created",
  subject_type: "profile", // keep as "profile" — the profile is the primary subject; the members row is a companion
  subject_id: member.id,
  description: `Member created: ${full_name}`,
  metadata: { email, full_name },
});
```

Rename the local `member` variable to avoid confusion — it holds the profile, not the members row. Rename to `profile`.

#### Rename for clarity

```ts
const { data: profile, error: insertError } = await supabase
  .from("profiles")
  .insert({ /* no status */ })
  .select()
  .single();

// ... members row insert keyed to profile.id ...

// ... activity_log insert keyed to profile.id ...

return NextResponse.json({ data: profile }, { status: 201 });
```

The API response shape stays `{ data: profile }` so the modal's success handler doesn't need to change.

### Step 2 — Seed data-testids (Engineer Step 1)

Per Analyst inventory. Edit two files:

**File: `apps/web/src/app/(admin)/members/_components/AddMemberModal.tsx`**
- Line 34 `DialogContent`: add `data-testid="members-add-modal-dialog"`
- Line 72 `<input>` name: add `data-testid="members-add-modal-name-input"`
- Line 84 `<input>` email: add `data-testid="members-add-modal-email-input"`
- Line 95 `<input>` phone: add `data-testid="members-add-modal-phone-input"`
- Line 105 error `<p>`: add `data-testid="members-add-modal-error"`
- Line 109 Cancel `<button>`: add `data-testid="members-add-modal-cancel-btn"`
- Line 116 Submit `<button>`: add `data-testid="members-add-modal-submit-btn"`

**File: `apps/web/src/app/(admin)/members/page.tsx`**
- Line 434 "Add Member" `<button>`: add `data-testid="members-add-btn"`

### Step 3 — Extend `MembersPage` POM

**File:** `apps/web/e2e/pages/MembersPage.ts`

Append (keep existing smoke helpers as-is):

```ts
// ─── Tier 3.5: Add Member modal ─────────────────────────────────

addMemberTriggerBtn(): Locator {
  return this.byTestId('members-add-btn')
}

addMemberModal(): Locator {
  return this.byTestId('members-add-modal-dialog')
}

addMemberNameInput(): Locator {
  return this.byTestId('members-add-modal-name-input')
}

addMemberEmailInput(): Locator {
  return this.byTestId('members-add-modal-email-input')
}

addMemberPhoneInput(): Locator {
  return this.byTestId('members-add-modal-phone-input')
}

addMemberSubmitBtn(): Locator {
  return this.byTestId('members-add-modal-submit-btn')
}

addMemberCancelBtn(): Locator {
  return this.byTestId('members-add-modal-cancel-btn')
}

addMemberErrorAlert(): Locator {
  return this.byTestId('members-add-modal-error')
}

async openAddMemberModal(): Promise<void> {
  await this.addMemberTriggerBtn().click()
  await expect(this.addMemberModal()).toBeVisible({ timeout: ANIM_TIMEOUT })
}

async fillAddMemberForm(opts: { name: string; email: string; phone?: string }): Promise<void> {
  await this.addMemberNameInput().fill(opts.name)
  await this.addMemberEmailInput().fill(opts.email)
  if (opts.phone) {
    await this.addMemberPhoneInput().fill(opts.phone)
  }
}

async submitAddMemberForm(): Promise<void> {
  await this.addMemberSubmitBtn().click()
}

async cancelAddMemberForm(): Promise<void> {
  await this.addMemberCancelBtn().click()
  await expect(this.addMemberModal()).toBeHidden({ timeout: ANIM_TIMEOUT })
}

async expectAddMemberError(messageSubstring?: string): Promise<void> {
  await expect(this.addMemberErrorAlert()).toBeVisible({ timeout: ANIM_TIMEOUT })
  if (messageSubstring) {
    await expect(this.addMemberErrorAlert()).toContainText(messageSubstring)
  }
}
```

No new `DirectoryPage` file — keep extending `MembersPage.ts` with a section header.

### Step 4 — Extend `test-data.ts`

**File:** `apps/web/e2e/fixtures/test-data.ts`

Add after `E2E_PRODUCT_NAME_PREFIX`:

```ts
/** Full-name prefix for seeded member profiles created via the AddMember modal flow. */
export const E2E_MEMBER_NAME_PREFIX = 'E2ETestMember_'
```

The email pattern `e2e-member-%@test.meridian.app` already exists and is used by `resetStudioTestData`. Reuse it — test emails must match this pattern.

### Step 5 — Extend `resetStudioTestData` with activity_log cleanup

**File:** `apps/web/e2e/fixtures/db.ts`

In the existing cleanup function, between Step 5 (bookings delete) and Step 6 (members delete), insert:

```ts
// 5b. Delete activity_log rows keyed to test profiles (both profile-subject
// and member-subject events). Must run before the profiles delete to avoid
// FK orphans. Scoped to the collected testProfileIds so dev activity is
// untouched.
if (testProfileIds.length > 0) {
  await testDb
    .from('activity_log')
    .delete()
    .in('subject_id', testProfileIds)
}
```

No change needed to Steps 6–7 (member + profile deletes) — they already run in the correct order.

### Step 6 — Write spec file

**File:** `apps/web/e2e/members-create-member.spec.ts`

Structure mirrors `revenue-products-crud.spec.ts` (Tier 3.4 precedent). 9 tests matching Analyst scenarios 1–9. Uses `MembersPage` POM, `testDb` service client, `resetStudioTestData()` in `beforeEach` + `afterAll`.

Test skeleton:

```ts
import { test, expect } from '@playwright/test'
import { MembersPage } from './pages/MembersPage'
import { testDb, resetStudioTestData, seedMember } from './fixtures/db'
import {
  DEFAULT_STUDIO_ID,
  E2E_MEMBER_NAME_PREFIX,
} from './fixtures/test-data'

test.describe('Members — Create Member (Tier 3.5)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  test('[P0] creates profile + member + activity_log end-to-end', async ({ page }) => {
    const members = new MembersPage(page)
    await page.goto('/members')
    await members.expectDirectoryMounted()

    const uniqueId = Date.now()
    const testName = `${E2E_MEMBER_NAME_PREFIX}${uniqueId}`
    const testEmail = `e2e-member-${uniqueId}@test.meridian.app`

    await members.openAddMemberModal()
    await members.fillAddMemberForm({
      name: testName,
      email: testEmail,
      phone: '+15555551234',
    })
    await members.submitAddMemberForm()

    // Modal should close on success
    await expect(members.addMemberModal()).toBeHidden({ timeout: 5000 })

    // DB: profile row
    const { data: profile } = await testDb
      .from('profiles')
      .select('*')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('email', testEmail)
      .single()

    expect(profile).not.toBeNull()
    expect(profile?.full_name).toBe(testName)
    expect(profile?.roles).toContain('member')
    expect(profile?.is_active).toBe(true)

    // DB: members row (Layer 2 fix proof)
    const { data: member } = await testDb
      .from('members')
      .select('*')
      .eq('profile_id', profile!.id)
      .single()

    expect(member).not.toBeNull()
    expect(member?.studio_id).toBe(DEFAULT_STUDIO_ID)
    expect(member?.membership_status).toBe('active')
    expect(member?.credits_remaining).toBe(0)
    expect(member?.join_date).toBeTruthy()

    // DB: activity_log row (Layers 3 + 4 fix proof)
    const { data: logs } = await testDb
      .from('activity_log')
      .select('*')
      .eq('subject_id', profile!.id)

    const createLog = logs?.find(l => l.type === 'member_created')
    expect(createLog).toBeDefined()
    expect(createLog?.description).toBeTruthy()
    expect(createLog?.description).toContain(testName)
  })

  // ... 8 more tests ...
})
```

### Step 7 — Run tests

```bash
# Single feature, 3 repeats for flake detection
npx playwright test members-create-member.spec.ts --project=admin --repeat-each=3
```

Expected: 9 × 3 = 27 passing.

### Step 8 — Run admin regression (Sentinel round 2)

```bash
npx playwright test --project=admin
```

Expected: 88 + 9 = 97 passing.

## File change inventory

| # | File | Change type | LoC est |
|---|---|---|---|
| 1 | (migration via Supabase MCP) `activity_log_type_check` extension | apply | 10 |
| 2 | `apps/web/src/app/api/members/route.ts` | edit | 40 |
| 3 | `apps/web/src/app/(admin)/members/_components/AddMemberModal.tsx` | edit (testids) | 8 |
| 4 | `apps/web/src/app/(admin)/members/page.tsx` | edit (testid) | 1 |
| 5 | `apps/web/e2e/fixtures/test-data.ts` | edit | 3 |
| 6 | `apps/web/e2e/fixtures/db.ts` | edit (cleanup step) | 10 |
| 7 | `apps/web/e2e/pages/MembersPage.ts` | edit (POM extension) | 80 |
| 8 | `apps/web/e2e/members-create-member.spec.ts` | create | 310 |

Total: ~462 LoC across 8 files. Smaller than Tier 3.4 (~693 LoC) because no UI-wiring work is required — the modal already exists and functions; only the API and tests need work.

## Risks / open questions

- **Q: Does dropping + re-adding `activity_log_type_check` leave a gap where a concurrent insert could violate the constraint?** A: No — Postgres wraps DROP + ADD CONSTRAINT in the same transaction. If ADD fails mid-transaction, Postgres rolls back DROP.
- **Q: The 17 orphan profiles (trainer/owner) in production — should BUG-010 fix clean them up?** A: No. Those are pre-existing data from Glofox migration and legitimate owner/trainer rows that (correctly) should not have `members` rows. BUG-010 fix only affects the go-forward write path, not historical data.
- **Q: `subject_type='profile'` vs `subject_type='member'` in activity_log?** A: Use `'profile'` — the canonical identity is the profile row, the members row is a facet. Tier 3.6 (Edit Member) will touch `members` fields; if that tier decides to split subject types, revisit then.
- **Risk: The modal's `disabled` check (`!addForm.full_name || !addForm.email`) means Scenario 6 (blank name keeps Submit disabled) is a client-only check.** That's fine — the test asserts the `disabled` attribute is present; no network request happens; no DB mutation.
- **Risk: Scenario 5 (blank email) is blocked by native HTML `required` + `type="email"`.** Playwright `.click()` on a submit inside a `<form>` with invalid required fields will NOT trigger submission. Test assertion: after clicking submit, modal is still open, `members-add-modal-error` is NOT visible, no DB mutation.

## Next phase

Engineer: execute steps 0–8 in order. Stop and report back if any step fails or produces unexpected output. Update the TodoWrite list as each step completes.
