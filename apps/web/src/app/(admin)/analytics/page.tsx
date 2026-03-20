'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
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

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type HeatmapFilter = 'All' | 'Open' | 'Guided'

interface AIRecommendation {
  id: string
  text: string
  tag: string
  tagColor: string
}

// ─── Mock Data ──────────────────────────────────────────────

const AI_RECOMMENDATIONS: AIRecommendation[] = [
  {
    id: '1',
    text: 'Add Thursday 7pm Guided — Wednesday Guided at 92% 3 weeks straight',
    tag: 'Schedule',
    tagColor: 'bg-indigo-50 text-indigo-700',
  },
  {
    id: '2',
    text: 'Discontinue 5-Pack offering — only 2 purchases in 90 days',
    tag: 'Pricing',
    tagColor: 'bg-amber-50 text-amber-700',
  },
  {
    id: '3',
    text: "Offer first Guided free — 61 members haven't tried Guided yet",
    tag: 'Growth',
    tagColor: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: '4',
    text: 'Holiday promo window — Dec bookings historically drop 23%',
    tag: 'Revenue',
    tagColor: 'bg-orange-50 text-orange-700',
  },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIME_SLOTS = ['5–6 PM', '6–7 PM', '7–8 PM', '8–9 PM']

// Fill rates (%) by [timeSlotIndex][dayIndex]
const HEATMAP_ALL: number[][] = [
  [92, 75, 50, 33, 83, 85, 67], // 5-6
  [67, 100, 75, 42, 58, 75, 58], // 6-7
  [42, 58, 92, 25, 42, 50, 33], // 7-8
  [25, 33, 42, 17, 25, 33, 25], // 8-9
]

const HEATMAP_OPEN: number[][] = [
  [92, 75, 50, 33, 83, 85, 67],
  [50, 83, 58, 42, 58, 75, 58],
  [42, 58, 33, 25, 42, 50, 33],
  [25, 33, 42, 17, 25, 33, 25],
]

const HEATMAP_GUIDED: number[][] = [
  [0, 0, 0, 0, 0, 0, 0],
  [83, 0, 92, 0, 0, 0, 0],
  [0, 0, 92, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
]

const HEATMAP_DATA: Record<HeatmapFilter, number[][]> = {
  All: HEATMAP_ALL,
  Open: HEATMAP_OPEN,
  Guided: HEATMAP_GUIDED,
}

// Cohort retention data (% retained over months)
const COHORT_DATA = [
  { month: 'M0', Jan: 100, Feb: 100, Mar: 100, Apr: 100, May: 100 },
  { month: 'M1', Jan: 88, Feb: 85, Mar: 91, Apr: 87, May: 93 },
  { month: 'M2', Jan: 79, Feb: 74, Mar: 82, Apr: 78, May: 86 },
  { month: 'M3', Jan: 72, Feb: 68, Mar: 76, Apr: 71, May: 80 },
  { month: 'M4', Jan: 68, Feb: 63, Mar: 71, Apr: 66, May: 76 },
  { month: 'M5', Jan: 65, Feb: 59, Mar: 68, Apr: 62, May: 73 },
  { month: 'M6', Jan: 62, Feb: 56, Mar: 65, Apr: 59, May: 71 },
]

const COHORT_COLORS = [
  '#4F46E5', // indigo-600
  '#6366F1', // indigo-500
  '#818CF8', // indigo-400
  '#8B5CF6', // violet-500
  '#A78BFA', // violet-400
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
  {
    name: 'Whitney Cooper',
    avatar: 'WC',
    avgAttendance: 9.2,
    classesLed: 24,
    bonusHitRate: 83,
    revenueAttributed: 4850,
    isTop: true,
  },
  {
    name: 'Drennen Hall',
    avatar: 'DH',
    avgAttendance: 8.1,
    classesLed: 18,
    bonusHitRate: 67,
    revenueAttributed: 3200,
    isTop: false,
  },
  {
    name: 'Trent Bailey',
    avatar: 'TB',
    avgAttendance: 7.4,
    classesLed: 20,
    bonusHitRate: 55,
    revenueAttributed: 2900,
    isTop: false,
  },
]

// Trending insights
const TRENDING_INSIGHTS = [
  {
    icon: TrendingUp,
    text: 'Tuesday 6pm consistently fills first — consider premium pricing',
    accent: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  {
    icon: CreditCard,
    text: 'Credit pack purchases up 34% since sampler launch',
    accent: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Clock,
    text: 'Average session duration: 52 min (up from 45 min)',
    accent: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    icon: UserPlus,
    text: 'Referral rate: 1 in 4 members came from a friend',
    accent: 'text-amber-600',
    bg: 'bg-amber-50',
  },
]

// ─── Helpers ──────────────────────────────────────────────────

function getHeatmapColor(value: number): string {
  if (value === 0) return 'bg-gray-50'
  if (value < 30) return 'bg-gray-100'
  if (value < 60) return 'bg-indigo-200'
  if (value < 80) return 'bg-indigo-400'
  return 'bg-indigo-600'
}

function getHeatmapTextColor(value: number): string {
  if (value >= 80) return 'text-white'
  if (value >= 60) return 'text-white'
  return 'text-gray-600'
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ─── Custom Tooltip Components ──────────────────────────────

function CohortTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-gray-600">{entry.dataKey}:</span>
          <span className="font-semibold text-gray-900">{entry.value}%</span>
        </div>
      ))}
    </div>
  )
}

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

// ─── Page Component ──────────────────────────────────────────

