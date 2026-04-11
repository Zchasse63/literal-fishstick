'use client'

import { useState, useEffect } from 'react'
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
} from 'recharts'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────

interface MemberMovementRow {
  date: string
  new: number
  churned: number
  net: number
}

interface AtRiskMember {
  name: string
  membership: string
  lastVisit: string
  riskScore: number
  trend: string
}

interface FunnelStage {
  stage: string
  count: number
  color: string
}

// ─── Helpers ──────────────────────────────────────────────────

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

function MovementTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-600 dark:text-gray-400 capitalize">{entry.dataKey}:</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{Math.abs(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

function getRiskBadge(score: number) {
  if (score >= 80) return { label: 'High', color: 'bg-red-50 text-red-600' }
  if (score >= 60) return { label: 'Medium', color: 'bg-amber-50 text-amber-600' }
  return { label: 'Low', color: 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400' }
}

// ─── Props ──────────────────────────────────────────────────

interface GrowthDashboardClientProps {
  initialAtRiskMembers: AtRiskMember[]
  initialFunnelData: FunnelStage[]
}

// ─── Component ──────────────────────────────────────────────

export function GrowthDashboardClient({
  initialAtRiskMembers,
  initialFunnelData,
}: GrowthDashboardClientProps) {
  // ─── State ─────────────────────────────────────────────────
  const [memberMovement, setMemberMovement] = useState<MemberMovementRow[]>([])
  const [movementLoading, setMovementLoading] = useState(true)
  const [cohortData, setCohortData] = useState<any[]>([])
  const [cohortLoading, setCohortLoading] = useState(true)
  const [atRiskMembers] = useState<AtRiskMember[]>(initialAtRiskMembers)
  const [funnelData] = useState<FunnelStage[]>(initialFunnelData)
  const [trainers, setTrainers] = useState<any[]>([])
  const [trainerLoading, setTrainerLoading] = useState(true)

  // ─── Fetch Member Movement (API route) ─────────────────────
  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const end = now.toISOString().split('T')[0]!
    const start = new Date(now)
    start.setDate(start.getDate() - 90)
    const startStr = start.toISOString().split('T')[0]!
    fetch(`/api/analytics/member-movement?start_date=${startStr}&end_date=${end}&group_by=week`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        const rows: MemberMovementRow[] = (d.data.periods ?? []).map((p: any) => {
          const dateObj = new Date(p.period + 'T00:00:00')
          const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return {
            date: label,
            new: p.new_members ?? 0,
            churned: -(p.churned_members ?? 0),
            net: p.net_change ?? 0,
          }
        })
        setMemberMovement(rows)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMovementLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ─── Fetch Cohort Comparison (API route) ───────────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/analytics/cohorts?months_back=6')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        const cohorts = d.data.cohorts ?? []
        const periods = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5']
        if (cohorts.length >= 2) {
          const latest = cohorts[cohorts.length - 1]
          const prev = cohorts[cohorts.length - 2]
          const latestLabel = new Date(latest.cohort_month + '-01').toLocaleString('en-US', { month: 'short' })
          const prevLabel = new Date(prev.cohort_month + '-01').toLocaleString('en-US', { month: 'short' })
          const chartData = periods.map((period, i) => {
            const latestEntry = (latest.retention ?? []).find((r: any) => r.month === i)
            const prevEntry = (prev.retention ?? []).find((r: any) => r.month === i)
            return {
              period,
              [`${latestLabel} Cohort`]: latestEntry ? Math.round(latestEntry.rate * 100) : 0,
              [`${prevLabel} Cohort`]: prevEntry ? Math.round(prevEntry.rate * 100) : 0,
            }
          })
          setCohortData(chartData)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCohortLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ─── Fetch Trainer Leaderboard (API route) ─────────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/analytics/snapshot')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.data?.trainers) {
          setTrainers(d.data.trainers.slice(0, 5))
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setTrainerLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ─── Derived values ────────────────────────────────────────
  const cohortKeys = cohortData.length > 0 ? Object.keys(cohortData[0]).filter(k => k !== 'period') : []

  return (
    <div data-testid="analytics-dashboards-growth-page-root" className="space-y-6">
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Growth & Retention</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Member trends, retention cohorts, at-risk members, and lead pipeline
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Member Movement Chart ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="lg:col-span-12 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Member Movement</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">New vs churned vs net members, last 90 days (weekly)</p>
            </div>

            {movementLoading ? (
              <LoadingSkeleton className="h-[280px] w-full rounded-xl" />
            ) : memberMovement.length === 0 ? (
              <EmptyState icon={Users} message="No member movement data available" />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={memberMovement} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
            className="lg:col-span-7 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cohort Retention Comparison</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Latest vs previous cohort</p>
            </div>

            {cohortLoading ? (
              <LoadingSkeleton className="h-[260px] w-full rounded-xl" />
            ) : cohortData.length === 0 ? (
              <EmptyState icon={Users} message="Not enough cohort data yet" />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cohortData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                          <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
                            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
                            {payload.map((entry: any) => (
                              <div key={entry.dataKey} className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                                <span className="text-gray-600 dark:text-gray-400">{entry.dataKey}:</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">{entry.value}%</span>
                              </div>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                    {cohortKeys[0] && (
                      <Area
                        type="monotone"
                        dataKey={cohortKeys[0]}
                        stroke="#4F46E5"
                        fill="#4F46E520"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
                      />
                    )}
                    {cohortKeys[1] && (
                      <Area
                        type="monotone"
                        dataKey={cohortKeys[1]}
                        stroke="#A78BFA"
                        fill="#A78BFA15"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={{ r: 3, fill: '#A78BFA', strokeWidth: 0 }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>

          {/* ─── Lead Pipeline Funnel ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.14 }}
            className="lg:col-span-5 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lead Pipeline</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Current funnel stages</p>
              </div>
              <Link
                href="/marketing/leads"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 transition-colors"
              >
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {funnelData.every((f) => f.count === 0) ? (
              <EmptyState icon={Target} message="No leads in pipeline" />
            ) : (
              <div className="space-y-3">
                {funnelData.map((stage, i) => {
                  const maxCount = Math.max(funnelData[0]?.count ?? 1, 1)
                  const width = Math.max((stage.count / maxCount) * 100, 15)
                  const conversionRate = i > 0 && funnelData[i - 1].count > 0
                    ? Math.round((stage.count / funnelData[i - 1].count) * 100)
                    : null
                  const StageIcon = i === 0 ? UserPlus : i === 1 ? Phone : i === 2 ? CalendarCheck : CheckCircle2
                  return (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <StageIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{stage.stage}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {conversionRate !== null && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{conversionRate}%</span>
                          )}
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{stage.count}</span>
                        </div>
                      </div>
                      <div className="w-full h-8 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
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
                {funnelData.length > 0 && funnelData[0].count > 0 && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Overall Conversion</span>
                      <span className="text-sm font-bold text-indigo-600 tabular-nums">
                        {Math.round((funnelData[funnelData.length - 1].count / funnelData[0].count) * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* ─── At-Risk Members ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.18 }}
            className="lg:col-span-7 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">At-Risk Members</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Top 10 by inactivity</p>
              </div>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>

            {atRiskMembers.length === 0 ? (
              <EmptyState icon={Users} message="No at-risk members detected" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-left">Member</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-left">Membership</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-left">Last Visit</th>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 text-center">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRiskMembers.map((member) => {
                      const badge = getRiskBadge(member.riskScore)
                      return (
                        <tr key={member.name} className="border-b border-gray-100 dark:border-gray-800/60 last:border-0">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                {member.name.split(' ').map((n) => n[0]).join('')}
                              </div>
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-xs text-gray-600 dark:text-gray-400">{member.membership}</td>
                          <td className="py-2.5 text-xs text-gray-500 dark:text-gray-400">{member.lastVisit}</td>
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
            className="lg:col-span-5 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Trainer Leaderboard</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Top 5 by avg attendance</p>
              </div>
              <Link
                href="/analytics/trainers"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 transition-colors"
              >
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {trainerLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <LoadingSkeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : trainers.length === 0 ? (
              <EmptyState icon={Trophy} message="No trainer data yet" />
            ) : (
              <div className="space-y-3">
                {trainers.map((trainer: any, i: number) => {
                  const initials = (trainer.name ?? '')
                    .split(' ')
                    .map((n: string) => n[0] ?? '')
                    .join('')
                    .toUpperCase()
                  const avg = trainer.avg_attendance ?? trainer.avgAttendance ?? 0
                  const classes = trainer.classes_led ?? trainer.classesLed ?? 0
                  const bonus = trainer.bonus_hit_rate ?? trainer.bonusHitRate ?? 0
                  return (
                    <div key={trainer.name ?? i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-300 w-4 tabular-nums">#{i + 1}</span>
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                          i === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        )}
                      >
                        {initials || '??'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{trainer.name}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {classes} classes &middot; {bonus}% bonus rate
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-16 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', i === 0 ? 'bg-indigo-600' : 'bg-indigo-300')}
                            style={{ width: `${(avg / 12) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100 w-8 text-right">
                          {typeof avg === 'number' ? avg.toFixed(1) : avg}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
