'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  DollarSign,
  Activity,
  Users,
  Percent,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ChevronRight,
  CalendarCheck,
  UserPlus,
  BarChart3,
  TrendingUp,
  ArrowLeft,
} from 'lucide-react'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────

interface KPIMetric {
  label: string
  value: string
  trend: number
  href: string
  icon: typeof DollarSign
}

interface RevenueSource {
  name: string
  value: number
  color: string
}

// ─── Constants ──────────────────────────────────────────────

const REVENUE_COLORS: Record<string, string> = {
  memberships: '#4F46E5',
  credit_packs: '#6366F1',
  drop_ins: '#8B5CF6',
  merch: '#A78BFA',
  corporate: '#C4B5FD',
  gift_cards: '#DDD6FE',
  events: '#EDE9FE',
}

const REVENUE_LABELS: Record<string, string> = {
  memberships: 'Subscriptions',
  credit_packs: 'Credit Packs',
  drop_ins: 'Drop-ins',
  merch: 'Merch',
  corporate: 'Corporate',
  gift_cards: 'Gift Cards',
  events: 'Events',
}

const COHORT_MONTHS_LABELS = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5']

// ─── Helpers ──────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function getRetentionColor(value: number): string {
  if (value === 0) return 'bg-gray-50'
  if (value >= 90) return 'bg-emerald-500'
  if (value >= 80) return 'bg-emerald-400'
  if (value >= 70) return 'bg-emerald-300'
  if (value >= 60) return 'bg-yellow-300'
  return 'bg-orange-300'
}

function getRetentionTextColor(value: number): string {
  if (value === 0) return 'text-gray-300'
  if (value >= 80) return 'text-white'
  return 'text-gray-800'
}

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

function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 animate-pulse rounded', className)} />
}

function RevenueLineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900">{label}</p>
      <p className="text-gray-600">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

