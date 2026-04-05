'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Sparkles,
  X,
  TrendingUp,
  TrendingDown,
  Trophy,
  Flame,
  Users,
  Clock,
  UserPlus,
  CreditCard,
  ChevronRight,
  CheckCircle2,
  BarChart3,
  DollarSign,
  Percent,
  CalendarCheck,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
  LayoutDashboard,
  PackageOpen,
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
  AreaChart,
  Area,
} from 'recharts'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
type TimeRange = '7d' | '30d' | '90d' | '12m'
type HeatmapFilter = 'All' | 'Open' | 'Guided'

interface AIRecommendation {
  id: string
  icon: typeof Sparkles
  title: string
  summary: string
  action: string
  actionHref: string
  tag: string
  tagColor: string
}

interface KPIMetric {
  label: string
  value: string
  trend: number
  trendLabel: string
  href: string
  icon: typeof DollarSign
}

interface RevenueSource {
  name: string
  value: number
  color: string
}

interface MemberMovementRow {
  month: string
  new: number
  churned: number
  net: number
}

// ─── Constants ──────────────────────────────────────────────

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = ['5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM']

const RETENTION_PERIODS = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5']

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

// ─── Helpers ──────────────────────────────────────────────────

function getHeatmapColor(value: number): string {
  if (value === 0) return 'bg-gray-50 dark:bg-gray-900'
  if (value < 30) return 'bg-indigo-100'
  if (value < 50) return 'bg-indigo-200'
  if (value < 70) return 'bg-indigo-300'
  if (value < 85) return 'bg-indigo-400'
  return 'bg-indigo-600'
}

function getHeatmapTextColor(value: number): string {
  if (value >= 70) return 'text-white'
  if (value === 0) return 'text-gray-300'
  return 'text-gray-600 dark:text-gray-400'
}

function getRetentionColor(value: number): string {
  if (value === 0) return 'bg-gray-50 dark:bg-gray-900'
  if (value >= 90) return 'bg-emerald-500'
  if (value >= 80) return 'bg-emerald-400'
  if (value >= 70) return 'bg-emerald-300'
  if (value >= 60) return 'bg-yellow-300'
  return 'bg-orange-300'
}

function getRetentionTextColor(value: number): string {
  if (value === 0) return 'text-gray-300'
  if (value >= 80) return 'text-white'
  return 'text-gray-800 dark:text-gray-200'
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function getDateRange(range: TimeRange): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString().split('T')[0]!
  const start = new Date(now)
  switch (range) {
    case '7d': start.setDate(start.getDate() - 7); break
    case '30d': start.setDate(start.getDate() - 30); break
    case '90d': start.setDate(start.getDate() - 90); break
    case '12m': start.setFullYear(start.getFullYear() - 1); break
  }
  return { start: start.toISOString().split('T')[0]!, end }
}

// ─── Empty State Component ──────────────────────────────────

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

// ─── Custom Tooltip Components ──────────────────────────────

function RevenueTooltip({ active, payload, revenueTotal }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  const total = revenueTotal || 1
  const pct = ((value / total) * 100).toFixed(1)
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{name}</p>
      <p className="text-gray-600 dark:text-gray-400">
        {formatCurrency(value)}{' '}
        <span className="text-gray-400 dark:text-gray-500">({pct}%)</span>
      </p>
    </div>
  )
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

