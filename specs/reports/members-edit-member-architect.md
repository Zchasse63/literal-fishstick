# QA Council — Members: Edit Member (Tier 3.6) — ARCHITECT

**Pipeline ID:** `members-edit-member`
**Tier:** 3.6
**Phase:** 2 — Architect
**Date:** 2026-04-09
**Predecessor:** `members-edit-member-analyst.md`

---

## Decision log (Analyst → Architect)

1. **Scope:** Build inline (Option B). Confirmed.
2. **Edit button placement:** Top-right of profile header card, pencil icon button next to the X close button. Confirmed.
3. **Modal pattern:** Mirror `AddMemberModal.tsx` exactly (same component shape, same testid pattern, same form layout). 4 fields: full_name, email, phone, notes.
4. **Refresh strategy:** `onSuccess` callback triggers a re-fetch in the parent `members/page.tsx`, same as `AddMemberModal`.
5. **Migration:** Single new RLS UPDATE policy for admins on profiles. NO column or constraint changes.
6. **`exclude_from_analytics`:** Leave in `allowedFields` (route-side); do NOT add a checkbox in the modal. Out of scope for Tier 3.6 — Tier 3.7 GAP-5.
7. **Activity log:** No rollback. Capture-and-log pattern matching POST `/api/members` and Tier 3.5.
8. **`seedMember` extension:** Add `notes?: string` to `SeedMemberOptions` so tests can pre-populate notes for the "modal pre-fills" scenario.

---

## 8-step blueprint

### Step 1 — Migration
Apply via Supabase MCP `apply_migration` with name `bug012_profiles_update_admin_policy`:

```sql
CREATE POLICY profiles_update_admin ON profiles
  FOR UPDATE
  USING (studio_id = get_user_studio_id())
  WITH CHECK (studio_id = get_user_studio_id());
```