function RevenueDonutTooltip({ active, payload, revenueTotal }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  const total = revenueTotal || 1
  const pct = ((value / total) * 100).toFixed(1)
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900">{name}</p>
      <p className="text-gray-600">
        {formatCurrency(value)} <span className="text-gray-400">({pct}%)</span>
      </p>
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────

export default function ExecutiveDashboardPage() {
  // ─── State ─────────────────────────────────────────────────
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetric[]>([])
  const [kpiLoading, setKpiLoading] = useState(true)
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([])
  const [revenueChartLoading, setRevenueChartLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<RevenueSource[]>([])
  const [revenueTotal, setRevenueTotal] = useState(0)
  const [revenueLoading, setRevenueLoading] = useState(true)
  const [cohortMonths, setCohortMonths] = useState<string[]>([])
  const [cohortRetention, setCohortRetention] = useState<number[][]>([])
  const [cohortLoading, setCohortLoading] = useState(true)
  const [aiInsights, setAiInsights] = useState<any[]>([])
  const [aiLoading, setAiLoading] = useState(true)

  // ─── Fetch KPIs ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/analytics/summary')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        const raw = d.data
        const metrics: KPIMetric[] = [
          { label: 'MRR', value: formatCurrency(raw.mrr?.value ?? 0), trend: raw.mrr?.trend ?? 0, href: '/revenue', icon: DollarSign },
          { label: 'ARPM', value: `$${(raw.arpm?.value ?? 0).toFixed(2)}`, trend: raw.arpm?.trend ?? 0, href: '/revenue', icon: Activity },
          { label: 'Active Members', value: String(raw.active_members?.value ?? 0), trend: raw.active_members?.trend ?? 0, href: '/members', icon: Users },
          { label: 'Churn Rate', value: `${(raw.monthly_churn_rate?.value ?? 0).toFixed(1)}%`, trend: raw.monthly_churn_rate?.trend ?? 0, href: '/members', icon: Percent },
          { label: 'Revenue MTD', value: formatCurrency(raw.revenue_mtd?.value ?? 0), trend: raw.revenue_mtd?.trend ?? 0, href: '/revenue', icon: CreditCard },
        ]
        setKpiMetrics(metrics)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setKpiLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ─── Fetch Monthly Revenue (12 months) ─────────────────────
  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const end = now.toISOString().split('T')[0]!
    const start = new Date(now)
    start.setFullYear(start.getFullYear() - 1)
    const startStr = start.toISOString().split('T')[0]!
    fetch(`/api/analytics/revenue-breakdown?start_date=${startStr}&end_date=${end}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        // Group daily data by month
        const monthMap: Record<string, number> = {}
        for (const day of d.data.daily ?? []) {
          const monthKey = day.date?.slice(0, 7)
          if (monthKey) {
            monthMap[monthKey] = (monthMap[monthKey] ?? 0) + (day.total ?? 0)
          }
        }
        const sorted = Object.entries(monthMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => ({
            month: new Date(key + '-01').toLocaleString('en-US', { month: 'short' }),
            revenue: Math.round(value),
          }))
        setMonthlyRevenue(sorted)

        // Also use this for the donut
        const breakdown: RevenueSource[] = (d.data.breakdown ?? [])
          .filter((b: any) => b.total > 0)
          .map((b: any) => ({
            name: REVENUE_LABELS[b.source] ?? b.source,
            value: b.total,
            color: REVENUE_COLORS[b.source] ?? '#CBD5E1',
          }))
        setRevenueData(breakdown)
        setRevenueTotal(d.data.grand_total ?? 0)
        setRevenueLoading(false)
      })
      .catch(() => { setRevenueLoading(false) })
      .finally(() => { if (!cancelled) setRevenueChartLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ─── Fetch Cohorts ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/analytics/cohorts?months_back=6')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        const cohorts = d.data.cohorts ?? []
        const months: string[] = []
        const retention: number[][] = []
        for (const c of cohorts) {
          const label = new Date(c.cohort_month + '-01').toLocaleString('en-US', { month: 'short' })
          months.push(label)
          const row: number[] = []
          for (let i = 0; i < 6; i++) {
            const entry = (c.retention ?? []).find((r: any) => r.month === i)
            row.push(entry ? Math.round(entry.rate * 100) : 0)
          }
          retention.push(row)
        }
        setCohortMonths(months)
        setCohortRetention(retention)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCohortLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ─── Fetch AI Insights ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/ai/insights?limit=3')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        setAiInsights(d.data)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAiLoading(false) })
    return () => { cancelled = true }
  }, [])

  const AI_ICON_MAP: Record<string, typeof CalendarCheck> = {
    scheduling: CalendarCheck,
    pricing: CreditCard,
    growth: UserPlus,
    retention: Users,
    revenue: DollarSign,
    trainer: TrendingUp,
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Executive Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            High-level performance metrics and strategic insights
          </p>
        </motion.div>

        {/* ─── KPI Strip ──────────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.03 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {kpiLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <LoadingSkeleton className="h-3 w-16 mb-2" />
                <LoadingSkeleton className="h-8 w-20 mb-1" />
                <LoadingSkeleton className="h-3 w-14" />
              </div>
            ))
          ) : (
            kpiMetrics.map((metric) => {
              const Icon = metric.icon
              const isPositive = metric.label === 'Churn Rate' ? metric.trend < 0 : metric.trend > 0
              return (
                <Link
                  key={metric.label}
                  href={metric.href}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-indigo-200 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {metric.label}
                    </span>
                    <Icon className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none mb-1">
                    {metric.value}
                  </p>
                  <div className="flex items-center gap-1">
                    {isPositive ? (
                      <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-red-500" />
                    )}
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        isPositive ? 'text-emerald-600' : 'text-red-600'
                      )}
                    >
                      {Math.abs(metric.trend)}%
                    </span>
                  </div>
                </Link>
              )
            })
          )}
        </motion.div>

        {/* ─── Charts Row ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Revenue Trend */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.08 }}
            className="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Revenue Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Monthly revenue, last 12 months</p>
            </div>

            {revenueChartLoading ? (
              <LoadingSkeleton className="h-[300px] w-full rounded-xl" />
            ) : monthlyRevenue.length === 0 ? (
              <EmptyState icon={TrendingUp} message="No revenue trend data available" />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyRevenue} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      width={50}
                    />
                    <Tooltip content={<RevenueLineTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#4F46E5"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>

          {/* Revenue by Source Donut */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.12 }}
            className="lg:col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-gray-900">Revenue by Source</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 30 days</p>
            </div>

            {revenueLoading ? (
              <div className="space-y-3 py-4">
                <LoadingSkeleton className="h-[180px] w-full rounded-xl" />
                <LoadingSkeleton className="h-8 w-32" />
              </div>
            ) : revenueData.length === 0 ? (
              <EmptyState icon={DollarSign} message="No revenue data available" />
            ) : (
              <>
                <div className="w-full h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {revenueData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<RevenueDonutTooltip revenueTotal={revenueTotal} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 mb-3">
                  <p className="text-[28px] font-black text-gray-900 tabular-nums">{formatCurrency(revenueTotal)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</p>
                </div>

                <div className="space-y-1.5">
                  {revenueData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-xs text-gray-600 flex-1 truncate">{item.name}</span>
                      <span className="text-xs font-semibold text-gray-900 tabular-nums">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          {/* Cohort Retention Heatmap */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.16 }}
            className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Cohort Retention</h2>
              <p className="text-xs text-gray-400 mt-0.5">% of members retained by signup month</p>
            </div>

            {cohortLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <LoadingSkeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : cohortRetention.length === 0 ? (
              <EmptyState icon={Users} message="No cohort data available" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-2 text-left pr-3">
                        Cohort
                      </th>
                      {COHORT_MONTHS_LABELS.map((period) => (
                        <th
                          key={period}
                          className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-2 text-center px-1"
                        >
                          {period}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohortMonths.map((month, rowIdx) => (
                      <tr key={month}>
                        <td className="text-xs font-semibold text-gray-700 pr-3 py-1">{month}</td>
                        {COHORT_MONTHS_LABELS.map((_, colIdx) => {
                          const val = cohortRetention[rowIdx]?.[colIdx] ?? 0
                          return (
                            <td key={colIdx} className="p-0.5">
                              <div
                                className={cn(
                                  'rounded-lg h-10 flex items-center justify-center',
                                  getRetentionColor(val)
                                )}
                              >
                                <span
                                  className={cn(
                                    'text-xs font-semibold tabular-nums',
                                    getRetentionTextColor(val)
                                  )}
                                >
                                  {val > 0 ? `${val}%` : ''}
                                </span>
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

          {/* AI Insights */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.2 }}
            className="lg:col-span-5 space-y-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Top AI Insights
              </span>
            </div>

            {aiLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 rounded-2xl p-4">
                  <LoadingSkeleton className="h-4 w-32 mb-2" />
                  <LoadingSkeleton className="h-3 w-full mb-1" />
                  <LoadingSkeleton className="h-3 w-3/4" />
                </div>
              ))
            ) : aiInsights.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <EmptyState icon={Sparkles} message="No insights available right now" />
              </div>
            ) : (
              aiInsights.map((insight: any) => {
                const Icon = AI_ICON_MAP[insight.type] ?? CalendarCheck
                return (
                  <div
                    key={insight.id}
                    className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-white/80 flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">{insight.title}</h3>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-3">{insight.summary}</p>
                    <Link
                      href={insight.action_link ?? '/analytics/insights'}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      {insight.action_label ?? 'View Details'}
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )
              })
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
