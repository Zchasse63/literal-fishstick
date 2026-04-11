/**
 * Utility pages smoke tests — Tier 2.10.
 *
 * Baseline page-mount coverage for 3 standalone admin routes that don't
 * belong to a larger module:
 *
 *   1. `/segments`  (Smart Segments)
 *   2. `/engagement` (Gamification / Leaderboard)
 *   3. `/docs/api`  (Swagger UI API docs)
 *
 * All writes (segment create/edit, engagement config, API key management)
 * are deferred to Tier 4/5 per the QA roadmap.
 */
import { test } from '@playwright/test'
import { UtilityPages } from './pages/UtilityPages'

test.describe('Utility Pages — Smoke (Tier 2.10)', () => {
  // ---------------------------------------------------------------------
  // P0 — Smart Segments (core AI-driven module, highest priority)
  // ---------------------------------------------------------------------

  test('/segments mounts — admin shell + segments-page-root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new UtilityPages(page)
    await pom.expectSegmentsMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — Engagement + Docs
  // ---------------------------------------------------------------------

  test('/engagement mounts — admin shell + engagement leaderboard visible @p1', async ({
    page,
  }) => {
    const pom = new UtilityPages(page)
    await pom.expectEngagementMounted()
  })

  test('/docs/api mounts — admin shell + Swagger UI container visible @p1', async ({
    page,
  }) => {
    const pom = new UtilityPages(page)
    await pom.expectDocsApiMounted()
  })
})
