/**
 * SettingsPage — thin POM for the admin Settings module.
 *
 * Tier 2.9 smoke covers 3 static routes:
 *   - `/settings`           (cancellation rules, strike system, studio config)
 *   - `/settings/geofence`  (geofence location manager)
 *   - `/settings/sms`       (SMS provider config — currently Twilio stub)
 *
 * All writes (save settings, add/delete geofence location, update SMS
 * credentials, send test SMS) are deferred to Tier 4 per the QA roadmap.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export class SettingsPage extends BasePage {
  // ─── Locators ────────────────────────────────────────────
  pageRoot(): Locator { return this.byTestId('settings-page-root') }
  geofencePageRoot(): Locator { return this.byTestId('settings-geofence-page-root') }
  smsPageRoot(): Locator { return this.byTestId('settings-sms-page-root') }

  // ─── Mount helpers ───────────────────────────────────────
  async expectMainMounted(): Promise<void> {
    await this.expectSmokeMount('/settings', this.adminShellLandmark())
    await expect(this.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectGeofenceMounted(): Promise<void> {
    await this.expectSmokeMount('/settings/geofence', this.adminShellLandmark())
    await expect(this.geofencePageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectSmsMounted(): Promise<void> {
    await this.expectSmokeMount('/settings/sms', this.adminShellLandmark())
    await expect(this.smsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }
}
