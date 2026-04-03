'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  MapPin,
  Coffee,
  Calendar,
  DollarSign,
  AlertTriangle,
  FileText,
  ChevronRight,
  Pause,
  Play,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useEmployeeProfile,
  useClockAction,
  useEmployeeClasses,
  useClockEntries,
  useEmployeeDocuments,
} from '@/hooks/use-employee'
import { fadeInUp } from '@/lib/motion'

function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatClassTime(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt)
  const e = new Date(endsAt)
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${fmt(s)} – ${fmt(e)}`
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function isTomorrow(dateStr: string): boolean {
  const d = new Date(dateStr)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return d.toDateString() === tomorrow.toDateString()
}

export default function EmployeeHomePage() {
  const { fullName, employee, trainer, loading: profileLoading } = useEmployeeProfile()
  const { isClockedIn, isOnBreak, elapsedMs, loading: clockLoading, clockIn, clockOut, startBreak, endBreak, activeEntry } = useClockAction(employee?.id)
  const { upcoming: upcomingClasses, loading: classesLoading } = useEmployeeClasses(trainer?.id)

  // Today's clock entries for summary
  const today = new Date().toISOString().slice(0, 10)
  const { entries: todayEntries } = useClockEntries(employee?.id, { from: today, to: today })

  // Documents for alerts
  const { documents } = useEmployeeDocuments(employee?.id)

  const [now, setNow] = useState(new Date())

  // Tick clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loading = profileLoading || clockLoading

  // Calculate today's summary from clock entries
  const todayTotalHours = todayEntries.reduce((acc, e) => acc + (e.total_hours ?? 0), 0)
  const todayBreakMins = todayEntries.reduce((acc, e) => acc + (e.break_duration_minutes ?? 0), 0)
  // If currently clocked in, add elapsed time
  const currentElapsedHours = isClockedIn ? elapsedMs / 3_600_000 : 0
  const totalHoursToday = todayTotalHours + currentElapsedHours
  const estPay = totalHoursToday * (employee?.pay_rate ?? 0)

  // Build upcoming shifts from classes
  const todayAndTomorrowClasses = upcomingClasses
    .filter((c) => isToday(c.starts_at) || isTomorrow(c.starts_at))
    .slice(0, 4)

  // Build alerts from documents
  const alerts: { icon: typeof AlertTriangle; text: string; color: string; bg: string }[] = []
  documents.forEach((doc) => {
    if (doc.expires_at) {
      const daysUntil = Math.ceil((new Date(doc.expires_at).getTime() - Date.now()) / 86_400_000)
      if (daysUntil < 0) {
        alerts.push({ icon: AlertTriangle, text: `${doc.name} has expired`, color: 'text-red-600', bg: 'bg-red-50' })
      } else if (daysUntil <= 30) {
        alerts.push({ icon: AlertTriangle, text: `${doc.name} expires in ${daysUntil} days`, color: 'text-amber-600', bg: 'bg-amber-50' })
      }
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  const firstName = fullName.split(' ')[0]

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}, {firstName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatDate(now)}</p>
      </motion.div>

      {/* Clock In/Out Hero Card */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8"
      >
        <div className="flex flex-col items-center text-center">
          {/* Status */}
          <div className="flex items-center gap-2 mb-6">
            {isClockedIn ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {isOnBreak ? 'On Break' : `Clocked In — ${formatElapsed(elapsedMs)}`}
              </span>
            ) : (
              <span className="text-sm font-medium text-gray-400">You are not clocked in</span>
            )}
          </div>

          {/* Big Clock Button */}
          <button
            onClick={async () => {
              if (isClockedIn) {
                await clockOut()
              } else {
                await clockIn()
              }
            }}
            className={cn(
              'w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95',
              isClockedIn
                ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                : 'bg-gradient-to-br from-indigo-600 to-violet-500 hover:from-indigo-700 hover:to-violet-600'
            )}
          >
            {isClockedIn ? (
              <>
                <Clock className="w-10 h-10 text-white mb-2" />
                <span className="text-white text-lg font-bold">Clock Out</span>
              </>
            ) : (
              <>
                <Play className="w-10 h-10 text-white mb-2 ml-1" />
                <span className="text-white text-lg font-bold">Clock In</span>
              </>
            )}
          </button>

          {/* Current Time */}
          <p className="text-[28px] font-black tabular-nums text-gray-900 mt-5">{formatTime(now)}</p>

          {/* Geofencing Badge */}
          <div className="flex items-center gap-1.5 mt-3">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600">At Studio</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>

          {/* Break Button */}
          {isClockedIn && (
            <motion.button
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={async () => {
                if (isOnBreak) {
                  await endBreak()
                } else {
                  await startBreak()
                }
              }}
              className={cn(
                'mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                isOnBreak
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {isOnBreak ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isOnBreak ? 'End Break' : 'Start Break'}
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Today's Summary + Upcoming Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Today's Summary */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <h3 className="text-sm font-bold text-gray-900 mb-4">Today&apos;s Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Hours Today</p>
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">
                {Math.floor(totalHoursToday)}h {Math.round((totalHoursToday % 1) * 60).toString().padStart(2, '0')}m
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Break Time</p>
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">{todayBreakMins}m</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Est. Pay</p>
              <p className="text-[28px] font-black tabular-nums text-emerald-600 leading-none">${Math.floor(estPay)}</p>
              <span className="text-xs text-gray-400">.{Math.round((estPay % 1) * 100).toString().padStart(2, '0')}</span>
            </div>
          </div>
        </motion.div>

        {/* Upcoming Schedule */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Upcoming Schedule</h3>
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-3">
            {todayAndTomorrowClasses.length === 0 && (
              <p className="text-sm text-gray-400">No upcoming classes</p>
            )}
            {todayAndTomorrowClasses.map((cls) => (
              <div key={cls.id} className="flex items-center gap-3">
                <div className="w-1 h-10 rounded-full flex-shrink-0 bg-indigo-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {cls.class_types?.name ?? cls.title}
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600">
                      Class
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {isToday(cls.starts_at) ? 'Today' : 'Tomorrow'} &middot; {formatClassTime(cls.starts_at, cls.ends_at)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-gray-500 tabular-nums">
                  {cls.booked_count}/{cls.capacity}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Alerts & Quick Links */}
      {alerts.length > 0 && (
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <h3 className="text-sm font-bold text-gray-900 mb-4">Alerts & Quick Links</h3>
          <div className="space-y-2.5">
            {alerts.map((alert, i) => (
              <button
                key={i}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:opacity-80',
                  alert.bg
                )}
              >
                <alert.icon className={cn('w-4 h-4 flex-shrink-0', alert.color)} />
                <span className={cn('text-sm font-medium flex-1 text-left', alert.color)}>{alert.text}</span>
                <ChevronRight className={cn('w-4 h-4 flex-shrink-0', alert.color)} />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