export default function AnalyticsPage() {
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set())
  const [heatmapFilter, setHeatmapFilter] = useState<HeatmapFilter>('All')
  const [hoveredCell, setHoveredCell] = useState<{
    row: number
    col: number
  } | null>(null)

  const visibleRecs = AI_RECOMMENDATIONS.filter(
    (r) => !dismissedRecs.has(r.id)
  )

  const dismissRec = (id: string) => {
    setDismissedRecs((prev) => new Set(prev).add(id))
  }

  const heatmapData = HEATMAP_DATA[heatmapFilter]

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header ──────────────────────────────────── */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Performance insights and AI recommendations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Last updated 2 min ago</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </motion.div>

        {/* ─── AI Recommendations Strip ────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.05 }}
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
                className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
              >
                {visibleRecs.map((rec, i) => (
                  <motion.div
                    key={rec.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, x: -20 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                    className="ai-border min-w-[280px] max-w-[280px] rounded-2xl p-4 flex-shrink-0 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span
                          className={cn(
                            'inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2',
                            rec.tagColor
                          )}
                        >
                          {rec.tag}
                        </span>
                        <p className="text-sm text-gray-700 leading-snug">
                          {rec.text}
                        </p>
                      </div>
                      <button
                        onClick={() => dismissRec(rec.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded-lg flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="ai-border rounded-2xl p-6 text-center"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  All caught up
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  No new recommendations right now
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ─── Main Grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Heatmap ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Attendance Heatmap
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fill rate by day and time slot
                </p>
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

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="w-20" />
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
                  {TIME_SLOTS.map((slot, rowIdx) => (
                    <tr key={slot}>
                      <td className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-3 py-1 text-right whitespace-nowrap">
                        {slot}
                      </td>
                      {DAYS.map((day, colIdx) => {
                        const val = heatmapData[rowIdx][colIdx]
                        const isHovered =
                          hoveredCell?.row === rowIdx &&
                          hoveredCell?.col === colIdx
                        return (
                          <td key={day} className="p-1">
                            <div
                              onMouseEnter={() =>
                                setHoveredCell({ row: rowIdx, col: colIdx })
                              }
                              onMouseLeave={() => setHoveredCell(null)}
                              className={cn(
                                'relative rounded-lg h-12 flex items-center justify-center transition-all cursor-default',
                                getHeatmapColor(val),
                                isHovered && 'ring-2 ring-indigo-600 ring-offset-1'
                              )}
                            >
                              <span
                                className={cn(
                                  'text-xs font-semibold tabular-nums',
                                  getHeatmapTextColor(val)
                                )}
                              >
                                {val > 0 ? `${val}%` : '—'}
                              </span>
                              {isHovered && val > 0 && (
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap z-10">
                                  {day} {slot}: {val}% filled
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

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Fill Rate
              </span>
              {[
                { label: '<30%', color: 'bg-gray-100' },
                { label: '30–60%', color: 'bg-indigo-200' },
                { label: '60–80%', color: 'bg-indigo-400' },
                { label: '80%+', color: 'bg-indigo-600' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={cn('w-3 h-3 rounded', color)} />
                  <span className="text-[10px] text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ─── Revenue by Source (Donut) ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-gray-900">
                Revenue by Source
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Last 30 days
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-[200px] h-[200px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={REVENUE_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
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

              <div className="flex-1 space-y-2.5">
                <div className="mb-3">
                  <p className="text-[28px] font-black text-gray-900 tabular-nums">
                    {formatCurrency(REVENUE_TOTAL)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Total Revenue
                  </p>
                </div>
                {REVENUE_DATA.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: item.color }}
                    />
                    <span className="text-xs text-gray-600 flex-1 truncate">
                      {item.name}
                    </span>
                    <span className="text-xs font-semibold text-gray-900 tabular-nums">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ─── Cohort Retention Chart ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.2 }}
            className="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Cohort Retention
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Member retention by signup month over 7 months
              </p>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={COHORT_DATA}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#F3F4F6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
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
                  <Tooltip content={<CohortTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  />
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May'].map((cohort, i) => (
                    <Line
                      key={cohort}
                      type="monotone"
                      dataKey={cohort}
                      stroke={COHORT_COLORS[i]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: COHORT_COLORS[i], strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* ─── Trainer Leaderboard ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.25 }}
            className="lg:col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Trainer Leaderboard
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  This month&apos;s performance
                </p>
              </div>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>

            <div className="space-y-4">
              {TRAINERS.map((trainer, i) => (
                <div
                  key={trainer.name}
                  className={cn(
                    'rounded-xl p-3 transition-all',
                    trainer.isTop
                      ? 'bg-indigo-50 border border-indigo-100'
                      : 'bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                        trainer.isTop
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      )}
                    >
                      {trainer.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {trainer.name}
                      </p>
                      {trainer.isTop && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                          Top Performer
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-black text-gray-900 tabular-nums">
                      #{i + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Avg Attend.
                      </p>
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        {trainer.avgAttendance}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Classes Led
                      </p>
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        {trainer.classesLed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Bonus Hit
                      </p>
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        {trainer.bonusHitRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Revenue
                      </p>
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        {formatCurrency(trainer.revenueAttributed)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ─── Trending Insights ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.3 }}
            className="lg:col-span-12"
          >
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Trending Insights
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {TRENDING_INSIGHTS.map((insight, i) => {
                const Icon = insight.icon
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.35 + i * 0.05,
                      duration: 0.25,
                      ease: [0.25, 1, 0.5, 1],
                    }}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow group cursor-default"
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center mb-3',
                        insight.bg
                      )}
                    >
                      <Icon className={cn('w-4 h-4', insight.accent)} />
                    </div>
                    <p className="text-sm text-gray-700 leading-snug">
                      {insight.text}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
