'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Users,
  Trophy,
  AlertTriangle,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  BarChart3,
  UserPlus,
  Target,
  Phone,
  CalendarCheck,
  CheckCircle2,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Mock Data ──────────────────────────────────────────────

const MEMBER_MOVEMENT = [
  { date: 'Dec 21', new: 6, churned: -3, net: 3 },
  { date: 'Dec 28', new: 4, churned: -2, net: 2 },
  { date: 'Jan 4', new: 12, churned: -3, net: 9 },
  { date: 'Jan 11', new: 10, churned: -2, net: 8 },
  { date: 'Jan 18', new: 11, churned: -1, net: 10 },
  { date: 'Jan 25', new: 12, churned: -3, net: 9 },
  { date: 'Feb 1', new: 9, churned: -2, net: 7 },
  { date: 'Feb 8', new: 10, churned: -1, net: 9 },
  { date: 'Feb 15', new: 8, churned: -2, net: 6 },
  { date: 'Feb 22', new: 11, churned: -2, net: 9 },
  { date: 'Mar 1', new: 14, churned: -1, net: 13 },
  { date: 'Mar 8', new: 13, churned: -2, net: 11 },
  { date: 'Mar 15', new: 14, churned: -3, net: 11 },
]

// Cohort comparison — this month vs last month
const COHORT_PERIODS = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5']
const COHORT_THIS_MONTH = [100, 93, 86, 80, 76, 73]
const COHORT_LAST_MONTH = [100, 85, 74, 68, 63, 59]

const AT_RISK_MEMBERS = [
  { name: 'Tom Harris', membership: 'Unlimited', lastVisit: '14 days ago', riskScore: 92, trend: 'declining' },
  { name: 'Nicole Brown', membership: '10-Class Pack', lastVisit: '18 days ago', riskScore: 88, trend: 'declining' },
  { name: 'Chris Moore', membership: 'Unlimited', lastVisit: '11 days ago', riskScore: 85, trend: 'declining' },
  { name: 'Amy Foster', membership: 'Unlimited', lastVisit: '21 days ago', riskScore: 82, trend: 'inactive' },
  { name: 'David Wu', membership: '10-Class Pack', lastVisit: '16 days ago', riskScore: 79, trend: 'declining' },
  { name: 'Rachel Green', membership: 'Unlimited', lastVisit: '9 days ago', riskScore: 74, trend: 'declining' },
  { name: 'Jake Monroe', membership: '6-Class Pack', lastVisit: '25 days ago', riskScore: 71, trend: 'inactive' },
  { name: 'Sara Voss', membership: 'Unlimited', lastVisit: '12 days ago', riskScore: 68, trend: 'declining' },
  { name: 'Ben Wright', membership: '10-Class Pack', lastVisit: '20 days ago', riskScore: 65, trend: 'declining' },
  { name: 'Lisa Wang', membership: 'Unlimited', lastVisit: '8 days ago', riskScore: 61, trend: 'declining' },
]

const FUNNEL_DATA = [
  { stage: 'New Leads', count: 48, color: '#C4B5FD' },
  { stage: 'Contacted', count: 32, color: '#A78BFA' },
  { stage: 'Trial', count: 18, color: '#8B5CF6' },
  { stage: 'Converted', count: 11, color: '#4F46E5' },
]

const TRAINERS = [
  { name: 'Whitney Cooper', avatar: 'WC', avgAttendance: 9.2, classesLed: 24, bonusHitRate: 83, maxAttendance: 12 },
  { name: 'Drennen Hall', avatar: 'DH', avgAttendance: 8.1, classesLed: 18, bonusHitRate: 67, maxAttendance: 12 },
  { name: 'Trent Bailey', avatar: 'TB', avgAttendance: 7.4, classesLed: 20, bonusHitRate: 55, maxAttendance: 12 },
  { name: 'Sara Voss', avatar: 'SV', avgAttendance: 6.8, classesLed: 16, bonusHitRate: 44, maxAttendance: 12 },
  { name: 'Jake Monroe', avatar: 'JM', avgAttendance: 6.2, classesLed: 14, bonusHitRate: 36, maxAttendance: 12 },
]

// ─── Helpers ──────────────────────────────────────────────────

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

function MovementTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-600 capitalize">{entry.dataKey}:</span>
          <span className="font-semibold text-gray-900">{Math.abs(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

function getRiskBadge(score: number) {
  if (score >= 80) return { label: 'High', color: 'bg-red-50 text-red-600' }
  if (score >= 60) return { label: 'Medium', color: 'bg-amber-50 text-amber-600' }
  return { label: 'Low', color: 'bg-gray-50 text-gray-500' }
}

// ─── Page Component ──────────────────────────────────────────

export default function GrowthDashboardPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Growth & Retention</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Member trends, retention cohorts, at-risk members, and lead pipeline
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Member Movement Chart ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="lg:col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Member Movement</h2>
              <p className="text-xs text-gray-400 mt-0.5">New vs churned vs net members, last 90 days (weekly)</p>
            </div>

            {MEMBER_MOVEMENT.length === 0 ? (
              <EmptyState icon={Users} message="No member movement data available" />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MEMBER_MOVEMENT} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip content={<MovementTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="new"
                      stroke="#10B981"
                      fill="#10B98120"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="churned"
                      stroke="#EF4444"
                      fill="#EF444420"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#EF4444', strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="net"
                      stroke="#4F46E5"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>

          {/* ─── Cohort Comparison ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Cohort Retention Comparison</h2>
              <p className="text-xs text-gray-400 mt-0.5">March cohort vs February cohort</p>
            </div>

            {COHORT_THIS_MONTH.length === 0 ? (
              <EmptyState icon={Users} message="Not enough cohort data yet" />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={COHORT_PERIODS.map((period, i) => ({
                      period,
                      'Mar Cohort': COHORT_THIS_MONTH[i],
                      'Feb Cohort': COHORT_LAST_MONTH[i],
                    }))}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                      width={44}
                    />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
                            <p className="font-semibold text-gray-900 mb-1">{label}</p>
                            {payload.map((entry: any) => (
                              <div key={entry.dataKey} className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                                <span className="text-gray-600">{entry.dataKey}:</span>
                                <span className="font-semibold text-gray-900">{entry.value}%</span>
                              </div>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="Mar Cohort"
                      stroke="#4F46E5"
                      fill="#4F46E520"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Feb Cohort"
                      stroke="#A78BFA"
                      fill="#A78BFA15"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: '#A78BFA', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>

          {/* ─── Lead Pipeline Funnel ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.14 }}
            className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Lead Pipeline</h2>
                <p className="text-xs text-gray-400 mt-0.5">Current funnel stages</p>
              </div>
              <Link
                href="/marketing/leads"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 transition-colors"
              >
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {FUNNEL_DATA.length === 0 ? (
              <EmptyState icon={Target} message="No leads in pipeline" />
            ) : (
              <div className="space-y-3">
                {FUNNEL_DATA.map((stage, i) => {
                  const maxCount = FUNNEL_DATA[0].count
                  const width = Math.max((stage.count / maxCount) * 100, 15)
                  const conversionRate = i > 0
                    ? Math.round((stage.count / FUNNEL_DATA[i - 1].count) * 100)
                    : null
                  const StageIcon = i === 0 ? UserPlus : i === 1 ? Phone : i === 2 ? CalendarCheck : CheckCircle2
                  return (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <StageIcon className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-700">{stage.stage}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {conversionRate !== null && (
                            <span className="text-[10px] text-gray-400">{conversionRate}%</span>
                          )}
                          <span className="text-sm font-bold text-gray-900 tabular-nums">{stage.count}</span>
                        </div>
                      </div>
                      <div className="w-full h-8 bg-gray-50 rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg flex items-center justify-center transition-all"
                          style={{ width: `${width}%`, background: stage.color }}
                        >
                          {width > 30 && (
                            <span className="text-[10px] font-bold text-white tabular-nums">{stage.count}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Overall Conversion</span>
                    <span className="text-sm font-bold text-indigo-600 tabular-nums">
                      {Math.round((FUNNEL_DATA[FUNNEL_DATA.length - 1].count / FUNNEL_DATA[0].count) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* ─── At-Risk Members ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.18 }}
            className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">At-Risk Members</h2>
                <p className="text-xs text-gray-400 mt-0.5">Top 10 by AI churn score</p>
              </div>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>

            {AT_RISK_MEMBERS.length === 0 ? (
              <EmptyState icon={Users} message="No at-risk members detected" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-left">Member</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-left">Membership</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-left">Last Visit</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 text-center">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AT_RISK_MEMBERS.map((member) => {
                      const badge = getRiskBadge(member.riskScore)
                      return (
                        <tr key={member.name} className="border-b border-gray-50 last:border-0">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                {member.name.split(' ').map((n) => n[0]).join('')}
                              </div>
                              <span className="text-sm font-medium text-gray-900">{member.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-xs text-gray-600">{member.membership}</td>
                          <td className="py-2.5 text-xs text-gray-500">{member.lastVisit}</td>
                          <td className="py-2.5 text-center">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
                                badge.color
                              )}
                            >
                              {member.riskScore}% {badge.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* ─── Trainer Leaderboard ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.22 }}
            className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Trainer Leaderboard</h2>
                <p className="text-xs text-gray-400 mt-0.5">Top 5 by avg attendance</p>
              </div>
              <Link
                href="/analytics/trainers"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 transition-colors"
              >
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {TRAINERS.length === 0 ? (
              <EmptyState icon={Trophy} message="No trainer data yet" />
            ) : (
              <div className="space-y-3">
                {TRAINERS.map((trainer, i) => (
                  <div key={trainer.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-300 w-4 tabular-nums">#{i + 1}</span>
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                        i === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {trainer.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{trainer.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {trainer.classesLed} classes &middot; {trainer.bonusHitRate}% bonus rate
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', i === 0 ? 'bg-indigo-600' : 'bg-indigo-300')}
                          style={{ width: `${(trainer.avgAttendance / trainer.maxAttendance) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold tabular-nums text-gray-900 w-8 text-right">
                        {trainer.avgAttendance}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
