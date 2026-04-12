/**
 * Glofox API Client for Meridian
 *
 * Handles authenticated requests to the Glofox REST API with automatic
 * pagination, retry logic, and rate limit handling.
 * Server-side only — never expose API keys to the client.
 */
import type {
  GlofoxConfig,
  GlofoxPaginatedResponse,
  GlofoxMember,
  GlofoxStaff,
  GlofoxEvent,
  GlofoxBooking,
  GlofoxTransaction,
  GlofoxMembership,
  GlofoxCreditPack,
  GlofoxLead,
  GlofoxProduct,
  GlofoxWaiver,
  GlofoxAgreement,
  GlofoxTrainerPerformance,
  GlofoxDiscount,
  GlofoxMarkAttendanceRequest,
  GlofoxMarkAttendanceResponse,
  GlofoxCreateBookingRequest,
  GlofoxCreateBookingResponse,
  GlofoxCancelBookingResponse,
  GlofoxPriceBreakdownRequest,
  GlofoxPriceBreakdownResponse,
  GlofoxTaxConfig,
  GlofoxTaxConfigResponse,
  GlofoxProgram,
  GlofoxFacility,
  GlofoxBranch,
  GlofoxCategory,
  GlofoxIntegration,
  GlofoxCourse,
  GlofoxRegisterMemberRequest,
  GlofoxRegisterMemberResponse,
  GlofoxUpdateMemberRequest,
  GlofoxSearchMembersResponse,
  GlofoxPurchaseMembershipRequest,
  GlofoxPurchaseMembershipResponse,
  GlofoxCancelMembershipRequest,
  GlofoxCancelMembershipResponse,
  GlofoxPaymentMethod,
  GlofoxInteraction,
  GlofoxCreateInteractionRequest,
  GlofoxContactSource,
  GlofoxMarketingSource,
  GlofoxSendAgreementRequest,
  GlofoxAgreementTemplate,
  GlofoxAppointment,
  GlofoxAppointmentAvailabilityResponse,
  GlofoxInvoice,
  GlofoxAccessRecordRequest,
} from './types'

// ─── Constants ─────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://gf-api.aws.glofox.com/prod/'
const DEFAULT_PAGE_LIMIT = 100
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000
/** Minimum delay (ms) between consecutive paginated requests to avoid hitting Glofox rate limits. */
const RATE_LIMIT_DELAY_MS = 100

// ─── Helpers ───────────────────────────────────────────────────

function unixToISO(unix: number | undefined | null | Record<string, unknown>): string | null {
  if (unix == null || unix === 0) return null
  // Handle Glofox {sec, usec} timestamp objects
  if (typeof unix === 'object' && unix !== null) {
    const sec = (unix as any).sec ?? (unix as any).$date
    if (typeof sec === 'number') return new Date(sec * 1000).toISOString()
    return null
  }
  if (typeof unix !== 'number') return null
  return new Date(unix * 1000).toISOString()
}

function isoToUnix(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000)
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Glofox Analytics/report TransactionsList wraps each row in a single-key
 * object keyed by the payment provider (e.g. `{ StripeCharge: {...} }`,
 * `{ PAYG: {...} }`, `{ Cash: {...} }`). Unwrap the payload so callers get
 * a flat transaction object with `_id`, `metadata.user_id`, etc.
 *
 * Unwrap requires:
 *   1. Row has NO top-level `_id`/`id` (so a flat fixture passes through), AND
 *   2. Row has exactly ONE key, AND
 *   3. That key's value is an object (not array) containing `_id` or `id`.
 *
 * The "exactly one key" guard is defensive against Glofox ever decorating
 * the envelope with sibling fields — if that happens, unwrap silently
 * refuses rather than randomly picking a wrapper.
 */
function unwrapTransactionRow(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {}
  const flat = row as Record<string, unknown>
  // Already unwrapped
  if (flat._id || flat.id) return flat
  const keys = Object.keys(flat)
  if (keys.length !== 1) return flat
  const v = flat[keys[0]]
  if (!v || typeof v !== 'object' || Array.isArray(v)) return flat
  const inner = v as Record<string, unknown>
  if (!inner._id && !inner.id) return flat
  return inner
}

// ─── Client ────────────────────────────────────────────────────

