'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  CalendarCheck,
  UserCheck,
  Footprints,
  AlertTriangle,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  UserPlus,
  CreditCard,
  ArrowLeft,
  Users,
} from 'lucide-react'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Mock Data ──────────────────────────────────────────────

const TODAY_KPIS = [
  { label: 'Bookings', value: '47', trend: 12, icon: CalendarCheck },
  { label: 'Check-ins', value: '38', trend: 8, icon: UserCheck },
  { label: 'Walk-ins', value: '6', trend: -15, icon: Footprints },
  { label: 'No-shows', value: '3', trend: -25, icon: AlertTriangle },
  { label: 'Fill Rate', value: '78%', trend: 5, icon: Percent },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = ['5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM']

// Current week heatmap — today is Thursday (index 3)
const WEEK_HEATMAP: number[][] = [
  [25, 20, 15, 30, 0, 0, 0],
  [40, 35, 30, 55, 0, 0, 0],
  [60, 55, 50, 72, 0, 0, 0],
  [75, 70, 65, 88, 0, 0, 0],
  [90, 85, 80, 92, 0, 0, 0],
  [95, 88, 85, 78, 0, 0, 0],
  [85, 80, 75, 65, 0, 0, 0],
  [70, 65, 60, 50, 0, 0, 0],
]

const TODAY_CLASSES = [
  { time: '5:00 AM', name: 'Open Sauna', trainer: null, booked: 4, capacity: 12, checkedIn: 3, type: 'Open' },
  { time: '6:00 AM', name: 'Open Sauna', trainer: null, booked: 7, capacity: 12, checkedIn: 6, type: 'Open' },
  { time: '7:00 AM', name: 'Open Sauna', trainer: null, booked: 9, capacity: 12, checkedIn: 8, type: 'Open' },
  { time: '8:00 AM', name: 'Guided Breathwork', trainer: 'Whitney Cooper', booked: 11, capacity: 12, checkedIn: 10, type: 'Guided' },
  { time: '9:00 AM', name: 'Open Sauna', trainer: null, booked: 11, capacity: 12, checkedIn: 9, type: 'Open' },
  { time: '10:00 AM', name: 'Open Sauna', trainer: null, booked: 8, capacity: 12, checkedIn: 0, type: 'Open' },
  { time: '11:00 AM', name: 'Open Sauna', trainer: null, booked: 6, capacity: 12, checkedIn: 0, type: 'Open' },
  { time: '12:00 PM', name: 'Guided Flow', trainer: 'Drennen Hall', booked: 8, capacity: 12, checkedIn: 0, type: 'Guided' },
]

const ACTIVITY_FEED = [
  { id: 1, icon: UserCheck, text: 'Sarah Kim checked in for 9:00 AM Open Sauna', time: '2 min ago', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 2, icon: CreditCard, text: 'Mike Torres purchased Unlimited membership', time: '5 min ago', color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 3, icon: CalendarCheck, text: 'Emma Davis booked 12:00 PM Guided Flow', time: '8 min ago', color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 4, icon: UserCheck, text: 'James Park checked in for 9:00 AM Open Sauna', time: '10 min ago', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 5, icon: XCircle, text: 'Alex Chen cancelled 11:00 AM booking', time: '12 min ago', color: 'text-red-500', bg: 'bg-red-50' },
  { id: 6, icon: UserPlus, text: 'New lead: Rachel Green (Instagram)', time: '15 min ago', color: 'text-violet-500', bg: 'bg-violet-50' },
  { id: 7, icon: UserCheck, text: 'Whitney Cooper checked in for 8:00 AM Guided', time: '18 min ago', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 8, icon: CreditCard, text: 'Jen Lee purchased 10-Class Pack', time: '22 min ago', color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 9, icon: CalendarCheck, text: 'David Wu booked 10:00 AM Open Sauna', time: '25 min ago', color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 10, icon: UserCheck, text: 'Maria Santos checked in for 8:00 AM Guided', time: '28 min ago', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 11, icon: Footprints, text: 'Walk-in: Tom Harris (9:00 AM Open Sauna)', time: '30 min ago', color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 12, icon: UserCheck, text: 'Lisa Wang checked in for 8:00 AM Guided', time: '32 min ago', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 13, icon: CalendarCheck, text: 'Chris Moore booked 11:00 AM Open Sauna', time: '35 min ago', color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 14, icon: CreditCard, text: 'Amy Foster renewed Unlimited membership', time: '38 min ago', color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 15, icon: UserCheck, text: 'Robert Kim checked in for 7:00 AM Open Sauna', time: '45 min ago', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 16, icon: XCircle, text: 'No-show: Jake Monroe for 7:00 AM', time: '50 min ago', color: 'text-red-500', bg: 'bg-red-50' },
  { id: 17, icon: UserCheck, text: 'Nicole Brown checked in for 7:00 AM Open Sauna', time: '52 min ago', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 18, icon: CalendarCheck, text: 'Ben Wright booked 12:00 PM Guided Flow', time: '55 min ago', color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 19, icon: Footprints, text: 'Walk-in: Sara Voss (6:00 AM Open Sauna)', time: '1 hr ago', color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 20, icon: UserCheck, text: 'Mark Johnson checked in for 6:00 AM Open Sauna', time: '1 hr ago', color: 'text-emerald-500', bg: 'bg-emerald-50' },
]

// ─── Helpers ──────────────────────────────────────────────────

function getHeatmapColor(value: number, isToday: boolean): string {
  if (value === 0) return 'bg-gray-50'
  if (value < 30) return isToday ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'bg-indigo-100'
  if (value < 50) return isToday ? 'bg-indigo-200 ring-1 ring-indigo-300' : 'bg-indigo-200'
  if (value < 70) return isToday ? 'bg-indigo-300 ring-1 ring-indigo-400' : 'bg-indigo-300'
  if (value < 85) return isToday ? 'bg-indigo-400 ring-1 ring-indigo-500' : 'bg-indigo-400'
  return isToday ? 'bg-indigo-600 ring-1 ring-indigo-700' : 'bg-indigo-600'
}

function getHeatmapTextColor(value: number): string {
  if (value >= 70) return 'text-white'
  if (value === 0) return 'text-gray-300'
  return 'text-gray-600'
}

function EmptyState({ icon: Icon, message }: { icon: typeof BarChart3; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-gray-300" />
      </div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────

export default function OperationsDashboardPage() {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header ──────────────────────────────────── */}
        <motion.div {...fadeInUp}>
          <Link
            href="/analytics/dashboards"
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            Dashboards
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Daily Operations</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Thursday, March 20, 2026 &middot; Real-time studio activity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Live</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </motion.div>

        {/* ─── Today's KPIs ──────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.03 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {TODAY_KPIS.map((kpi) => {
            const Icon = kpi.icon
            const isNoShows = kpi.label === 'No-shows'
            const isPositive = isNoShows ? kpi.trend < 0 : kpi.trend > 0
            return (
              <div
                key={kpi.label}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {kpi.label}
                  </span>
                  <Icon className="w-3.5 h-3.5 text-gray-300" />
                </div>
                <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none mb-1">
                  {kpi.value}
                </p>
                <div className="flex items-center gap-1">
                  {isPositive ? (
                    <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-red-500" />
                  )}
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      isPositive ? 'text-emerald-600' : 'text-red-600'
                    )}
                  >
                    {Math.abs(kpi.trend)}%
                  </span>
                  <span className="text-[10px] text-gray-400">vs last Thu</span>
                </div>
              </div>
            )
          })}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Attendance Heatmap (Current Week) ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.08 }}
            className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">This Week&apos;s Attendance</h2>
              <p className="text-xs text-gray-400 mt-0.5">Fill rate by hour &middot; Today highlighted</p>
            </div>

            {WEEK_HEATMAP.every((row) => row.every((v) => v === 0)) ? (
              <EmptyState icon={BarChart3} message="No attendance data this week" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="w-16" />
                      {DAYS.map((day, i) => (
                        <th
                          key={day}
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-widest pb-2 text-center',
                            i === 3 ? 'text-indigo-600' : 'text-gray-400'
                          )}
                        >
                          {day}
                          {i === 3 && (
                            <span className="block text-[8px] text-indigo-400 font-medium normal-case tracking-normal">
                              Today
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HOURS.map((hour, rowIdx) => (
                      <tr key={hour}>
                        <td className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-2 py-0.5 text-right whitespace-nowrap">
                          {hour}
                        </td>
                        {DAYS.map((day, colIdx) => {
                          const val = WEEK_HEATMAP[rowIdx]?.[colIdx] ?? 0
                          const isToday = colIdx === 3
                          const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx
                          return (
                            <td key={day} className="p-0.5">
                              <div
                                onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                                onMouseLeave={() => setHoveredCell(null)}
                                className={cn(
                                  'relative rounded-md h-8 flex items-center justify-center transition-all cursor-default',
                                  getHeatmapColor(val, isToday),
                                  isHovered && val > 0 && 'ring-2 ring-indigo-600 ring-offset-1'
                                )}
                              >
                                <span
                                  className={cn(
                                    'text-[10px] font-semibold tabular-nums',
                                    getHeatmapTextColor(val)
                                  )}
                                >
                                  {val > 0 ? `${val}` : ''}
                                </span>
                                {isHovered && val > 0 && (
                                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap z-10">
                                    {day} {hour}: {val}% fill
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-900" />
                                  </div>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* ─── Activity Feed ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.12 }}
            className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
                <p className="text-xs text-gray-400 mt-0.5">Last 20 events</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-gray-400">Live</span>
              </div>
            </div>

            {ACTIVITY_FEED.length === 0 ? (
              <EmptyState icon={Clock} message="No recent activity" />
            ) : (
              <div className="space-y-1 max-h-[440px] overflow-y-auto pr-1">
                {ACTIVITY_FEED.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.id} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                      <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', item.bg)}>
                        <Icon className={cn('w-3 h-3', item.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 leading-snug">{item.text}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* ─── Today's Class Schedule ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.16 }}
            className="lg:col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Today&apos;s Classes</h2>
                <p className="text-xs text-gray-400 mt-0.5">Fill rates and check-in status per slot</p>
              </div>
              <Link
                href="/schedule"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 transition-colors"
              >
                Full Schedule <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {TODAY_CLASSES.length === 0 ? (
              <EmptyState icon={CalendarCheck} message="No classes scheduled today" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-left">Time</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-left">Class</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-left">Trainer</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-center">Booked</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-center">Checked In</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-center">Fill Rate</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TODAY_CLASSES.map((cls, i) => {
                      const fillRate = Math.round((cls.booked / cls.capacity) * 100)
                      const isPast = cls.checkedIn > 0
                      const isFull = cls.booked >= cls.capacity
                      return (
                        <tr key={i} className="border-b border-gray-50 last:border-0">
                          <td className="py-3 text-sm font-semibold text-gray-900 tabular-nums">{cls.time}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900">{cls.name}</span>
                              <span
                                className={cn(
                                  'text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full',
                                  cls.type === 'Guided' ? 'bg-violet-50 text-violet-600' : 'bg-gray-100 text-gray-500'
                                )}
                              >
                                {cls.type}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-gray-600">{cls.trainer ?? '—'}</td>
                          <td className="py-3 text-sm font-semibold text-gray-900 text-center tabular-nums">
                            {cls.booked}/{cls.capacity}
                          </td>
                          <td className="py-3 text-sm font-semibold text-gray-900 text-center tabular-nums">
                            {isPast ? cls.checkedIn : '—'}
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full',
                                    fillRate >= 90 ? 'bg-indigo-600' : fillRate >= 70 ? 'bg-indigo-400' : 'bg-indigo-200'
                                  )}
                                  style={{ width: `${fillRate}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold tabular-nums text-gray-600 w-8">{fillRate}%</span>
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            {isPast ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Complete
                              </span>
                            ) : isFull ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                Full
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" /> Upcoming
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
