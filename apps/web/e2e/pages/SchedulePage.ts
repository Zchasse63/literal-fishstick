/**
 * SchedulePage — POM for the admin Schedule page (`/schedule`).
 *
 * Tier 2.2 established the smoke-level section (pageRoot + expectMounted).
 * Tier 3.8 adds the Create Class section — locators + helpers for the
 * ClassFormModal opened via the "New Class" button.
 *
 * When Tier 3.9–3.11 add more write flows (Cancel, Reschedule, Waitlist),
 * append a new section below the existing Tier 3.8 block. Do NOT restructure.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export class SchedulePage extends BasePage {
  /** The top-level container of the schedule page body. */
  pageRoot(): Locator {
    return this.byTestId('schedule-page-root')
  }

  /**
   * Assert that `/schedule` loaded under the admin shell with the schedule
   * component rendered (via the testid, which proves the component itself
   * mounted and not just the shell wrapping an error boundary).
   */
  async expectMounted(): Promise<void> {
    await this.expectSmokeMount('/schedule', this.adminShellLandmark())
    await expect(this.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  // ─── Tier 3.8: Create Class ────────────────────────────────────────────────
  //
  // Locators and helpers for the "New Class" flow on /schedule.
  // The modal is rendered by ClassFormModal.tsx as a shadcn Dialog.
  // Flow: click "New Class" → modal opens (with lookup spinner for class_types
  // + trainers) → fill form → click "Create Class" → POST /api/classes →
  // modal closes → schedule refreshes.
  //
  // BUG-015 (4-layer route divergence) was fixed inline as part of this tier:
  //   L1. description → notes column mapping
  //   L2. title defaults to class_type.name when blank
  //   L3. activity_log.description added (NOT NULL guard)
  //   L4. activity_log.type='class_created' added to CHECK enum (migration)
  //   L5. POST role check added (owner | manager)

  /** "New Class" button in the schedule header. Opens the create modal. */
  newClassBtn(): Locator {
    return this.byTestId('schedule-new-class-btn')
  }

  /** The DialogContent wrapper of the ClassFormModal. Visible when modal is open. */
  classFormModal(): Locator {
    return this.byTestId('schedule-class-form-modal')
  }

  /** Class type native <select> dropdown. Use selectOption() by label text. */
  classTypeSelect(): Locator {
    return this.byTestId('schedule-class-form-type-select')
  }

  /** Title text input (optional — defaults to class_type.name on the server). */
  titleInput(): Locator {
    return this.byTestId('schedule-class-form-title-input')
  }

  /** Date input (type="date"). Fill with 'YYYY-MM-DD'. */
  dateInput(): Locator {
    return this.byTestId('schedule-class-form-date-input')
  }

  /** Start time input (type="time"). Fill with 'HH:MM'. */
  startTimeInput(): Locator {
    return this.byTestId('schedule-class-form-start-time-input')
  }

  /** End time input (type="time"). Fill with 'HH:MM'. */
  endTimeInput(): Locator {
    return this.byTestId('schedule-class-form-end-time-input')
  }

  /** Capacity number input. Fill with string representation of the integer. */
  capacityInput(): Locator {
    return this.byTestId('schedule-class-form-capacity-input')
  }

  /** Trainer native <select> dropdown. Use selectOption() by label text or '' for None. */
  trainerSelect(): Locator {
    return this.byTestId('schedule-class-form-trainer-select')
  }

  /** Description textarea. Maps to classes.notes in the DB (BUG-015 L1 fix). */
  descriptionTextarea(): Locator {
    return this.byTestId('schedule-class-form-description-textarea')
  }

  /**
   * Inline error paragraph. Conditionally rendered — only present in the DOM
   * when `setError()` has been called. Covers both client-side validation
   * errors (e.g., "Please select a class type") and server-side 400/500
   * errors (e.g., "end_time must be after start_time").
   */
  classFormError(): Locator {
    return this.byTestId('schedule-class-form-error')
  }

  /** "Create Class" submit button (shows "Save Changes" in edit mode). */
  submitClassBtn(): Locator {
    return this.byTestId('schedule-class-form-submit-btn')
  }

  /** "Cancel" outline button — closes modal without submitting. */
  cancelClassBtn(): Locator {
    return this.byTestId('schedule-class-form-cancel-btn')
  }

  /**
   * Click "New Class" and wait for the modal to be visible + interactive.
   * The modal renders a lookup spinner while fetching class_types and trainers;
   * the submit button stays disabled until lookups resolve. Waiting for
   * toBeEnabled is the correct signal the form is ready.
   */
  async openNewClassModal(): Promise<void> {
    await this.newClassBtn().click()
    await expect(this.classFormModal()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.submitClassBtn()).toBeEnabled({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Fill the class creation form. All fields are optional — only provided
   * fields are set. Omitted fields retain their current/default values.
   *
   * @param opts.classTypeName - Label text of the class type option
   *   (e.g., 'Open Sauna'). Matches on visible text, not value.
   * @param opts.title - Title string. Pass '' to test blank-title defaulting.
   * @param opts.date - Date in 'YYYY-MM-DD' format.
   * @param opts.startTime - HH:MM (e.g., '17:00').
   * @param opts.endTime - HH:MM (e.g., '18:00').
   * @param opts.capacity - Integer capacity value.
   * @param opts.description - Description/notes text.
   */
  async fillClassForm(opts: {
    classTypeName?: string
    title?: string
    date?: string
    startTime?: string
    endTime?: string
    capacity?: number
    description?: string
  }): Promise<void> {
    if (opts.classTypeName !== undefined) {
      await this.classTypeSelect().selectOption({ label: opts.classTypeName })
    }
    if (opts.title !== undefined) {
      await this.titleInput().fill(opts.title)
    }
    if (opts.date !== undefined) {
      await this.dateInput().fill(opts.date)
    }
    if (opts.startTime !== undefined) {
      await this.startTimeInput().fill(opts.startTime)
    }
    if (opts.endTime !== undefined) {
      await this.endTimeInput().fill(opts.endTime)
    }
    if (opts.capacity !== undefined) {
      await this.capacityInput().fill(String(opts.capacity))
    }
    if (opts.description !== undefined) {
      await this.descriptionTextarea().fill(opts.description)
    }
  }

  /**
   * Click the submit button and wait for the matching API response.
   *
   * Race-safe: the waitForResponse promise is created BEFORE the click,
   * so the response cannot arrive before we start listening. The 30s timeout
   * covers Next.js cold-compile on the first test run (canonical pattern
   * from Tier 3.7).
   *
   * This helper resolves when the response arrives — it does NOT assert the
   * response status. Callers are responsible for asserting modal state + DB.
   *
   * @param method 'POST' for create (default, preserves Tier 3.8 callers),
   *   'PUT' for edit. Controls which HTTP method the response filter
   *   matches. Use 'PUT' from Tier 3.10's reschedule tests.
   */
  async submitClassForm(method: 'POST' | 'PUT' = 'POST'): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes('/api/classes') &&
        res.request().method() === method,
      { timeout: 30_000 },
    )
    await this.submitClassBtn().click()
    await responsePromise
  }

  /**
   * Click Cancel and wait for the modal to disappear. Does NOT trigger a
   * network request — the cancel path is purely local state reset.
   */
  async cancelClassForm(): Promise<void> {
    await this.cancelClassBtn().click()
    await expect(this.classFormModal()).toBeHidden({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Assert the inline error is visible and optionally contains a substring.
   * Used by Scenarios 5 and 6 to verify client and server-side validation.
   */
  async expectClassFormError(messageSubstring?: string): Promise<void> {
    await expect(this.classFormError()).toBeVisible({ timeout: ANIM_TIMEOUT })
    if (messageSubstring !== undefined) {
      await expect(this.classFormError()).toContainText(messageSubstring)
    }
  }

  // ─── Tier 3.9: Cancel Class ────────────────────────────────────────────────
  //
  // Locators and helpers for cancelling a scheduled class via the
  // ClassDetailPanel. Flow: click a class tile on the calendar → panel
  // opens → click Cancel Class → confirm() dialog → accept →
  // PUT /api/classes/[id] with { status: 'cancelled' } → panel closes
  // → toast 'Class cancelled'.
  //
  // BUG-017 (`/api/classes/[id]` PUT + DELETE divergence) was fixed inline
  // as part of this tier:
  //   PUT L1 — body field `description` remapped to `notes` column
  //   PUT L3 — activity_log.description added with capture-and-log
  //   PUT L5 — role check (owner | manager) added
  //   DELETE L3 — activity_log.description added with capture-and-log
  //   DELETE L5 — role check (owner | manager) added

  /** The ClassDetailPanel root — visible when a class tile is clicked. */
  classDetailPanel(): Locator {
    return this.byTestId('schedule-class-detail-panel')
  }

  /**
   * "Cancel Class" action button at the bottom of the ClassDetailPanel.
   * NOTE: distinct from `cancelClassBtn()` (Tier 3.8) which is the
   * "Cancel" button in the Create/Edit Class modal footer. Same name
   * collision was unavoidable without renaming Tier 3.8 helpers.
   */
  cancelClassActionBtn(): Locator {
    return this.byTestId('schedule-cancel-class-btn')
  }

  /** All class tiles on the current calendar view (Week / Day / Month). */
  classTiles(): Locator {
    return this.byTestId('schedule-class-tile')
  }

  /**
   * Click a class tile on the calendar by its title text. Waits for the
   * ClassDetailPanel to become visible after the click.
   *
   * @param classTitle - Title text shown on the tile (matches against
   *   the rendered name, not the DB title column directly — they should
   *   be the same for seeded classes).
   */
  async openClassPanel(classTitle: string): Promise<void> {
    const tile = this.classTiles().filter({ hasText: classTitle }).first()
    await expect(tile).toBeVisible({ timeout: ANIM_TIMEOUT })
    await tile.click()
    await expect(this.classDetailPanel()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Click Cancel Class and handle the browser confirm() dialog.
   * When accepting, waits for the PUT /api/classes/[id] response before
   * returning (canonical waitForResponse pattern from Tier 3.7/3.8).
   *
   * URL filter is stricter than Tier 3.8's: `/\/api\/classes\/[^/]+$/`
   * matches `/api/classes/<id>` exactly (not `/api/classes` POST or
   * `/api/classes/<id>/remind`).
   *
   * @param accept true → accept the dialog (cancel proceeds),
   *   false → dismiss the dialog (cancel is aborted)
   */
  async cancelClassFromPanel(accept: boolean): Promise<void> {
    this.page.once('dialog', async (dialog) => {
      if (accept) {
        await dialog.accept()
      } else {
        await dialog.dismiss()
      }
    })
    if (accept) {
      const responsePromise = this.page.waitForResponse(
        (res) =>
          /\/api\/classes\/[^/]+$/.test(res.url()) &&
          res.request().method() === 'PUT',
        { timeout: 30_000 },
      )
      await this.cancelClassActionBtn().click()
      await responsePromise
    } else {
      await this.cancelClassActionBtn().click()
    }
  }

  // ─── Tier 3.10: Reschedule Class ──────────────────────────────────────────
  //
  // Locators and helpers for rescheduling a class via the existing Edit Class
  // modal (which is the same ClassFormModal used for Create Class in Tier 3.8,
  // just opened in edit mode via the ClassDetailPanel's Edit button).
  //
  // BUG-018 (phantom description in editData) was fixed inline: the modal
  // now loads `raw.notes` instead of the phantom `raw.description` so that
  // save preserves existing notes instead of wiping them.
  //
  // The PUT handler also gained an end-after-start validation (mirror of
  // the POST handler's check) so Scenario 5 has a server-side rejection
  // path to assert against.

  /** "Edit Class" button in the ClassDetailPanel footer. Seeded in Tier 3.9. */
  editClassBtn(): Locator {
    return this.byTestId('schedule-edit-class-btn')
  }

  /**
   * Open the edit modal by clicking a class tile, then clicking the Edit
   * Class button on the detail panel. Waits for the modal to be visible
   * AND the submit button to be enabled (lookups resolved + editData
   * loaded into form state).
   *
   * @param classTitle - Title text of the class tile to click
   */
  async openEditClassModalFromPanel(classTitle: string): Promise<void> {
    await this.openClassPanel(classTitle)
    await this.editClassBtn().click()
    await expect(this.classFormModal()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.submitClassBtn()).toBeEnabled({ timeout: ANIM_TIMEOUT })
  }

  // ─── Tier 3.12: Check-in ──────────────────────────────────────────────────
  //
  // Locators and helpers for the "Check In All" button in the ClassDetailPanel.
  //
  // BUG-019 + BUG-020 are documented in specs/bugs/checkin-handler-and-ui-divergence.md.
  // The AS-SHIPPED UI button does a direct Supabase client UPDATE that bypasses
  // /api/check-in — so there's no network round trip for Playwright to wait on.
  // The helper waits for the button to re-enable (checkingInAll state flip) as
  // the readiness signal.

  /** "Check In All" button at the bottom of the ClassDetailPanel's attendee list. */
  checkInAllBtn(): Locator {
    return this.byTestId('schedule-check-in-all-btn')
  }

  /**
   * Click Check In All and wait for the handler to complete.
   *
   * The handler performs a direct Supabase client UPDATE (not an /api/check-in
   * POST — see BUG-020), then refetches attendees. The button's `disabled`
   * state flips true during the operation and false after. Waiting for
   * `toBeEnabled` is the correct readiness signal.
   */
  async clickCheckInAll(): Promise<void> {
    await this.checkInAllBtn().click()
    // Wait for the disabled state to clear (handler finished)
    await expect(this.checkInAllBtn()).toBeEnabled({ timeout: 15_000 })
  }
}