// ─── Page Component ──────────────────────────────────────────

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set())
  const [heatmapFilter, setHeatmapFilter] = useState<HeatmapFilter>('All')
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  // ─── Live data state ───────────────────────────────────────
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetric[]>([])
  const [kpiLoading, setKpiLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<RevenueSource[]>([])
  const [revenueTotal, setRevenueTotal] = useState(0)
  const [revenueLoading, setRevenueLoading] = useState(true)
  const [memberMovement, setMemberMovement] = useState<MemberMovementRow[]>([])
  const [movementLoading, setMovementLoading] = useState(true)
  const [heatmapData, setHeatmapData] = useState<number[][]>([])
  const [heatmapLoading, setHeatmapLoading] = useState(true)
  const [cohortMonths, setCohortMonths] = useState<string[]>([])
  const [cohortRetention, setCohortRetention] = useState<number[][]>([])
  const [cohortLoading, setCohortLoading] = useState(true)
  const [aiRecs, setAiRecs] = useState<AIRecommendation[]>([])
  const [aiRecsLoading, setAiRecsLoading] = useState(true)

  // ─── Fetch KPIs ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setKpiLoading(true)
    fetch('/api/analytics/summary')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        const raw = d.data
        const metrics: KPIMetric[] = [
          { label: 'MRR', value: formatCurrency(raw.mrr?.value ?? 0), trend: raw.mrr?.trend ?? 0, trendLabel: 'vs last period', href: '/revenue', icon: DollarSign },
          { label: 'ARPM', value: `$${(raw.arpm?.value ?? 0).toFixed(2)}`, trend: raw.arpm?.trend ?? 0, trendLabel: 'vs last period', href: '/revenue', icon: Activity },
          { label: 'Active Members', value: String(raw.active_members?.value ?? 0), trend: raw.active_members?.trend ?? 0, trendLabel: 'vs last period', href: '/members', icon: Users },
          { label: 'Monthly Churn', value: `${(raw.monthly_churn_rate?.value ?? 0).toFixed(1)}%`, trend: raw.monthly_churn_rate?.trend ?? 0, trendLabel: 'vs last period', href: '/members', icon: Percent },
          { label: 'Avg Fill Rate', value: `${Math.round(raw.avg_fill_rate?.value ?? 0)}%`, trend: raw.avg_fill_rate?.trend ?? 0, trendLabel: 'vs last period', href: '/schedule', icon: CalendarCheck },
          { label: 'Revenue MTD', value: formatCurrency(raw.revenue_mtd?.value ?? 0), trend: raw.revenue_mtd?.trend ?? 0, trendLabel: 'vs last period', href: '/revenue', icon: CreditCard },
        ]
        setKpiMetrics(metrics)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setKpiLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ─── Fetch Revenue Breakdown ───────────────────────────────
  useEffect(() => {
    let cancelled = false
    setRevenueLoading(true)
    const { start, end } = getDateRange(timeRange)
    fetch(`/api/analytics/revenue-breakdown?start_date=${start}&end_date=${end}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        const breakdown: RevenueSource[] = (d.data.breakdown ?? [])
          .filter((b: any) => b.total > 0)
          .map((b: any) => ({
            name: REVENUE_LABELS[b.source] ?? b.source,
            value: b.total,
            color: REVENUE_COLORS[b.source] ?? '#CBD5E1',
          }))
        setRevenueData(breakdown)
        setRevenueTotal(d.data.grand_total ?? 0)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRevenueLoading(false) })
    return () => { cancelled = true }
  }, [timeRange])

  // ─── Fetch Member Movement ─────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setMovementLoading(true)
    const { start, end } = getDateRange(timeRange)
    fetch(`/api/analytics/member-movement?start_date=${start}&end_date=${end}&group_by=month`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        const rows: MemberMovementRow[] = (d.data.periods ?? []).map((p: any) => {
          const label = p.period.length === 7
            ? new Date(p.period + '-01').toLocaleString('en-US', { month: 'short' })
            : p.period
          return {
            month: label,
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
  }, [timeRange])

  // ─── Fetch Heatmap ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setHeatmapLoading(true)
    const { start, end } = getDateRange(timeRange)
    const classTypeParam = heatmapFilter !== 'All' ? `&class_type=${heatmapFilter.toLowerCase()}` : ''
    fetch(`/api/analytics/heatmap?start_date=${start}&end_date=${end}${classTypeParam}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        // API returns array of { day_of_week, hour_of_day, avg_fill_rate }
        // Build 12x7 grid (hours 5-16, days Mon-Sun 1-7)
        const grid: number[][] = Array.from({ length: 12 }, () => Array(7).fill(0))
        for (const row of d.data) {
          const hourIdx = (row.hour_of_day ?? 5) - 5
          const dayIdx = (row.day_of_week ?? 1) - 1
          if (hourIdx >= 0 && hourIdx < 12 && dayIdx >= 0 && dayIdx < 7) {
            grid[hourIdx][dayIdx] = Math.round((row.avg_fill_rate ?? 0) * 100)
          }
        }
        setHeatmapData(grid)
      })
      .catch(() => { setHeatmapData([]) })
      .finally(() => { if (!cancelled) setHeatmapLoading(false) })
    return () => { cancelled = true }
  }, [timeRange, heatmapFilter])

  // ─── Fetch Cohorts ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setCohortLoading(true)
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

  // ─── Fetch AI Insights for recommendations ────────────────
  useEffect(() => {
    let cancelled = false
    setAiRecsLoading(true)
    fetch('/api/ai/insights?limit=3')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        const TAG_ICONS: Record<string, typeof Sparkles> = {
          scheduling: CalendarCheck,
          pricing: CreditCard,
          retention: Users,
          revenue: DollarSign,
          trainer: Trophy,
          growth: UserPlus,
          anomaly: Target,
        }
        const TAG_COLORS: Record<string, string> = {
          scheduling: 'bg-indigo-50 text-indigo-700',
          pricing: 'bg-amber-50 text-amber-700',
          retention: 'bg-violet-50 text-violet-700',
          revenue: 'bg-emerald-50 text-emerald-700',
          trainer: 'bg-teal-50 text-teal-700',
          growth: 'bg-blue-50 text-blue-700',
          anomaly: 'bg-red-50 text-red-700',
        }
        const recs: AIRecommendation[] = (d.data as any[]).map((insight) => ({
          id: insight.id,
          icon: TAG_ICONS[insight.type] ?? Sparkles,
          title: insight.title,
          summary: insight.summary,
          action: insight.action_label ?? 'View Details',
          actionHref: insight.action_link ?? '/analytics/insights',
          tag: insight.type ? insight.type.charAt(0).toUpperCase() + insight.type.slice(1) : 'Insight',
          tagColor: TAG_COLORS[insight.type] ?? 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300',
        }))
        setAiRecs(recs)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAiRecsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const visibleRecs = aiRecs.filter((r) => !dismissedRecs.has(r.id))

  const dismissRec = (id: string) => {
    setDismissedRecs((prev) => new Set(prev).add(id))
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header with Time Range ──────────────────── */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Performance insights and AI recommendations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-0.5">
              {TIME_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                    timeRange === range.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">Live</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </motion.div>

        {/* ─── KPI Strip ──────────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.03 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
        >
          {kpiLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <LoadingSkeleton className="h-3 w-16" />
                  <LoadingSkeleton className="h-3.5 w-3.5" />
                </div>
                <LoadingSkeleton className="h-8 w-20 mb-1" />
                <LoadingSkeleton className="h-3 w-14" />
              </div>
            ))
          ) : (
          kpiMetrics.map((metric) => {
            const Icon = metric.icon
            const isPositive = metric.label === 'Monthly Churn' ? metric.trend < 0 : metric.trend > 0
            return (
              <Link
                key={metric.label}
                href={metric.href}
                className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {metric.label}
                  </span>
                  <Icon className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>
                <p className="text-[28px] font-black tabular-nums text-gray-900 dark:text-gray-100 leading-none mb-1">
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
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{metric.trendLabel}</span>
                </div>
              </Link>
            )
          })
          )}
        </motion.div>

        {/* ─── AI Recommendations Strip ────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.06 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              AI Recommendations
            </span>
          </div>

          <AnimatePresence mode="wait">
            {aiRecsLoading ? (
              <motion.div key="loading" className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 rounded-2xl p-4">
                    <LoadingSkeleton className="h-4 w-24 mb-3" />
                    <LoadingSkeleton className="h-4 w-full mb-2" />
                    <LoadingSkeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </motion.div>
            ) : visibleRecs.length > 0 ? (
              <motion.div
                key="recs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-3"
              >
                {visibleRecs.map((rec, i) => {
                  const Icon = rec.icon
                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, x: -20 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 rounded-2xl p-4 group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white dark:bg-gray-950/80 flex items-center justify-center">
                            <Icon className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          <span
                            className={cn(
                              'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
                              rec.tagColor
                            )}
                          >
                            {rec.tag}
                          </span>
                        </div>
                        <button
                          onClick={() => dismissRec(rec.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white dark:bg-gray-950/50 rounded-lg flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        </button>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{rec.title}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">{rec.summary}</p>
                      <Link
                        href={rec.actionHref}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        {rec.action}
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </motion.div>
                  )
                })}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 rounded-2xl p-6 text-center"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">All caught up</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">No new recommendations right now</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ─── Main Grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Attendance Heatmap ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="lg:col-span-8 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Attendance Heatmap</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Fill rate by day and hour</p>
              </div>
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5">
                {(['All', 'Open', 'Guided'] as HeatmapFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setHeatmapFilter(f)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded-lg transition-all',
                      heatmapFilter === f
                        ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {heatmapLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <LoadingSkeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : heatmapData.length === 0 || heatmapData.every((row) => row.every((v) => v === 0)) ? (
              <EmptyState icon={BarChart3} message="No attendance data for this filter" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="w-16" />
                        {DAYS.map((day) => (
                          <th
                            key={day}
                            className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-2 text-center"
                          >
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HOURS.map((hour, rowIdx) => (
                        <tr key={hour}>
                          <td className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pr-2 py-0.5 text-right whitespace-nowrap">
                            {hour}
                          </td>
                          {DAYS.map((day, colIdx) => {
                            const val = heatmapData[rowIdx]?.[colIdx] ?? 0
                            const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx
                            return (
                              <td key={day} className="p-0.5">
                                <div
                                  onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                                  onMouseLeave={() => setHoveredCell(null)}
                                  className={cn(
                                    'relative rounded-md h-8 flex items-center justify-center transition-all cursor-default',
                                    getHeatmapColor(val),
                                    isHovered && val > 0 && 'ring-2 ring-indigo-600 ring-offset-1'
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'text-[10px] font-semibold tabular-nums',
                                      getHeatmapTextColor(val)
                                    )}
                                  >
                                    {val > 0 ? `${val}` : ''}
                                  </span>
                                  {isHovered && val > 0 && (
                                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap z-10">
                                      {day} {hour}: {val}% fill
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-900" />
                                    </div>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Fill Rate</span>
                  {[
                    { label: '<30%', color: 'bg-indigo-100' },
                    { label: '30-50%', color: 'bg-indigo-200' },
                    { label: '50-70%', color: 'bg-indigo-300' },
                    { label: '70-85%', color: 'bg-indigo-400' },
                    { label: '85%+', color: 'bg-indigo-600' },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={cn('w-3 h-3 rounded', color)} />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          {/* ─── Revenue by Source (Donut) ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="lg:col-span-4 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Revenue by Source</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Last 30 days</p>
            </div>

            {revenueLoading ? (
              <div className="space-y-3 py-4">
                <LoadingSkeleton className="h-[200px] w-full rounded-xl" />
                <LoadingSkeleton className="h-8 w-32" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <LoadingSkeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : revenueData.length === 0 ? (
              <EmptyState icon={DollarSign} message="No revenue data available" />
            ) : (
              <>
                <div className="w-full h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {revenueData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<RevenueTooltip revenueTotal={revenueTotal} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 mb-2">
                  <p className="text-[28px] font-black text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(revenueTotal)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total Revenue</p>
                </div>

                <div className="space-y-2">
                  {revenueData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{item.name}</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          {/* ─── Cohort Retention Heatmap ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.2 }}
            className="lg:col-span-7 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cohort Retention</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">% of members retained by signup month</p>
            </div>

            {cohortLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <LoadingSkeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : cohortRetention.length === 0 ? (
              <EmptyState icon={Users} message="No cohort data available yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-2 text-left pr-3">
                        Cohort
                      </th>
                      {RETENTION_PERIODS.map((period) => (
                        <th
                          key={period}
                          className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-2 text-center px-1"
                        >
                          {period}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohortMonths.map((month, rowIdx) => (
                      <tr key={month}>
                        <td className="text-xs font-semibold text-gray-700 dark:text-gray-300 pr-3 py-1">{month}</td>
                        {RETENTION_PERIODS.map((_, colIdx) => {
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

          {/* ─── Trainer Leaderboard ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.25 }}
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

            <TrainerLeaderboard />
          </motion.div>

          {/* ─── Member Movement Chart ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.3 }}
            className="lg:col-span-12 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Member Movement</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">New vs churned vs net members</p>
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
                      dataKey="month"
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
        </div>

        {/* ─── Quick Access ────────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.35 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <LayoutDashboard className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Quick Access
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/analytics/kpi"
              className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-3 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors">
                <TrendingUp className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">KPI Deep Dive</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">Revenue, attendance, and member trends with period comparison</p>
            </Link>
            <Link
              href="/analytics/dashboards"
              className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950 flex items-center justify-center mb-3 group-hover:bg-violet-100 dark:group-hover:bg-violet-900 transition-colors">
                <LayoutDashboard className="w-4.5 h-4.5 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Dashboards</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">Executive, growth, and operations dashboards</p>
            </Link>
            <Link
              href="/analytics/trainers"
              className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center mb-3 group-hover:bg-teal-100 dark:group-hover:bg-teal-900 transition-colors">
                <Trophy className="w-4.5 h-4.5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Trainer Performance</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">Individual metrics, bonus rates, and rankings</p>
            </Link>
            <Link
              href="/analytics/reports"
              className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mb-3 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900 transition-colors">
                <PackageOpen className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Reports</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">Scheduled and on-demand report library</p>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Trainer Leaderboard Sub-component ──────────────────────

function TrainerLeaderboard() {
  const [trainers, setTrainers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // Use the snapshot endpoint which includes trainer stats
    fetch('/api/analytics/snapshot')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.data?.trainers) {
          setTrainers(d.data.trainers.slice(0, 5))
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <LoadingSkeleton className="w-4 h-4" />
            <LoadingSkeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1">
              <LoadingSkeleton className="h-4 w-28 mb-1" />
              <LoadingSkeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (trainers.length === 0) {
    return <EmptyState icon={Trophy} message="No trainer data yet" />
  }

  return (
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
  )
}
