# QA Council — Members: Archive / Exclude from Analytics (Tier 3.7) — ARCHITECT

**Pipeline ID:** `members-archive-exclude`
**Tier:** 3.7 (Core Writes — 7 of 12)
**Project:** `admin`
**Phase:** 2 — Architect
**Date:** 2026-04-09
**Input:** `specs/reports/members-archive-exclude-analyst.md`
**Status:** ✅ 8-step blueprint. Execution order is load-bearing — do not re-order without re-reviewing dependencies.

---

## Scope affirmation

Re-read the Analyst report. All four BUG-014 layers are in play, plus BUG-008 GAP-5 (Exclude from Analytics UI). Five tests (3 P0 + 2 P1). Zero migrations. Nine files.

**Test scenarios 1:1 match the Analyst's listing:**

| # | ID | Priority | Title |
|---|---|---|---|
| 1 | P0-1 | P0 | Archive happy path — `profiles.is_active=false` + activity_log |
| 2 | P0-2 | P0 | Archive activity_log explicit proof — description + enum type |
| 3 | P0-3 | P0 | Exclude from Analytics checkbox — `exclude_from_analytics=true` |
| 4 | P1-1 | P1 | Cancel archive dialog leaves member active |
| 5 | P1-2 | P1 | Exclude toggle persists through modal reopen |

**POM extension section header:** `// ─── Tier 3.7: Archive / Exclude from Analytics ───`

**Fixture note:** `seedMember` in `e2e/fixtures/db.ts` already accepts `excludeFromAnalytics?: boolean` (line 92 of types, line 218 of impl). **No fixture change needed.** `resetStudioTestData` already cleans up `activity_log` rows keyed to test profile IDs (Step 5b, line 463). Archived rows (`is_active=false`) are also matched by the `email` LIKE pattern, so teardown is clean.

---

## Execution order (load-bearing)

The Engineer MUST execute in this order. Rationale follows each step.

```
Step 1 → Step 2    (DELETE handler + Archive button — blocker for P0-1 / P0-2 / P1-1)
Step 3 → Step 4 → Step 5 → Step 6    (type chain for Exclude — blocker for P0-3 / P1-2)
Step 7 → Step 8    (POM + spec — blocker for Sentinel)
```

- **Steps 1–2 are independent of Steps 3–6** (different files, different concerns). They can run in parallel if the Engineer wants, but sequencing them gives a cleaner diff history.
- **Steps 3 → 4 → 5 → 6 are strictly sequential.** Type extension must precede mapper extension must precede modal extension must precede panel prop update. Compile errors will enforce this but the ordering is explicit so the Engineer doesn't waste cycles.
- **Step 7 (POM) depends on all six UI/route steps being done** because the locator helpers reference testids seeded in Steps 2 and 5.
- **Step 8 (spec) depends on Step 7** because it imports the POM methods.

---

## Step 1 — DELETE handler rewrite

**File:** `apps/web/src/app/api/members/[id]/route.ts`
**Function:** `export async function DELETE(...)` — lines 384–456
**Why first:** All three Archive tests (P0-1, P0-2, P1-1) are blocked on this. The route is 500-ing on Layers 1–3 and 404-ing on Layer 4. Without Step 2, fixing the route still leaves the UI broken; without Step 1, fixing the UI just surfaces a different failure.

### Replace the current handler body (keep the signature + auth block)

Between `const { data: authProfile } = ...` + studio/role check and the final `catch` block, the handler body (lines 413–448) must be rewritten. Mirror the PUT handler pattern from lines 249–360:

1. **Add role check** (same pattern as PUT lines 175–179). The current DELETE handler has NO role check — any authenticated user can archive. Matches BUG-012 L4 from Tier 3.6.
2. **Fetch existing profile up-front** (mirror PUT lines 249–268). Needed for (a) membership verification, (b) `full_name` for the activity_log description. Use `.select("id, full_name, is_active")` and `.single()`. 404 on missing.
3. **Short-circuit if already archived** — if `existingProfile.is_active === false`, return 200 with `{ data: { id, already_archived: true } }`. Idempotent. No activity_log row on double-archive.
4. **Update `is_active: false`** instead of `status: 'archived'`. Include `updated_at: new Date().toISOString()`. Chain `.eq("id", id).eq("studio_id", studioId).select().single()`. Handle error + missing row same as PUT.
5. **Insert activity_log row** with the full shape:
   ```ts
   const memberName = existingProfile.full_name ?? "(unknown)";
   const { error: activityError } = await supabase
     .from("activity_log")
     .insert({
       studio_id: studioId,
       actor_id: user.id,
       type: "member_deleted",               // ← Layer 3 fix
       subject_type: "profile",
       subject_id: id,
       description: `Member archived: ${memberName}`,   // ← Layer 2 fix
       metadata: {
         action: "archive",
         profile_id: id,
       },
     });
   if (activityError) {
     console.error(
       "DELETE /api/members/[id]: activity_log insert failed",
       activityError.message,
     );
   }
   ```
   **Capture-and-log pattern**, no rollback — matches PUT + POST + the standing convention. The user is already archived; losing an observability row is not a reason to return 500.
6. **Invalidate AI cache** (mirror PUT lines 364–368) — archive changes churn predictions. Delete `ai_cache` rows where `entity_id = id`.
7. **Return** `NextResponse.json({ data: updatedProfile })`.

### Also update the JSDoc comment at line 380–383

Change from `Soft-delete a member (set status to 'archived').` to:
```
DELETE /api/members/[id]
Soft-delete a member by setting profiles.is_active = false. URL [id] is
the profiles.id (profile_id), NOT the members.id — see BUG-013. Writes an
activity_log row with type='member_deleted'. Idempotent: archiving an
already-archived member is a no-op.
```

### Acceptance criteria for Step 1

- `profiles.status` is not referenced anywhere in the DELETE body.
- `is_active: false` is the only profile column written.
- Activity_log insert includes `description` and uses `type: 'member_deleted'`.
- Error from activity_log insert is captured into `activityError` and `console.error`'d, never returned as 500.
- Role check rejects non-owner/manager with 403.
- Already-archived short-circuit returns 200 without a new activity_log row.
- `ai_cache.delete` runs after successful update.

---

## Step 2 — Archive button fix (BUG-013 narrow + testid)

**File:** `apps/web/src/app/(admin)/members/_components/MemberProfilePanel.tsx`
**Element:** the red "Archive" button at lines 326–344 inside the "Active Membership" card
**Why second:** Without this, Step 1's route fix is invisible — the UI still calls `/api/members/${member.id}` which is `members.id`, not `profile_id`. Route returns 404. P0-1 still fails.

### Two changes to the button element

1. **Change the URL template** at line 330:
   ```ts
   // Before:
   const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' })
   // After:
   const res = await fetch(`/api/members/${member.profileId}`, { method: 'DELETE' })
   ```
   This is the same narrow-blast Option B fix the EditMemberModal uses (see `types.ts` line 17 JSDoc and `MemberProfilePanel.tsx` line 607). It does NOT fix pause/upgrade — those stay broken until Tier 4.2/4.3.

2. **Add `data-testid="members-archive-btn"`** to the `<button>` element at line 326. Place it alongside the existing `className` prop. Convention: `module-component-action-or-role`. ✓ matches AGENTS.md.

Do NOT replace `confirm()` with shadcn `AlertDialog`. Playwright handles native dialogs via `page.on('dialog', ...)`. UI polish is out of scope.

### Acceptance criteria for Step 2

- `fetch()` URL references `member.profileId`, not `member.id`.
- Archive button has `data-testid="members-archive-btn"`.
- No other changes to the onClick handler (notify logic, dialog logic, panel close on success — all unchanged).
- No changes to the Pause/Upgrade buttons (out of scope).

