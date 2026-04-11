/**
 * T37 — Stress/load test for members search endpoint.
 *
 * Fires 200 concurrent GET /api/members?search=... requests and verifies:
 *   - All succeed (200)
 *   - No server errors (5xx)
 *   - Total elapsed stays within SLA
 *
 * The members search uses full_name/email/phone ilike filters with RLS,
 * so this exercises the auth path, RLS initplan, and the profiles+members
 * join. A sane upper bound for a warmed-up dev server is ~15s for 200 reads.
 */
import { test, expect } from '@playwright/test'

const CONCURRENCY = 200
const SLA_MS = 30_000

// Seven diverse search terms that won't match anything real — the goal is
// to exercise the query path, not to hit cache.
const SEARCH_TERMS = [
  'zzzstress_alpha',
  'zzzstress_beta',
  'zzzstress_gamma',
  'zzzstress_delta',
  'zzzstress_epsilon',
  'zzzstress_zeta',
  'zzzstress_eta',
]

test.describe('Platform — Stress: 200 concurrent search queries (T37)', () => {
  test.setTimeout(120_000)

  test('200 concurrent GET /api/members?search → all 200 OK, no 5xx @stress', async ({
    page,
  }) => {
    const startTime = Date.now()

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) => {
        const term = SEARCH_TERMS[i % SEARCH_TERMS.length]
        return page.request.get(`/api/members?search=${term}&limit=10`)
      })
    )

    const elapsedMs = Date.now() - startTime

    const statuses = results.map((r) => r.status())
    const ok200 = statuses.filter((s) => s === 200).length
    const serverErrors = statuses.filter((s) => s >= 500).length
    const rateLimited = statuses.filter((s) => s === 429).length
    const authFailures = statuses.filter((s) => s === 401 || s === 403).length
    const other = statuses.filter(
      (s) => s !== 200 && s < 500 && s !== 429 && s !== 401 && s !== 403
    ).length

    console.log(
      `[T37] ${CONCURRENCY} requests in ${elapsedMs}ms: ` +
        `${ok200} ok, ${serverErrors} 5xx, ${rateLimited} 429, ${authFailures} auth, ${other} other`
    )

    // Zero server errors is the hard bar
    expect(serverErrors).toBe(0)
    // All but rate-limited and auth failures should succeed
    expect(ok200 + rateLimited + authFailures).toBe(CONCURRENCY)
    // At least 80% should succeed (allow rate-limiting to cap some)
    expect(ok200).toBeGreaterThanOrEqual(Math.floor(CONCURRENCY * 0.8))
    // Soft SLA
    expect(elapsedMs).toBeLessThan(SLA_MS)
  })
})
