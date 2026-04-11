'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Sparkles,
  ArrowLeft,
  RefreshCw,
  Users,
  Trophy,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Repeat,
  Tag,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Calendar,
  Inbox,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { fadeInUp } from '@/lib/motion'

// --- Types ---
type TrendDirection = 'up' | 'down' | 'flat'

interface ClassBreakdown {
  name: string
  dayTime: string
  avgAttendance: number
  fillRate: number
  trend: TrendDirection
}

interface MonthlyPerformance {
  month: string
  avgAttendance: number
  fillRate: number
}

// --- Helpers ---
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function TrendIcon({ trend }: { trend: TrendDirection }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
    case 'down':
      return <TrendingDown className="w-3.5 h-3.5 text-red-500" />
    case 'flat':
      return <Minus className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
  }
}

function PerfTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
            {entry.dataKey === 'fillRate' ? `${entry.value}%` : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// --- Props ---
interface TrainerDetailClientProps {
  trainer: {
    id: string
    name: string
    avatar: string
    role: string
    classesPerWeek: number
    totalMembersServed: number
  } | null
  aiNarrative: string
  kpiCards: any[]
  monthlyPerformance: MonthlyPerformance[]
  classBreakdown: ClassBreakdown[]
  highlights: string[]
  growthAreas: string[]
  payroll: { basePay: number; bonuses: number; promoCommission: number }
}

export function TrainerDetailClient({
  trainer: TRAINER,
  aiNarrative: AI_NARRATIVE,
  kpiCards: KPI_CARDS,
  monthlyPerformance: MONTHLY_PERFORMANCE,
  classBreakdown: CLASS_BREAKDOWN,
  highlights: HIGHLIGHTS,
  growthAreas: GROWTH_AREAS,
  payroll: PAYROLL,
}: TrainerDetailClientProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  if (!TRAINER || !TRAINER.id) {
    return (
      <div data-testid="analytics-trainers-detail-not-found" className="space-y-6">
        <Link href="/analytics/trainers" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-6">
          <ArrowLeft className="h-4 w-4" />Back to Trainers
        </Link>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-16 text-center shadow-sm">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">Trainer not found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">This trainer profile may have been removed.</p>
        </div>
      </div>
    )
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 2000)
  }

  const totalCompensation = PAYROLL.basePay + PAYROLL.bonuses + PAYROLL.promoCommission

  return (
    <div data-testid="analytics-trainers-detail-root" className="space-y-6">
      <div className="space-y-6">
        {/* --- Back Link --- */}
        <motion.div {...fadeInUp}>
          <Link
            href="/analytics/trainers"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Trainer Performance
          </Link>
        </motion.div>

        {/* --- Profile Header --- */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.03 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-xl font-black text-white">
              {TRAINER.avatar}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{TRAINER.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-indigo-100 text-indigo-700">
                  {TRAINER.role}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {TRAINER.classesPerWeek} classes/week
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {TRAINER.totalMembersServed.toLocaleString()} total members served
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* --- AI Narrative Card --- */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.06 }}
          className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                AI Performance Narrative
              </span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                isRefreshing
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'text-indigo-600 hover:bg-indigo-50'
              )}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {AI_NARRATIVE}
          </p>
        </motion.div>

        {/* --- KPI Cards --- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {KPI_CARDS.map((kpi: any, i: number) => {
            const ICON_MAP: Record<string, any> = { Users, Trophy, DollarSign, Tag, Repeat }
            const Icon = ICON_MAP[kpi.iconName] ?? Users
            return (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.09 + i * 0.03,
                  duration: 0.25,
                  ease: [0.25, 1, 0.5, 1],
                }}
                className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </div>
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      kpi.changeType === 'up' ? 'text-emerald-600' : 'text-red-500'
                    )}
                  >
                    {kpi.change}
                  </span>
                </div>
                <p className="text-[28px] font-black text-gray-900 dark:text-gray-100 tabular-nums leading-none mb-1">
                  {kpi.value}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {kpi.label}
                </p>
              </motion.div>
            )
          })}
        </div>

        {/* --- Performance Over Time --- */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Performance Over Time</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Avg attendance and fill rate -- last 6 months
            </p>
          </div>

          {MONTHLY_PERFORMANCE.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-gray-500">No performance data yet</p>
              </div>
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={MONTHLY_PERFORMANCE}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={44} domain={[0, 12]} label={{ value: 'Avg Attendance', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#9CA3AF' }, offset: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={44} domain={[0, 100]} tickFormatter={(v) => `${v}%`} label={{ value: 'Fill Rate', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#9CA3AF' }, offset: 10 }} />
                  <Tooltip content={<PerfTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="avgAttendance" name="Avg Attendance" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4, fill: '#4F46E5', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                  <Line yAxisId="right" type="monotone" dataKey="fillRate" name="Fill Rate" stroke="#8B5CF6" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* --- Class Breakdown Table --- */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.25 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Class Breakdown</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Individual class performance for this trainer</p>
          </div>

          {CLASS_BREAKDOWN.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No classes assigned</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">This trainer has no classes in the current period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Class</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Day / Time</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Avg Attendance</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Fill Rate</th>
                    <th className="text-center px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {CLASS_BREAKDOWN.map((cls) => (
                    <tr key={`${cls.name}-${cls.dayTime}`} className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-5 py-3.5"><span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cls.name}</span></td>
                      <td className="px-5 py-3.5"><span className="text-sm text-gray-600 dark:text-gray-400">{cls.dayTime}</span></td>
                      <td className="px-5 py-3.5 text-right"><span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{cls.avgAttendance}</span></td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', cls.fillRate >= 80 ? 'bg-indigo-600' : cls.fillRate >= 60 ? 'bg-indigo-400' : 'bg-indigo-200')} style={{ width: `${cls.fillRate}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums w-10 text-right">{cls.fillRate}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center"><div className="flex items-center justify-center"><TrendIcon trend={cls.trend} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* --- Highlights & Growth Areas --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.3 }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Highlights</h2>
            </div>
            {HIGHLIGHTS.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No highlights for this period.</p>
            ) : (
              <ul className="space-y-3">
                {HIGHLIGHTS.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>

          <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.33 }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Areas to Develop</h2>
            </div>
            {GROWTH_AREAS.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No growth areas identified.</p>
            ) : (
              <ul className="space-y-3">
                {GROWTH_AREAS.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </div>

        {/* --- Payroll Summary --- */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.36 }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Payroll Summary</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Current period compensation breakdown</p>
            </div>
            <Link href="/operations" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
              View Full Payroll Report
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Base Pay</p>
              <p className="text-lg font-black text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(PAYROLL.basePay)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Bonuses</p>
              <p className="text-lg font-black text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(PAYROLL.bonuses)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Promo Commission</p>
              <p className="text-lg font-black text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(PAYROLL.promoCommission)}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">Total Compensation</p>
              <p className="text-lg font-black text-indigo-700 tabular-nums">{formatCurrency(totalCompensation)}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
