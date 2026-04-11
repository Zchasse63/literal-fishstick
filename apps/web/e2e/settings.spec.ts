/**
 * Settings smoke tests — Tier 2.9.
 *
 * Baseline page-mount coverage for the Settings module (3 routes).
 *
 *   1. `/settings`           (cancellation/strike/studio config)
 *   2. `/settings/geofence`  (geofence location manager)
 *   3. `/settings/sms`       (SMS provider config)
 *
 * All writes (save settings, add/delete geofence, update SMS credentials,
 * send test SMS) are deferred to Tier 4 per the QA roadmap.
 */
import { test } from '@playwright/test'
import { SettingsPage } from './pages/SettingsPage'

test.describe('Settings — Smoke (Tier 2.9)', () => {
  // ---------------------------------------------------------------------
  // P0 — core mount contract for the module overview
  // ---------------------------------------------------------------------

  test('/settings mounts — admin shell + settings-page-root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new SettingsPage(page)
    await pom.expectMainMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — sub-page smokes
  // ---------------------------------------------------------------------

  test('/settings/geofence mounts — admin shell + geofence manager visible @p1', async ({
    page,
  }) => {
    const pom = new SettingsPage(page)
    await pom.expectGeofenceMounted()
  })

  test('/settings/sms mounts — admin shell + SMS config visible @p1', async ({
    page,
  }) => {
    const pom = new SettingsPage(page)
    await pom.expectSmsMounted()
  })
})
