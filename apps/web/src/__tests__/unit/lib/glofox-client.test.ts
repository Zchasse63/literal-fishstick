/**
 * Glofox API Client Tests (MED-013)
 *
 * Verifies the 15 corrected API methods send the right HTTP method, path,
 * headers, and body shapes. Uses a globally mocked `fetch`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Global fetch mock ─────────────────────────────────────────
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// ─── Env vars required by GlofoxClient constructor ─────────────
process.env.GLOFOX_API_TOKEN = 'test-token'
process.env.GLOFOX_API_KEY = 'test-api-key'
process.env.GLOFOX_BRANCH_ID = 'test-branch-id'

// ─── Import after env/mocks are set ────────────────────────────
import { GlofoxClient } from '@/lib/glofox/client'

// ─── Helpers ───────────────────────────────────────────────────
function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

describe('GlofoxClient', () => {
  let client: GlofoxClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new GlofoxClient({
      apiToken: 'test-token',
      apiKey: 'test-api-key',
      branchId: 'test-branch-id',
      baseUrl: 'https://gf-api.aws.glofox.com/prod/',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── getTransactions ──────────────────────────────────────────
  describe('getTransactions()', () => {
    it('sends POST to Analytics/report with model=TransactionsList and unix timestamp strings', async () => {
      fetchMock.mockReturnValueOnce(
        jsonResponse({
          TransactionsList: {
            details: [{ id: 'tx-1', amount: 50.0 }],
          },
        }),
      )

      const result = await client.getTransactions(
        'branch-1',
        'ns-1',
        '2025-01-01T00:00:00.000Z',
        '2025-01-31T23:59:59.000Z',
      )

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('Analytics/report')
      expect(opts.method).toBe('POST')

      const body = JSON.parse(opts.body)
      expect(body.model).toBe('TransactionsList')
      // start and end must be UNIX timestamp STRINGS
      expect(typeof body.start).toBe('string')
      expect(typeof body.end).toBe('string')
      expect(Number(body.start)).toBeGreaterThan(0)
      expect(Number(body.end)).toBeGreaterThan(0)
      // secondStart/secondEnd are integers
      expect(typeof body.secondStart).toBe('number')
      expect(typeof body.secondEnd).toBe('number')

      expect(result).toEqual([{ id: 'tx-1', amount: 50.0 }])
    })

    it('parses TransactionsList.details[] from the response', async () => {
      fetchMock.mockReturnValueOnce(
        jsonResponse({
          TransactionsList: {
            details: [
              { id: 'tx-1', amount: 10 },
              { id: 'tx-2', amount: 20 },
            ],
          },
        }),
      )

      const result = await client.getTransactions('b', 'ns', '2025-01-01', '2025-01-31')
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('tx-1')
      expect(result[1].id).toBe('tx-2')
    })

    it('falls back to data[] when TransactionsList is absent', async () => {
      fetchMock.mockReturnValueOnce(
        jsonResponse({ data: [{ id: 'tx-fallback' }] }),
      )

      const result = await client.getTransactions('b', 'ns', '2025-01-01', '2025-01-31')
      expect(result).toEqual([{ id: 'tx-fallback' }])
    })
  })

  // ─── registerMember ───────────────────────────────────────────
  describe('registerMember()', () => {
    it('calls POST /2.0/register', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ user_id: 'new-user' }))

      await client.registerMember({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
      } as any)

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('2.0/register')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body)
      expect(body.first_name).toBe('Jane')
    })
  })

  // ─── cancelMembership ─────────────────────────────────────────
  describe('cancelMembership()', () => {
    it('calls POST /v3.0/memberships/{id}/cancel', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ status: 'cancelled' }))

      await client.cancelMembership({
        user_membership_id: 'mem-123',
        user_id: 'user-456',
        when: 'now',
      } as any)

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('v3.0/memberships/mem-123/cancel')
      expect(opts.method).toBe('POST')
      // Should include the impersonation header
      expect(opts.headers['x-glofox-impersonated-member-id']).toBe('user-456')
    })
  })

  // ─── getInteractions ──────────────────────────────────────────
  describe('getInteractions()', () => {
    it('calls GET /2.1/branches/{branchId}/leads/{userId}/interactions with page param', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ data: [] }))

      await client.getInteractions('user-1', 'branch-2', 3)

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('2.1/branches/branch-2/leads/user-1/interactions')
      expect(url).toContain('page=3')
      expect(opts.method).toBe('GET')
    })

    it('defaults to client branchId when none provided', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ data: [] }))

      await client.getInteractions('user-1')

      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain('2.1/branches/test-branch-id/leads/user-1/interactions')
    })
  })

  // ─── getContactSources ────────────────────────────────────────
  describe('getContactSources()', () => {
    it('uses /2.3/ path prefix', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ data: [{ id: 'cs-1' }] }))

      await client.getContactSources('branch-3')

      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain('2.3/branches/branch-3/leads/contact-sources')
    })
  })

  // ─── getMarketingSources ──────────────────────────────────────
  describe('getMarketingSources()', () => {
    it('uses /2.3/ path prefix', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ data: [{ id: 'ms-1' }] }))

      await client.getMarketingSources('branch-4')

      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain('2.3/branches/branch-4/leads/marketing-sources')
    })
  })

  // ─── getPrograms ──────────────────────────────────────────────
  describe('getPrograms()', () => {
    it('uses POST (not GET) to v3.0 search-programs path', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ data: [{ id: 'prog-1' }] }))

      await client.getPrograms('loc-1')

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('v3.0/locations/loc-1/search-programs')
      expect(opts.method).toBe('POST')
    })
  })

  // ─── getBranches ──────────────────────────────────────────────
  describe('getBranches()', () => {
    it('uses POST to v3.0/locations/retrieve', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ data: [] }))

      await client.getBranches()

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('v3.0/locations/retrieve')
      expect(opts.method).toBe('POST')
    })
  })

  // ─── createBooking ────────────────────────────────────────────
  describe('createBooking()', () => {
    it('calls POST /2.3/branches/{branchId}/bookings', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ booking_id: 'b-1' }))

      await client.createBooking({
        model: 'class',
        model_id: 'evt-1',
        user_id: 'user-1',
        branch_id: 'branch-5',
      })

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('2.3/branches/branch-5/bookings')
      expect(opts.method).toBe('POST')
    })
  })

  // ─── cancelBooking ────────────────────────────────────────────
  describe('cancelBooking()', () => {
    it('calls DELETE /2.3/branches/{branchId}/bookings/{bookingId}', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ status: 'cancelled' }))

      await client.cancelBooking('booking-99', 'branch-6')

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('2.3/branches/branch-6/bookings/booking-99')
      expect(opts.method).toBe('DELETE')
    })
  })

  // ─── getTaxConfig ─────────────────────────────────────────────
  describe('getTaxConfig()', () => {
    it('calls GET /2.2/branches/{branchId}/taxes', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ data: [{ rate: 0.0425 }] }))

      const result = await client.getTaxConfig('branch-7')

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('2.2/branches/branch-7/taxes')
      expect(opts.method).toBe('GET')
      expect(result).toEqual([{ rate: 0.0425 }])
    })
  })

  // ─── sendAgreement ────────────────────────────────────────────
  describe('sendAgreement()', () => {
    it('calls POST to agreements/send with trigger in body', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ status: 'sent' }))

      await client.sendAgreement({ user_id: 'user-10', document_id: 'doc-5' } as any)

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('agreements/send')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body)
      expect(body.trigger).toBe('doc-5')
    })
  })

  // ─── purchaseMembership ───────────────────────────────────────
  describe('purchaseMembership()', () => {
    it('calls POST /2.2/branches/{branchId}/users/{userId}/memberships/{membershipId}/plans/{planCode}/purchase', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ status: 'purchased' }))

      await client.purchaseMembership({
        branch_id: 'branch-8',
        user_id: 'user-20',
        membership_id: 'mem-5',
        plan_code: 'monthly',
      } as any)

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('2.2/branches/branch-8/users/user-20/memberships/mem-5/plans/monthly/purchase')
      expect(opts.method).toBe('POST')
    })
  })

  // ─── getBookingPrice ──────────────────────────────────────────
  describe('getBookingPrice()', () => {
    it('calls GET /2.0/branches/{branchId}/events/{eventId}/price', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ price: 25 }))

      await client.getBookingPrice('branch-9', 'event-1')

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('2.0/branches/branch-9/events/event-1/price')
      expect(opts.method).toBe('GET')
    })
  })

  // ─── Headers ──────────────────────────────────────────────────
  describe('request headers', () => {
    it('includes x-glofox-api-token, x-api-key, and x-glofox-branch-id', async () => {
      fetchMock.mockReturnValueOnce(jsonResponse({ data: [] }))

      await client.getStaff()

      const [, opts] = fetchMock.mock.calls[0]
      expect(opts.headers['x-glofox-api-token']).toBe('test-token')
      expect(opts.headers['x-api-key']).toBe('test-api-key')
      expect(opts.headers['x-glofox-branch-id']).toBe('test-branch-id')
    })
  })
})
