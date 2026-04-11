/**
 * CommandCenterPage — thin POM for the admin Command Center (`/`).
 *
 * Tier 2.1 is a smoke run — the only thing this POM needs to expose is:
 *   1. expectMounted() — asserts the page loaded into the admin shell,
 *      no uncaught pageerror fired, and the command-page-root testid is
 *      visible (proves the component itself rendered, not just the shell).
 *
 * All the cross-cutting logic (pathname check, pageerror tracking, landmark
 * visibility) lives in BasePage.expectSmokeMount. This POM is just the glue.
 *
 * When Tier 3+ adds write flows against Command Center (if any), extend this
 * POM with action methods — don't duplicate expectSmokeMount here.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export class CommandCenterPage extends BasePage {
  /** The top-level container of the command center page body. */
  pageRoot(): Locator {
    return this.byTestId('command-page-root')
  }

  /**
   * Assert that `/` loaded as the Command Center under the admin shell.
   *
   * Calls the shared smoke helper to check shell landmark + pathname +
   * no pageerrors, then also asserts the command-page-root testid is
   * visible so we know the component itself rendered.
   *
   * NOTE: `/` is the admin root; if middleware ever redirects authenticated
   * admins elsewhere, pass `expectedPath` to override. As of 2026-04-09,
   * no such redirect exists (BUG-004's fix will only redirect /login → /,
   * not / → elsewhere).
   */
  async expectMounted(): Promise<void> {
    await this.expectSmokeMount('/', this.adminShellLandmark())
    await expect(this.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  /**
   * Assert that the command center's greeting header is rendered.
   *
   * The AI briefing card contains `<h2>{greeting}, {firstName}</h2>` where
   * greeting is one of "Good morning" / "Good afternoon" / "Good evening"
   * and firstName defaults to "there" for admin accounts without a first
   * name in profile.full_name. We match the greeting pattern loosely.
   */
  async expectGreetingVisible(): Promise<void> {
    const greeting = this.page.getByRole('heading', {
      level: 2,
      name: /Good (morning|afternoon|evening)/i,
    })
    await expect(greeting).toBeVisible({ timeout: ANIM_TIMEOUT })
  }
}
