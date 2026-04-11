/**
 * MembersPage — thin POM for the admin Members module.
 *
 * Tier 2.3 is a smoke run. This POM wraps the shared Tier 2 smoke
 * infrastructure (BasePage.expectSmokeMount + adminShellLandmark) with
 * Members-specific locators for both the directory (`/members`) and the
 * detail (`/members/[id]`) routes.
 *
 * Detail page coverage is limited to the "member not found" branch for
 * Tier 2 — the happy-path detail page requires a seeded real member row
 * (blocked on BUG-001's DEFAULT_STUDIO_ID coupling), which belongs in
 * Tier 3.5 (Members: Create Member).
 *
 * When Tier 3.5–3.7 add write flows (Create, Edit, Archive), extend this
 * POM with `openAddMemberModal()`, `fillMemberForm()`, etc.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

/**
 * A syntactically valid UUID that will not match any real member row.
 * Used to smoke the `/members/[id]` not-found branch without needing to
 * seed fixtures.
 */
export const BOGUS_MEMBER_ID = '00000000-0000-0000-0000-000000000000'

export class MembersPage extends BasePage {
  /** The top-level container of the members directory page body. */
  pageRoot(): Locator {
    return this.byTestId('members-page-root')
  }

  /** The main container rendered when a valid member is found. */
  detailRoot(): Locator {
    return this.byTestId('members-detail-root')
  }

  /** The fallback container rendered for an unknown member id. */
  detailNotFound(): Locator {
    return this.byTestId('members-detail-not-found')
  }

