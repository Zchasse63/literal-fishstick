'use client'

import { motion } from 'framer-motion'
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  UserPlus,
  DollarSign,
  ChevronRight,
  XCircle,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/auth-context'
import {
  useCommandCenterData,
  formatEasternTime,
  formatCurrency,
  type AIInsight,
  type ClassData,
  type ActivityItem,
} from '@/hooks/use-command-center-data'

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

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
      return { icon: Calendar, color: 'text-gray-500' }
  }
}

// ─── Loading Skeleton ───────────────────────────────────────
function CommandCenterSkeleton() {
  return (
    <div className="space-y-5">
      {/* AI Briefing skeleton */}
      <div className="rounded-2xl border border-gray-200 p-6">
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

      {/* Metrics strip skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Class Status + Timeline skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
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
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
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
function AIBriefingCard({ insights, greeting, firstName }: { insights: AIInsight[]; greeting: string; firstName: string }) {
  return (
    <div className="ai-border rounded-2xl p-6">
      <div className="bg-gradient-to-br from-indigo-500/[0.04] to-violet-500/[0.04] -m-6 p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900">{greeting}, {firstName}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.map((insight, i) => {
            const Icon = INSIGHT_ICON_MAP[insight.icon] || TrendingUp
            return (
              <div key={i} className="flex gap-3">
                <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', insight.color)} />
                <div>
                  <p className="text-sm text-gray-700 leading-relaxed">{insight.text}</p>
                  <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 mt-1 flex items-center gap-1">
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

// ─── Metric Card ─────────────────────────────────────────────
interface MetricCardProps {
  label: string
  value: string
  trend: string
  trendDirection: 'up' | 'down' | 'neutral'
  subtitle?: string
}

function MetricCard({ label, value, trend, trendDirection, subtitle }: MetricCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
      <p className="text-[28px] font-black text-gray-900 tabular-nums leading-none">{value}</p>
      <div className="flex items-center gap-1.5 mt-2">
        {trendDirection === 'up' && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />}
        {trendDirection === 'down' && <ArrowDownRight className="w-3.5 h-3.5 text-orange-600" />}
        <span className={cn(
          'text-xs font-bold',
          trendDirection === 'up' ? 'text-emerald-600' : trendDirection === 'down' ? 'text-orange-600' : 'text-gray-500'
        )}>
          {trend}
        </span>
        {subtitle && <span className="text-xs text-gray-400 ml-1">{subtitle}</span>}
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Class Status Board</h3>
        </div>
        <p className="text-sm text-gray-500">No classes scheduled for today.</p>
      </div>
    )
  }

  const hasLiveClass = classItems.some((c) => c.status === 'live')

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900">Class Status Board</h3>
          {hasLiveClass && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          View All <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-3">
        {classItems.map((cls, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 w-16 tabular-nums">{cls.time}</span>
            <span className={cn(
              'text-sm font-semibold flex-1',
              cls.isGuided ? 'text-violet-600' : 'text-gray-900'
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
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
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
              <span className="text-xs font-bold text-gray-500 tabular-nums w-8 text-right">
                {cls.booked}/{cls.capacity}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
          Cold Plunges: 4/6 available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-indigo-500 rounded-full" />
          All saunas active
        </span>
      </div>
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900">Today&apos;s Timeline</h3>
        <p className="text-sm text-gray-500 mt-4">No classes scheduled for today.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Today&apos;s Timeline</h3>
        <span className="text-xs font-medium text-gray-400 tabular-nums">{currentTimeStr}</span>
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
                <span className="text-sm font-bold text-gray-900">{entry.time}</span>
                {entry.status === 'live' && (
                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase rounded-full">Live</span>
                )}
              </div>
              <p className={cn(
                'text-sm font-semibold mt-0.5',
                entry.isGuided ? 'text-violet-600' : 'text-gray-700'
              )}>
                {entry.label}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {entry.names.map((name, j) => (
                  <span key={j} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
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
  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900">Activity Feed</h3>
        <p className="text-sm text-gray-500 mt-4">No recent activity.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900">Activity Feed</h3>
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
            <div key={activity.id} className="flex items-start gap-3 py-2 px-2 rounded-xl hover:bg-gray-50/80 transition-colors cursor-pointer">
              <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', color)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{mainText}</p>
                {detail && <p className="text-xs text-gray-500">{detail}</p>}
              </div>
              <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">{time}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Command Center Page ─────────────────────────────────────
export default function CommandCenter() {
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
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

  if (isLoading) {
    return <CommandCenterSkeleton />
  }

  return (
    <motion.div {...fadeInUp} className="space-y-5">
      {/* AI Briefing */}
      <AIBriefingCard insights={aiInsights} greeting={greeting} firstName={firstName} />

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Bookings Today"
          value={String(bookingsToday)}
          trend={bookingsToday > 0 ? `${bookingsToday} total` : 'No bookings'}
          trendDirection={bookingsToday > 0 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Current Session"
          value={`${currentSessionBooked}/${currentSessionCapacity}`}
          trend={currentSessionLive ? 'Live' : 'No active session'}
          trendDirection={currentSessionLive ? 'up' : 'neutral'}
          subtitle={currentSessionLive ? 'In progress' : undefined}
        />
        <MetricCard
          label="Revenue Today"
          value={formatCurrency(revenueToday)}
          trend={revenueToday > 0 ? 'Today' : 'No revenue yet'}
          trendDirection={revenueToday > 0 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Walk-Ins"
          value={String(walkInsToday)}
          trend={walkInsToday > 0 ? `${walkInsToday} today` : 'None today'}
          trendDirection={walkInsToday > 0 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="No-Shows"
          value={String(noShowsToday)}
          trend={noShowsToday === 0 ? 'None' : `${noShowsToday} today`}
          trendDirection={noShowsToday === 0 ? 'down' : 'up'}
        />
      </div>

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
