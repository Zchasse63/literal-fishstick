'use client'

import { useState, useEffect } from 'react'
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
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────

interface KPIItem {
  label: string
  value: string
  trend: number
  iconName: string
}

interface ClassRow {
  time: string
  name: string
  trainer: string | null
  booked: number
  capacity: number
  checkedIn: number
  type: string
}

interface ActivityItem {
  id: string
  iconName: string
  color: string
  bg: string
  text: string
  time: string
}

// ─── Constants ──────────────────────────────────────────────

const ICON_MAP: Record<string, typeof CalendarCheck> = {
  CalendarCheck,
  UserCheck,
  Footprints,
  AlertTriangle,
  Percent,
  XCircle,
  UserPlus,
  CreditCard,
  Clock,
}

// ─── Helpers ──────────────────────────────────────────────────

function getHeatmapColor(value: number, isToday: boolean): string {
  if (value === 0) return 'bg-gray-50 dark:bg-gray-900'
  if (value < 30) return isToday ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'bg-indigo-100'
  if (value < 50) return isToday ? 'bg-indigo-200 ring-1 ring-indigo-300' : 'bg-indigo-200'
  if (value < 70) return isToday ? 'bg-indigo-300 ring-1 ring-indigo-400' : 'bg-indigo-300'
  if (value < 85) return isToday ? 'bg-indigo-400 ring-1 ring-indigo-500' : 'bg-indigo-400'
  return isToday ? 'bg-indigo-600 ring-1 ring-indigo-700' : 'bg-indigo-600'
}

function getHeatmapTextColor(value: number): string {
  if (value >= 70) return 'text-white'
  if (value === 0) return 'text-gray-300'
  return 'text-gray-600 dark:text-gray-400'
}

function EmptyState({ icon: Icon, message }: { icon: typeof BarChart3; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-gray-300" />
      </div>
      <p className="text-sm text-gray-400 dark:text-gray-500">{message}</p>
    </div>
  )
}

function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 animate-pulse rounded', className)} />
}

// ─── Props ──────────────────────────────────────────────────

interface OperationsDashboardClientProps {
  initialKPIs: KPIItem[]
  initialClasses: ClassRow[]
  initialActivity: ActivityItem[]
  formattedDate: string
  todayIdx: number
}

// ─── Component ──────────────────────────────────────────────