Coexists with `profiles_update_own` (Postgres OR's matching policies). Members keep self-update; admins gain studio-scoped update. Application `requireRole(['owner','manager'])` still gates the route.

**Verification:** After apply, run `SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS withcheck_expr FROM pg_policy WHERE polrelid = 'public.profiles'::regclass ORDER BY polname;` and confirm 4 policies (read, update_admin, update_own, write).

---

### Step 2 — Fix `PUT /api/members/[id]` (6 layers)

File: `apps/web/src/app/api/members/[id]/route.ts` (PUT handler at lines 139–255).

**Changes (in order, all in the same handler):**

1. **Layer 2 + 3 — Strip phantom fields from `allowedFields`:**
   ```ts
   // Profile-level fields only. Membership state changes use the dedicated
   // upgrade/pause/downgrade routes; `notes` is handled below as a separate
   // dual-write target on the `members` table.
   const profileAllowedFields = [
     "full_name",
     "email",
     "phone",
     "exclude_from_analytics",
   ];
   const memberAllowedFields = ["notes"];
   ```

2. **Layer 1 — Split incoming body into two update payloads:**
   ```ts
   const profileUpdates: Record<string, unknown> = {};
   const memberUpdates: Record<string, unknown> = {};
   for (const field of profileAllowedFields) {
     if (body[field] !== undefined) profileUpdates[field] = body[field];
   }
   for (const field of memberAllowedFields) {
     if (body[field] !== undefined) memberUpdates[field] = body[field];
   }

   if (profileUpdates.phone !== undefined) {
     profileUpdates.phone = normalizePhone(profileUpdates.phone as string | null);
   }

   if (
     Object.keys(profileUpdates).length === 0 &&
     Object.keys(memberUpdates).length === 0
   ) {
     return NextResponse.json(
       { error: "No valid fields to update" },
       { status: 400 }
     );
   }
   ```

3. **Layer 1.5 — Server-side email format validation (matches POST):**
   ```ts
   if (typeof profileUpdates.email === "string") {
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(profileUpdates.email)) {
       return NextResponse.json(
         { error: "Invalid email format" },
         { status: 400 }
       );
     }
   }
   ```

4. **Layer 6 — Duplicate-email check (when email is being changed):**
   ```ts
   if (profileUpdates.email !== undefined) {
     const { data: existing } = await supabase
       .from("profiles")
       .select("id")
       .eq("email", profileUpdates.email)
       .eq("studio_id", studioId)
       .neq("id", id)
       .maybeSingle();
     if (existing) {
       return NextResponse.json(
         { error: "A member with this email already exists" },
         { status: 409 }
       );
     }
   }
   ```

5. **Profile update (only if there are profile fields):**
   ```ts
   let updatedProfile = null;
   if (Object.keys(profileUpdates).length > 0) {
     profileUpdates.updated_at = new Date().toISOString();
     const { data, error } = await supabase
       .from("profiles")
       .update(profileUpdates)
       .eq("id", id)
       .eq("studio_id", studioId)
       .select()
       .single();
     if (error) {
       return NextResponse.json(
         { error: "Internal server error" },
         { status: 500 }
       );
     }
     if (!data) {
       return NextResponse.json(
         { error: "Member not found" },
         { status: 404 }
       );
     }
     updatedProfile = data;
   }
   ```

6. **Member update (only if there are member fields — Layer 1):**
   ```ts
   if (Object.keys(memberUpdates).length > 0) {
     memberUpdates.updated_at = new Date().toISOString();
     const { error: memberError } = await supabase
       .from("members")
       .update(memberUpdates)
       .eq("profile_id", id)
       .eq("studio_id", studioId);
     if (memberError) {
       return NextResponse.json(
         { error: `Failed to update member fields: ${memberError.message}` },
         { status: 500 }
       );
     }
   }
   ```

7. **Layer 4 — activity_log with description + capture-and-log:**
   ```ts
   const updatedFields = [
     ...Object.keys(profileUpdates).filter((k) => k !== "updated_at"),
     ...Object.keys(memberUpdates).filter((k) => k !== "updated_at"),
   ];
   const memberName =
     (updatedProfile?.full_name as string | undefined) ??
     "(unknown)";
   const { error: activityError } = await supabase.from("activity_log").insert({
     studio_id: studioId,
     actor_id: user.id,
     type: "member_updated",
     subject_type: "profile",
     subject_id: id,
     description: `Member updated: ${memberName}`,
     metadata: { ...profileUpdates, ...memberUpdates, fields: updatedFields },
   });
   if (activityError) {
     console.error(
       "PUT /api/members/[id]: activity_log insert failed",
       activityError.message
     );
   }
   ```

8. **AI cache invalidation stays as-is.** Return shape: prefer `data: updatedProfile` if profile was updated, else fall back to a `{ data: { id } }` shape for notes-only updates so the modal can still close cleanly.

   ```ts
   return NextResponse.json({ data: updatedProfile ?? { id } });
   ```

**Note:** If the modal only changes `notes` (no profile fields), `updatedProfile` will be null. In practice the modal always includes name + email + phone + notes from the form, so the profile branch is always taken — but the handler must not crash when only member fields change.

---

### Step 3 — Seed testids in `MemberProfilePanel.tsx`

File: `apps/web/src/app/(admin)/members/_components/MemberProfilePanel.tsx`

**Changes:**

1. Add `Pencil` to the lucide-react import block:
   ```ts
   import { ..., Pencil, ... } from 'lucide-react'
   ```

2. Add `editOpen` state at the top of the component:
   ```ts
   const [editOpen, setEditOpen] = useState(false)
   ```

3. Add the Edit button **between the avatar/name block and the Close X button** in the profile header card (lines 69–103):

   ```tsx
   <div className="flex items-center gap-1">
     <button
       data-testid="members-edit-btn"
       onClick={() => setEditOpen(true)}
       aria-label="Edit member"
       className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
     >
       <Pencil className="h-4 w-4" />
     </button>
     <button
       onClick={onClose}
       aria-label="Close panel"
       className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
     >
       <X className="h-4 w-4" />
     </button>
   </div>
   ```

4. Import `EditMemberModal` (created in Step 4) and render it at the bottom of the component alongside the existing Pause / Upgrade / AIDetail modals:
   ```tsx
   <EditMemberModal
     open={editOpen}
     onOpenChange={setEditOpen}
     memberId={member.id}
     initialName={`${member.firstName} ${member.lastName}`}
     initialEmail={member.email ?? ''}
     initialPhone={member.phone ?? ''}
     initialNotes={member.notes ?? ''}
     onSuccess={() => notify('Member updated successfully')}
   />
   ```

   The `notify` callback will trigger the parent's `loadMembers()` re-fetch via the existing toast hook chain.

5. **`Member` type extension:** Check `_components/types.ts` to confirm `Member` already has `notes?: string`. If not, add it. (This is the prop the modal needs.)

---

### Step 4 — Create `EditMemberModal.tsx`

File: `apps/web/src/app/(admin)/members/_components/EditMemberModal.tsx` (NEW)

Mirror `AddMemberModal.tsx` exactly. Differences:
- Props: `memberId: string`, `initialName/Email/Phone/Notes: string`
- State: pre-filled with the initials in `useState`
- Submit: `PUT /api/members/${memberId}` with `{ full_name, email, phone, notes }`
- Title: "Edit Member"
- Submit button text: "Save Changes" (loading: "Saving...")
- Add a notes `<textarea>` field below phone (3 rows, optional)

**Exact testids:**
- `members-edit-modal` on `<DialogContent>`
- `members-edit-name-input` on name `<input>`
- `members-edit-email-input` on email `<input>`
- `members-edit-phone-input` on phone `<input>`
- `members-edit-notes-input` on notes `<textarea>`
- `members-edit-error` on the error `<p>` block
- `members-edit-cancel-btn` on Cancel button
- `members-edit-submit` on Save button

**Submit logic** (reset error before fetch, set loading, propagate parsed `error` field, close modal on success):
```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError(null)
  try {
    const res = await fetch(`/api/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to update member')
    handleClose()
    onSuccess()
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Something went wrong')
  } finally {
    setLoading(false)
  }
}
```

`handleClose` resets form to initials (NOT to empty — so re-opening the modal shows the still-current values, which the parent should re-pass via prop on the next render after `onSuccess` triggers a fetch).

---

### Step 5 — Extend `MembersPage` POM

File: `apps/web/e2e/pages/MembersPage.ts`

Add a new section after the existing Tier 3.5 block:

```ts
// ─── Tier 3.6: Edit Member modal ────────────────────────────────────────
//
// Locators + helpers for the admin "Edit Member" write flow. The modal is
// triggered from a pencil icon in the MemberProfilePanel header and is
// wired through PUT /api/members/[id]. BUG-012 (6-layer divergence) was
// fixed inline as part of the Tier 3.6 council run; these helpers assume
// the fix is live.