---

## Step 3 — Member type extension

**File:** `apps/web/src/app/(admin)/members/_components/types.ts`
**Location:** `Member` interface, after `notes: string | null` at line 40
**Why third:** Prerequisite for Steps 4, 5, 6 — TypeScript will not compile until the field exists on the type.

### Add one optional field

```ts
// (after the `notes: string | null` line)
excludeFromAnalytics?: boolean
```

Make it **optional** (`?`) — legacy mapped rows or test fixtures that don't populate it should not fail typechecking. Default behavior downstream is `false`.

### Acceptance criteria for Step 3

- `Member` interface has `excludeFromAnalytics?: boolean`.
- No other fields added. No fields renamed.

---

## Step 4 — Directory mapper extension

**File:** `apps/web/src/app/(admin)/members/page.tsx`
**Function:** `fetchMembers` useCallback, lines 196–309
**Why fourth:** Populates `Member.excludeFromAnalytics` from `profiles.exclude_from_analytics`, which flows into the modal via the panel's `initial` prop (Step 6).

### Two changes

1. **Extend the `select()` string** at lines 199–208. Current profiles sub-select:
   ```
   profiles!inner ( full_name, email, phone, avatar_url )
   ```
   Change to:
   ```
   profiles!inner ( full_name, email, phone, avatar_url, exclude_from_analytics )
   ```

2. **Populate the mapped field** in the `(data || []).map((row: any) => { ... })` body at lines 249–292. Add **exactly one line** inside the `return { ... }` object, anywhere after `notes: row.notes,` and before the `engagementStatus` line:
   ```ts
   excludeFromAnalytics: profile.exclude_from_analytics ?? false,
   ```

### Acceptance criteria for Step 4

