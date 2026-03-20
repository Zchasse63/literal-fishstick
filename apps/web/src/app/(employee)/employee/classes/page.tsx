'use client'

import { motion } from 'framer-motion'
import {
  Dumbbell,
  Users,
  TrendingUp,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

const upcomingClasses = [
  { date: 'Thu, Mar 20', time: '5:00 – 6:00 PM', type: 'Guided Breathwork', booked: 8, capacity: 12, bonusStatus: 'on-track' as const },
  { date: 'Fri, Mar 21', time: '6:00 – 7:00 PM', type: 'Open Sauna Lead', booked: 5, capacity: 12, bonusStatus: 'needs-more' as const },
  { date: 'Sat, Mar 22', time: '10:00 – 11:00 AM', type: 'Guided Breathwork', booked: 11, capacity: 12, bonusStatus: 'on-track' as const },
  { date: 'Mon, Mar 24', time: '7:00 – 8:00 PM', type: 'Guided Breathwork', booked: 3, capacity: 12, bonusStatus: 'needs-more' as const },
]

const classHistory = [
  { date: 'Wed, Mar 19', time: '7:00 – 8:00 PM', type: 'Guided Breathwork', checkIns: 10, capacity: 12, bonusEarned: true, bonus: 40 },
  { date: 'Mon, Mar 17', time: '5:00 – 6:00 PM', type: 'Guided Breathwork', checkIns: 8, capacity: 12, bonusEarned: true, bonus: 40 },
  { date: 'Sat, Mar 15', time: '10:00 – 11:00 AM', type: 'Open Sauna Lead', checkIns: 6, capacity: 12, bonusEarned: false, bonus: 0 },
  { date: 'Wed, Mar 12', time: '7:00 – 8:00 PM', type: 'Guided Breathwork', checkIns: 9, capacity: 12, bonusEarned: true, bonus: 40 },
  { date: 'Mon, Mar 10', time: '5:00 – 6:00 PM', type: 'Guided Breathwork', checkIns: 7, capacity: 12, bonusEarned: true, bonus: 40 },
  { date: 'Sat, Mar 8', time: '10:00 – 11:00 AM', type: 'Open Sauna Lead', checkIns: 4, capacity: 12, bonusEarned: false, bonus: 0 },
]

const bonusStatusConfig = {
  'on-track': { label: 'On Track', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'needs-more': { label: 'Needs 7+', color: 'text-amber-600', bg: 'bg-amber-50' },
}

export default function ClassesPage() {
  const totalClasses = classHistory.length
  const totalBonuses = classHistory.filter((c) => c.bonusEarned).length
  const avgAttendance = (classHistory.reduce((acc, c) => acc + c.checkIns, 0) / classHistory.length).toFixed(1)
  const totalBonusEarned = classHistory.reduce((acc, c) => acc + c.bonus, 0)

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
                {Math.round((totalBonuses / totalClasses) * 100)}%
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
            {upcomingClasses.map((cls, i) => {
              const status = bonusStatusConfig[cls.bonusStatus]
              return (
                <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-900">{cls.date}</p>
                    <p className="text-xs text-gray-500">{cls.time}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium text-gray-700">{cls.type}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-gray-900">{cls.booked}</span>
                      <span className="text-xs text-gray-400">/ {cls.capacity}</span>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            cls.booked >= 7 ? 'bg-emerald-500' : 'bg-amber-400'
                          )}
                          style={{ width: `${(cls.booked / cls.capacity) * 100}%` }}
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
            {classHistory.map((cls, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-sm font-semibold text-gray-900">{cls.date}</p>
                  <p className="text-xs text-gray-500">{cls.time}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm font-medium text-gray-700">{cls.type}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={cn(
                    'text-sm font-bold tabular-nums',
                    cls.checkIns >= 7 ? 'text-emerald-600' : 'text-gray-500'
                  )}>
                    {cls.checkIns}/{cls.capacity}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {cls.bonusEarned ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      +${cls.bonus}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-400">
                      <XCircle className="w-3.5 h-3.5" />
                      Missed
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  )
}
