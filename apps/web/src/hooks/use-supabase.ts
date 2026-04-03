'use client'

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Member,
  UserProfile,
  ClassInstance,
  Booking,
  MembershipPlan,
} from '@meridian/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const DEFAULT_POLL_INTERVAL = 60_000 // 60 seconds

// ---------------------------------------------------------------------------
// useSupabase — memoised browser client
// ---------------------------------------------------------------------------

export function useSupabase(): SupabaseClient {
  return useMemo(() => createBrowserClient(), [])
}

// ---------------------------------------------------------------------------
// useQuery — generic table fetching hook
// ---------------------------------------------------------------------------

export interface UseQueryFilter {
  column: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is'
  value: unknown
}

export interface UseQueryOptions {
  select?: string
  filters?: UseQueryFilter[]
  orderBy?: { column: string; ascending?: boolean }
  limit?: number
  /** Enable polling-based refresh. Pass `true` for 60 s, or a number in ms. */
  poll?: boolean | number
  /** When false the query will not execute (useful for conditional fetching). */
  enabled?: boolean
}

export interface UseQueryResult<T> {
  data: T[] | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useQuery<T = Record<string, unknown>>(
  table: string,
  options: UseQueryOptions = {},
): UseQueryResult<T> {
  const supabase = useSupabase()
  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Stable serialisation of options so the effect re-runs on real changes only.
  const optionsKey = JSON.stringify(options)

  const fetch = useCallback(async () => {
    const {
      select = '*',
      filters = [],
      orderBy,
      limit,
      enabled = true,
    } = options

    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      let query = supabase.from(table).select(select)

      for (const f of filters) {
        // Supabase PostgREST filter methods share a uniform signature.
        query = (query as any)[f.operator](f.column, f.value)
      }

      if (orderBy) {
        query = query.order(orderBy.column, {
          ascending: orderBy.ascending ?? true,
        })
      }

      if (limit) {
        query = query.limit(limit)
      }

      const { data: rows, error: queryError } = await query

      if (queryError) throw queryError

      setData(rows as T[])
    } catch (err) {
      if (err instanceof Error) {
        setError(err)
      } else if (err && typeof err === 'object' && 'message' in err) {
        setError(new Error((err as { message: string }).message))
      } else {
        setError(new Error(JSON.stringify(err)))
      }
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, table, optionsKey])

  // Initial fetch + re-fetch when deps change.
  useEffect(() => {
    fetch()
  }, [fetch])

  // Optional polling.
  useEffect(() => {
    const { poll, enabled = true } = options
    if (!poll || !enabled) return

    const interval = typeof poll === 'number' ? poll : DEFAULT_POLL_INTERVAL
    const timer = setInterval(fetch, interval)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetch, optionsKey])

  return { data, loading, error, refetch: fetch }
}

// ---------------------------------------------------------------------------
// Domain hooks
// ---------------------------------------------------------------------------

/** Member with joined profile data. */
export interface MemberWithProfile extends Member {
  profiles: UserProfile | null
}

/**
 * Fetch all members for the current studio, joined with their profile.
 */
export function useMembers(): UseQueryResult<MemberWithProfile> {
  return useQuery<MemberWithProfile>('members', {
    select: '*, profiles:profile_id ( * )',
    filters: [
      { column: 'studio_id', operator: 'eq', value: DEFAULT_STUDIO_ID },
    ],
    orderBy: { column: 'created_at', ascending: false },
    poll: true,
  })
}

/**
 * Fetch class instances, optionally filtered by a date range.
 *
 * @param dateRange - Optional `{ from, to }` with ISO date strings (YYYY-MM-DD).
 */
export function useClasses(
  dateRange?: { from: string; to: string },
): UseQueryResult<ClassInstance & { class_types: Record<string, unknown> | null; trainer: { full_name: string } | null }> {
  const filters: UseQueryFilter[] = [
    { column: 'studio_id', operator: 'eq', value: DEFAULT_STUDIO_ID },
  ]

  if (dateRange) {
    filters.push(
      { column: 'starts_at', operator: 'gte', value: dateRange.from },
      { column: 'starts_at', operator: 'lte', value: dateRange.to },
    )
  }

  return useQuery<ClassInstance & { class_types: Record<string, unknown> | null; trainer: { full_name: string } | null }>('classes', {
    select: '*, class_types:class_type_id ( * ), trainer:profiles!classes_trainer_id_fkey ( full_name )',
    filters,
    orderBy: { column: 'starts_at', ascending: true },
    poll: true,
  })
}

/**
 * Fetch bookings — optionally scoped to a single class.
 */
export function useBookings(classId?: string): UseQueryResult<Booking> {
  const filters: UseQueryFilter[] = [
    { column: 'studio_id', operator: 'eq', value: DEFAULT_STUDIO_ID },
  ]

  if (classId) {
    filters.push({ column: 'class_id', operator: 'eq', value: classId })
  }

  return useQuery<Booking>('bookings', {
    select: '*',
    filters,
    orderBy: { column: 'created_at', ascending: false },
    poll: true,
    enabled: classId !== undefined ? !!classId : true,
  })
}

/**
 * Fetch active membership plans for the current studio.
 */
export function useMembershipPlans(): UseQueryResult<MembershipPlan> {
  return useQuery<MembershipPlan>('membership_plans', {
    select: '*',
    filters: [
      { column: 'studio_id', operator: 'eq', value: DEFAULT_STUDIO_ID },
      { column: 'is_active', operator: 'eq', value: true },
    ],
    orderBy: { column: 'sort_order', ascending: true },
  })
}

/**
 * Studio settings (single row expected).
 */
export interface StudioSettings {
  id: string
  studio_id: string
  late_cancel_window_minutes: number
  strike_window_days: number
  strike_penalties: Record<string, unknown> | null
  strike_system_enabled: boolean
  unlimited_members_warning_only: boolean
  credit_grace_period_days: number
  waitlist_claim_window_minutes: number
  inventory_hold_minutes: number
  checkout_lock_minutes: number
  pilot_discount_rate: number | null
  member_discount_rate: number | null
  private_event_base_rate: number | null
  waiver_text: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export function useStudioSettings(): UseQueryResult<StudioSettings> {
  return useQuery<StudioSettings>('studio_settings', {
    select: '*',
    filters: [
      { column: 'studio_id', operator: 'eq', value: DEFAULT_STUDIO_ID },
    ],
    limit: 1,
  })
}

/**
 * Recent activity log entries.
 *
 * @param limit - Number of entries to fetch (default 50).
 */
export interface ActivityLogEntry {
  id: string
  studio_id: string
  type: string
  actor_id: string | null
  subject_id: string | null
  subject_type: string
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
  actor_profile?: { full_name: string } | null
}

export function useActivityLog(limit = 50): UseQueryResult<ActivityLogEntry> {
  return useQuery<ActivityLogEntry>('activity_log', {
    select: '*, actor_profile:profiles!activity_log_actor_id_fkey ( full_name )',
    filters: [
      { column: 'studio_id', operator: 'eq', value: DEFAULT_STUDIO_ID },
    ],
    orderBy: { column: 'created_at', ascending: false },
    limit,
    poll: true,
  })
}
