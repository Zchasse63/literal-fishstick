'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID
const POLL_INTERVAL = 60_000 // 60 seconds

// ─── Types ──────────────────────────────────────────────────
export interface ClassData {
  id: string
  title: string
  starts_at: string
  ends_at: string
  capacity: number
  booked_count: number
  checked_in_count: number
  status: string
  class_type_name: string | null
  attendees: { full_name: string; status: string }[]
}

export interface ActivityItem {
  id: string
  type: string
  description: string
  created_at: string
  metadata: Record<string, unknown> | null
}

export interface AIInsight {
  icon: 'trending' | 'alert' | 'briefcase'
  text: string
  action: string
  color: string
}

export interface CommandCenterData {
  bookingsToday: number
  currentSessionBooked: number
  currentSessionCapacity: number
  currentSessionLive: boolean
  revenueToday: number
  walkInsToday: number
  noShowsToday: number
  classes: ClassData[]
  activities: ActivityItem[]
  aiInsights: AIInsight[]
  isLoading: boolean
  error: string | null
}

// ─── Fallback mock data ─────────────────────────────────────
const MOCK_INSIGHTS: AIInsight[] = [
  {
    icon: 'trending',
    text: 'Wednesday 7pm Guided class hit 10/12 capacity 3 weeks straight — consider adding a Thursday session',
    action: 'Add Class',
    color: 'text-indigo-600',
  },
  {
    icon: 'alert',
    text: "9 members haven't booked in 14+ days — churn risk campaign ready",
    action: 'Send Campaign',
    color: 'text-orange-600',
  },
  {
    icon: 'briefcase',
    text: 'Tampa Tech corporate account is 3 sessions from their monthly cap',
    action: 'Contact Account',
    color: 'text-amber-600',
  },
]

// ─── Helpers ────────────────────────────────────────────────

/** Get the current Eastern Time UTC offset string (e.g. "-04:00" for EDT, "-05:00" for EST). */
function getEasternOffset(): string {
  // Format a timestamp in Eastern time and extract the GMT offset
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'longOffset',
  })
  const parts = fmt.formatToParts(new Date())
  const tzPart = parts.find((p) => p.type === 'timeZoneName')
  // tzPart.value is like "GMT-04:00" or "GMT-05:00"
  const match = tzPart?.value?.match(/GMT([+-]\d{2}:\d{2})/)
  return match ? match[1] : '-05:00' // fallback to EST
}

function todayDateString(): string {
  // Get today in Eastern time as YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function formatEasternTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()

  // Get date strings in Eastern time for comparison
  const dateET = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const todayET = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // Calculate yesterday in Eastern time
  const yesterdayDate = new Date(now.getTime() - 86_400_000)
  const yesterdayET = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const timeStr = date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (dateET === todayET) {
    return `Today ${timeStr}`
  } else if (dateET === yesterdayET) {
    return `Yesterday ${timeStr}`
  } else {
    const monthDay = date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
    })
    return `${monthDay} ${timeStr}`
  }
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

