import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client used by the rate limiter.
// Since the real implementation calls Supabase RPC, we mock the createClient
// factory to return a controllable stub.
const mockRpc = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}))

// Ensure env vars are set so the client gets initialised
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

describe('rateLimit (async, Supabase-backed)', () => {
  let rateLimit: typeof import('@/lib/rate-limit').rateLimit

  beforeEach(async () => {
    vi.resetModules()
    mockRpc.mockReset()
    const mod = await import('@/lib/rate-limit')
    rateLimit = mod.rateLimit
  })

  it('returns allowed=true when under the limit', async () => {
    mockRpc.mockResolvedValue({
      data: [{ current_count: 1, is_allowed: true }],
      error: null,
    })

    const result = await rateLimit('key-a', 5, 60_000)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('returns allowed=false when at or over the limit', async () => {
    mockRpc.mockResolvedValue({
      data: [{ current_count: 6, is_allowed: false }],
      error: null,
    })

    const result = await rateLimit('key-b', 5, 60_000)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('passes correct parameters to the RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [{ current_count: 1, is_allowed: true }],
      error: null,
    })

    await rateLimit('ai:user-123', 20, 60_000)

    expect(mockRpc).toHaveBeenCalledWith('increment_rate_limit', {
      p_key: 'ai:user-123',
      p_limit: 20,
      p_window_ms: 60_000,
    })
  })

  it('fails open when the RPC returns an error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'relation does not exist' },
    })

    const result = await rateLimit('key-c', 5, 60_000)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
  })

  it('fails open when the RPC throws a network error', async () => {
    mockRpc.mockRejectedValue(new Error('Network timeout'))

    const result = await rateLimit('key-d', 5, 60_000)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
  })

  it('handles non-array RPC response (single object)', async () => {
    mockRpc.mockResolvedValue({
      data: { current_count: 3, is_allowed: true },
      error: null,
    })

    const result = await rateLimit('key-e', 5, 60_000)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('remaining never goes below 0', async () => {
    mockRpc.mockResolvedValue({
      data: [{ current_count: 100, is_allowed: false }],
      error: null,
    })

    const result = await rateLimit('key-f', 5, 60_000)

    expect(result.remaining).toBe(0)
  })
})
