'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Loader2,
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
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

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

const STUDIO_ID = DEFAULT_STUDIO_ID

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

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
  const [TRAINERS, setTrainers] = useState<Trainer[]>([])
  const [COACH_NOTES, setCoachNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTrainers() {
      const supabase = createBrowserClient()

      // Query trainers joined with profiles for name, and get the latest metric snapshot
      const { data: trainers } = await supabase
        .from('trainers')
        .select('id, profile_id, total_classes_led, total_bonus_earned, total_commission_earned, promo_code, profiles:profile_id ( full_name )')
        .eq('studio_id', STUDIO_ID)

      if (trainers && trainers.length > 0) {
        // Fetch the most recent metric snapshot for each trainer
        const trainerIds = trainers.map((t: any) => t.id)
        const { data: snapshots } = await supabase
          .from('trainer_metric_snapshots')
          .select('trainer_id, total_classes, avg_attendance, avg_capacity_utilization, classes_above_bonus_threshold, promo_code_conversions, revenue_attributed')
          .in('trainer_id', trainerIds)
          .eq('studio_id', STUDIO_ID)
          .order('period_end', { ascending: false })

        // Build a map of trainer_id -> latest snapshot
        const snapshotMap: Record<string, any> = {}
        for (const s of (snapshots || [])) {
          if (!snapshotMap[s.trainer_id]) {
            snapshotMap[s.trainer_id] = s
          }
        }

        const mapped: Trainer[] = trainers.map((t: any) => {
          const profile = t.profiles as any
          const snap = snapshotMap[t.id]
          const totalClasses = snap?.total_classes ?? t.total_classes_led ?? 0
          const avgAtt = snap?.avg_attendance ?? 0
          const bonusThresholdClasses = snap?.classes_above_bonus_threshold ?? 0
          const bonusHitRate = totalClasses > 0 ? Math.round((bonusThresholdClasses / totalClasses) * 100) : 0

          return {
            id: t.id,
            name: profile?.full_name ?? 'Unknown',
            avatar: getInitials(profile?.full_name ?? 'U'),
            classesLed: totalClasses,
            avgAttendance: Math.round(avgAtt * 10) / 10,
            bonusHitRate,
            revenueAttributed: snap?.revenue_attributed ?? 0,
            promoConversions: snap?.promo_code_conversions ?? 0,
          }
        })
        mapped.sort((a, b) => b.avgAttendance - a.avgAttendance)
        setTrainers(mapped)
      }

      // AI notes would be generated server-side; empty for now
      setCoachNotes([])
      setLoading(false)
    }
    fetchTrainers()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

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
            {COACH_NOTES.length > 0 ? COACH_NOTES.map((note, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                {note}
              </p>
            )) : (
              <p className="text-sm text-gray-500 italic">AI coaching notes will appear here once trainers have class history.</p>
            )}
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
