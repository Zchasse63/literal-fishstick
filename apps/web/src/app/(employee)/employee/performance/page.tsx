'use client'

import { motion } from 'framer-motion'
import {
  Dumbbell,
  Users,
  TrendingUp,
  DollarSign,
  Award,
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

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

const stats = [
  { label: 'Classes This Month', value: '12', icon: Dumbbell, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Avg Attendance', value: '9.4', icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Bonus Hit Rate', value: '83%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Total Earnings', value: '$2,140', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
]

const attendanceTrend = [
  { week: 'Jan 27', avg: 8.2 },
  { week: 'Feb 3', avg: 7.8 },
  { week: 'Feb 10', avg: 9.1 },
  { week: 'Feb 17', avg: 10.4 },
  { week: 'Feb 24', avg: 8.8 },
  { week: 'Mar 3', avg: 9.6 },
  { week: 'Mar 10', avg: 9.2 },
  { week: 'Mar 17', avg: 10.1 },
]

const earningsBreakdown = [
  { month: 'Oct', base: 1800, bonus: 120 },
  { month: 'Nov', base: 2100, bonus: 200 },
  { month: 'Dec', base: 1650, bonus: 80 },
  { month: 'Jan', base: 2280, bonus: 240 },
  { month: 'Feb', base: 2340, bonus: 320 },
  { month: 'Mar', base: 1960, bonus: 180 },
]

const classComparison = [
  { type: 'Guided Breathwork', classes: 28, avgAttendance: 9.8, hitRate: 89, revenue: '$1,120' },
  { type: 'Open Sauna Lead', classes: 12, avgAttendance: 7.2, hitRate: 58, revenue: '$480' },
]

export default function PerformancePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your trainer metrics and trends</p>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.03 * i }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stat.label}</p>
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-4 h-4', stat.color)} />
              </div>
            </div>
            <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Attendance Trend */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.15 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Attendance Trend</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Last 8 Weeks</span>
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
                y={7}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: 'Bonus Threshold (7)', position: 'insideTopRight', fill: '#f59e0b', fontSize: 11 }}
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
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Earnings Breakdown</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Last 6 Months</span>
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
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Class Type Comparison</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Class Type</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Classes</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Avg Attendance</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Hit Rate</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bonus Earned</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {classComparison.map((cls, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-4">
                  <span className="text-sm font-semibold text-gray-900">{cls.type}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm font-bold tabular-nums text-gray-900">{cls.classes}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm font-bold tabular-nums text-gray-900">{cls.avgAttendance}</span>
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
      </motion.div>
    </div>
  )
}
