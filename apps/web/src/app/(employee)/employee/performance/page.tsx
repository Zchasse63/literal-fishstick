'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Dumbbell,
  Users,
  TrendingUp,
  DollarSign,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts'
import {
  useEmployeeProfile,
  useTrainerClassLog,
} from '@/hooks/use-employee'
import { fadeInUp } from '@/lib/motion'

export default function PerformancePage() {
  const { trainer, loading: profileLoading } = useEmployeeProfile()
  const { entries: classLog, loading: logLoading } = useTrainerClassLog(trainer?.id)

  const loading = profileLoading || logLoading
  const bonusThreshold = trainer?.bonus_threshold ?? 7

  // Current month stats
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const thisMonthEntries = classLog.filter((e) => {
    const d = new Date(e.created_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  const classesThisMonth = thisMonthEntries.length
  const avgAttendance = classesThisMonth > 0
    ? (thisMonthEntries.reduce((acc, e) => acc + e.check_in_count, 0) / classesThisMonth).toFixed(1)
    : '0'
  const bonusHits = thisMonthEntries.filter((e) => e.bonus_earned).length
  const hitRate = classesThisMonth > 0 ? Math.round((bonusHits / classesThisMonth) * 100) : 0
  const totalEarnings = thisMonthEntries.reduce((acc, e) => acc + (e.base_pay ?? 0) + (e.bonus_amount ?? 0), 0)

  const stats = [
    { label: 'Classes This Month', value: String(classesThisMonth), icon: Dumbbell, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Avg Attendance', value: avgAttendance, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Bonus Hit Rate', value: `${hitRate}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Earnings', value: `$${totalEarnings.toLocaleString()}`, icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  // Attendance trend — group by week (last 8 weeks)
  const attendanceTrend = useMemo(() => {
    const weeks: { week: string; avg: number }[] = []
    const now = new Date()

    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - w * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 7)

      const weekEntries = classLog.filter((e) => {
        const d = new Date(e.created_at)
        return d >= weekStart && d < weekEnd
      })

      const avg = weekEntries.length > 0
        ? weekEntries.reduce((acc, e) => acc + e.check_in_count, 0) / weekEntries.length
        : 0

      weeks.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        avg: Math.round(avg * 10) / 10,
      })
    }

    return weeks
  }, [classLog])

  // Earnings breakdown — last 6 months
  const earningsBreakdown = useMemo(() => {
    const months: { month: string; base: number; bonus: number }[] = []
    const now = new Date()

    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const monthEntries = classLog.filter((e) => {
        const ed = new Date(e.created_at)
        return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear()
      })

      months.push({
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        base: monthEntries.reduce((acc, e) => acc + (e.base_pay ?? 0), 0),
        bonus: monthEntries.reduce((acc, e) => acc + (e.bonus_amount ?? 0), 0),
      })
    }

    return months
  }, [classLog])

  // Class type comparison
  const classComparison = useMemo(() => {
    const byType: Record<string, { classes: number; totalAttendance: number; bonusHits: number; totalBonusEarned: number }> = {}

    for (const entry of classLog) {
      const typeName = entry.classes?.class_types?.name ?? entry.classes?.title ?? 'Unknown'
      if (!byType[typeName]) {
        byType[typeName] = { classes: 0, totalAttendance: 0, bonusHits: 0, totalBonusEarned: 0 }
      }
      byType[typeName].classes++
      byType[typeName].totalAttendance += entry.check_in_count
      if (entry.bonus_earned) {
        byType[typeName].bonusHits++
        byType[typeName].totalBonusEarned += entry.bonus_amount ?? 0
      }
    }

    return Object.entries(byType).map(([type, data]) => ({
      type,
      classes: data.classes,
      avgAttendance: data.classes > 0 ? Math.round((data.totalAttendance / data.classes) * 10) / 10 : 0,
      hitRate: data.classes > 0 ? Math.round((data.bonusHits / data.classes) * 100) : 0,
      revenue: `$${data.totalBonusEarned.toLocaleString()}`,
    }))
  }, [classLog])

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Performance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your trainer metrics and trends</p>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.03 * i }}
            className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{stat.label}</p>
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-4 h-4', stat.color)} />
              </div>
            </div>
            <p className="text-[28px] font-black tabular-nums text-gray-900 dark:text-gray-100 leading-none">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Attendance Trend */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.15 }}
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Attendance Trend</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Last 8 Weeks</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 12]}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  fontSize: '13px',
                }}
              />
              <ReferenceLine
                y={bonusThreshold}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: `Bonus Threshold (${bonusThreshold})`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#4f46e5"
                strokeWidth={2.5}
                dot={{ fill: '#4f46e5', r: 4, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                name="Avg Attendance"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Earnings Breakdown */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.2 }}
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Earnings Breakdown</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Last 6 Months</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={earningsBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  fontSize: '13px',
                }}
                formatter={(value: number) => `$${value}`}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Bar dataKey="base" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} name="Base Pay" />
              <Bar dataKey="bonus" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} name="Bonus" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Class Type Comparison */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.25 }}
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Class Type Comparison</h3>
        </div>
        {classComparison.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No class data yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Class Type</span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Classes</span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Avg Attendance</span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Hit Rate</span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Bonus Earned</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {classComparison.map((cls, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cls.type}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{cls.classes}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{cls.avgAttendance}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn(
                      'text-sm font-bold tabular-nums',
                      cls.hitRate >= 80 ? 'text-emerald-600' : cls.hitRate >= 60 ? 'text-amber-600' : 'text-red-500'
                    )}>
                      {cls.hitRate}%
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-bold tabular-nums text-emerald-600">{cls.revenue}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  )
}
