'use client'

import { useState } from 'react'
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

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

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

// ─── Mock Data ──────────────────────────────────────────────

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
]

const KPI_METRICS: KPIMetric[] = [
  { label: 'MRR', value: '$18,420', trend: 12.3, trendLabel: 'vs last period', href: '/revenue', icon: DollarSign },
  { label: 'ARPM', value: '$67.40', trend: 4.2, trendLabel: 'vs last period', href: '/revenue', icon: Activity },
  { label: 'Active Members', value: '273', trend: 8.1, trendLabel: 'vs last period', href: '/members', icon: Users },
  { label: 'Monthly Churn', value: '3.2%', trend: -1.4, trendLabel: 'vs last period', href: '/members', icon: Percent },
  { label: 'Avg Fill Rate', value: '71%', trend: 5.6, trendLabel: 'vs last period', href: '/schedule', icon: CalendarCheck },
  { label: 'Revenue MTD', value: '$24,850', trend: 9.7, trendLabel: 'vs last period', href: '/revenue', icon: CreditCard },
]

const AI_RECOMMENDATIONS: AIRecommendation[] = [
  {
    id: '1',
    icon: CalendarCheck,
    title: 'Add Thursday 7pm Guided',
    summary: 'Wednesday Guided at 92% fill rate for 3 consecutive weeks. Strong demand signal for an additional guided session.',
    action: 'View Schedule',
    actionHref: '/schedule',
    tag: 'Schedule',
    tagColor: 'bg-indigo-50 text-indigo-700',
  },
  {
    id: '2',
    icon: CreditCard,
    title: 'Discontinue 5-Pack',
    summary: 'Only 2 purchases in the last 90 days. Consider replacing with a 3-visit sampler pack at a lower price point.',
    action: 'View Pricing',
    actionHref: '/revenue',
    tag: 'Pricing',
    tagColor: 'bg-amber-50 text-amber-700',
  },
  {
    id: '3',
    icon: UserPlus,
    title: 'First Guided Free Campaign',
    summary: '61 active members have never tried a Guided class. A targeted email could drive trial and increase Guided fill rates.',
    action: 'Create Campaign',
    actionHref: '/marketing/campaigns/new',
    tag: 'Growth',
    tagColor: 'bg-emerald-50 text-emerald-700',
  },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = ['5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM']

// Fill rates (%) by [hourIndex][dayIndex] — 12 hours x 7 days
const HEATMAP_ALL: number[][] = [
  [20, 15, 10, 12, 18, 45, 50],
  [35, 30, 25, 28, 40, 65, 70],
  [55, 50, 45, 48, 60, 80, 85],
  [70, 65, 60, 58, 72, 90, 92],
  [85, 80, 75, 70, 88, 95, 90],
  [92, 88, 82, 75, 90, 85, 80],
  [88, 85, 80, 72, 85, 75, 70],
  [80, 78, 75, 68, 80, 70, 65],
  [65, 60, 58, 55, 68, 60, 55],
  [50, 48, 45, 42, 55, 50, 45],
  [35, 33, 30, 28, 40, 38, 35],
  [25, 22, 20, 18, 30, 28, 25],
]

const HEATMAP_OPEN: number[][] = [
  [20, 15, 10, 12, 18, 45, 50],
  [30, 25, 20, 25, 35, 60, 65],
  [50, 45, 40, 42, 55, 75, 80],
  [65, 60, 55, 52, 68, 85, 88],
  [80, 75, 70, 65, 82, 90, 85],
  [88, 82, 78, 70, 85, 80, 75],
  [82, 80, 75, 68, 80, 70, 65],
  [75, 72, 70, 62, 75, 65, 60],
  [60, 55, 52, 50, 62, 55, 50],
  [45, 42, 40, 38, 50, 45, 40],
  [30, 28, 25, 22, 35, 33, 30],
  [20, 18, 15, 14, 25, 22, 20],
]

const HEATMAP_GUIDED: number[][] = [
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 92, 0],
  [0, 0, 0, 0, 0, 85, 90],
  [0, 0, 92, 0, 0, 0, 0],
  [83, 0, 92, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
]

const HEATMAP_DATA: Record<HeatmapFilter, number[][]> = {
  All: HEATMAP_ALL,
  Open: HEATMAP_OPEN,
  Guided: HEATMAP_GUIDED,
}

// Cohort retention heatmap data
const COHORT_MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
const RETENTION_PERIODS = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5']
const COHORT_RETENTION: number[][] = [
  [100, 88, 79, 72, 68, 65],
  [100, 85, 74, 68, 63, 0],
  [100, 91, 82, 76, 0, 0],
  [100, 87, 78, 0, 0, 0],
  [100, 93, 0, 0, 0, 0],
  [100, 0, 0, 0, 0, 0],
]

// Revenue by source
const REVENUE_DATA = [
  { name: 'Subscriptions', value: 18400, color: '#4F46E5' },
  { name: 'Credit Packs', value: 4200, color: '#6366F1' },
  { name: 'Drop-ins', value: 2800, color: '#8B5CF6' },
  { name: 'Merch', value: 1600, color: '#A78BFA' },
  { name: 'Corporate', value: 3200, color: '#C4B5FD' },
  { name: 'Gift Cards', value: 950, color: '#DDD6FE' },
]

const REVENUE_TOTAL = REVENUE_DATA.reduce((sum, d) => sum + d.value, 0)

// Trainer leaderboard
const TRAINERS = [
  { name: 'Whitney Cooper', avatar: 'WC', avgAttendance: 9.2, classesLed: 24, bonusHitRate: 83, maxAttendance: 12 },
  { name: 'Drennen Hall', avatar: 'DH', avgAttendance: 8.1, classesLed: 18, bonusHitRate: 67, maxAttendance: 12 },
  { name: 'Trent Bailey', avatar: 'TB', avgAttendance: 7.4, classesLed: 20, bonusHitRate: 55, maxAttendance: 12 },
  { name: 'Sara Voss', avatar: 'SV', avgAttendance: 6.8, classesLed: 16, bonusHitRate: 44, maxAttendance: 12 },
  { name: 'Jake Monroe', avatar: 'JM', avgAttendance: 6.2, classesLed: 14, bonusHitRate: 36, maxAttendance: 12 },
]

// Member movement data
const MEMBER_MOVEMENT = [
  { month: 'Oct', new: 32, churned: -8, net: 24 },
  { month: 'Nov', new: 28, churned: -11, net: 17 },
  { month: 'Dec', new: 18, churned: -14, net: 4 },
  { month: 'Jan', new: 45, churned: -9, net: 36 },
  { month: 'Feb', new: 38, churned: -7, net: 31 },
  { month: 'Mar', new: 41, churned: -6, net: 35 },
]

// ─── Helpers ──────────────────────────────────────────────────

function getHeatmapColor(value: number): string {
  if (value === 0) return 'bg-gray-50'
  if (value < 30) return 'bg-indigo-100'
  if (value < 50) return 'bg-indigo-200'
  if (value < 70) return 'bg-indigo-300'
  if (value < 85) return 'bg-indigo-400'
  return 'bg-indigo-600'
}

function getHeatmapTextColor(value: number): string {
  if (value >= 70) return 'text-white'
  if (value === 0) return 'text-gray-300'
  return 'text-gray-600'
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ─── Empty State Component ──────────────────────────────────

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

// ─── Custom Tooltip Components ──────────────────────────────

function RevenueTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  const pct = ((value / REVENUE_TOTAL) * 100).toFixed(1)
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900">{name}</p>
      <p className="text-gray-600">
        {formatCurrency(value)}{' '}
        <span className="text-gray-400">({pct}%)</span>
      </p>
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

// ─── Page Component ──────────────────────────────────────────

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set())
  const [heatmapFilter, setHeatmapFilter] = useState<HeatmapFilter>('All')
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  const visibleRecs = AI_RECOMMENDATIONS.filter((r) => !dismissedRecs.has(r.id))

  const dismissRec = (id: string) => {
    setDismissedRecs((prev) => new Set(prev).add(id))
  }

  const heatmapData = HEATMAP_DATA[heatmapFilter]

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header with Time Range ──────────────────── */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Performance insights and AI recommendations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-xl border border-gray-200 p-0.5">
              {TIME_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                    timeRange === range.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Live</span>
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
          {KPI_METRICS.map((metric) => {
            const Icon = metric.icon
            const isPositive = metric.label === 'Monthly Churn' ? metric.trend < 0 : metric.trend > 0
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
                  <span className="text-[10px] text-gray-400">{metric.trendLabel}</span>
                </div>
              </Link>
            )
          })}
        </motion.div>

        {/* ─── AI Recommendations Strip ────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.06 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              AI Recommendations
            </span>
          </div>

          <AnimatePresence mode="wait">
            {visibleRecs.length > 0 ? (
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
                          <div className="w-7 h-7 rounded-lg bg-white/80 flex items-center justify-center">
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
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/50 rounded-lg flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{rec.title}</h3>
                      <p className="text-xs text-gray-600 leading-relaxed mb-3">{rec.summary}</p>
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
                <p className="text-sm font-medium text-gray-700">All caught up</p>
                <p className="text-xs text-gray-400 mt-0.5">No new recommendations right now</p>
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
            className="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Attendance Heatmap</h2>
                <p className="text-xs text-gray-400 mt-0.5">Fill rate by day and hour</p>
              </div>
              <div className="flex bg-gray-100 rounded-xl p-0.5">
                {(['All', 'Open', 'Guided'] as HeatmapFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setHeatmapFilter(f)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded-lg transition-all',
                      heatmapFilter === f
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {heatmapData.every((row) => row.every((v) => v === 0)) ? (
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
                            className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-2 text-center"
                          >
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HOURS.map((hour, rowIdx) => (
                        <tr key={hour}>
                          <td className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-2 py-0.5 text-right whitespace-nowrap">
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

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fill Rate</span>
                  {[
                    { label: '<30%', color: 'bg-indigo-100' },
                    { label: '30-50%', color: 'bg-indigo-200' },
                    { label: '50-70%', color: 'bg-indigo-300' },
                    { label: '70-85%', color: 'bg-indigo-400' },
                    { label: '85%+', color: 'bg-indigo-600' },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={cn('w-3 h-3 rounded', color)} />
                      <span className="text-[10px] text-gray-500">{label}</span>
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
            className="lg:col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-gray-900">Revenue by Source</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 30 days</p>
            </div>

            {REVENUE_DATA.length === 0 ? (
              <EmptyState icon={DollarSign} message="No revenue data available" />
            ) : (
              <>
                <div className="w-full h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={REVENUE_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {REVENUE_DATA.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<RevenueTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 mb-2">
                  <p className="text-[28px] font-black text-gray-900 tabular-nums">{formatCurrency(REVENUE_TOTAL)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Revenue</p>
                </div>

                <div className="space-y-2">
                  {REVENUE_DATA.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
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

          {/* ─── Cohort Retention Heatmap ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.2 }}
            className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Cohort Retention</h2>
              <p className="text-xs text-gray-400 mt-0.5">% of members retained by signup month</p>
            </div>

            {COHORT_RETENTION.length === 0 ? (
              <EmptyState icon={Users} message="No cohort data available yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-2 text-left pr-3">
                        Cohort
                      </th>
                      {RETENTION_PERIODS.map((period) => (
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
                    {COHORT_MONTHS.map((month, rowIdx) => (
                      <tr key={month}>
                        <td className="text-xs font-semibold text-gray-700 pr-3 py-1">{month}</td>
                        {RETENTION_PERIODS.map((_, colIdx) => {
                          const val = COHORT_RETENTION[rowIdx][colIdx]
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

          {/* ─── Member Movement Chart ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.3 }}
            className="lg:col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Member Movement</h2>
              <p className="text-xs text-gray-400 mt-0.5">New vs churned vs net members</p>
            </div>

            {MEMBER_MOVEMENT.length === 0 ? (
              <EmptyState icon={Users} message="No member movement data available" />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MEMBER_MOVEMENT} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
      </div>
    </div>
  )
}
