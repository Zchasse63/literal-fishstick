/**
 * Marketing smoke tests — Tier 2.5.
 *
 * Baseline page-mount coverage for the entire Marketing module (5 routes).
 * Uses the shared Tier 2 smoke infrastructure (`BasePage.expectSmokeMount`,
 * `adminShellLandmark`).
 *
 * Six tests covering the smoke contract for all 5 pages:
 *   1. `/marketing` overview mounts — nav cards + metrics
 *   2. `/marketing` → "New Campaign" CTA rendered (content semantics)
 *   3. `/marketing/campaigns` mounts — campaigns list page
 *   4. `/marketing/automations` mounts — automation flows list page
 *   5. `/marketing/content` mounts — content hub page
 *   6. `/marketing/leads` mounts — lead pipeline (drag-and-drop board)
 *
 * Write flows (campaign create/edit/send, automation builder, lead drag-drop)
 * are deferred to Tier 5 (Marketing/AI writes) per the QA roadmap.
 */
import { test, expect } from '@playwright/test'
import { MarketingPage } from './pages/MarketingPage'
import { ANIM_TIMEOUT } from './pages/BasePage'

test.describe('Marketing — Smoke (Tier 2.5)', () => {
  // ---------------------------------------------------------------------
  // P0 — core mount contract for the module overview
  // ---------------------------------------------------------------------

  test('/marketing mounts — admin shell + marketing-page-root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new MarketingPage(page)
    await pom.expectOverviewMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — content semantics + sub-page smokes
  // ---------------------------------------------------------------------

  test('/marketing/campaigns → "New Campaign" header CTA rendered @p1', async ({ page }) => {
    // Content-level signal: CampaignsClient renders a "New Campaign" primary
    // link in the header (CampaignsClient.tsx:165-167). This links to the
    // campaign builder — Tier 5 will exercise the builder itself.
    const pom = new MarketingPage(page)
    await pom.expectCampaignsMounted()
    await expect(
      page.getByRole('link', { name: /New Campaign/ }).first(),
    ).toBeVisible({ timeout: ANIM_TIMEOUT })
  })

  test('/marketing/automations mounts — admin shell + marketing-automations-page-root visible @p1', async ({
    page,
  }) => {
    const pom = new MarketingPage(page)
    await pom.expectAutomationsMounted()
  })

  test('/marketing/content mounts — admin shell + marketing-content-page-root visible @p1', async ({
    page,
  }) => {
    const pom = new MarketingPage(page)
    await pom.expectContentMounted()
  })

  test('/marketing/leads mounts — admin shell + marketing-leads-page-root visible @p1', async ({
    page,
  }) => {
    // Lead pipeline is a drag-and-drop kanban board (see LeadPipelineClient).
    // Smoke just proves the board mounts — drag/drop interaction is deferred
    // to Tier 5.
    const pom = new MarketingPage(page)
    await pom.expectLeadsMounted()
  })
})
