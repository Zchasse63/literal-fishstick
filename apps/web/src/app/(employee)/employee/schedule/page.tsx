'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  CalendarOff,
  Plus,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmployeeProfile, useScheduleClasses } from '@/hooks/use-employee'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

type ViewMode = 'week' | 'day' | 'month'

const weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const typeStyles = {
  shift: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
  class: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  off: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', dot: 'bg-gray-400' },
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
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

function formatTimeShort(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function SchedulePage() {
  const [view, setView] = useState<ViewMode>('week')
  const [weekOffset, setWeekOffset] = useState(0)

  const { trainer, loading: profileLoading } = useEmployeeProfile()

  const today = new Date()
  const currentWeekStart = useMemo(() => {
    const ws = getWeekStart(today)
    return addDays(ws, weekOffset * 7)
  }, [weekOffset])

  const weekEnd = addDays(currentWeekStart, 6)
  const weekStartISO = currentWeekStart.toISOString().slice(0, 10)
  const weekEndISO = weekEnd.toISOString().slice(0, 10)

  const { classes, loading: classesLoading } = useScheduleClasses(
    trainer?.id,
    weekStartISO,
    weekEndISO
  )

  const loading = profileLoading || classesLoading

  // Build week dates array
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
  }, [currentWeekStart])

  // Get today's index in the week (0-6, Mon-Sun)
  const todayIndex = useMemo(() => {
    const todayStr = today.toISOString().slice(0, 10)
    return weekDates.findIndex((d) => d.toISOString().slice(0, 10) === todayStr)
  }, [weekDates])

  // Group classes by day of week
  const classesByDay = useMemo(() => {
    const map: Record<number, typeof classes> = {}
    for (const cls of classes) {
      const clsDate = new Date(cls.starts_at)
      const dayIndex = weekDates.findIndex(
        (d) => d.toISOString().slice(0, 10) === clsDate.toISOString().slice(0, 10)
      )
      if (dayIndex >= 0) {
        if (!map[dayIndex]) map[dayIndex] = []
        map[dayIndex].push(cls)
      }
    }
    return map
  }, [classes, weekDates])

  // Week summary
  const totalClasses = classes.length
  const totalClassHours = classes.reduce((acc, c) => {
    const dur = (new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime()) / 3_600_000
    return acc + dur
  }, 0)
  const daysWithClasses = new Set(classes.map((c) => new Date(c.starts_at).toISOString().slice(0, 10))).size
  const daysOff = 7 - daysWithClasses

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  const weekLabel = `${formatDateShort(currentWeekStart)} – ${formatDateShort(weekEnd)}, ${weekEnd.getFullYear()}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">Week of {weekLabel}</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" />
          Request Time Off
        </button>
      </motion.div>

      {/* View Toggle + Navigation */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((o) => o - 1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-sm font-semibold text-gray-900">{weekLabel}</span>
          <button onClick={() => setWeekOffset((o) => o + 1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize',
                view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Weekly Calendar */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDayLabels.map((day, i) => (
            <div
              key={day}
              className={cn(
                'px-3 py-3 text-center border-r border-gray-100 last:border-r-0',
                i === todayIndex && 'bg-indigo-50/50'
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{day}</p>
              <p className={cn(
                'text-lg font-bold mt-0.5',
                i === todayIndex ? 'text-indigo-600' : 'text-gray-900'
              )}>
                {weekDates[i].getDate()}
              </p>
            </div>
          ))}
        </div>

        {/* Schedule Blocks */}
        <div className="grid grid-cols-7 min-h-[320px]">
          {weekDayLabels.map((_, dayIndex) => {
            const dayClasses = classesByDay[dayIndex] ?? []
            return (
              <div key={dayIndex} className={cn(
                'border-r border-gray-100 last:border-r-0 p-2 space-y-2',
                dayIndex === todayIndex && 'bg-indigo-50/30'
              )}>
                {dayClasses.length === 0 && (
                  <div className={cn('rounded-lg border p-2 text-xs', typeStyles.off.bg)}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', typeStyles.off.dot)} />
                      <span className={cn('font-semibold truncate', typeStyles.off.text)}>No Classes</span>
                    </div>
                  </div>
                )}
                {dayClasses.map((cls) => {
                  const style = typeStyles.class
                  const timeStr = `${formatTimeShort(cls.starts_at)} – ${formatTimeShort(cls.ends_at)}`
                  return (
                    <div
                      key={cls.id}
                      className={cn('rounded-lg border p-2 text-xs', style.bg)}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', style.dot)} />
                        <span className={cn('font-semibold truncate', style.text)}>
                          {cls.class_types?.name ?? cls.title}
                        </span>
                      </div>
                      <p className={cn('text-[10px] opacity-70', style.text)}>
                        {timeStr} &middot; {cls.booked_count}/{cls.capacity}
                      </p>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Week Summary */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.15 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900 mb-4">Week Summary</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Scheduled Hours</p>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-500" />
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">{Math.round(totalClassHours)}h</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Classes</p>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-indigo-500" />
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">{totalClasses}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Days Off</p>
            <div className="flex items-center gap-2">
              <CalendarOff className="w-4 h-4 text-gray-400" />
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">{daysOff} days</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Legend */}
      <div className="flex items-center gap-6">
        {Object.entries(typeStyles).map(([key, style]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={cn('w-3 h-3 rounded-sm', style.dot)} />
            <span className="text-xs font-medium text-gray-500 capitalize">{key === 'off' ? 'Time Off' : key === 'class' ? 'Classes' : 'Shifts'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
