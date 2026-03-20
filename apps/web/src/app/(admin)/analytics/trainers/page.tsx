'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Sparkles,
  Trophy,
  ChevronRight,
  ChevronDown,
  Users,
  Inbox,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type Period = 'this-month' | 'last-month' | 'last-3-months' | 'custom'
type CompareMetric = 'avgAttendance' | 'bonusHitRate' | 'classesLed'

interface Trainer {
  id: string
  name: string
  avatar: string
  classesLed: number
  avgAttendance: number
  bonusHitRate: number
  revenueAttributed: number
  promoConversions: number
}

// ─── Constants ──────────────────────────────────────────────
const PERIODS: { value: Period; label: string }[] = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'custom', label: 'Custom Range' },
]

const COMPARE_METRICS: { value: CompareMetric; label: string }[] = [
  { value: 'avgAttendance', label: 'Avg Attendance' },
  { value: 'bonusHitRate', label: 'Bonus Rate' },
  { value: 'classesLed', label: 'Classes Led' },
]

const BAR_COLORS = ['#4F46E5', '#6366F1', '#818CF8', '#A78BFA', '#C4B5FD']

// ─── Mock Data ──────────────────────────────────────────────
const COACH_NOTES = [
  'Whitney Cooper continues to dominate with the highest avg attendance and bonus hit rate on the team.',
  'Overall team attendance is trending up 6% compared to last month across all guided sessions.',
  'Consider pairing newer trainers with Whitney for shadow sessions to improve the team average.',
]

const TRAINERS: Trainer[] = [
  {
    id: 'whitney-cooper',
    name: 'Whitney Cooper',
    avatar: 'WC',
    classesLed: 24,
    avgAttendance: 9.2,
    bonusHitRate: 83,
    revenueAttributed: 4850,
    promoConversions: 14,
  },
  {
    id: 'drennen-hall',
    name: 'Drennen Hall',
    avatar: 'DH',
    classesLed: 18,
    avgAttendance: 8.1,
    bonusHitRate: 67,
    revenueAttributed: 3200,
    promoConversions: 9,
  },
  {
    id: 'trent-bailey',
    name: 'Trent Bailey',
    avatar: 'TB',
    classesLed: 20,
    avgAttendance: 7.4,
    bonusHitRate: 55,
    revenueAttributed: 2900,
    promoConversions: 7,
  },
  {
    id: 'maya-santos',
    name: 'Maya Santos',
    avatar: 'MS',
    classesLed: 12,
    avgAttendance: 7.8,
    bonusHitRate: 58,
    revenueAttributed: 2100,
    promoConversions: 5,
  },
  {
    id: 'jordan-reed',
    name: 'Jordan Reed',
    avatar: 'JR',
    classesLed: 8,
    avgAttendance: 6.5,
    bonusHitRate: 38,
    revenueAttributed: 1400,
    promoConversions: 3,
  },
]

// ─── Helpers ──────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function getMetricLabel(metric: CompareMetric): string {
  switch (metric) {
    case 'avgAttendance': return 'Avg Attendance'
    case 'bonusHitRate': return 'Bonus Hit Rate (%)'
    case 'classesLed': return 'Classes Led'
  }
}

function getMetricValue(trainer: Trainer, metric: CompareMetric): number {
  return trainer[metric]
}

// ─── Custom Tooltip ──────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 mb-0.5">{label}</p>
      <p className="text-gray-600 tabular-nums">{payload[0].value}</p>
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────
export default function TrainerPerformancePage() {
  const [period, setPeriod] = useState<Period>('this-month')
  const [compareMetric, setCompareMetric] = useState<CompareMetric>('avgAttendance')
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const [showMetricDropdown, setShowMetricDropdown] = useState(false)

  const chartData = TRAINERS.map((t) => ({
    name: t.name.split(' ')[0],
    value: getMetricValue(t, compareMetric),
    fullName: t.name,
  }))

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header ──────────────────────────────────── */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Trainer Performance</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Track and compare trainer metrics across your team
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors shadow-sm"
            >
              {PERIODS.find((p) => p.value === period)?.label}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showPeriodDropdown && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-20">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setPeriod(p.value)
                      setShowPeriodDropdown(false)
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm transition-colors',
                      period === p.value
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ─── AI Coach's Notes ──────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.05 }}
          className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              AI Coach&apos;s Notes
            </span>
          </div>
          <div className="space-y-2">
            {COACH_NOTES.map((note, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                {note}
              </p>
            ))}
          </div>
        </motion.div>

        {/* ─── Leaderboard Table ──────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900">Leaderboard</h2>
            </div>
            <span className="text-xs text-gray-400">{TRAINERS.length} trainers</span>
          </div>

          {TRAINERS.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No trainers yet</h3>
              <p className="text-sm text-gray-500">Add trainers in the Operations module to see performance data.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-12">#</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Trainer</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Classes Led</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Avg Attendance</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Bonus Hit Rate</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Revenue Attributed</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Promo Conversions</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {TRAINERS.map((trainer, i) => (
                    <Link
                      key={trainer.id}
                      href={`/analytics/trainers/${trainer.id}`}
                      className="contents"
                    >
                      <tr
                        className={cn(
                          'border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer group',
                          i === 0 && 'bg-amber-50/50 hover:bg-amber-50/80'
                        )}
                      >
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              'text-sm font-black tabular-nums',
                              i === 0 ? 'text-amber-600' : 'text-gray-400'
                            )}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                                i === 0
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-200 text-gray-600'
                              )}
                            >
                              {trainer.avatar}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {trainer.name}
                            </span>
                            {i === 0 && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                Top
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">
                            {trainer.classesLed}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">
                            {trainer.avgAttendance}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">
                            {trainer.bonusHitRate}%
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">
                            {formatCurrency(trainer.revenueAttributed)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">
                            {trainer.promoConversions}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </td>
                      </tr>
                    </Link>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* ─── Comparison Bar Chart ──────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Trainer Comparison</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Compare trainers by selected metric
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowMetricDropdown(!showMetricDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {COMPARE_METRICS.find((m) => m.value === compareMetric)?.label}
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showMetricDropdown && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-20">
                  {COMPARE_METRICS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => {
                        setCompareMetric(m.value)
                        setShowMetricDropdown(false)
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-xs transition-colors',
                        compareMetric === m.value
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {TRAINERS.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center">
              <p className="text-sm text-gray-400">No data to display</p>
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#F3F4F6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    label={{
                      value: getMetricLabel(compareMetric),
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 10, fill: '#9CA3AF' },
                      offset: 10,
                    }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
