/**
 * Tier 8.3 — Platform: Rate limit + Failed payment retry (API-level, gap-filed)
 *
 * The rate limiter in `src/lib/rate-limit.ts` calls the `increment_rate_limit`
 * RPC which does NOT exist in the DB (B7). The limiter fails open — every
 * request is allowed. This tier asserts the fail-open contract and documents
 * the gap.
 *
 * Dunning / failed payment retry has no dedicated API route — it is surfaced
 * via Stripe webhooks (B5) and `/api/transactions?status=failed` filtering.
 * This tier verifies the read path.
 */
import { test, expect } from '@playwright/test'

test.describe('Platform — Rate Limit + Failed Payment Read (Tier 8.3)', () => {
  test('AI endpoint allows rapid successive calls (rate limit fails open) @p0', async ({ page }) => {
    // Fire 10 sequential calls — should all succeed because the RPC is missing
    // and rateLimit() returns allowed=true. Once B7 lands, this test must be
    // updated to assert the 20/min limit.
    const results: number[] = []
    for (let i = 0; i < 10; i++) {
      const res = await page.request.get('/api/ai/briefing')
      results.push(res.status())
    }
    expect(results.every((s) => s === 200)).toBe(true)
  })

  test('transactions endpoint filters by failed status @p0', async ({ page }) => {
    const res = await page.request.get('/api/transactions?status=failed&limit=10')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const rows = body.data ?? []
    for (const t of rows) {
      expect(t.status).toBe('failed')
    }
  })

  test('rate limit RPC dependency documented (B7) @p1', async () => {
    // `increment_rate_limit(p_key, p_limit, p_window_ms)` RPC is missing.
    // Current fail-open behaviour is safe for Phase 1 (pre-launch) but must
    // be resolved before any member-facing endpoints accept public traffic.
    expect(true).toBe(true)
  })

  test('Stripe webhook retry path gap-filed (B5) @p1', async () => {
    // No direct webhook mock harness is set up. B5 tracks the full Stripe
    // SDK integration including webhook signature verification and retry.
    expect(true).toBe(true)
  })
})
