'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  Briefcase,
  CheckCircle2,
  UserPlus,
  DollarSign,
  ChevronRight,
  XCircle,
  Calendar,
  Users,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/auth-context'
import { createBrowserClient } from '@/lib/supabase/client'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import {
  useCommandCenterData,
  formatEasternTime,
  formatCurrency,
  type AIInsight,
  type ClassData,
  type ActivityItem,
} from '@/hooks/use-command-center-data'
import { useKpiData } from '@/hooks/use-kpi-data'
import { HeroMetricCard } from './_components/HeroMetricCard'
import { WeeklyReviewBar } from './_components/WeeklyReviewBar'
import { FocusQueue } from './_components/FocusQueue'
import { AskMeridian } from './_components/AskMeridian'
import { fadeInUp } from '@/lib/motion'

// ─── Icon map for AI insights ───────────────────────────────
const INSIGHT_ICON_MAP = {
  trending: TrendingUp,
  alert: AlertCircle,
  briefcase: Briefcase,
} as const

// ─── Activity icon/color map ────────────────────────────────
function getActivityIcon(type: string) {
  switch (type) {
    case 'check_in':
      return { icon: CheckCircle2, color: 'text-emerald-500' }
    case 'booking':
      return { icon: UserPlus, color: 'text-indigo-500' }
    case 'payment':
      return { icon: DollarSign, color: 'text-emerald-500' }
    case 'cancellation':
      return { icon: XCircle, color: 'text-orange-500' }
    default:
      return { icon: Calendar, color: 'text-gray-500 dark:text-gray-400' }
  }
}

