'use client'

import { motion } from 'framer-motion'
import {
  Dumbbell,
  Users,
  TrendingUp,
  Award,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useEmployeeProfile,
  useEmployeeClasses,
  useTrainerClassLog,
} from '@/hooks/use-employee'
import { fadeInUp } from '@/lib/motion'

const bonusStatusConfig = {
  'on-track': { label: 'On Track', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'needs-more': { label: 'Needs 7+', color: 'text-amber-600', bg: 'bg-amber-50' },
}

function formatClassDateTime(startsAt: string): { date: string; time: string } {
  const d = new Date(startsAt)
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  }
}

function formatClassTimeRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt)
  const e = new Date(endsAt)
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${fmt(s)} – ${fmt(e)}`
}

export default function ClassesPage() {
  const { trainer, loading: profileLoading } = useEmployeeProfile()
  const { upcoming, past, loading: classesLoading } = useEmployeeClasses(trainer?.id)
  const { entries: classLog, loading: logLoading } = useTrainerClassLog(trainer?.id)

  const loading = profileLoading || classesLoading || logLoading

  // Calculate period totals from trainer_class_log
  const totalClasses = classLog.length
  const totalBonuses = classLog.filter((c) => c.bonus_earned).length
  const avgAttendance = totalClasses > 0
    ? (classLog.reduce((acc, c) => acc + c.check_in_count, 0) / totalClasses).toFixed(1)
    : '0'
  const totalBonusEarned = classLog.reduce((acc, c) => acc + (c.bonus_amount ?? 0), 0)
  const bonusThreshold = trainer?.bonus_threshold ?? 7

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage and track your instructor sessions</p>
      </motion.div>

      {/* Period Totals */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900 mb-4">This Period</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Classes Led</p>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-indigo-500" />
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">{totalClasses}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Avg Attendance</p>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-500" />
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">{avgAttendance}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Bonuses Earned</p>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-500" />
              <p className="text-[28px] font-black tabular-nums text-emerald-600 leading-none">${totalBonusEarned}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Hit Rate</p>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">
                {totalClasses > 0 ? Math.round((totalBonuses / totalClasses) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Upcoming Classes */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Upcoming Classes</h3>
        </div>
        {upcoming.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No upcoming classes</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Date & Time</span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Type</span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bookings</span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bonus Status</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((cls) => {
                const { date } = formatClassDateTime(cls.starts_at)
                const timeRange = formatClassTimeRange(cls.starts_at, cls.ends_at)
                const bonusStatus = cls.booked_count >= bonusThreshold ? 'on-track' : 'needs-more'
                const status = bonusStatusConfig[bonusStatus]
                return (
                  <tr key={cls.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">{date}</p>
                      <p className="text-xs text-gray-500">{timeRange}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-gray-700">{cls.class_types?.name ?? cls.title}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold tabular-nums text-gray-900">{cls.booked_count}</span>
                        <span className="text-xs text-gray-400">/ {cls.capacity}</span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              cls.booked_count >= bonusThreshold ? 'bg-emerald-500' : 'bg-amber-400'
                            )}
                            style={{ width: `${(cls.booked_count / cls.capacity) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        'inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold',
                        status.bg, status.color
                      )}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Class History */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.15 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Class History</h3>
        </div>
        {classLog.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No class history yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Date & Time</span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Type</span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Check-Ins</span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bonus</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {classLog.map((entry) => {
                const classData = entry.classes
                const date = classData
                  ? formatClassDateTime(classData.starts_at).date
                  : new Date(entry.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                const timeRange = classData
                  ? formatClassTimeRange(classData.starts_at, classData.ends_at)
                  : ''
                const typeName = classData?.class_types?.name ?? classData?.title ?? 'Class'
                const capacity = classData?.capacity ?? 12

                return (
                  <tr key={entry.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-gray-900">{date}</p>
                      <p className="text-xs text-gray-500">{timeRange}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-700">{typeName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'text-sm font-bold tabular-nums',
                        entry.check_in_count >= bonusThreshold ? 'text-emerald-600' : 'text-gray-500'
                      )}>
                        {entry.check_in_count}/{capacity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {entry.bonus_earned ? (
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          +${entry.bonus_amount}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-400">
                          <XCircle className="w-3.5 h-3.5" />
                          Missed
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  )
}
