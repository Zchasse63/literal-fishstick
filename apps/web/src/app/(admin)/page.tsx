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
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── AI Briefing Card ────────────────────────────────────────
function AIBriefingCard() {
  const insights = [
    {
      icon: TrendingUp,
      text: 'Wednesday 7pm Guided class hit 10/12 capacity 3 weeks straight — consider adding a Thursday session',
      action: 'Add Class',
      color: 'text-indigo-600',
    },
    {
      icon: AlertCircle,
      text: '9 members haven\'t booked in 14+ days — churn risk campaign ready',
      action: 'Send Campaign',
      color: 'text-orange-600',
    },
    {
      icon: Briefcase,
      text: 'Tampa Tech corporate account is 3 sessions from their monthly cap',
      action: 'Contact Account',
      color: 'text-amber-600',
    },
  ]

  return (
    <div className="ai-border rounded-2xl p-6">
      <div className="bg-gradient-to-br from-indigo-500/[0.04] to-violet-500/[0.04] -m-6 p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900">Good morning, Zach</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.map((insight, i) => (
            <div key={i} className="flex gap-3">
              <insight.icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', insight.color)} />
              <div>
                <p className="text-sm text-gray-700 leading-relaxed">{insight.text}</p>
                <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 mt-1 flex items-center gap-1">
                  {insight.action}
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
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
function ClassStatusBoard() {
  const classes = [
    { time: '5:00 PM', name: 'Open Sauna', status: 'live' as const, booked: 11, capacity: 12 },
    { time: '6:00 PM', name: 'Open Sauna', status: 'upcoming' as const, booked: 7, capacity: 12 },
    { time: '7:00 PM', name: 'Guided: Whitney', status: 'upcoming' as const, booked: 9, capacity: 12, isGuided: true },
    { time: '8:00 PM', name: 'Open Sauna', status: 'upcoming' as const, booked: 4, capacity: 12 },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900">Class Status Board</h3>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          View All <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-3">
        {classes.map((cls, i) => (
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
function TodaysTimeline() {
  const entries = [
    { time: '5:00 PM', label: 'Open Sauna — In Progress', status: 'live', names: ['Sarah M.', 'David L.', 'Kevin S.', '+8 others'] },
    { time: '6:00 PM', label: 'Open Sauna', status: 'upcoming', names: ['Michael R.', 'Tom B.', '+4 others'] },
    { time: '7:00 PM', label: 'Guided — Whitney', status: 'upcoming', isGuided: true, names: ['Emily P.', 'Chris T.', '+6 others'] },
    { time: '8:00 PM', label: 'Open Sauna', status: 'upcoming', names: ['Mike T.', '+3 others'] },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Today&apos;s Timeline</h3>
        <span className="text-xs font-medium text-gray-400 tabular-nums">17:14</span>
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
function ActivityFeed() {
  const activities = [
    { icon: CheckCircle2, color: 'text-emerald-500', text: 'Sarah M. checked in', detail: '5:00 PM Open Sauna', time: '5:00 PM' },
    { icon: UserPlus, color: 'text-indigo-500', text: 'New booking: James K.', detail: '7:00 PM Guided, Whitney', time: '4:48 PM' },
    { icon: DollarSign, color: 'text-emerald-500', text: 'Payment received: $149', detail: 'Mike T. — Unlimited Monthly', time: '4:30 PM' },
  ]

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
        {activities.map((activity, i) => (
          <div key={i} className="flex items-start gap-3 py-2 px-2 rounded-xl hover:bg-gray-50/80 transition-colors cursor-pointer">
            <activity.icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', activity.color)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{activity.text}</p>
              <p className="text-xs text-gray-500">{activity.detail}</p>
            </div>
            <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">{activity.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Command Center Page ─────────────────────────────────────
export default function CommandCenter() {
  return (
    <motion.div {...fadeInUp} className="space-y-5">
      {/* AI Briefing */}
      <AIBriefingCard />

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Bookings Today" value="34" trend="↗ 12%" trendDirection="up" />
        <MetricCard label="Current Session" value="9/12" trend="↗ Live" trendDirection="up" subtitle="In progress" />
        <MetricCard label="Revenue Today" value="$2,847" trend="↗ 8.2%" trendDirection="up" />
        <MetricCard label="Walk-Ins" value="7" trend="↗ 2 today" trendDirection="up" />
        <MetricCard label="No-Shows" value="1" trend="↘ 50%" trendDirection="down" />
      </div>

      {/* Class Status + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <ClassStatusBoard />
        </div>
        <div className="lg:col-span-5">
          <TodaysTimeline />
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed />
    </motion.div>
  )
}