editMemberTriggerBtn(): Locator {
  return this.byTestId('members-edit-btn')
}

editMemberModal(): Locator {
  return this.byTestId('members-edit-modal')
}

editMemberNameInput(): Locator {
  return this.byTestId('members-edit-name-input')
}

editMemberEmailInput(): Locator {
  return this.byTestId('members-edit-email-input')
}

editMemberPhoneInput(): Locator {
  return this.byTestId('members-edit-phone-input')
}

editMemberNotesInput(): Locator {
  return this.byTestId('members-edit-notes-input')
}

editMemberSubmitBtn(): Locator {
  return this.byTestId('members-edit-submit')
}

editMemberCancelBtn(): Locator {
  return this.byTestId('members-edit-cancel-btn')
}

editMemberErrorAlert(): Locator {
  return this.byTestId('members-edit-error')
}

async openEditMemberModal(): Promise<void> {
  await this.editMemberTriggerBtn().click()
  await expect(this.editMemberModal()).toBeVisible({ timeout: ANIM_TIMEOUT })
}

async fillEditMemberForm(opts: {
  name?: string
  email?: string
  phone?: string
  notes?: string
}): Promise<void> {
  if (opts.name !== undefined) await this.editMemberNameInput().fill(opts.name)
  if (opts.email !== undefined) await this.editMemberEmailInput().fill(opts.email)
  if (opts.phone !== undefined) await this.editMemberPhoneInput().fill(opts.phone)
  if (opts.notes !== undefined) await this.editMemberNotesInput().fill(opts.notes)
}

async submitEditMemberForm(): Promise<void> {
  await this.editMemberSubmitBtn().click()
}

