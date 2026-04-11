/**
 * MarketingPage — thin POM for the admin Marketing module.
 *
 * Tier 2.5 smoke covers FIVE routes:
 *   - `/marketing` (overview with nav cards + metrics)
 *   - `/marketing/campaigns` (campaigns list)
 *   - `/marketing/automations` (automation flows list)
 *   - `/marketing/content` (content hub)
 *   - `/marketing/leads` (lead pipeline with drag-and-drop)
 *
 * Tier 3 (Tier 5 in roadmap terms) will add write flows via extended methods.
 */
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { BasePage, ANIM_TIMEOUT } from './BasePage'

export class MarketingPage extends BasePage {
  pageRoot(): Locator {
    return this.byTestId('marketing-page-root')
  }
  campaignsPageRoot(): Locator {
    return this.byTestId('marketing-campaigns-page-root')
  }
  automationsPageRoot(): Locator {
    return this.byTestId('marketing-automations-page-root')
  }
  contentPageRoot(): Locator {
    return this.byTestId('marketing-content-page-root')
  }
  leadsPageRoot(): Locator {
    return this.byTestId('marketing-leads-page-root')
  }

  async expectOverviewMounted(): Promise<void> {
    await this.expectSmokeMount('/marketing', this.adminShellLandmark())
    await expect(this.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectCampaignsMounted(): Promise<void> {
    await this.expectSmokeMount('/marketing/campaigns', this.adminShellLandmark())
    await expect(this.campaignsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectAutomationsMounted(): Promise<void> {
    await this.expectSmokeMount('/marketing/automations', this.adminShellLandmark())
    await expect(this.automationsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectContentMounted(): Promise<void> {
    await this.expectSmokeMount('/marketing/content', this.adminShellLandmark())
    await expect(this.contentPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }

  async expectLeadsMounted(): Promise<void> {
    await this.expectSmokeMount('/marketing/leads', this.adminShellLandmark())
    await expect(this.leadsPageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
  }
}