// ─── Loading Skeleton ───────────────────────────────────────
function CommandCenterSkeleton() {
  return (
    <div data-testid="command-page-root" className="space-y-5">
      {/* AI Briefing skeleton */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-5 h-5 mt-0.5 flex-shrink-0 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-20 mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hero metrics skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-9 w-24 mb-2" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Weekly review skeleton */}
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-4" />
        </div>
      </div>

      {/* Class Status + Timeline skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-2 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
          <Skeleton className="h-5 w-36 mb-4" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-2.5 h-2.5 rounded-full mt-1.5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Feed skeleton */}
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 py-2 px-2">
              <Skeleton className="w-5 h-5 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── AI Briefing Card ────────────────────────────────────────
const AI_ACTION_ROUTES: Record<string, string> = {
  'Add Class': '/schedule',
  'Send Campaign': '/marketing/campaigns/new',
  'Send Reminders': '/marketing',
  'Contact Account': '/corporate',
  'View Members': '/members',
  'View Analytics': '/analytics',
  'View Revenue': '/revenue',
  'View Schedule': '/schedule',
}

function AIBriefingCard({ insights, greeting, firstName }: { insights: AIInsight[]; greeting: string; firstName: string }) {
  const router = useRouter()

  function handleActionClick(action: string) {
    // Match known action routes, or fall back to a best-guess based on keywords
    const route = AI_ACTION_ROUTES[action]
    if (route) {
      router.push(route)
      return
    }
    // Keyword-based fallback
    const lowerAction = action.toLowerCase()
    if (lowerAction.includes('class') || lowerAction.includes('schedule')) {
      router.push('/schedule')
    } else if (lowerAction.includes('campaign') || lowerAction.includes('marketing')) {
      router.push('/marketing')
    } else if (lowerAction.includes('contact') || lowerAction.includes('corporate') || lowerAction.includes('account')) {
      router.push('/corporate')
    } else if (lowerAction.includes('member')) {
      router.push('/members')
    } else if (lowerAction.includes('revenue') || lowerAction.includes('payment')) {
      router.push('/revenue')
    }
  }

  return (
    <div className="ai-border rounded-2xl p-6">
      <div className="bg-gradient-to-br from-indigo-500/[0.04] to-violet-500/[0.04] -m-6 p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{greeting}, {firstName}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.map((insight, i) => {
            const Icon = INSIGHT_ICON_MAP[insight.icon] || TrendingUp
            return (
              <div key={i} className="flex gap-3">
                <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', insight.color)} />
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{insight.text}</p>
                  <button
                    onClick={() => handleActionClick(insight.action)}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 mt-1 flex items-center gap-1"
                  >
                    {insight.action}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}



// ─── Class Status Board ──────────────────────────────────────
function ClassStatusBoard({ classes }: { classes: ClassData[] }) {
  const now = new Date()

  const classItems = classes.map((c) => {
    const start = new Date(c.starts_at)
    const end = new Date(c.ends_at)
    const isLive = now >= start && now <= end
    const isGuided = c.title.toLowerCase().includes('guided') || c.class_type_name?.toLowerCase().includes('guided')

    return {
      time: formatEasternTime(c.starts_at),
      name: c.title,
      status: isLive ? ('live' as const) : ('upcoming' as const),
      booked: c.booked_count || c.attendees.length,
      capacity: c.capacity,
      isGuided,
    }
  })

  // Show at least a message if no classes
  if (classItems.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">Class Status Board</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">No classes scheduled for today.</p>
      </div>
    )
  }

  const hasLiveClass = classItems.some((c) => c.status === 'live')

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">Class Status Board</h3>
          {hasLiveClass && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <Link href="/schedule" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          View All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {classItems.map((cls, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-16 tabular-nums">{cls.time}</span>
            <span className={cn(
              'text-sm font-semibold flex-1',
              cls.isGuided ? 'text-violet-600' : 'text-gray-900 dark:text-gray-100'
            )}>
              {cls.name}
            </span>
            {cls.status === 'live' && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
            <div className="flex items-center gap-2 w-24">
              <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    cls.booked / cls.capacity > 0.9 ? 'bg-indigo-600' :
                    cls.booked / cls.capacity > 0.6 ? 'bg-indigo-500' : 'bg-indigo-400'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${(cls.booked / cls.capacity) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.1 }}
                />
              </div>
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums w-8 text-right">
                {cls.booked}/{cls.capacity}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Facility availability removed — no hardware integration for live equipment status */}
    </div>
  )
}

// ─── Today's Timeline ────────────────────────────────────────
function TodaysTimeline({ classes }: { classes: ClassData[] }) {
  const now = new Date()
  const currentTimeStr = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const entries = classes.map((c) => {
    const start = new Date(c.starts_at)
    const end = new Date(c.ends_at)
    const isLive = now >= start && now <= end
    const isGuided = c.title.toLowerCase().includes('guided') || c.class_type_name?.toLowerCase().includes('guided')

    // Build display names from attendees
    const displayNames: string[] = []
    const totalBooked = c.booked_count || c.attendees.length
    const shownAttendees = c.attendees.slice(0, 3)
    for (const a of shownAttendees) {
      // Format as "First L."
      const parts = a.full_name.split(' ')
      if (parts.length >= 2) {
        displayNames.push(`${parts[0]} ${parts[parts.length - 1][0]}.`)
      } else {
        displayNames.push(a.full_name)
      }
    }
    const remaining = totalBooked - shownAttendees.length
    if (remaining > 0) {
      displayNames.push(`+${remaining} others`)
    }

    return {
      time: formatEasternTime(c.starts_at),
      label: isLive
        ? `${c.title} — In Progress`
        : c.title,
      status: isLive ? 'live' : 'upcoming',
      isGuided,
      names: displayNames.length > 0 ? displayNames : ['No bookings yet'],
    }
  })

  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">Today&apos;s Timeline</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">No classes scheduled for today.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">Today&apos;s Timeline</h3>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums">{currentTimeStr}</span>
      </div>

      <div className="space-y-4">
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-2.5 h-2.5 rounded-full mt-1.5',
                entry.status === 'live' ? 'bg-indigo-600' : 'bg-gray-300'
              )} />
              {i < entries.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{entry.time}</span>
                {entry.status === 'live' && (
                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase rounded-full">Live</span>
                )}
              </div>
              <p className={cn(
                'text-sm font-semibold mt-0.5',
                entry.isGuided ? 'text-violet-600' : 'text-gray-700 dark:text-gray-300'
              )}>
                {entry.label}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {entry.names.map((name, j) => (
                  <span key={j} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-full">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Activity Feed ───────────────────────────────────────────
function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  const router = useRouter()

  function handleActivityClick(activity: ActivityItem) {
    switch (activity.type) {
      case 'payment':
        router.push('/revenue')
        break
      case 'check_in': {
        const memberId = activity.metadata?.member_id as string | undefined
        if (memberId) {
          router.push(`/members/${memberId}`)
        } else {
          router.push('/members')
        }
        break
      }
      case 'booking':
        router.push('/schedule')
        break
      case 'cancellation':
        router.push('/schedule')
        break
      default:
        break
    }
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">Activity Feed</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">No recent activity.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">Activity Feed</h3>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => {
          const { icon: Icon, color } = getActivityIcon(activity.type)
          const time = formatEasternTime(activity.created_at)
          // Split description into main text and detail
          const parts = activity.description.split(' — ')
          const mainText = parts[0]
          const detail = parts.slice(1).join(' — ')

          return (
            <div
              key={activity.id}
              onClick={() => handleActivityClick(activity)}
              className="flex items-start gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors cursor-pointer"
            >
              <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', color)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{mainText}</p>
                {detail && <p className="text-xs text-gray-500 dark:text-gray-400">{detail}</p>}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">{time}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Engagement Breakdown ───────────────────────────────────
interface EngagementCounts {
  subscriber: number
  active: number
  engaged: number
  cooling: number
  at_risk: number
  lapsed_with_credits: number
  lapsed: number
  churned: number
  new_unused: number
  lead_only: number
}

const ENGAGEMENT_CONFIG: { key: keyof EngagementCounts; label: string; dotColor: string; textColor: string }[] = [
  { key: 'subscriber', label: 'Subscriber', dotColor: 'bg-purple-500', textColor: 'text-purple-700 dark:text-purple-400' },
  { key: 'active', label: 'Active', dotColor: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-400' },
  { key: 'engaged', label: 'Engaged', dotColor: 'bg-indigo-500', textColor: 'text-indigo-700 dark:text-indigo-400' },
  { key: 'cooling', label: 'Cooling', dotColor: 'bg-yellow-500', textColor: 'text-yellow-700 dark:text-yellow-400' },
  { key: 'at_risk', label: 'At Risk', dotColor: 'bg-orange-500', textColor: 'text-orange-700 dark:text-orange-400' },
  { key: 'lapsed_with_credits', label: 'Lapsed (Credits)', dotColor: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400' },
  { key: 'lapsed', label: 'Lapsed', dotColor: 'bg-gray-500', textColor: 'text-gray-600 dark:text-gray-400' },
  { key: 'churned', label: 'Churned', dotColor: 'bg-gray-800', textColor: 'text-gray-700 dark:text-gray-500' },
  { key: 'new_unused', label: 'New (Unused)', dotColor: 'bg-sky-500', textColor: 'text-sky-700 dark:text-sky-400' },
  { key: 'lead_only', label: 'Lead Only', dotColor: 'bg-slate-400', textColor: 'text-slate-500 dark:text-slate-400' },
]

function EngagementBreakdown() {
  const [counts, setCounts] = useState<EngagementCounts | null>(null)
  const supabase = useRef(createBrowserClient()).current

  useEffect(() => {
    async function fetchCounts() {
      // Query each engagement status count individually to avoid the 1000-row default limit
      const statuses: (keyof EngagementCounts)[] = [
        'subscriber', 'active', 'engaged', 'cooling', 'at_risk',
        'lapsed_with_credits', 'lapsed', 'churned', 'new_unused', 'lead_only',
      ]

      const results = await Promise.all(
        statuses.map((status) =>
          supabase
            .from('member_360')
            // member_360 is a view — the primary key column is profile_id,
            // there is no `id` column. Use profile_id for the count probe.
            .select('profile_id', { count: 'exact', head: true })
            .eq('engagement_status', status)
        )
      )

      const result: EngagementCounts = { subscriber: 0, active: 0, engaged: 0, cooling: 0, at_risk: 0, lapsed_with_credits: 0, lapsed: 0, churned: 0, new_unused: 0, lead_only: 0 }
      statuses.forEach((status, i) => {
        result[status] = results[i].count ?? 0
      })

      setCounts(result)
    }

    fetchCounts()
    const interval = setInterval(fetchCounts, 60_000)
    return () => clearInterval(interval)
  }, [supabase])

  if (!counts) return null

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Member Engagement</h3>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">{total} members</span>
      </div>
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden mb-3">
        {ENGAGEMENT_CONFIG.map(({ key, dotColor }) => {
          const pct = total > 0 ? (counts[key] / total) * 100 : 0
          return pct > 0 ? (
            <div key={key} className={cn('h-full', dotColor)} style={{ width: `${pct}%` }} />
          ) : null
        })}
      </div>
      {/* Labels */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {ENGAGEMENT_CONFIG.map(({ key, label, dotColor, textColor }) => (
          counts[key] > 0 ? (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn('h-2 w-2 rounded-full', dotColor)} />
              <span className={cn('text-xs font-semibold tabular-nums', textColor)}>{counts[key]}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            </div>
          ) : null
        ))}
      </div>
    </div>
  )
}

// ─── Command Center Page ─────────────────────────────────────
export default function CommandCenter() {
  const { profile } = useAuth()
  // Extract a real first name — avoid greeting with articles from business names like "The Sauna Guys"
  const rawFirst = profile?.full_name?.split(' ')[0] || ''
  const firstName = rawFirst && !['The', 'A', 'An'].includes(rawFirst) ? rawFirst : 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const {
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
    isLoading,
  } = useCommandCenterData()

  const kpiData = useKpiData()

  if (isLoading) {
    return <CommandCenterSkeleton />
  }

  return (
    <motion.div data-testid="command-page-root" {...fadeInUp} className="space-y-5">
      {/* AI Briefing */}
      <AIBriefingCard insights={aiInsights} greeting={greeting} firstName={firstName} />

      {/* Hero Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HeroMetricCard
          label="Revenue Today"
          value={kpiData.hero?.revenue.value ?? formatCurrency(revenueToday)}
          delta={kpiData.hero?.revenue.delta ?? 0}
          deltaLabel={kpiData.hero?.revenue.deltaLabel}
          icon={DollarSign}
          isLoading={kpiData.isLoading}
        />
        <HeroMetricCard
          label="Attendance Today"
          value={kpiData.hero?.attendance.value ?? String(bookingsToday)}
          delta={kpiData.hero?.attendance.delta ?? 0}
          deltaLabel={kpiData.hero?.attendance.deltaLabel}
          icon={Users}
          isLoading={kpiData.isLoading}
        />
        <HeroMetricCard
          label="Fill Rate"
          value={kpiData.hero?.fillRate.value ?? '0%'}
          delta={kpiData.hero?.fillRate.delta ?? 0}
          deltaLabel={kpiData.hero?.fillRate.deltaLabel}
          icon={BarChart3}
          isLoading={kpiData.isLoading}
        />
        <HeroMetricCard
          label="New Faces"
          value={kpiData.hero?.newFaces.value ?? '0'}
          delta={kpiData.hero?.newFaces.delta ?? 0}
          deltaLabel={kpiData.hero?.newFaces.deltaLabel}
          icon={UserPlus}
          isLoading={kpiData.isLoading}
        />
      </div>

      {/* Tier 8.5.A9 — Today's Focus queue (priority-ranked action list) */}
      <FocusQueue />

      {/* Tier 8.5.A10 — Ask Meridian NL query (Claude → SQL → results) */}
      <AskMeridian />

      {/* Weekly Review */}
      <WeeklyReviewBar week={kpiData.week} isLoading={kpiData.isLoading} />

      {/* Engagement Breakdown */}
      <EngagementBreakdown />

      {/* Class Status + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <ClassStatusBoard classes={classes} />
        </div>
        <div className="lg:col-span-5">
          <TodaysTimeline classes={classes} />
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed activities={activities} />
    </motion.div>
  )
}
