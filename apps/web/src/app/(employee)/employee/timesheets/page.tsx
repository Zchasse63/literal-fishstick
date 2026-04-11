'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Flag,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmployeeProfile, useClockEntries } from '@/hooks/use-employee'
import { fadeInUp } from '@/lib/motion'

const statusConfig = {
  completed: { icon: CheckCircle2, label: 'Verified', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  verified: { icon: CheckCircle2, label: 'Verified', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  active: { icon: Clock, label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50' },
  pending: { icon: Clock, label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50' },
  flagged: { icon: AlertCircle, label: 'Flagged', color: 'text-red-600', bg: 'bg-red-50' },
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function TimesheetsPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const { employee, loading: profileLoading } = useEmployeeProfile()

  const currentWeekStart = useMemo(() => {
    const ws = getWeekStart(new Date())
    return addDays(ws, weekOffset * 7)
  }, [weekOffset])

  const weekEnd = addDays(currentWeekStart, 6)
  const weekStartISO = currentWeekStart.toISOString().slice(0, 10)
  const weekEndISO = weekEnd.toISOString().slice(0, 10)

  const { entries, loading: entriesLoading } = useClockEntries(employee?.id, {
    from: weekStartISO,
    to: weekEndISO,
  })

  const loading = profileLoading || entriesLoading

  // Group entries by day
  interface DayEntry {
    day: string
    date: string
    clockIn: string
    clockOut: string
    breakMins: number
    totalHours: number
    status: 'verified' | 'pending' | 'flagged' | 'completed' | 'active'
  }

  const dayEntries: DayEntry[] = useMemo(() => {
    // Build an entry for each day of the week
    const days: DayEntry[] = []
    for (let i = 0; i < 7; i++) {
      const d = addDays(currentWeekStart, i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayName = dayNames[d.getDay()]
      const shortDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      // Find entries for this day
      const dayClockEntries = entries.filter((e) => e.clock_in.slice(0, 10) === dateStr)

      if (dayClockEntries.length === 0) {
        // Only show past days or today
        if (d <= new Date()) {
          days.push({
            day: dayName,
            date: shortDate,
            clockIn: '\u2014',
            clockOut: '\u2014',
            breakMins: 0,
            totalHours: 0,
            status: 'pending',
          })
        }
      } else {
        // Combine multiple entries for same day
        let totalHours = 0
        let totalBreak = 0
        let firstIn = ''
        let lastOut = '\u2014'
        let status: DayEntry['status'] = 'completed'

        for (const entry of dayClockEntries) {
          totalHours += entry.total_hours ?? 0
          totalBreak += entry.break_duration_minutes ?? 0
          if (!firstIn || entry.clock_in < firstIn) firstIn = entry.clock_in
          if (entry.clock_out) {
            if (lastOut === '\u2014' || entry.clock_out > lastOut) lastOut = entry.clock_out
          } else {
            lastOut = '\u2014'
            status = 'active'
          }
          if (entry.status === 'flagged') status = 'flagged'
        }

        days.push({
          day: dayName,
          date: shortDate,
          clockIn: firstIn ? formatTime(firstIn) : '\u2014',
          clockOut: lastOut !== '\u2014' ? formatTime(lastOut) : '\u2014',
          breakMins: totalBreak,
          totalHours,
          status,
        })
      }
    }
    return days
  }, [entries, currentWeekStart])

  const totalHours = dayEntries.reduce((acc, e) => acc + e.totalHours, 0)
  const totalBreak = dayEntries.reduce((acc, e) => acc + e.breakMins, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  const weekLabel = `${formatDateShort(currentWeekStart)} – ${formatDateShort(weekEnd)}, ${weekEnd.getFullYear()}`

  return (
    <div data-testid="employee-timesheets-page-root" className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Timesheets</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track and review your hours</p>
      </motion.div>

      {/* Pay Period Selector */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekOffset((o) => o - 1)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{weekLabel}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {weekOffset === 0 ? 'Current Pay Period' : 'Pay Period'}
            </p>
          </div>
          <button onClick={() => setWeekOffset((o) => o + 1)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors border border-amber-200">
          <Flag className="w-4 h-4" />
          Flag for Review
        </button>
      </motion.div>

      {/* Timesheet Table */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Day</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Clock In</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Clock Out</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Break</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total Hours</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Status</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dayEntries.map((entry, i) => {
              const statusKey = entry.status as keyof typeof statusConfig
              const status = statusConfig[statusKey] ?? statusConfig.pending
              return (
                <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.day}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{entry.date}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-gray-300">{entry.clockIn}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-gray-300">{entry.clockOut}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-gray-300">
                      {entry.breakMins > 0 ? `${entry.breakMins}m` : '\u2014'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {entry.totalHours > 0 ? `${entry.totalHours.toFixed(1)}h` : '\u2014'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold',
                      status.bg, status.color
                    )}>
                      <status.icon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Period Totals */}
        <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Period Totals</span>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total Break</p>
                <p className="text-sm font-bold tabular-nums text-gray-700 dark:text-gray-300">{totalBreak}m</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total Hours</p>
                <p className="text-[28px] font-black tabular-nums text-gray-900 dark:text-gray-100 leading-none">{totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
