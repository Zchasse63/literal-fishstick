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
   * POST 2.0/members
   */
  async registerMember(data: GlofoxRegisterMemberRequest): Promise<GlofoxRegisterMemberResponse> {
    return this.request<GlofoxRegisterMemberResponse>('POST', '2.0/members', { body: data })
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
   * GET 2.0/members with email filter
   */
  async searchMembersByEmail(email: string): Promise<GlofoxSearchMembersResponse> {
    return this.request<GlofoxSearchMembersResponse>('GET', '2.0/members', {
      params: { email },
    })
  }

  /**
   * Request a password reset for a member.
   * POST 2.0/members/{userId}/password-reset
   */
  async requestPasswordReset(userId: string): Promise<{ status?: string; message?: string }> {
    return this.request<{ status?: string; message?: string }>(
      'POST',
      `2.0/members/${userId}/password-reset`,
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

  async getPrograms(): Promise<GlofoxProgram[]> {
    return this.fetchAll<GlofoxProgram>('2.0/programs')
  }

  // ─── Facilities ───────────────────────────────────────────

  async getFacilities(): Promise<GlofoxFacility[]> {
    return this.fetchAll<GlofoxFacility>('2.0/facilities')
  }

  // ─── Branches ─────────────────────────────────────────────

  async getBranches(): Promise<GlofoxBranch[]> {
    return this.fetchAll<GlofoxBranch>('2.0/branches')
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

  async getCourses(): Promise<GlofoxCourse[]> {
    return this.fetchAll<GlofoxCourse>('2.0/courses')
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
    const response = await this.request<{ data: GlofoxTransaction[] }>('POST', 'Analytics/report', {
      body: {
        branch_id: branchId,
        namespace,
        start: startDate,
        end: endDate,
        secondStart: isoToUnix(startDate),
        secondEnd: isoToUnix(endDate),
      },
    })
    return response.data ?? []
  }

  // ─── Memberships ───────────────────────────────────────────

  async getMemberships(): Promise<GlofoxMembership[]> {
    return this.fetchAll<GlofoxMembership>('2.0/memberships')
  }

  /**
   * Purchase a membership for a member in Glofox.
   * POST 2.0/memberships/purchase
   */
  async purchaseMembership(
    data: GlofoxPurchaseMembershipRequest,
  ): Promise<GlofoxPurchaseMembershipResponse> {
    return this.request<GlofoxPurchaseMembershipResponse>(
      'POST',
      '2.0/memberships/purchase',
      { body: data },
    )
  }

  /**
   * Cancel a member's membership in Glofox.
   * POST 2.0/memberships/cancel
   */
  async cancelMembership(
    data: GlofoxCancelMembershipRequest,
  ): Promise<GlofoxCancelMembershipResponse> {
    return this.request<GlofoxCancelMembershipResponse>(
      'POST',
      '2.0/memberships/cancel',
      { body: data },
    )
  }

  /**
   * Get payment methods for a member.
   * GET 2.0/members/{userId}/payment-methods
   */
  async getPaymentMethods(userId: string): Promise<GlofoxPaymentMethod[]> {
    const response = await this.request<{ data?: GlofoxPaymentMethod[] }>(
      'GET',
      `2.0/members/${userId}/payment-methods`,
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

  async getInteractions(userId: string): Promise<GlofoxInteraction[]> {
    const response = await this.request<{ data?: GlofoxInteraction[] }>(
      'GET',
      `2.0/members/${userId}/interactions`,
    )
    return response.data ?? []
  }

  async createInteraction(data: GlofoxCreateInteractionRequest): Promise<GlofoxInteraction> {
    return this.request<GlofoxInteraction>(
      'POST',
      `2.0/members/${data.user_id}/interactions`,
      { body: { type: data.type, notes: data.notes } },
    )
  }

  async getContactSources(): Promise<GlofoxContactSource[]> {
    const response = await this.request<{ data?: GlofoxContactSource[] }>(
      'GET',
      '2.0/contact-sources',
    )
    return response.data ?? []
  }

  async getMarketingSources(): Promise<GlofoxMarketingSource[]> {
    const response = await this.request<{ data?: GlofoxMarketingSource[] }>(
      'GET',
      '2.0/marketing-sources',
    )
    return response.data ?? []
  }

  // ─── Agreements (Phase 8) ─────────────────────────────────

  async sendAgreement(data: GlofoxSendAgreementRequest): Promise<{ status?: string }> {
    return this.request<{ status?: string }>(
      'POST',
      `2.2/branches/${this.branchId}/users/${data.user_id}/agreements`,
      { body: { document_id: data.document_id } },
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

  async getAppointments(options?: {
    modifiedSince?: string
    start?: number
    end?: number
  }): Promise<GlofoxAppointment[]> {
    const params: Record<string, string | number | boolean | undefined> = {}
    if (options?.modifiedSince) params.utc_modified_start_date = options.modifiedSince
    if (options?.start !== undefined) params.start = options.start
    if (options?.end !== undefined) params.end = options.end
    return this.fetchAll<GlofoxAppointment>('2.0/appointments', params)
  }

  async getAppointmentAvailability(
    trainerId: string,
    start: number,
    end: number,
  ): Promise<GlofoxAppointmentAvailabilityResponse> {
    return this.request<GlofoxAppointmentAvailabilityResponse>(
      'GET',
      '2.0/appointments/availability',
      { params: { trainer_id: trainerId, start, end } },
    )
  }

  // ─── Invoices (Phase 10) ──────────────────────────────────

  async getInvoices(branchId?: string): Promise<GlofoxInvoice[]> {
    const branch = branchId ?? this.branchId
    return this.fetchAll<GlofoxInvoice>(`2.2/branches/${branch}/invoices`)
  }

  // ─── Access Records (Phase 10) ────────────────────────────

  async createAccessRecord(data: GlofoxAccessRecordRequest): Promise<{ status?: string }> {
    return this.request<{ status?: string }>(
      'POST',
      '2.0/access-records',
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
