'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
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
  Loader2,
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

// ─── Types ──────────────────────────────────────────────────
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

// ─── Supabase ──────────────────────────────────────────────
const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

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

function TrendIcon({ trend }: { trend: TrendDirection }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
    case 'down':
      return <TrendingDown className="w-3.5 h-3.5 text-red-500" />
    case 'flat':
      return <Minus className="w-3.5 h-3.5 text-gray-400" />
  }
}

// ─── Custom Tooltip ──────────────────────────────────────────
function PerfTooltip({ active, payload, label }: any) {
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
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold text-gray-900 tabular-nums">
            {entry.dataKey === 'fillRate' ? `${entry.value}%` : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────
export default function TrainerDetailPage() {
  const params = useParams()
  const trainerId = params?.id as string
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  const [TRAINER, setTrainer] = useState({ id: '', name: '', avatar: '', role: 'Trainer', classesPerWeek: 0, totalMembersServed: 0 })
  const [AI_NARRATIVE, setAiNarrative] = useState('')
  const [KPI_CARDS, setKpiCards] = useState<any[]>([])
  const [MONTHLY_PERFORMANCE, setMonthlyPerf] = useState<MonthlyPerformance[]>([])
  const [CLASS_BREAKDOWN, setClassBreakdown] = useState<ClassBreakdown[]>([])
  const [HIGHLIGHTS, setHighlights] = useState<string[]>([])
  const [GROWTH_AREAS, setGrowthAreas] = useState<string[]>([])
  const [PAYROLL, setPayroll] = useState({ basePay: 0, bonuses: 0, promoCommission: 0 })

  useEffect(() => {
    async function fetchTrainer() {
      const supabase = createBrowserClient()

      // Fetch trainer record joined with profile for name
      const { data: trainer } = await supabase
        .from('trainers')
        .select('*, profiles:profile_id ( full_name )')
        .eq('id', trainerId)
        .eq('studio_id', STUDIO_ID)
        .single()

      if (trainer) {
        const profile = trainer.profiles as any

        // Fetch latest metric snapshot for this trainer
        const { data: snapshots } = await supabase
          .from('trainer_metric_snapshots')
          .select('*')
          .eq('trainer_id', trainerId)
          .eq('studio_id', STUDIO_ID)
          .order('period_end', { ascending: false })
          .limit(6)

        const latestSnap = snapshots?.[0] ?? null
        const totalClasses = latestSnap?.total_classes ?? trainer.total_classes_led ?? 0
        const avgAtt = latestSnap?.avg_attendance ?? 0
        const bonusThresholdClasses = latestSnap?.classes_above_bonus_threshold ?? 0
        const bonusHitRate = totalClasses > 0 ? Math.round((bonusThresholdClasses / totalClasses) * 100) : 0
        const uniqueMembers = latestSnap?.unique_members_served ?? 0
        const repeatRate = latestSnap?.repeat_member_rate ?? 0

        setTrainer({
          id: trainer.id,
          name: profile?.full_name ?? 'Unknown',
          avatar: getInitials(profile?.full_name ?? 'U'),
          role: 'Trainer',
          classesPerWeek: totalClasses > 0 ? Math.round(totalClasses / 4) : 0,
          totalMembersServed: uniqueMembers,
        })

        setKpiCards([
          { label: 'Avg Attendance', value: String(Math.round(avgAtt * 10) / 10), change: '—', changeType: 'flat', icon: Users },
          { label: 'Bonus Hit Rate', value: `${bonusHitRate}%`, change: '—', changeType: 'flat', icon: Trophy },
          { label: 'Revenue Attributed', value: formatCurrency(latestSnap?.revenue_attributed ?? 0), change: '—', changeType: 'flat', icon: DollarSign },
          { label: 'Promo Conversions', value: String(latestSnap?.promo_code_conversions ?? 0), change: '—', changeType: 'flat', icon: Tag },
          { label: 'Repeat Member Rate', value: repeatRate > 0 ? `${Math.round(repeatRate * 100)}%` : '—', change: '—', changeType: 'flat', icon: Repeat },
        ])

        setPayroll({
          basePay: latestSnap?.base_pay ?? 0,
          bonuses: latestSnap?.bonus_pay ?? 0,
          promoCommission: latestSnap?.promo_commission ?? 0,
        })

        // AI narrative and highlights from latest snapshot
        if (latestSnap?.ai_narrative) {
          setAiNarrative(latestSnap.ai_narrative)
        }
        if (latestSnap?.ai_highlights && Array.isArray(latestSnap.ai_highlights)) {
          setHighlights(latestSnap.ai_highlights)
        }
        if (latestSnap?.ai_growth_areas && Array.isArray(latestSnap.ai_growth_areas)) {
          setGrowthAreas(latestSnap.ai_growth_areas)
        }

        // Build monthly performance from snapshots
        if (snapshots && snapshots.length > 0) {
          const monthly: MonthlyPerformance[] = snapshots
            .slice()
            .reverse()
            .map((s: any) => {
              const periodStart = new Date(s.period_start)
              const monthLabel = periodStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
              return {
                month: monthLabel,
                avgAttendance: Math.round((s.avg_attendance ?? 0) * 10) / 10,
                fillRate: Math.round((s.avg_capacity_utilization ?? 0) * 100),
              }
            })
          setMonthlyPerf(monthly)
        }
      }
      setLoading(false)
    }
    if (trainerId) fetchTrainer()
  }, [trainerId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!TRAINER.id) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] p-8">
        <Link href="/analytics/trainers" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" />Back to Trainers
        </Link>
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center shadow-sm">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-base font-semibold text-gray-900">Trainer not found</h3>
          <p className="mt-1 text-sm text-gray-500">This trainer profile may have been removed.</p>
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
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Back Link ───────────────────────────────── */}
        <motion.div {...fadeInUp}>
          <Link
            href="/analytics/trainers"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Trainer Performance
          </Link>
        </motion.div>

        {/* ─── Profile Header ──────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.03 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-xl font-black text-white">
              {TRAINER.avatar}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{TRAINER.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-indigo-100 text-indigo-700">
                  {TRAINER.role}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
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

        {/* ─── AI Narrative Card ───────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.06 }}
          className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                AI Performance Narrative
              </span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                isRefreshing
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-indigo-600 hover:bg-indigo-50'
              )}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            {AI_NARRATIVE}
          </p>
        </motion.div>

        {/* ─── KPI Cards ──────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {KPI_CARDS.map((kpi, i) => {
            const Icon = kpi.icon
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
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gray-500" />
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
                <p className="text-[28px] font-black text-gray-900 tabular-nums leading-none mb-1">
                  {kpi.value}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {kpi.label}
                </p>
              </motion.div>
            )
          })}
        </div>

        {/* ─── Performance Over Time ──────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Performance Over Time</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Avg attendance and fill rate — last 6 months
            </p>
          </div>

          {MONTHLY_PERFORMANCE.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No performance data yet</p>
              </div>
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={MONTHLY_PERFORMANCE}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#F3F4F6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    domain={[0, 12]}
                    label={{
                      value: 'Avg Attendance',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 10, fill: '#9CA3AF' },
                      offset: 10,
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    label={{
                      value: 'Fill Rate',
                      angle: 90,
                      position: 'insideRight',
                      style: { fontSize: 10, fill: '#9CA3AF' },
                      offset: 10,
                    }}
                  />
                  <Tooltip content={<PerfTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="avgAttendance"
                    name="Avg Attendance"
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#4F46E5', strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="fillRate"
                    name="Fill Rate"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    strokeDasharray="6 3"
                    dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* ─── Class Breakdown Table ──────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.25 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Class Breakdown</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Individual class performance for this trainer
            </p>
          </div>

          {CLASS_BREAKDOWN.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No classes assigned</h3>
              <p className="text-sm text-gray-500">This trainer has no classes in the current period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Class</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Day / Time</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Avg Attendance</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Fill Rate</th>
                    <th className="text-center px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {CLASS_BREAKDOWN.map((cls, i) => (
                    <tr
                      key={`${cls.name}-${cls.dayTime}`}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-semibold text-gray-900">{cls.name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-600">{cls.dayTime}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          {cls.avgAttendance}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                cls.fillRate >= 80 ? 'bg-indigo-600' :
                                cls.fillRate >= 60 ? 'bg-indigo-400' :
                                'bg-indigo-200'
                              )}
                              style={{ width: `${cls.fillRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-900 tabular-nums w-10 text-right">
                            {cls.fillRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center">
                          <TrendIcon trend={cls.trend} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* ─── Highlights & Growth Areas ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.3 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-gray-900">Highlights</h2>
            </div>
            {HIGHLIGHTS.length === 0 ? (
              <p className="text-sm text-gray-400">No highlights for this period.</p>
            ) : (
              <ul className="space-y-3">
                {HIGHLIGHTS.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700 leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>

          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.33 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900">Areas to Develop</h2>
            </div>
            {GROWTH_AREAS.length === 0 ? (
              <p className="text-sm text-gray-400">No growth areas identified.</p>
            ) : (
              <ul className="space-y-3">
                {GROWTH_AREAS.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700 leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </div>

        {/* ─── Payroll Summary ────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.36 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Payroll Summary</h2>
              <p className="text-xs text-gray-400 mt-0.5">Current period compensation breakdown</p>
            </div>
            <Link
              href="/operations"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              View Full Payroll Report
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Base Pay
              </p>
              <p className="text-lg font-black text-gray-900 tabular-nums">
                {formatCurrency(PAYROLL.basePay)}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Bonuses
              </p>
              <p className="text-lg font-black text-gray-900 tabular-nums">
                {formatCurrency(PAYROLL.bonuses)}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Promo Commission
              </p>
              <p className="text-lg font-black text-gray-900 tabular-nums">
                {formatCurrency(PAYROLL.promoCommission)}
              </p>
            </div>
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
                Total Compensation
              </p>
              <p className="text-lg font-black text-indigo-700 tabular-nums">
                {formatCurrency(totalCompensation)}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
