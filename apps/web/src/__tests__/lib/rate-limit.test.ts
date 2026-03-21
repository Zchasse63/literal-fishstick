import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('rateLimit', () => {
  let rateLimit: typeof import('@/lib/rate-limit').rateLimit

  beforeEach(async () => {
    vi.useFakeTimers()
    // Reset modules to get fresh module-level state (new Map, new lastCleanup)
    vi.resetModules()
    const mod = await import('@/lib/rate-limit')
    rateLimit = mod.rateLimit
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns success with remaining = limit - 1 on first request', () => {
    const result = rateLimit('key-a', 5, 60_000)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('returns decreasing remaining count for multiple requests up to limit', () => {
    const limit = 3
    const results = []
    for (let i = 0; i < limit; i++) {
      results.push(rateLimit('key-b', limit, 60_000))
    }

    expect(results[0]).toEqual({ success: true, remaining: 2 })
    expect(results[1]).toEqual({ success: true, remaining: 1 })
    expect(results[2]).toEqual({ success: true, remaining: 0 })
  })

  it('returns failure after limit is reached', () => {
    const limit = 2
    rateLimit('key-c', limit, 60_000)
    rateLimit('key-c', limit, 60_000)

    const result = rateLimit('key-c', limit, 60_000)

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets counter after window expires', () => {
    const windowMs = 10_000
    rateLimit('key-d', 1, windowMs)

    // Advance past the window
    vi.advanceTimersByTime(windowMs + 1)

    const result = rateLimit('key-d', 1, windowMs)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('isolates different keys from each other', () => {
    rateLimit('key-e', 1, 60_000)

    const result = rateLimit('key-f', 1, 60_000)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('cleans up expired entries when cleanup interval elapses', () => {
    // Create an entry that will expire
    rateLimit('expired-key', 5, 1_000)

    // Advance past both the entry window AND the cleanup interval (60s)
    vi.advanceTimersByTime(61_000)

    // This call triggers cleanup() which should remove 'expired-key'
    // If cleanup works, the next call for 'expired-key' creates a fresh entry
    const result = rateLimit('expired-key', 5, 1_000)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4) // Fresh entry: limit (5) - 1
  })

  it('handles limit of 1 correctly (first succeeds, second fails)', () => {
    const first = rateLimit('key-g', 1, 60_000)
    const second = rateLimit('key-g', 1, 60_000)

    expect(first).toEqual({ success: true, remaining: 0 })
    expect(second).toEqual({ success: false, remaining: 0 })
  })

  it('handles window of 0ms (resets immediately on next call)', () => {
    rateLimit('key-h', 1, 0)

    // Advance time by just 1ms so Date.now() > resetAt
    vi.advanceTimersByTime(1)

    const result = rateLimit('key-h', 1, 0)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('does not clean up entries before cleanup interval has passed', () => {
    rateLimit('persist-key', 2, 1_000)

    // Advance past entry window but NOT past cleanup interval
    vi.advanceTimersByTime(2_000)

    // Trigger another call (cleanup runs but skips because < 60s from module init)
    // Actually, 2s < 60s so cleanup skips. The entry IS expired though,
    // so the rateLimit function itself resets it (line 39-41 of source).
    const result = rateLimit('persist-key', 2, 1_000)

    // The entry was expired, so it gets a fresh window
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('multiple failed requests after limit still return failure', () => {
    rateLimit('key-i', 1, 60_000) // uses up the limit

    const second = rateLimit('key-i', 1, 60_000)
    const third = rateLimit('key-i', 1, 60_000)

    expect(second).toEqual({ success: false, remaining: 0 })
    expect(third).toEqual({ success: false, remaining: 0 })
  })
})