// ─── Hook ───────────────────────────────────────────────────
export function useCommandCenterData(): CommandCenterData {
  const [data, setData] = useState<Omit<CommandCenterData, 'isLoading' | 'error'>>({
    bookingsToday: 0,
    currentSessionBooked: 0,
    currentSessionCapacity: 12,
    currentSessionLive: false,
    revenueToday: 0,
    walkInsToday: 0,
    noShowsToday: 0,
    classes: [],
    activities: [],
    aiInsights: MOCK_INSIGHTS,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createBrowserClient())

  const fetchData = useCallback(async () => {
    const supabase = supabaseRef.current
    const today = todayDateString()
    const offset = getEasternOffset() // Dynamic: "-04:00" EDT or "-05:00" EST
    const todayStart = `${today}T00:00:00${offset}`
    const todayEnd = `${today}T23:59:59${offset}`
    const now = new Date().toISOString()

    try {
      // Run all queries in parallel
      const [
        classesResult,
        bookingsTodayResult,
        revenueTodayResult,
        walkInsResult,
        noShowsResult,
        activityLogResult,
        aiBriefingResult,
      ] = await Promise.allSettled([
        // 1. Today's classes with class type name
        supabase
          .from('classes')
          .select('id, title, starts_at, ends_at, capacity, booked_count, checked_in_count, status, class_types(name)')
          .eq('studio_id', STUDIO_ID)
          .gte('starts_at', todayStart)
          .lte('starts_at', todayEnd)
          .order('starts_at', { ascending: true }),

        // 2. Bookings today count
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .in('status', ['booked', 'confirmed', 'checked_in'])
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),

        // 3. Revenue today — sum positive completed transactions only
        //    (excludes refunds which have negative amounts)
        supabase
          .from('transactions')
          .select('amount')
          .eq('studio_id', STUDIO_ID)
          .eq('status', 'completed')
          .gt('amount', 0)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),

        // 4. Walk-ins today
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .eq('is_walk_in', true)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),

        // 5. No-shows today
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .eq('status', 'no_show')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),

        // 6. Activity log (try activity_log first, fall back to recent bookings)
        supabase
          .from('activity_log')
          .select('id, type, description, metadata, created_at')
          .eq('studio_id', STUDIO_ID)
          .order('created_at', { ascending: false })
          .limit(10),

        // 7. AI Briefing from API
        fetch('/api/ai/briefing', { signal: AbortSignal.timeout(5000) })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('API unavailable'))))
          .catch(() => null),
      ])

      // --- Process classes ---
      let classes: ClassData[] = []
      if (classesResult.status === 'fulfilled' && classesResult.value.data) {
        const classIds = classesResult.value.data.map((c: Record<string, unknown>) => c.id as string)

        // Fetch attendees for each class (up to 5 per class)
        let attendeesByClass: Record<string, { full_name: string; status: string }[]> = {}
        if (classIds.length > 0) {
          const { data: bookingsData } = await supabase
            .from('bookings')
            .select('class_id, status, members(profiles(full_name))')
            .in('class_id', classIds)
            .in('status', ['booked', 'confirmed', 'checked_in'])

          if (bookingsData) {
            for (const b of bookingsData) {
              const classId = b.class_id as string
              if (!attendeesByClass[classId]) attendeesByClass[classId] = []
              const member = b.members as unknown as Record<string, unknown> | null
              const profile = member?.profiles as unknown as Record<string, unknown> | null
              const fullName = (profile?.full_name as string) || 'Unknown'
              attendeesByClass[classId].push({
                full_name: fullName,
                status: b.status as string,
              })
            }
          }
        }

        classes = classesResult.value.data.map((c: Record<string, unknown>) => {
          const classType = c.class_types as Record<string, unknown> | null
          const allAttendees = attendeesByClass[c.id as string] || []
          return {
            id: c.id as string,
            title: c.title as string,
            starts_at: c.starts_at as string,
            ends_at: c.ends_at as string,
            capacity: c.capacity as number,
            booked_count: c.booked_count as number,
            checked_in_count: c.checked_in_count as number,
            status: c.status as string,
            class_type_name: (classType?.name as string) || null,
            attendees: allAttendees.slice(0, 5),
          }
        })
      }

      // --- Process bookings today ---
      // Use the classes data to count bookings more accurately
      // Sum booked_count from all today's classes
      let bookingsToday = 0
      if (classesResult.status === 'fulfilled' && classesResult.value.data) {
        bookingsToday = classesResult.value.data.reduce(
          (sum: number, c: Record<string, unknown>) => sum + ((c.booked_count as number) || 0),
          0
        )
      }
      // Fall back to the count query if no classes data
      if (bookingsToday === 0 && bookingsTodayResult.status === 'fulfilled') {
        bookingsToday = bookingsTodayResult.value.count || 0
      }

      // --- Current session ---
      let currentSessionBooked = 0
      let currentSessionCapacity = 12
      let currentSessionLive = false
      const liveClass = classes.find((c) => {
        const start = new Date(c.starts_at)
        const end = new Date(c.ends_at)
        const nowDate = new Date(now)
        return nowDate >= start && nowDate <= end
      })
      if (liveClass) {
        currentSessionBooked = liveClass.checked_in_count || liveClass.booked_count
        currentSessionCapacity = liveClass.capacity
        currentSessionLive = true
      }

      // --- Revenue today ---
      let revenueToday = 0
      if (revenueTodayResult.status === 'fulfilled' && revenueTodayResult.value.data) {
        revenueToday = revenueTodayResult.value.data.reduce(
          (sum: number, t: Record<string, unknown>) => sum + ((t.amount as number) || 0),
          0
        )
      }

      // --- Walk-ins ---
      let walkInsToday = 0
      if (walkInsResult.status === 'fulfilled') {
        walkInsToday = walkInsResult.value.count || 0
      }

      // --- No-shows ---
      let noShowsToday = 0
      if (noShowsResult.status === 'fulfilled') {
        noShowsToday = noShowsResult.value.count || 0
      }

      // --- Activity feed ---
      let activities: ActivityItem[] = []
      if (activityLogResult.status === 'fulfilled' && activityLogResult.value.data && activityLogResult.value.data.length > 0) {
        activities = activityLogResult.value.data.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          type: a.type as string,
          description: a.description as string,
          created_at: a.created_at as string,
          metadata: a.metadata as Record<string, unknown> | null,
        }))
      } else {
        // Fall back: build activity items from recent bookings and transactions
        const [recentBookings, recentTransactions] = await Promise.all([
          supabase
            .from('bookings')
            .select('id, member_id, status, is_walk_in, checked_in_at, created_at, members(profiles(full_name))')
            .eq('studio_id', STUDIO_ID)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('transactions')
            .select('id, type, amount, description, created_at, members(profiles(full_name))')
            .eq('studio_id', STUDIO_ID)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        const bookingActivities: ActivityItem[] = (recentBookings.data || []).map((b: Record<string, unknown>) => {
          const member = b.members as Record<string, unknown> | null
          const profile = member?.profiles as Record<string, unknown> | null
          const name = (profile?.full_name as string) || 'A member'
          const memberId = member ? (b.member_id as string || '') : ''
          const status = b.status as string
          let type = 'booking'
          let description = `${name} booked a class`
          if (status === 'checked_in') {
            type = 'check_in'
            description = `${name} checked in`
          } else if (status === 'cancelled' || status === 'late_cancelled') {
            type = 'cancellation'
            description = `${name} cancelled booking`
          }
          return {
            id: b.id as string,
            type,
            description,
            created_at: b.created_at as string,
            metadata: memberId ? { member_id: memberId } : null,
          }
        })

        const txActivities: ActivityItem[] = (recentTransactions.data || []).map((t: Record<string, unknown>) => {
          const member = t.members as Record<string, unknown> | null
          const profile = member?.profiles as Record<string, unknown> | null
          const name = (profile?.full_name as string) || ''
          const amount = formatCurrency((t.amount as number) || 0)
          const txDesc = (t.description as string) || ''

          // Build description: show member name if available, otherwise just show the transaction detail
          let description: string
          if (name) {
            description = `Payment received: ${amount} — ${name}${txDesc ? ` — ${txDesc}` : ''}`
          } else if (txDesc) {
            description = `Payment received: ${amount} — ${txDesc}`
          } else {
            description = `Payment received: ${amount}`
          }

          return {
            id: t.id as string,
            type: 'payment',
            description,
            created_at: t.created_at as string,
            metadata: null,
          }
        })

        activities = [...bookingActivities, ...txActivities]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
      }

      // --- AI Briefing ---
      let aiInsights = MOCK_INSIGHTS
      if (aiBriefingResult.status === 'fulfilled' && aiBriefingResult.value?.insights) {
        aiInsights = aiBriefingResult.value.insights
      }

      setData({
        bookingsToday,
        currentSessionBooked,
        currentSessionCapacity,
        currentSessionLive,
        revenueToday,
        walkInsToday,
        noShowsToday,
        classes,
        activities,
        aiInsights,
      })
      setError(null)
    } catch (err) {
      console.error('Command Center fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  return { ...data, isLoading, error }
}

export { formatEasternTime, formatCurrency }
