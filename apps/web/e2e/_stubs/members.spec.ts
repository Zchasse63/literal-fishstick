/**
 * Members smoke tests — Tier 2.3.
 *
 * Baseline page-mount coverage for `/members` (directory) and
 * `/members/[id]` (detail). Uses the shared Tier 2 smoke infrastructure
 * (`BasePage.expectSmokeMount`, `adminShellLandmark`) established in
 * Tier 2.1 — see `specs/reports/command-center-smoke-report.md`.
 *
 * Four tests covering the core smoke contract:
 *   1. Directory mounts — shell + testid + pathname + no pageerrors
 *   2. Directory stable — no deferred hydration crashes
 *   3. Directory content semantics — the "Add Member" button renders, proving
 *      the MembersPage client component actually executed
 *   4. Detail page mounts on a bogus id — the `/members/[id]` route renders
 *      the "Member not found" fallback without crashing, proving the route,
 *      server component data fetch, and client component error branch all
 *      execute end-to-end
 *
 * Happy-path detail coverage (valid member id, member profile rendered) is
 * deferred to Tier 3.5 (Members: Create Member) where we'll seed a real
 * member fixture via `db.ts` and assert the full profile renders. That's
 * blocked on BUG-001 (DEFAULT_STUDIO_ID coupling) being addressed enough for
 * seeded rows to be visible to the admin page.
 */
import { test, expect } from '@playwright/test'
import { MembersPage } from './pages/MembersPage'
import { ANIM_TIMEOUT } from './pages/BasePage'

test.describe('Members — Smoke (Tier 2.3)', () => {
  // ---------------------------------------------------------------------
  // P0 — core directory mount contract
  // ---------------------------------------------------------------------

  test('/members mounts — admin shell + members-page-root visible, no pageerrors @p0', async ({
    page,
  }) => {
    const pom = new MembersPage(page)
    await pom.expectDirectoryMounted()
  })

  // ---------------------------------------------------------------------
  // P1 — directory stability + content
  // ---------------------------------------------------------------------

  test('/members remains stable after 1.5s idle — no hydration crash @p1', async ({
    page,
  }) => {
    const pom = new MembersPage(page)
    const pageErrors: Error[] = []
    const errorListener = (err: Error) => pageErrors.push(err)
    page.on('pageerror', errorListener)
    try {
      await pom.goto('/members')
      await expect(pom.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
      await page.waitForTimeout(1500)
      await expect(pom.pageRoot()).toBeVisible()
      const errorMessages = pageErrors.map((e) => e.message)
      expect(
        errorMessages,
        `Deferred page errors on /members: ${errorMessages.join('; ')}`,
      ).toEqual([])
    } finally {
      page.off('pageerror', errorListener)
    }
  })

  test('/members → "Add Member" header button rendered @p1', async ({ page }) => {
    // Content-level signal: the members directory header renders an
    // "Add Member" primary button (members/page.tsx:434-440). This proves the
    // MembersDirectory client component actually executed past the data-loading
    // branch — the button is a pure UI element, not blocked on Supabase.
    const pom = new MembersPage(page)
    await pom.goto('/members')
    await expect(pom.pageRoot()).toBeVisible({ timeout: ANIM_TIMEOUT })
    await expect(
      page.getByRole('button', { name: 'Add Member', exact: true }),
    ).toBeVisible({ timeout: ANIM_TIMEOUT })
  })

  // ---------------------------------------------------------------------
  // P1 — detail page smoke (not-found branch only for Tier 2)
  // ---------------------------------------------------------------------

  test('/members/[bogus-uuid] mounts + renders not-found fallback @p1', async ({
    page,
  }) => {
    // The detail route is a Next.js async server component that fetches the
    // member row by id + studio_id filter. When no row matches, the server
    // renders <MemberProfileClient member={null} .../> and the client renders
    // the `data-testid="members-detail-not-found"` fallback.
    //
    // This smoke proves:
    //   1. The `/members/[id]` route compiles and serves HTML
    //   2. The Supabase query with a well-formed-but-nonexistent UUID
    //      returns a clean null (not a 500) — zero rows, not a parse error
    //   3. The MemberProfileClient `if (!member) return <NotFound/>` branch
    //      renders cleanly under the admin shell with no pageerrors
    //
    // The happy-path equivalent (seeded member, full profile rendered) is
    // Tier 3.5's responsibility.
    const pom = new MembersPage(page)
    await pom.expectBogusDetailNotFound()
  })
})