- `profiles!inner` select includes `exclude_from_analytics`.
- Mapped Member includes `excludeFromAnalytics: profile.exclude_from_analytics ?? false`.
- No other fields added to the select (don't expand scope).
- No changes to the ordering, filtering, or member_360 enrichment logic.

---

## Step 5 — EditMemberModal extension

**File:** `apps/web/src/app/(admin)/members/_components/EditMemberModal.tsx`
**Component:** `EditMemberModal` — full file (207 lines)
**Why fifth:** This unlocks P0-3 (Exclude happy path) and P1-2 (Persist through reopen). Delta-payload logic means adding this field is regression-safe for Tier 3.6 tests that never touch it.

### Five discrete edits inside the component

1. **Extend `EditFields` type** at lines 13–18. Add `exclude_from_analytics: boolean`:
   ```ts
   type EditFields = {
     full_name: string
     email: string
     phone: string
     notes: string
     exclude_from_analytics: boolean
   }
   ```

2. **Extend `EditableInitial` type** at lines 20–25. Add `exclude_from_analytics?: boolean` (optional to survive existing call sites):
   ```ts
   type EditableInitial = {
     full_name: string
     email: string
     phone: string
     notes: string | null
     exclude_from_analytics?: boolean
   }
   ```

3. **Extend initial `useState`** at lines 44–49. Default to `initial.exclude_from_analytics ?? false`:
   ```ts
   const [form, setForm] = useState<EditFields>({
     full_name: initial.full_name ?? '',
     email: initial.email ?? '',
     phone: initial.phone ?? '',
     notes: initial.notes ?? '',
     exclude_from_analytics: initial.exclude_from_analytics ?? false,
   })
   ```

4. **Extend re-seed `useEffect`** at lines 55–65. Add the field + dep:
   ```ts
   useEffect(() => {
     if (open) {
       setForm({
         full_name: initial.full_name ?? '',
         email: initial.email ?? '',
         phone: initial.phone ?? '',
         notes: initial.notes ?? '',
         exclude_from_analytics: initial.exclude_from_analytics ?? false,
       })
       setError(null)
     }
   }, [
     open,
     initial.full_name,
     initial.email,
     initial.phone,
     initial.notes,
     initial.exclude_from_analytics,
   ])
   ```

5. **Extend delta-payload logic** inside `onSubmit` at lines 96–108. Add the delta check **before** the `Object.keys(payload).length === 0` short-circuit:
   ```ts
   if (form.notes !== (initial.notes ?? '')) payload.notes = form.notes
   if (form.exclude_from_analytics !== (initial.exclude_from_analytics ?? false)) {
     payload.exclude_from_analytics = form.exclude_from_analytics
   }
   ```

6. **Add checkbox UI element** after the Notes `<div>` at line 173, before the `{error && ...}` block at line 175. Exact markup (matches the existing shadcn-flavored styling):
   ```tsx
   <div className="flex items-start gap-2.5">
     <input
       data-testid="members-edit-modal-exclude-analytics-checkbox"
       type="checkbox"
       id="edit-member-exclude-analytics"
       checked={form.exclude_from_analytics}
       onChange={(e) =>
         setForm(f => ({ ...f, exclude_from_analytics: e.target.checked }))
       }
       className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
     />
     <label
       htmlFor="edit-member-exclude-analytics"
       className="text-sm text-gray-700 dark:text-gray-300 leading-tight select-none cursor-pointer"
     >
       <span className="font-medium">Exclude from analytics</span>
       <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
         Hide this member from revenue, attendance, and engagement reports
         (e.g., comped members, former owners).
       </span>
     </label>
   </div>
   ```

### Acceptance criteria for Step 5

- `EditFields` has `exclude_from_analytics: boolean`.
- `EditableInitial` has `exclude_from_analytics?: boolean` (optional).
- Initial state and re-seed useEffect both default to `false` when the prop is omitted.
- Delta-payload submits `exclude_from_analytics` ONLY if the current form value differs from `initial.exclude_from_analytics ?? false`.
- Checkbox has `data-testid="members-edit-modal-exclude-analytics-checkbox"`.
- Label uses `htmlFor` to bind to the checkbox `id` (Playwright `getByLabel` fallback).

---

## Step 6 — MemberProfilePanel `initial` prop update

**File:** `apps/web/src/app/(admin)/members/_components/MemberProfilePanel.tsx`
**Element:** `<EditMemberModal>` mount at lines 604–618
**Why sixth:** Without this, the modal always initializes `exclude_from_analytics = false`, which would make P1-2 (persist through reopen) fail. The Member type (Step 3) carries the field; the mapper (Step 4) populates it; the panel must pass it in.

### One change inside the `initial={{ ... }}` object literal

Add a single field at the bottom of the object (after `notes: member.notes,`):
```ts
initial={{
  full_name: `${member.firstName} ${member.lastName}`.trim(),
  email: member.email,
  phone: member.phone,
  notes: member.notes,
  exclude_from_analytics: member.excludeFromAnalytics ?? false,
}}
```

### Acceptance criteria for Step 6

- `initial` includes `exclude_from_analytics: member.excludeFromAnalytics ?? false`.
- No other changes to the EditMemberModal props or to MemberProfilePanel.

---

## Step 7 — MembersPage POM extension

**File:** `apps/web/e2e/pages/MembersPage.ts`
**Section:** after the Tier 3.6 block (ends around line 324)
**Why seventh:** Spec file (Step 8) imports from this module. All POM helpers must exist before the spec compiles.

### Append a new section

```ts
  // ─── Tier 3.7: Archive / Exclude from Analytics ────────────────────────
  //
  // Locators + helpers for the admin "Archive Member" flow and the
  // "Exclude from Analytics" checkbox (part of the Edit Member modal).
  //
  // Archive button lives in the MemberProfilePanel's Active Membership
  // card and is wired through `DELETE /api/members/[id]`. Fires a browser
  // `confirm()` dialog. BUG-014 (4-layer route divergence) was fixed inline
  // as part of the Tier 3.7 council run. BUG-013 narrow-blast Option B:
  // the button now passes `member.profileId`.
  //
  // Exclude from Analytics: a new checkbox in the existing EditMemberModal
  // (Tier 3.6 surface). Closes BUG-008 GAP-5.

  /** The red "Archive" button in the profile panel's Active Membership card. */
  archiveMemberBtn(): Locator {
    return this.byTestId('members-archive-btn')
  }

  /** The "Exclude from analytics" checkbox in the Edit Member modal. */
  editMemberExcludeAnalyticsCheckbox(): Locator {
    return this.byTestId('members-edit-modal-exclude-analytics-checkbox')
  }

  /**
   * Click the Archive button, handling the browser `confirm()` dialog.
   * Attach the dialog listener BEFORE the click to avoid a race.
   *
   * @param accept true → accept (archive proceeds), false → dismiss (no-op)
   */
  async archiveMemberFromPanel(accept: boolean): Promise<void> {
    // Attach a one-shot dialog handler. Using `once` so we don't leak state
    // across tests that might fire other native dialogs.
    this.page.once('dialog', async (dialog) => {
      if (accept) {
        await dialog.accept()
      } else {
        await dialog.dismiss()
      }
    })
    await this.archiveMemberBtn().click()
  }

  /**
   * Toggle the Exclude from Analytics checkbox inside an already-open
   * Edit Member modal. Use in combination with `openEditMemberModal()`
   * and `submitEditMemberForm()`.
   */
  async toggleExcludeFromAnalytics(): Promise<void> {
    await this.editMemberExcludeAnalyticsCheckbox().click()
  }

  /**
   * Assert the Exclude from Analytics checkbox visual state matches the
   * expected boolean. Used by P1-2 to prove the value round-trips from
   * DB → mapper → panel prop → modal initial state.
   */
  async expectExcludeFromAnalyticsChecked(expected: boolean): Promise<void> {
    const checkbox = this.editMemberExcludeAnalyticsCheckbox()
    if (expected) {
      await expect(checkbox).toBeChecked()
    } else {
      await expect(checkbox).not.toBeChecked()
    }
  }
```

### Acceptance criteria for Step 7

- New section header comment present: `// ─── Tier 3.7: Archive / Exclude from Analytics ───`.
- Four new locator/helper methods: `archiveMemberBtn`, `editMemberExcludeAnalyticsCheckbox`, `archiveMemberFromPanel(accept)`, `toggleExcludeFromAnalytics`, `expectExcludeFromAnalyticsChecked(expected)`.
- `archiveMemberFromPanel` attaches the dialog listener **before** the click.
- `page.once` (not `page.on`) to avoid listener leakage.

---

## Step 8 — Spec file

**File (NEW):** `apps/web/e2e/members-archive-exclude.spec.ts`
**Why last:** Depends on Steps 1–7. One scenario cannot run in isolation until every preceding step is done.

### Structure

Mirror the Tier 3.6 spec (`members-edit-member.spec.ts`):
- File header doc-comment explaining scope and the 4 BUG-014 layers
- `uniqueName` / `uniqueEmail` helpers for parallel-worker safety
- `test.describe('Members — Archive / Exclude from Analytics (Tier 3.7)', ...)`
- `beforeEach`: `resetStudioTestData()`
- `afterAll`: `resetStudioTestData()`
- Five `test()` blocks, one per Analyst scenario, with `@p0` / `@p1` tag in the title

### Per-scenario execution

#### Scenario 1 — Archive happy path @p0

```ts
test('archives a member, flipping profiles.is_active false + activity_log @p0', async ({ page }) => {
  const seededName = uniqueName('ArchiveHappy')
  const seededEmail = uniqueEmail('archivehappy')
  const { profileId } = await seedMember({
    fullName: seededName,
    email: seededEmail,
    studioId: DEFAULT_STUDIO_ID,
  })

  const members = new MembersPage(page)
  await page.goto('/members')
  await members.expectDirectoryMounted()
  await members.openMemberProfileByName(seededName)

  await members.archiveMemberFromPanel(true)

  // Wait for the panel to close (the panel's onClose fires on success).
  await expect(members.editMemberTriggerBtn()).toBeHidden({ timeout: 5000 })

  // DB: profile row is now is_active=false
  const { data: profile } = await testDb
    .from('profiles')
    .select('is_active, exclude_from_analytics')
    .eq('id', profileId)
    .single()

  expect(profile?.is_active).toBe(false)
  expect(profile?.exclude_from_analytics).toBe(false) // regression — archive ≠ exclude

  // DB: activity_log row
  const { data: logs } = await testDb
    .from('activity_log')
    .select('*')
    .eq('subject_id', profileId)
    .eq('type', 'member_deleted')

  expect(logs?.length).toBeGreaterThanOrEqual(1)
})
```

#### Scenario 2 — Archive activity_log explicit proof @p0

```ts
test('archive activity_log has non-null description and valid type @p0', async ({ page }) => {
  const seededName = uniqueName('ArchiveLog')
  const seededEmail = uniqueEmail('archivelog')
  const { profileId } = await seedMember({
    fullName: seededName,
    email: seededEmail,
    studioId: DEFAULT_STUDIO_ID,
  })

  const members = new MembersPage(page)
  await page.goto('/members')
  await members.expectDirectoryMounted()
  await members.openMemberProfileByName(seededName)

  await members.archiveMemberFromPanel(true)
  await expect(members.editMemberTriggerBtn()).toBeHidden({ timeout: 5000 })

  const { data: logs } = await testDb
    .from('activity_log')
    .select('description, type, metadata, subject_type, subject_id')
    .eq('subject_id', profileId)
    .eq('type', 'member_deleted')

  expect(logs?.length).toBeGreaterThanOrEqual(1)
  const log = logs![0]
  expect(log.description).toBeTruthy()              // Layer 2 proof
  expect(log.description).toContain('archived')     // reads humanly
  expect(log.description).toContain(seededName)
  expect(log.type).toBe('member_deleted')           // Layer 3 proof (not 'member_archived')
  expect(log.subject_type).toBe('profile')
  expect(log.metadata).toMatchObject({ action: 'archive' })
})
```

#### Scenario 3 — Exclude from Analytics happy path @p0

```ts
test('exclude from analytics checkbox writes profiles.exclude_from_analytics @p0', async ({ page }) => {
  const seededName = uniqueName('ExcludeHappy')
  const seededEmail = uniqueEmail('excludehappy')
  const { profileId } = await seedMember({
    fullName: seededName,
    email: seededEmail,
    excludeFromAnalytics: false, // explicit default
    studioId: DEFAULT_STUDIO_ID,
  })

  const members = new MembersPage(page)
  await page.goto('/members')
  await members.expectDirectoryMounted()
  await members.openMemberProfileByName(seededName)
  await members.openEditMemberModal()

  // Assert starting state
  await members.expectExcludeFromAnalyticsChecked(false)

  // Toggle + submit
  await members.toggleExcludeFromAnalytics()
  await members.submitEditMemberForm()
  await expect(members.editMemberModal()).toBeHidden({ timeout: 5000 })

  // DB: profiles row flipped
  const { data: profile } = await testDb
    .from('profiles')
    .select('full_name, email, phone, exclude_from_analytics')
    .eq('id', profileId)
    .single()

  expect(profile?.exclude_from_analytics).toBe(true)
  // Regression — nothing else changed (delta-payload proof)
  expect(profile?.full_name).toBe(seededName)
  expect(profile?.email).toBe(seededEmail)

  // DB: activity_log row includes the field
  const { data: logs } = await testDb
    .from('activity_log')
    .select('description, type, metadata')
    .eq('subject_id', profileId)
    .eq('type', 'member_updated')

  expect(logs?.length).toBeGreaterThanOrEqual(1)
  expect(logs![0].metadata.fields).toContain('exclude_from_analytics')
})
```

#### Scenario 4 — Cancel archive dialog leaves member active @p1

```ts
test('cancelling archive dialog leaves member active @p1', async ({ page }) => {
  const seededName = uniqueName('ArchiveCancel')
  const seededEmail = uniqueEmail('archivecancel')
  const { profileId } = await seedMember({
    fullName: seededName,
    email: seededEmail,
    studioId: DEFAULT_STUDIO_ID,
  })

  const members = new MembersPage(page)
  await page.goto('/members')
  await members.expectDirectoryMounted()
  await members.openMemberProfileByName(seededName)

  await members.archiveMemberFromPanel(false) // dismiss

  // Panel should still be open — edit button still visible
  await expect(members.editMemberTriggerBtn()).toBeVisible()

  // DB: nothing changed
  const { data: profile } = await testDb
    .from('profiles')
    .select('is_active')
    .eq('id', profileId)
    .single()

  expect(profile?.is_active).toBe(true)

  // DB: no deletion log row
  const { data: logs } = await testDb
    .from('activity_log')
    .select('id')
    .eq('subject_id', profileId)
    .eq('type', 'member_deleted')

  expect(logs?.length ?? 0).toBe(0)
})
```

#### Scenario 5 — Exclude toggle persists through modal reopen @p1

```ts
test('exclude from analytics persists through modal reopen @p1', async ({ page }) => {
  const seededName = uniqueName('ExcludePersist')
  const seededEmail = uniqueEmail('excludepersist')
  const { profileId } = await seedMember({
    fullName: seededName,
    email: seededEmail,
    excludeFromAnalytics: false,
    studioId: DEFAULT_STUDIO_ID,
  })

  const members = new MembersPage(page)
  await page.goto('/members')
  await members.expectDirectoryMounted()
  await members.openMemberProfileByName(seededName)

  // Open, toggle, submit
  await members.openEditMemberModal()
  await members.toggleExcludeFromAnalytics()
  await members.submitEditMemberForm()
  await expect(members.editMemberModal()).toBeHidden({ timeout: 5000 })

  // DB sanity — the value landed
  const { data: profile1 } = await testDb
    .from('profiles')
    .select('exclude_from_analytics')
    .eq('id', profileId)
    .single()
  expect(profile1?.exclude_from_analytics).toBe(true)

  // Reopen the modal WITHOUT closing/reopening the panel. The panel's
  // `initial` prop is re-evaluated when the `open` state flips to true.
  // However, the panel's `member` object is snapshot-stale after the
  // update — the fetchMembers() refresh only fires on panel close.
  // To prove the round-trip through DB → directory mapper → panel prop,
  // we have to close and reopen the panel first.
  await members.page.keyboard.press('Escape') // close panel
  // Wait for the panel to be fully unmounted
  await expect(members.editMemberTriggerBtn()).toBeHidden({ timeout: 5000 })

  // Re-open the profile and re-open the modal
  await members.openMemberProfileByName(seededName)
  await members.openEditMemberModal()

  // The checkbox should be checked on re-open
  await members.expectExcludeFromAnalyticsChecked(true)

  // Submitting without changes should be a no-op (delta-payload short-circuit)
  await members.submitEditMemberForm()
  await expect(members.editMemberModal()).toBeHidden({ timeout: 5000 })

  // DB: only one member_updated row (no duplicate from the no-op submit)
  const { data: logs } = await testDb
    .from('activity_log')
    .select('id')
    .eq('subject_id', profileId)
    .eq('type', 'member_updated')

  expect(logs?.length ?? 0).toBe(1)
})
```

### Acceptance criteria for Step 8

- Five tests, tagged `@p0` (1–3) or `@p1` (4–5).
- Each test seeds, drives the UI, asserts against the DB, and does NOT rely on toast text.
- Scenario 2 explicitly asserts `type === 'member_deleted'` (Layer 3 proof).
- Scenario 2 explicitly asserts `description` is truthy and contains the name (Layer 2 proof).
- Scenario 4 uses `dismiss()` (not `accept()`) and asserts the panel stays open.
- Scenario 5 closes + reopens the panel before re-reading the checkbox (critical — the panel's `member` prop is stale until fetchMembers re-runs on panel close).

---

## Risk register (Architect-scoped)

| Risk | Surfaced in | Mitigation |
|---|---|---|
| `page.once('dialog')` races the click | Step 7 POM helper | Attach listener BEFORE click. Already done in `archiveMemberFromPanel`. |
| Scenario 5 fails because panel's `member` prop is stale post-update | Step 8 test | Close panel with `Escape`, wait for unmount, reopen. Explicit note in the test comments. |
| Already-archived short-circuit (Step 1.3) masks a real DELETE regression | Step 1 | Return `data.already_archived = true` so tests CAN detect the difference. Scenario 1 doesn't depend on this path. |
| Directory still shows archived members after Step 1 | (none) | Intentional. BUG-011 + directory filter work is out of scope. `openMemberProfileByName` uses search which still finds them. |
| Pause/Upgrade still call with `member.id` after Step 2 | Step 2 | Intentional. BUG-013 narrow Option B. Tier 4.2/4.3 will fix. The spec comment should mention this. |
| Tier 3.5 / 3.6 tests regress from the new `select()` field (Step 4) | Step 4 | Supabase PostgREST ignores unknown columns in the `select` object. Returning more data does not affect existing `row.profiles.full_name` etc. Zero regression risk. |
| Tier 3.6 tests regress from the new EditModal checkbox (Step 5) | Step 5 | Delta-payload means the field is only in the PUT body if toggled. Tier 3.6 tests never touch the checkbox → `exclude_from_analytics` never appears in `metadata.fields`. Confirmed by re-reading Tier 3.6 spec assertions (e.g., Scenario 1 line 115: `expect(log.description).toContain(newName)` — no `.toContain('exclude_from_analytics')`). |
| `resetStudioTestData` misses archived profiles | (none) | The cleanup is `.like('email', E2E_MEMBER_EMAIL_PATTERN)`, which is orthogonal to `is_active`. Archived rows are still matched. Verified in `db.ts:411–479`. |

---

## Handoff to Engineer

**Execute Steps 1–8 in order.** Each step has explicit acceptance criteria. The Engineer's checklist for the run is:

```
[ ] Step 1 — DELETE handler rewrite (7 sub-changes)
[ ] Step 2 — Archive button fix + testid (2 sub-changes)
[ ] Step 3 — Member type extension (1 line)
[ ] Step 4 — Directory mapper extension (2 sub-changes)
[ ] Step 5 — EditMemberModal extension (6 sub-changes)
[ ] Step 6 — MemberProfilePanel initial prop update (1 line)
[ ] Step 7 — MembersPage POM section (4 methods)
[ ] Step 8 — Spec file (5 tests, new file)
```

**No migrations.** First Tier 3+ run since 3.1 without one.

**Standing directive:** "Work through all tiers until 100% complete." This is Tier 3.7. Tier 3 counter advances to **7/12** on completion.

**Handoff checklist for the Engineer:**
- [ ] Do NOT refactor the DELETE handler beyond the rewrite specified in Step 1
- [ ] Do NOT rename existing testids in the Archive button or EditMemberModal
- [ ] Do NOT replace `confirm()` with `AlertDialog`
- [ ] Do NOT touch Pause/Upgrade buttons (Tier 4.2/4.3 scope)
- [ ] Do NOT add a directory filter for `is_active=false` (UX polish)
- [ ] After all 8 steps, run the 5-test spec in isolation before the full admin regression