async cancelEditMemberForm(): Promise<void> {
  await this.editMemberCancelBtn().click()
  await expect(this.editMemberModal()).toBeHidden({ timeout: ANIM_TIMEOUT })
}

async expectEditMemberError(messageSubstring?: string): Promise<void> {
  await expect(this.editMemberErrorAlert()).toBeVisible({
    timeout: ANIM_TIMEOUT,
  })
  if (messageSubstring) {
    await expect(this.editMemberErrorAlert()).toContainText(messageSubstring)
  }
}

async editMemberViaModal(opts: {
  name?: string
  email?: string
  phone?: string
  notes?: string
}): Promise<void> {
  await this.openEditMemberModal()
  await this.fillEditMemberForm(opts)
  await this.submitEditMemberForm()
  await expect(this.editMemberModal()).toBeHidden({ timeout: ANIM_TIMEOUT })
}
```

---

### Step 6 — Extend `seedMember` to accept `notes`

File: `apps/web/e2e/fixtures/db.ts`

Add `notes?: string | null` to `SeedMemberOptions` and pass it through to the `members` insert:

```ts
export type SeedMemberOptions = {
  // ...existing fields...
  /** Optional notes string. Defaults to null. */
  notes?: string | null
}
```

In `seedMember`:
```ts
const { error: memberError } = await testDb.from('members').insert({
  // ...existing fields...
  notes: opts.notes ?? null,
  // ...
})
```

---

### Step 7 — Write `members-edit-member.spec.ts`

File: `apps/web/e2e/members-edit-member.spec.ts` (NEW)

9 tests mirroring Tier 3.5 cadence. Pattern:
- `beforeEach` runs `resetStudioTestData()`
- Each test seeds its own member via `seedMember({...})` (not via the create modal — that's tested separately in Tier 3.5)
- After mounting the directory, tests need a way to select a specific member and open its panel

**Critical: how do tests select a seeded member?**

Looking at Tier 3.5 spec — it never opened the panel. It only created members. For Tier 3.6, tests must:
1. Seed a member via `seedMember`
2. Navigate to `/members`
3. Click that specific member's row in the directory to open the panel
4. Click the Edit pencil button
5. Drive the modal

To click the specific row reliably, tests will use the existing search box (Tier 3.5 BUG-011 workaround) to filter the directory to just the seeded member, then click the first/only row. If the row click selector is not testid-stable, an additional testid needs to be seeded on the row container.

**Pre-flight check during Engineer phase:** Confirm whether `members/page.tsx` rows have a testid like `members-directory-row` or similar. If NOT, seed one as `members-directory-row` with `data-row-key={member.id}`. This is the same pattern documented in `apps/web/AGENTS.md` for table rows.

**Test scenarios** (full inventory below). Key helpers:
- `seedMember({ fullName, email, phone, notes })` — pre-populated row
- A new helper `selectMemberInDirectory(name)` on `MembersPage` that fills the search box and clicks the matching row

```ts
// Helper added to MembersPage POM (Step 5 addendum)
async selectMemberInDirectory(searchTerm: string): Promise<void> {
  await this.page.getByPlaceholder('Search members...').fill(searchTerm)
  // Wait for the debounce + render
  await this.page
    .getByTestId('members-directory-row')
    .filter({ hasText: searchTerm })
    .first()
    .click()
  // Wait for the panel to mount
  await expect(this.byTestId('members-profile-panel-root')).toBeVisible({
    timeout: ANIM_TIMEOUT,
  })
}
```

(If `members-directory-row` and `members-profile-panel-root` testids don't exist yet, add them in Step 3 alongside `members-edit-btn` — flag for the Engineer.)

---

### Step 8 — Flake check + admin regression

After all 9 tests pass once on the admin project:

1. **Flake detection:** `npx playwright test e2e/members-edit-member.spec.ts --project=admin --repeat-each=3` — must be 27/27 passing.
2. **Full admin regression:** `npx playwright test --project=admin` — must be ≥ 106/106 passing (97 from Tier 3.5 + 9 new from Tier 3.6).
3. **Regressions to watch for:**
   - The new RLS policy could in theory affect any other test that updates `profiles` from a non-admin session. Search test files for `profiles.update` or `from('profiles').update` to verify nothing is testing the negative case (admin denied from updating other profiles). Tier 3.5 spec uses service-role testDb so it bypasses RLS — fine.
   - The route refactor splits a single update into two. Any test that mocks `/api/members/[id]` PUT and asserts on the SQL must be updated. Likely zero such tests but verify with grep.

---

## Test scenario inventory (9 tests)

| # | Pri | File location | Setup | Action | Assertion |
|---|---|---|---|---|---|
| 1 | P0 | `it("updates profile + members + activity_log @p0")` | `seedMember({ fullName: orig, email: orig, phone: orig, notes: 'old' })` | open panel → open Edit modal → change all 4 fields → submit | `profiles` row reflects new name/email/phone, `members.notes` reflects new notes, 1 `activity_log` row with `type='member_updated'` and non-null `description` |
| 2 | P0 | `it("dual-write proof — notes lands on members not profiles @p0")` | seedMember with notes='old' | edit notes only → submit | `members.notes` updated; `profiles` row has NO `notes` column (verified via column-list query) |
| 3 | P0 | `it("activity_log description contains member name and changed fields @p0")` | seedMember | edit name → submit | `activity_log.description` matches `Member updated: <new name>` and `metadata.fields` contains `'full_name'` |
| 4 | P0 | `it("modal pre-fills with current values @p0")` | seedMember with all fields populated | open Edit modal | each input's value matches the seeded value |
| 5 | P1 | `it("blocks submit when name is blank @p1")` | seedMember | open Edit modal → clear name → assert submit disabled | submit button has `disabled` attribute, no DB mutation observed |
| 6 | P1 | `it("blocks submit when email is blank @p1")` | seedMember | clear email → assert submit disabled | submit button disabled, no DB mutation |
| 7 | P1 | `it("returns 409 on duplicate email @p1")` | seed TWO members with different emails | edit member A → change email to member B's | modal stays open, `expectEditMemberError('already exists')`, member A unchanged |
| 8 | P1 | `it("returns 400 on invalid email format @p1")` | seedMember | `page.request.put('/api/members/${id}', { data: { email: 'no.tld@x' } })` | `res.status() === 400`, `body.error === 'Invalid email format'` |
| 9 | P1 | `it("Cancel closes modal without writing @p1")` | seedMember | open modal → fill fields → click Cancel | modal hidden, `profiles`/`members` rows unchanged |

---

## Files affected (summary)

| File | Change type | Lines | Purpose |
|---|---|---|---|
| `src/app/api/members/[id]/route.ts` | EDIT | ~80 (PUT handler rewrite) | Layer 1, 2, 3, 4, 6 fixes |
| `src/app/(admin)/members/_components/MemberProfilePanel.tsx` | EDIT | ~20 | Pencil import, editOpen state, Edit button, modal mount |
| `src/app/(admin)/members/_components/EditMemberModal.tsx` | CREATE | ~170 | New modal mirroring AddMemberModal |
| `src/app/(admin)/members/_components/types.ts` | EDIT (maybe) | 1 | Add `notes?: string` to `Member` type if missing |
| `src/app/(admin)/members/page.tsx` | EDIT (maybe) | ~3 | Seed `members-directory-row` + `members-profile-panel-root` testids if missing |
| `e2e/pages/MembersPage.ts` | EDIT | ~80 | Tier 3.6 section: 9 locators + 7 helpers |
| `e2e/fixtures/db.ts` | EDIT | ~3 | `notes` field in SeedMemberOptions + insert pass-through |
| `e2e/members-edit-member.spec.ts` | CREATE | ~400 | 9 tests |
| **Database migration via MCP:** | | | |
| `bug012_profiles_update_admin_policy` | NEW | 4 | RLS UPDATE policy for admins |

**Total estimated diff:** ~600 lines added, ~80 lines modified. One migration. One new page-component file. One new e2e spec.

---

## Hand-off

Engineer: please execute steps 1–8 in order. After step 4 (modal creation) but before step 7 (spec), do a quick `npx tsc --noEmit` to catch type errors early. After step 7, run a single-test smoke (`npx playwright test e2e/members-edit-member.spec.ts:56 --project=admin`) to validate the happy path before committing to the full flake-detection run in step 8.