export function OperationsDashboardClient({
  initialKPIs,
  initialClasses,
  initialActivity,
  formattedDate,
  todayIdx,
}: OperationsDashboardClientProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [todayKPIs] = useState<KPIItem[]>(initialKPIs)
  const [todayClasses] = useState<ClassRow[]>(initialClasses)
  const [activityFeed] = useState<ActivityItem[]>(initialActivity)
  const [heatmapData, setHeatmapData] = useState<number[][]>([])
  const [heatmapLoading, setHeatmapLoading] = useState(true)

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const HOURS = ['5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM']

  // Fetch heatmap from API route (can't call from RSC without full URL)
  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const mondayDate = new Date(now)
    const dayOfWeek = mondayDate.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    mondayDate.setDate(mondayDate.getDate() + diff)
    const startStr = mondayDate.toISOString().split('T')[0]!
    const sundayDate = new Date(mondayDate)
    sundayDate.setDate(sundayDate.getDate() + 6)
    const endStr = sundayDate.toISOString().split('T')[0]!

    fetch(`/api/analytics/heatmap?start_date=${startStr}&end_date=${endStr}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        const grid: number[][] = Array.from({ length: 8 }, () => Array(7).fill(0))
        for (const row of d.data) {
          const hourIdx = (row.hour_of_day ?? 5) - 5
          const dayIdx = (row.day_of_week ?? 1) - 1
          if (hourIdx >= 0 && hourIdx < 8 && dayIdx >= 0 && dayIdx < 7) {
            grid[hourIdx][dayIdx] = Math.round((row.avg_fill_rate ?? 0) * 100)
          }
        }
        setHeatmapData(grid)
      })
      .catch(() => { setHeatmapData([]) })
      .finally(() => { if (!cancelled) setHeatmapLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div data-testid="analytics-dashboards-operations-page-root" className="space-y-6">
      <div className="space-y-6">
        {/* ─── Header ──────────────────────────────────── */}
        <motion.div {...fadeInUp}>
          <Link
            href="/analytics/dashboards"
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            Dashboards
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daily Operations</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {formattedDate} &middot; Real-time studio activity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">Live</span>
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
          {todayKPIs.map((kpi) => {
            const Icon = ICON_MAP[kpi.iconName] ?? CalendarCheck
            return (
              <div
                key={kpi.label}
                className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {kpi.label}
                  </span>
                  <Icon className="w-3.5 h-3.5 text-gray-300" />
                </div>
                <p className="text-[28px] font-black tabular-nums text-gray-900 dark:text-gray-100 leading-none mb-1">
                  {kpi.value}
                </p>
              </div>
            )
          })}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Attendance Heatmap (Current Week) ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.08 }}
            className="lg:col-span-7 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">This Week&apos;s Attendance</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Fill rate by hour &middot; Today highlighted</p>
            </div>

            {heatmapLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <LoadingSkeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : heatmapData.length === 0 || heatmapData.every((row) => row.every((v) => v === 0)) ? (
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
                            i === todayIdx ? 'text-indigo-600' : 'text-gray-400 dark:text-gray-500'
                          )}
                        >
                          {day}
                          {i === todayIdx && (
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
                        <td className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pr-2 py-0.5 text-right whitespace-nowrap">
                          {hour}
                        </td>
                        {DAYS.map((day, colIdx) => {
                          const val = heatmapData[rowIdx]?.[colIdx] ?? 0
                          const isToday = colIdx === todayIdx
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
            className="lg:col-span-5 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Last 20 events</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-gray-400 dark:text-gray-500">Live</span>
              </div>
            </div>

            {activityFeed.length === 0 ? (
              <EmptyState icon={Clock} message="No recent activity" />
            ) : (
              <div className="space-y-1 max-h-[440px] overflow-y-auto pr-1">
                {activityFeed.map((item) => {
                  const Icon = ICON_MAP[item.iconName] ?? CalendarCheck
                  return (
                    <div key={item.id} className="flex items-start gap-2.5 py-2 border-b border-gray-100 dark:border-gray-800/60 last:border-0">
                      <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', item.bg)}>
                        <Icon className={cn('w-3 h-3', item.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">{item.text}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{item.time}</p>
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
            className="lg:col-span-12 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today&apos;s Classes</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Fill rates and check-in status per slot</p>
              </div>
              <Link
                href="/schedule"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 transition-colors"
              >
                Full Schedule <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {todayClasses.length === 0 ? (
              <EmptyState icon={CalendarCheck} message="No classes scheduled today" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-left">Time</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-left">Class</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-left">Trainer</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-center">Booked</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-center">Checked In</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-center">Fill Rate</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayClasses.map((cls, i) => {
                      const fillRate = cls.capacity > 0 ? Math.round((cls.booked / cls.capacity) * 100) : 0
                      const isPast = cls.checkedIn > 0
                      const isFull = cls.booked >= cls.capacity
                      return (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800/60 last:border-0">
                          <td className="py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{cls.time}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900 dark:text-gray-100">{cls.name}</span>
                              <span
                                className={cn(
                                  'text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full',
                                  cls.type === 'Guided' ? 'bg-violet-50 text-violet-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                )}
                              >
                                {cls.type}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-gray-600 dark:text-gray-400">{cls.trainer ?? '\u2014'}</td>
                          <td className="py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-center tabular-nums">
                            {cls.booked}/{cls.capacity}
                          </td>
                          <td className="py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-center tabular-nums">
                            {isPast ? cls.checkedIn : '\u2014'}
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full',
                                    fillRate >= 90 ? 'bg-indigo-600' : fillRate >= 70 ? 'bg-indigo-400' : 'bg-indigo-200'
                                  )}
                                  style={{ width: `${fillRate}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-400 w-8">{fillRate}%</span>
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
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-full">
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