export class GlofoxClient {
  private readonly baseUrl: string
  private readonly apiToken: string
  private readonly apiKey: string
  private readonly branchId: string

  constructor(config?: Partial<GlofoxConfig>) {
    this.apiToken = config?.apiToken ?? process.env.GLOFOX_API_TOKEN ?? ''
    this.apiKey = config?.apiKey ?? process.env.GLOFOX_API_KEY ?? ''
    this.branchId = config?.branchId ?? process.env.GLOFOX_BRANCH_ID ?? ''
    this.baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL

    if (!this.apiToken || !this.apiKey) {
      throw new Error(
        'Missing Glofox credentials. Set GLOFOX_API_TOKEN and GLOFOX_API_KEY environment variables.',
      )
    }
  }

  // ─── Core Request ──────────────────────────────────────────

  private get headers(): Record<string, string> {
    return {
      'x-glofox-api-token': this.apiToken,
      'x-api-key': this.apiKey,
      'x-glofox-branch-id': this.branchId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  /**
   * Execute a single HTTP request with retry + exponential backoff.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options?: {
      params?: Record<string, string | number | boolean | undefined>
      body?: unknown
    },
  ): Promise<T> {
    // Build query string from params, filtering out undefined values
    const queryParts: string[] = []
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        }
      }
    }
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''

    // Build URL using string concatenation (NOT new URL()) to preserve /prod/ base path
    const url = `${this.baseUrl}${path}${queryString}`

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
        console.warn(
          `[glofox] Retry ${attempt}/${MAX_RETRIES} for ${method} ${path} after ${delay}ms`,
        )
        await sleep(delay)
      }

      try {
        const response = await fetch(url, {
          method,
          headers: this.headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
        })

        // Rate limited — retry
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : INITIAL_RETRY_DELAY_MS * 2
          console.warn(`[glofox] Rate limited on ${method} ${path}. Waiting ${waitMs}ms.`)
          await sleep(waitMs)
          continue
        }

        // Server error — retry
        if (response.status >= 500) {
          lastError = new Error(`Glofox API server error: ${response.status} ${response.statusText}`)
          console.error(`[glofox] ${lastError.message} for ${method} ${path}`)
          continue
        }

        // Client error — do not retry
        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'unknown')
          throw new Error(
            `Glofox API error: ${response.status} ${response.statusText} — ${errorBody}`,
          )
        }

        const data = (await response.json()) as T
        return data
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Glofox API error:')) {
          throw err // client errors are not retryable
        }
        lastError = err instanceof Error ? err : new Error(String(err))
        console.error(`[glofox] Request failed for ${method} ${path}:`, lastError.message)
      }
    }

    throw lastError ?? new Error(`Glofox API request failed after ${MAX_RETRIES} retries`)
  }

  // ─── Paginated Fetcher ─────────────────────────────────────

  /**
   * Auto-page through a paginated GET endpoint, returning all results.
   */
  async fetchAll<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T[]> {
    const results: T[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.request<GlofoxPaginatedResponse<T>>('GET', path, {
        params: {
          ...params,
          page,
          limit: DEFAULT_PAGE_LIMIT,
        },
      })

      const pageData = response.data ?? (response as any).bookings ?? []
      if (Array.isArray(pageData) && pageData.length > 0) {
        results.push(...pageData)
      }

      // Determine if there are more pages
      if (response.has_more !== undefined) {
        hasMore = response.has_more === true
      } else if (response.total_count !== undefined) {
        hasMore = results.length < response.total_count
      } else if (Array.isArray(pageData)) {
        // If no pagination info, keep going if we got a full page
        hasMore = pageData.length >= DEFAULT_PAGE_LIMIT
      } else {
        hasMore = false
      }

      page++

      // Safety cap at 200 pages (20,000 records)
      if (page > 200) break

      // Rate-limit delay between paginated requests to avoid 429s
      if (hasMore) {
        await sleep(RATE_LIMIT_DELAY_MS)
      }
    }

    console.log(`[glofox] fetchAll ${path}: retrieved ${results.length} records`)
    return results
  }

  // ─── Members ───────────────────────────────────────────────

  async getMembers(options?: { modifiedSince?: string }): Promise<GlofoxMember[]> {
    const params: Record<string, string | number | boolean | undefined> = {}
    if (options?.modifiedSince) {
      params.utc_modified_start_date = options.modifiedSince
    }
    return this.fetchAll<GlofoxMember>('2.0/members', params)
  }

  async getMember(userId: string): Promise<GlofoxMember> {
    return this.request<GlofoxMember>('GET', `2.0/members/${userId}`)
  }

  /**
   * Register a new member in Glofox.
   * POST 2.0/register
   */
  async registerMember(data: GlofoxRegisterMemberRequest): Promise<GlofoxRegisterMemberResponse> {
    return this.request<GlofoxRegisterMemberResponse>('POST', '2.0/register', { body: data })
  }

  /**
   * Update an existing member in Glofox.
   * PUT 2.0/members/{userId}
   */
  async updateMember(userId: string, data: GlofoxUpdateMemberRequest): Promise<GlofoxMember> {
    return this.request<GlofoxMember>('PUT', `2.0/members/${userId}`, { body: data })
  }

  /**
   * Search members by email for deduplication.
   * GET 2.1/branches/{branchId}/users?filters[email]=...
   * Emails in Glofox are unique per studio. Requires exact match.
   */
  async searchMembersByEmail(email: string, branchId?: string): Promise<GlofoxSearchMembersResponse> {
    const branch = branchId ?? this.branchId
    return this.request<GlofoxSearchMembersResponse>(
      'GET',
      `2.1/branches/${branch}/users`,
      { params: { 'filters[email]': email } },
    )
  }

  /**
   * Request a password reset link for a member.
   * POST 2.0/reset
   * Sends a reset email from no-reply@glofox.com.
   */
  async requestPasswordReset(email: string): Promise<{ status?: string; message?: string }> {
    return this.request<{ status?: string; message?: string }>(
      'POST',
      '2.0/reset',
      { body: { email } },
    )
  }

  // ─── Staff ─────────────────────────────────────────────────

  async getStaff(): Promise<GlofoxStaff[]> {
    return this.fetchAll<GlofoxStaff>('2.0/staff')
  }

  async getStaffMember(staffId: string): Promise<GlofoxStaff> {
    return this.request<GlofoxStaff>('GET', `2.0/staff/${staffId}`)
  }

  // ─── Attendances ───────────────────────────────────────────

  /**
   * Mark a booking as attended in Glofox.
   * Called as async write-back when a member checks in via Meridian.
   * POST 2.0/attendances
   */
  async markAttendance(
    bookingId: string,
    userId: string,
  ): Promise<GlofoxMarkAttendanceResponse> {
    const body: GlofoxMarkAttendanceRequest = {
      booking_id: bookingId,
      user_id: userId,
    }
    return this.request<GlofoxMarkAttendanceResponse>('POST', '2.0/attendances', { body })
  }

  // ─── Booking Write-back ────────────────────────────────────

  /**
   * Create a booking in Glofox on behalf of a member.
   * Called as async write-back when a booking is created in Meridian.
   * POST 2.3/branches/{branchId}/bookings
   */
  async createBooking(
    data: GlofoxCreateBookingRequest,
  ): Promise<GlofoxCreateBookingResponse> {
    const branchId = data.branch_id ?? this.branchId
    return this.request<GlofoxCreateBookingResponse>(
      'POST',
      `2.3/branches/${branchId}/bookings`,
      {
        body: {
          model: data.model,
          model_id: data.model_id,
          user_id: data.user_id,
        },
      },
    )
  }

  /**
   * Cancel a booking in Glofox.
   * Called as async write-back when a booking is cancelled in Meridian.
   * DELETE 2.3/branches/{branchId}/bookings/{bookingId}
   */
  async cancelBooking(
    bookingId: string,
    branchId?: string,
  ): Promise<GlofoxCancelBookingResponse> {
    const branch = branchId ?? this.branchId
    return this.request<GlofoxCancelBookingResponse>(
      'DELETE',
      `2.3/branches/${branch}/bookings/${bookingId}`,
    )
  }

  /**
   * Get the price breakdown for a booking before checkout.
   * GET 2.0/branches/{branchId}/events/{eventId}/price
   */
  async getBookingPrice(
    branchId: string,
    eventId: string,
    params?: Omit<GlofoxPriceBreakdownRequest, 'model' | 'model_id'>,
  ): Promise<GlofoxPriceBreakdownResponse> {
    return this.request<GlofoxPriceBreakdownResponse>(
      'GET',
      `2.0/branches/${branchId}/events/${eventId}/price`,
      {
        params: {
          user_id: params?.user_id,
          discount_ids: params?.discount_ids?.join(','),
          promo_code: params?.promo_code,
        },
      },
    )
  }

  // ─── Tax Configuration ─────────────────────────────────────

  /**
   * Get tax configuration for a branch.
   * GET 2.2/branches/{branchId}/taxes
   */
  async getTaxConfig(branchId?: string): Promise<GlofoxTaxConfig[]> {
    const branch = branchId ?? this.branchId
    const response = await this.request<GlofoxTaxConfigResponse>(
      'GET',
      `2.2/branches/${branch}/taxes`,
    )
    return response.data ?? response.taxes ?? []
  }

  // ─── Programs ──────────────────────────────────────────────

  /**
   * Search programs for a location.
   * POST v3.0/locations/{locationId}/search-programs
   */
  async getPrograms(locationId?: string): Promise<GlofoxProgram[]> {
    const locId = locationId ?? this.branchId
    const response = await this.request<{ data?: GlofoxProgram[] }>(
      'POST',
      `v3.0/locations/${locId}/search-programs`,
      { body: {} },
    )
    return response.data ?? []
  }

  // ─── Facilities ───────────────────────────────────────────

  /**
   * Get facilities for a location.
   * GET 3.0/locations/{locationId}/facilities
   */
  async getFacilities(locationId?: string): Promise<GlofoxFacility[]> {
    const locId = locationId ?? this.branchId
    return this.fetchAll<GlofoxFacility>(`3.0/locations/${locId}/facilities`)
  }

  // ─── Branches ─────────────────────────────────────────────

  /**
   * Retrieve locations/branches for the integrator's allowed namespaces.
   * POST v3.0/locations/retrieve
   */
  async getBranches(): Promise<GlofoxBranch[]> {
    const response = await this.request<{ data?: GlofoxBranch[] }>(
      'POST',
      'v3.0/locations/retrieve',
      { body: {} },
    )
    return response.data ?? []
  }

  // ─── Categories ───────────────────────────────────────────

  async getCategories(): Promise<GlofoxCategory[]> {
    return this.fetchAll<GlofoxCategory>('2.0/categories')
  }

  // ─── Integrations ─────────────────────────────────────────

  async getIntegrations(): Promise<GlofoxIntegration[]> {
    const response = await this.request<{ data?: GlofoxIntegration[]; integrations?: GlofoxIntegration[] }>(
      'GET',
      '2.0/integrations',
    )
    return response.data ?? response.integrations ?? []
  }

  // ─── Courses ──────────────────────────────────────────────

  /**
   * Get courses for a location.
   * GET 3.0/locations/{locationId}/courses
   */
  async getCourses(locationId?: string): Promise<GlofoxCourse[]> {
    const locId = locationId ?? this.branchId
    return this.fetchAll<GlofoxCourse>(`3.0/locations/${locId}/courses`)
  }

  // ─── Events / Classes ──────────────────────────────────────

  async getEvents(options?: {
    modifiedSince?: string
    start?: number
    end?: number
  }): Promise<GlofoxEvent[]> {
    const params: Record<string, string | number | boolean | undefined> = {}
    if (options?.modifiedSince) {
      params.utc_modified_start_date = options.modifiedSince
    }
    if (options?.start !== undefined) {
      params.start = options.start
    }
    if (options?.end !== undefined) {
      params.end = options.end
    }
    return this.fetchAll<GlofoxEvent>('2.0/events', params)
  }

  // ─── Bookings ──────────────────────────────────────────────

  async getBookings(
    branchId: string,
    options?: {
      modifiedSince?: string
      startDate?: string
    },
  ): Promise<GlofoxBooking[]> {
    const params: Record<string, string | number | boolean | undefined> = {}
    if (options?.modifiedSince) {
      params.modified_start_date = options.modifiedSince
    }
    if (options?.startDate) {
      // Glofox expects Unix timestamp format for start_date
      const d = new Date(options.startDate)
      params.start_date = Math.floor(d.getTime() / 1000)
    }
    return this.fetchAll<GlofoxBooking>(`2.2/branches/${branchId}/bookings`, params)
  }

  // ─── Transactions ──────────────────────────────────────────

  async getTransactions(
    branchId: string,
    namespace: string,
    startDate: string,
    endDate: string,
  ): Promise<GlofoxTransaction[]> {
    // Analytics/report requires:
    // - model: "TransactionsList" (required)
    // - start/end: UNIX timestamp STRINGS (not ISO dates)
    // - secondStart/secondEnd: integer UNIX timestamps (for comparison range)
    // - Response wraps in TransactionsList.details[] (not data[])
    // - amount is in DOLLARS not cents
    // - EACH ROW is itself wrapped in a payment-provider key like
    //   `{ StripeCharge: { ... } }` or `{ PAYG: { ... } }`. We unwrap
    //   here so downstream code gets a flat GlofoxTransaction.
    const startUnix = String(isoToUnix(startDate))
    const endUnix = String(isoToUnix(endDate))

    const response = await this.request<{
      TransactionsList?: { details?: unknown[] }
      data?: unknown[]
    }>('POST', 'Analytics/report', {
      body: {
        model: 'TransactionsList',
        branch_id: branchId,
        namespace,
        start: startUnix,
        end: endUnix,
        secondStart: isoToUnix(startDate),
        secondEnd: isoToUnix(endDate),
        filter: {
          ReportByMembers: false,
          CompareToRanges: false,
        },
      },
    })

    const rawRows = response.TransactionsList?.details ?? response.data ?? []
    return rawRows.map((row) => unwrapTransactionRow(row) as unknown as GlofoxTransaction)
  }

  // ─── Memberships ───────────────────────────────────────────

  async getMemberships(): Promise<GlofoxMembership[]> {
    return this.fetchAll<GlofoxMembership>('2.0/memberships')
  }

  /**
   * Purchase a membership for a member in Glofox.
   * POST 2.2/branches/{branchId}/users/{userId}/memberships/{membershipId}/plans/{planCode}/purchase
   */
  async purchaseMembership(
    data: GlofoxPurchaseMembershipRequest,
  ): Promise<GlofoxPurchaseMembershipResponse> {
    const branchId = (data as any).branch_id ?? this.branchId
    const userId = (data as any).user_id
    const membershipId = (data as any).membership_id
    const planCode = (data as any).plan_code
    return this.request<GlofoxPurchaseMembershipResponse>(
      'POST',
      `2.2/branches/${branchId}/users/${userId}/memberships/${membershipId}/plans/${planCode}/purchase`,
      { body: data },
    )
  }

  /**
   * Cancel a member's membership in Glofox.
   * POST v3.0/memberships/{userMembershipId}/cancel
   * Requires x-glofox-impersonated-member-id header (set via data.user_id).
   */
  async cancelMembership(
    data: GlofoxCancelMembershipRequest,
  ): Promise<GlofoxCancelMembershipResponse> {
    const userMembershipId = (data as any).user_membership_id ?? (data as any).membership_id
    const memberId = (data as any).user_id
    // The v3.0 cancel endpoint requires x-glofox-impersonated-member-id header
    // We pass the cancellation body (when, local_date, reason) directly
    const body: Record<string, unknown> = {}
    if ((data as any).when) body.when = (data as any).when
    if ((data as any).local_date) body.local_date = (data as any).local_date
    if ((data as any).reason) body.reason = (data as any).reason

    // Override headers for this request to include impersonation
    const url = `${this.baseUrl}v3.0/memberships/${userMembershipId}/cancel`
    const headers = {
      ...this.headers,
      'x-glofox-impersonated-member-id': memberId ?? '',
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown')
      throw new Error(`Glofox API error: ${response.status} ${response.statusText} — ${errorBody}`)
    }

    return (await response.json()) as GlofoxCancelMembershipResponse
  }

  /**
   * Get payment methods available for a branch.
   * GET 2.1/branches/{branchId}/payment-methods
   */
  async getPaymentMethods(branchId?: string): Promise<GlofoxPaymentMethod[]> {
    const branch = branchId ?? this.branchId
    const response = await this.request<{ data?: GlofoxPaymentMethod[] }>(
      'GET',
      `2.1/branches/${branch}/payment-methods`,
      { params: { includes: 'provider,iframe' } },
    )
    return response.data ?? []
  }

  // ─── Discounts ─────────────────────────────────────────────

  async getDiscounts(): Promise<GlofoxDiscount[]> {
    const response = await this.request<{ discounts: GlofoxDiscount[] }>(
      'GET',
      `2.2/branches/${this.branchId}/discounts`,
    )
    return response.discounts ?? []
  }

  // ─── Credits ───────────────────────────────────────────────

  async getCredits(userId: string): Promise<GlofoxCreditPack[]> {
    return this.fetchAll<GlofoxCreditPack>('2.0/credits', { user_id: userId })
  }

  // ─── Leads ─────────────────────────────────────────────────

  async getLeads(
    branchId: string,
    filters?: Record<string, unknown>,
  ): Promise<GlofoxLead[]> {
    const response = await this.request<{ data: GlofoxLead[] }>(
      'POST',
      `2.1/branches/${branchId}/leads/filter`,
      { body: filters ?? {} },
    )
    return response.data ?? []
  }

  // ─── Products ──────────────────────────────────────────────

  async getProducts(locationId: string): Promise<GlofoxProduct[]> {
    return this.fetchAll<GlofoxProduct>(`v3.0/locations/${locationId}/products`)
  }

  // ─── Waivers ───────────────────────────────────────────────

  async getWaivers(): Promise<GlofoxWaiver[]> {
    const response = await this.request<{ data: GlofoxWaiver[] }>('GET', 'TermsConditions/view')
    return response.data ?? []
  }

  // ─── User Agreements ───────────────────────────────────────

  async getUserAgreements(
    branchId: string,
    userId: string,
  ): Promise<GlofoxAgreement[]> {
    const response = await this.request<{ data: GlofoxAgreement[] }>(
      'GET',
      `2.2/branches/${branchId}/users/${userId}/agreements/`,
    )
    return response.data ?? []
  }

  // ─── Linked / Family Accounts ──────────────────────────────

  async getLinkedAccounts(parentId: string): Promise<GlofoxMember[]> {
    const response = await this.request<{ data: GlofoxMember[] }>(
      'GET',
      `2.2/users/${parentId}/linked-accounts`,
    )
    return response.data ?? []
  }

  // ─── Trainer Performance ───────────────────────────────────

  async getTrainerPerformance(
    start: number,
    end: number,
  ): Promise<GlofoxTrainerPerformance[]> {
    const response = await this.request<{ data: GlofoxTrainerPerformance[] }>(
      'GET',
      '2.0/analytics/trainer-performance',
      { params: { start, end } },
    )
    return response.data ?? []
  }

  // ─── CRM / Interactions (Phase 7) ─────────────────────────

  /**
   * Get interactions for a user in a branch.
   * GET 2.1/branches/{branchId}/leads/{userId}/interactions?page=1
   */
  async getInteractions(userId: string, branchId?: string, page = 1): Promise<GlofoxInteraction[]> {
    const branch = branchId ?? this.branchId
    const response = await this.request<{ data?: GlofoxInteraction[] }>(
      'GET',
      `2.1/branches/${branch}/leads/${userId}/interactions`,
      { params: { page, limit: 100 } },
    )
    return response.data ?? []
  }

  /**
   * Add an interaction/note for a user.
   * POST 2.1/branches/{branchId}/leads/{userId}/interactions
   */
  async createInteraction(data: GlofoxCreateInteractionRequest): Promise<GlofoxInteraction> {
    const branchId = (data as any).branch_id ?? this.branchId
    return this.request<GlofoxInteraction>(
      'POST',
      `2.1/branches/${branchId}/leads/${data.user_id}/interactions`,
      { body: { user_id: data.user_id, type: data.type, description: data.notes } },
    )
  }

  /**
   * Get contact sources for a branch.
   * GET 2.3/branches/{branchId}/leads/contact-sources
   */
  async getContactSources(branchId?: string): Promise<GlofoxContactSource[]> {
    const branch = branchId ?? this.branchId
    const response = await this.request<{ data?: GlofoxContactSource[] }>(
      'GET',
      `2.3/branches/${branch}/leads/contact-sources`,
    )
    return response.data ?? []
  }

  /**
   * Get marketing sources for a branch.
   * GET 2.3/branches/{branchId}/leads/marketing-sources
   */
  async getMarketingSources(branchId?: string): Promise<GlofoxMarketingSource[]> {
    const branch = branchId ?? this.branchId
    const response = await this.request<{ data?: GlofoxMarketingSource[] }>(
      'GET',
      `2.3/branches/${branch}/leads/marketing-sources`,
    )
    return response.data ?? []
  }

  // ─── Agreements (Phase 8) ─────────────────────────────────

  /**
   * Send a document to a user for signature.
   * POST 2.2/branches/{branchId}/users/{userId}/agreements/send
   */
  async sendAgreement(data: GlofoxSendAgreementRequest): Promise<{ status?: string }> {
    return this.request<{ status?: string }>(
      'POST',
      `2.2/branches/${this.branchId}/users/${data.user_id}/agreements/send`,
      { body: { trigger: data.document_id } },
    )
  }

  async getAgreementTemplates(): Promise<GlofoxAgreementTemplate[]> {
    const response = await this.request<{ data?: GlofoxAgreementTemplate[] }>(
      'GET',
      'TermsConditions/view',
    )
    return response.data ?? []
  }

  // ─── Appointments (Phase 9) ───────────────────────────────

  /**
   * Get appointments by querying events with timeslot filter.
   * Appointments are retrieved via GET /2.0/events?filter=timeslot&model=appointments
   */
  async getAppointments(options?: {
    modifiedSince?: string
    start?: number
    end?: number
  }): Promise<GlofoxAppointment[]> {
    const params: Record<string, string | number | boolean | undefined> = {
      filter: 'timeslot',
      model: 'appointments',
    }
    if (options?.modifiedSince) params.utc_modified_start_date = options.modifiedSince
    if (options?.start !== undefined) params.start = options.start
    if (options?.end !== undefined) params.end = options.end
    return this.fetchAll<GlofoxAppointment>('2.0/events', params)
  }

  /**
   * Retrieve all available appointments for a branch.
   * GET 2.1/branches/{branchId}/appointments-availability
   */
  async getAppointmentAvailability(
    branchId?: string,
    start?: number,
    end?: number,
  ): Promise<GlofoxAppointmentAvailabilityResponse> {
    const branch = branchId ?? this.branchId
    return this.request<GlofoxAppointmentAvailabilityResponse>(
      'GET',
      `2.1/branches/${branch}/appointments-availability`,
      { params: { start, end } },
    )
  }

  // ─── Invoices (Phase 10) ──────────────────────────────────

  async getInvoices(branchId?: string): Promise<GlofoxInvoice[]> {
    const branch = branchId ?? this.branchId
    return this.fetchAll<GlofoxInvoice>(`2.2/branches/${branch}/invoices`)
  }

  // ─── Access Records (Phase 10) ────────────────────────────

  /**
   * Create an access/check-in event.
   * POST 2.0/access
   */
  async createAccessRecord(data: GlofoxAccessRecordRequest): Promise<{ status?: string }> {
    return this.request<{ status?: string }>(
      'POST',
      '2.0/access',
      { body: data },
    )
  }

  // ─── Analytics (Phase 10) ─────────────────────────────────

  async getMemberAnalytics(
    branchId: string,
    start: string,
    end: string,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `2.0/analytics/members`,
      { params: { branch_id: branchId, start, end } },
    )
  }

  async getRevenueAnalytics(
    branchId: string,
    start: string,
    end: string,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `2.0/analytics/revenue`,
      { params: { branch_id: branchId, start, end } },
    )
  }

  async getBookingAnalytics(
    branchId: string,
    start: string,
    end: string,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `2.0/analytics/bookings`,
      { params: { branch_id: branchId, start, end } },
    )
  }
}

// ─── Singleton ─────────────────────────────────────────────────

let _client: GlofoxClient | null = null

export function getGlofoxClient(): GlofoxClient {
  if (!_client) {
    _client = new GlofoxClient()
  }
  return _client
}

// Re-export helpers for use in transformers
export { unixToISO, isoToUnix }