  /**
   * Assert that `/members` loaded under the admin shell with the members
   * directory component rendered.
   */
  async expectDirectoryMounted(): Promise<void> {
    await this.expectSmokeMount('/members', this.adminShellLandmark())
    await expect(this.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Assert that `/members/[BOGUS_MEMBER_ID]` mounts and renders the
   * not-found fallback. This proves the route, layout, and MemberProfileClient
   * component all execute end-to-end even on a cache miss.
   */
  async expectBogusDetailNotFound(): Promise<void> {
    const url = `/members/${BOGUS_MEMBER_ID}`
    await this.expectSmokeMount(url, this.adminShellLandmark())
    await expect(this.detailNotFound()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(this.page.getByText('Member not found.')).toBeVisible()
  }

  // ─── Tier 3.5: Add Member modal ─────────────────────────────────────────
  //
  // Locators + helpers for the admin "Add Member" write flow. The modal is
  // rendered from the `/members` directory header and is wired through
  // `POST /api/members`. BUG-010 (4-layer schema divergence) was fixed inline
  // as part of the Tier 3.5 council run; these helpers assume the fix is live.

  /** The "Add Member" trigger button in the directory header. */
  addMemberTriggerBtn(): Locator {
    return this.byTestId('members-add-btn')
  }

  /** The outer DialogContent of the Add Member modal. */
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

  /**
   * Click the "Add Member" trigger and wait for the modal to become visible.
   */
  async openAddMemberModal(): Promise<void> {
    await this.addMemberTriggerBtn().click()
    await expect(this.addMemberModal()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Fill the Add Member form fields. Phone is optional.
   */
  async fillAddMemberForm(opts: {
    name: string
    email: string
    phone?: string
  }): Promise<void> {
    await this.addMemberNameInput().fill(opts.name)
    await this.addMemberEmailInput().fill(opts.email)
    if (opts.phone) {
      await this.addMemberPhoneInput().fill(opts.phone)
    }
  }

  /** Click the Submit button. Caller waits for the modal to close or error. */
  async submitAddMemberForm(): Promise<void> {
    await this.addMemberSubmitBtn().click()
  }

  /**
   * Click Cancel and wait for the modal to close. Used by Scenario 9.
   */
  async cancelAddMemberForm(): Promise<void> {
    await this.addMemberCancelBtn().click()
    await expect(this.addMemberModal()).toBeHidden({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Assert the modal's error alert is visible and optionally contains a
   * substring. Used by Scenarios 7 and 8 (duplicate email, invalid format).
   */
  async expectAddMemberError(messageSubstring?: string): Promise<void> {
    await expect(this.addMemberErrorAlert()).toBeVisible({
      timeout: ANIM_TIMEOUT,
    })
    if (messageSubstring) {
      await expect(this.addMemberErrorAlert()).toContainText(messageSubstring)
    }
  }

  /**
   * Full happy-path convenience helper: open modal, fill, submit, wait for
   * the modal to close. Returns nothing — caller asserts against the DB.
   */
  async createMemberViaModal(opts: {
    name: string
    email: string
    phone?: string
  }): Promise<void> {
    await this.openAddMemberModal()
    await this.fillAddMemberForm(opts)
    await this.submitAddMemberForm()
    await expect(this.addMemberModal()).toBeHidden({ timeout: ANIM_TIMEOUT })
  }

  // ─── Tier 3.6: Edit Member modal ────────────────────────────────────────
  //
  // Locators + helpers for the admin "Edit Member" write flow. The Edit
  // button lives in the MemberProfilePanel header (next to the Close X)
  // and is wired through `PUT /api/members/[id]`. BUG-012 (6-layer schema
  // divergence) was fixed inline as part of the Tier 3.6 council run.
  //
  // BUG-013: the panel's pause/upgrade/archive flows pass `member.id`
  // (members.id), but `PUT /api/members/[id]` expects URL [id] = profile_id.
  // The Edit modal correctly passes `member.profileId` — see EditMemberModal.

  /**
   * Open a member's profile panel by clicking its row in the directory.
   * Targets by data-row-key (the profile_id) so it works regardless of
   * BUG-011 ordering.
   */
  async openMemberProfileByRowKey(profileId: string): Promise<void> {
    const row = this.page.locator(
      `[data-testid="members-directory-row"][data-row-key="${profileId}"]`,
    )
    await expect(row).toBeVisible({ timeout: ANIM_TIMEOUT })
    await row.click()
    await expect(this.editMemberTriggerBtn()).toBeVisible({
      timeout: ANIM_TIMEOUT,
    })
  }

  /**
   * Open a member's profile panel by searching for their name and clicking
   * the first matching row. Used when the test only has the display name
   * available (e.g. immediately after createMemberViaModal).
   */
  async openMemberProfileByName(name: string): Promise<void> {
    await this.page.getByPlaceholder('Search members...').fill(name)
    const row = this.page
      .locator('[data-testid="members-directory-row"]')
      .filter({ hasText: name })
      .first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.click()
    await expect(this.editMemberTriggerBtn()).toBeVisible({
      timeout: ANIM_TIMEOUT,
    })
  }

  /** The Edit pencil button in the profile panel header. */
  editMemberTriggerBtn(): Locator {
    return this.byTestId('members-edit-btn')
  }

  /** The outer DialogContent of the Edit Member modal. */
  editMemberModal(): Locator {
    return this.byTestId('members-edit-modal-dialog')
  }

  editMemberNameInput(): Locator {
    return this.byTestId('members-edit-modal-name-input')
  }

  editMemberEmailInput(): Locator {
    return this.byTestId('members-edit-modal-email-input')
  }

  editMemberPhoneInput(): Locator {
    return this.byTestId('members-edit-modal-phone-input')
  }

  editMemberNotesInput(): Locator {
    return this.byTestId('members-edit-modal-notes-input')
  }

  editMemberSubmitBtn(): Locator {
    return this.byTestId('members-edit-modal-submit-btn')
  }

  editMemberCancelBtn(): Locator {
    return this.byTestId('members-edit-modal-cancel-btn')
  }

  editMemberErrorAlert(): Locator {
    return this.byTestId('members-edit-modal-error')
  }

  /** Click the Edit pencil and wait for the modal to become visible. */
  async openEditMemberModal(): Promise<void> {
    await this.editMemberTriggerBtn().click()
    await expect(this.editMemberModal()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Fill the Edit Member form fields. All fields are optional; only the
   * provided values are typed (the rest stay as the seeded values).
   *
   * Inputs are cleared before fill so the spec doesn't have to manage
   * the existing-text-prefix problem.
   */
  async fillEditMemberForm(opts: {
    name?: string
    email?: string
    phone?: string
    notes?: string
  }): Promise<void> {
    if (opts.name !== undefined) {
      await this.editMemberNameInput().fill(opts.name)
    }
    if (opts.email !== undefined) {
      await this.editMemberEmailInput().fill(opts.email)
    }
    if (opts.phone !== undefined) {
      await this.editMemberPhoneInput().fill(opts.phone)
    }
    if (opts.notes !== undefined) {
      await this.editMemberNotesInput().fill(opts.notes)
    }
  }

  /** Click Submit. Caller waits for the modal to close or for an error. */
  async submitEditMemberForm(): Promise<void> {
    await this.editMemberSubmitBtn().click()
  }

  /** Click Cancel and wait for the modal to close. */
  async cancelEditMemberForm(): Promise<void> {
    await this.editMemberCancelBtn().click()
    await expect(this.editMemberModal()).toBeHidden({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Assert the modal's error alert is visible and optionally contains a
   * substring. Used by duplicate-email and validation scenarios.
   */
  async expectEditMemberError(messageSubstring?: string): Promise<void> {
    await expect(this.editMemberErrorAlert()).toBeVisible({
      timeout: ANIM_TIMEOUT,
    })
    if (messageSubstring) {
      await expect(this.editMemberErrorAlert()).toContainText(messageSubstring)
    }
  }

  /**
   * Full happy-path convenience helper: open modal, fill provided fields,
   * submit, wait for modal close. Caller asserts against the DB.
   */
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

  // ─── Tier 3.7: Archive / Exclude from Analytics ────────────────────────
  //
  // Locators + helpers for the admin "Archive Member" flow and the
  // "Exclude from Analytics" checkbox (part of the Edit Member modal).
  //
  // Archive button lives in the MemberProfilePanel's Active Membership
  // card and is wired through `DELETE /api/members/[id]`. Fires a browser
  // `confirm()` dialog. BUG-014 (4-layer route divergence) was fixed inline
  // as part of the Tier 3.7 council run. BUG-013 narrow-blast Option B:
  // the button now passes `member.profileId`, same as the Edit modal.
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
   * The dialog listener is attached BEFORE the click to avoid a race.
   *
   * When accepting, waits for the DELETE response before returning so
   * callers don't race the async fetch (especially during cold-compile on
   * the first test run — Next.js can take >5s to compile the route).
   *
   * @param accept true → accept (archive proceeds), false → dismiss (no-op)
   */
  async archiveMemberFromPanel(accept: boolean): Promise<void> {
    // One-shot dialog handler so we don't leak state across tests.
    this.page.once('dialog', async (dialog) => {
      if (accept) {
        await dialog.accept()
      } else {
        await dialog.dismiss()
      }
    })
    if (accept) {
      // Wait for the DELETE round-trip so the test can safely assert
      // against the panel close + DB state immediately after.
      const responsePromise = this.page.waitForResponse(
        (res) =>
          res.url().includes('/api/members/') &&
          res.request().method() === 'DELETE',
        { timeout: 30_000 },
      )
      await this.archiveMemberBtn().click()
      await responsePromise
    } else {
      await this.archiveMemberBtn().click()
    }
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
   * DB → directory mapper → panel prop → modal initial state.
   */
  async expectExcludeFromAnalyticsChecked(expected: boolean): Promise<void> {
    const checkbox = this.editMemberExcludeAnalyticsCheckbox()
    if (expected) {
      await expect(checkbox).toBeChecked()
    } else {
      await expect(checkbox).not.toBeChecked()
    }
  }

  /**
   * The X button in the top-right of the MemberProfilePanel header.
   * MemberProfilePanel has no Escape key handler — closing must be done
   * via this button (or by the route changing, etc).
   */
  panelCloseBtn(): Locator {
    return this.byTestId('members-panel-close-btn')
  }

  /**
   * Explicitly close the MemberProfilePanel by clicking the X button.
   * Waits for the panel's edit trigger to disappear so callers can
   * safely open another member immediately afterwards.
   */
  async closeMemberPanel(): Promise<void> {
    await this.panelCloseBtn().click()
    await expect(this.editMemberTriggerBtn()).toBeHidden({
      timeout: ANIM_TIMEOUT,
    })
  }
}
