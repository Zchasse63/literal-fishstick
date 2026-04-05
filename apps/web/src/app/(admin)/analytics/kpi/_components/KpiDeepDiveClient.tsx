'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { fadeInUp } from '@/lib/motion'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  CalendarCheck,
  UserPlus,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

// ─── Types ──────────────────────────────────────────────────

type PeriodFilter = 'all' | '12m' | 'takeover'

interface InitialSummary {
  current: { revenue: number; attendance: number; newMembers: number }
  baselineMonthly: { revenue: number; attendance: number; newMembers: number }
  takeoverDate: string
  baselineStart: string
}

interface MonthlyRevenue {
  month: string
  revenue: number
  isCurrent: boolean
}

interface MonthlyAttendance {
  month: string
  attended: number
  isCurrent: boolean
}

interface MonthlySignups {
  month: string
  signups: number
  isCurrent: boolean
}

interface MonthlyRevenuePerVisit {
  month: string
  rpv: number
  isCurrent: boolean
}

interface MonthlyNewReturning {
  month: string
  newMembers: number
  returning: number
  isCurrent: boolean
}

interface StatusCount {
  status: string
  count: number
}

// ─── Constants ──────────────────────────────────────────────

const TAKEOVER_MONTH = '2026-03'

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: '12m', label: 'Last 12 Months' },
  { value: 'takeover', label: 'Since Takeover (Mar 2026)' },
]

const STATUS_ORDER = [
  'subscriber',
  'active',
  'engaged',
  'cooling',
  'at_risk',
  'lapsed_with_credits',
  'lapsed',
  'churned',
  'new_unused',
  'lead_only',
]

const STATUS_LABELS: Record<string, string> = {
  subscriber: 'Subscriber',
  active: 'Active',
  engaged: 'Engaged',
  cooling: 'Cooling',
  at_risk: 'At Risk',
  lapsed_with_credits: 'Lapsed (Credits)',
  lapsed: 'Lapsed',
  churned: 'Churned',
  new_unused: 'New (Unused)',
  lead_only: 'Lead Only',
}

const STATUS_COLORS: Record<string, string> = {
  subscriber: '#A855F7',
  active: '#22C55E',
  engaged: '#3B82F6',
  cooling: '#EAB308',
  at_risk: '#F97316',
  lapsed_with_credits: '#EF4444',
  lapsed: '#6B7280',
  churned: '#1F2937',
  new_unused: '#0EA5E9',
  lead_only: '#94A3B8',
}

// ─── Helpers ────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${Math.round(value)}`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m!, 10) - 1]} ${y!.slice(2)}`
}

// ─── Loading Skeleton ───────────────────────────────────────

function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 dark:bg-gray-800 animate-pulse rounded', className)} />
}

// ─── Custom Tooltips ────────────────────────────────────────

function RevenueBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      <p className="text-gray-600 dark:text-gray-400">
        Revenue: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(payload[0].value)}</span>
      </p>
    </div>
  )
}

function AttendanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      <p className="text-gray-600 dark:text-gray-400">
        Check-ins: <span className="font-semibold text-gray-900 dark:text-gray-100">{payload[0].value}</span>
      </p>
    </div>
  )
}

function SignupsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      <p className="text-gray-600 dark:text-gray-400">
        New Members: <span className="font-semibold text-gray-900 dark:text-gray-100">{payload[0].value}</span>
      </p>
    </div>
  )
}

function RpvTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      <p className="text-gray-600 dark:text-gray-400">
        Revenue/Visit: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(payload[0].value)}</span>
      </p>
    </div>
  )
}

function NewReturningTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-gray-600 dark:text-gray-400">
          {p.dataKey === 'newMembers' ? 'New' : 'Returning'}:{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function FunnelTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { status, count } = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{STATUS_LABELS[status] ?? status}</p>
      <p className="text-gray-600 dark:text-gray-400">
        Count: <span className="font-semibold text-gray-900 dark:text-gray-100">{count}</span>
      </p>
    </div>
  )
}

// ─── Chart Section Wrapper ──────────────────────────────────

function ChartSection({
  title,
  subtitle,
  children,
  delay = 0,
  className,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      {...fadeInUp}
      transition={{ ...fadeInUp.transition, delay }}
      className={cn(
        'bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5',
        className
      )}
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </motion.div>
  )
}

// ─── Summary Cards ──────────────────────────────────────────

function SummaryCard({
  label,
  currentValue,
  baselineValue,
  format,
  icon: Icon,
}: {
  label: string
  currentValue: number
  baselineValue: number
  format: 'currency' | 'number'
  icon: typeof DollarSign
}) {
  const delta = baselineValue > 0 ? ((currentValue - baselineValue) / baselineValue) * 100 : 0
  const isPositive = delta > 0
  const formatted = format === 'currency' ? formatCurrency(currentValue) : currentValue.toLocaleString()
  const baseFormatted = format === 'currency' ? formatCurrency(Math.round(baselineValue)) : Math.round(baselineValue).toLocaleString()

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {label}
        </span>
        <Icon className="w-3.5 h-3.5 text-gray-300" />
      </div>
      <p className="text-[28px] font-black tabular-nums text-gray-900 dark:text-gray-100 leading-none mb-1">
        {formatted}
      </p>
      <div className="flex items-center gap-2">
        {baselineValue > 0 ? (
          <>
            <div className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span className={cn('text-xs font-semibold tabular-nums', isPositive ? 'text-emerald-600' : 'text-red-600')}>
                {isPositive ? '+' : ''}{delta.toFixed(1)}%
              </span>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              vs baseline avg {baseFormatted}/mo
            </span>
          </>
        ) : (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Since Mar 2026</span>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function KpiDeepDiveClient({ initialSummary }: { initialSummary: InitialSummary }) {
  const supabase = useRef(createBrowserClient()).current
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [loading, setLoading] = useState(true)

  // Data states
  const [revenueData, setRevenueData] = useState<MonthlyRevenue[]>([])
  const [attendanceData, setAttendanceData] = useState<MonthlyAttendance[]>([])
  const [signupsData, setSignupsData] = useState<MonthlySignups[]>([])
  const [rpvData, setRpvData] = useState<MonthlyRevenuePerVisit[]>([])
  const [newReturningData, setNewReturningData] = useState<MonthlyNewReturning[]>([])
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([])

  // ── Fetch all data on mount ─────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      setLoading(true)

      try {
        // 1. Revenue by month from transactions
        const { data: txnRows } = await supabase
          .from('transactions')
          .select('created_at, amount')

        const revenueByMonth: Record<string, number> = {}
        if (txnRows) {
          for (const row of txnRows) {
            const d = new Date(row.created_at)
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const amt = Number(row.amount ?? 0)
            if (amt > 0) {
              revenueByMonth[ym] = (revenueByMonth[ym] ?? 0) + amt / 100.0
            }
          }
        }

        // 2. Attendance by month from bookings + classes
        const { data: bookingRows } = await supabase
          .from('bookings')
          .select('status, class_id, classes:class_id ( starts_at )')

        const attendanceByMonth: Record<string, number> = {}

        if (bookingRows) {
          for (const row of bookingRows as any[]) {
            const status = row.status as string
            if (status === 'cancelled' || status === 'late_cancelled') continue
            const startsAt = row.classes?.starts_at
            if (!startsAt) continue
            const d = new Date(startsAt)
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            attendanceByMonth[ym] = (attendanceByMonth[ym] ?? 0) + 1
          }
        }

        // 3. Signups by month from members
        const { data: memberRows } = await supabase
          .from('members')
          .select('join_date')

        const signupsByMonth: Record<string, number> = {}
        if (memberRows) {
          for (const row of memberRows) {
            if (!row.join_date) continue
            const d = new Date(row.join_date)
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            signupsByMonth[ym] = (signupsByMonth[ym] ?? 0) + 1
          }
        }

        // 4. New vs returning members per month
        // Fetch bookings with member_id for new/returning calculation
        const { data: bookingsWithMember } = await supabase
          .from('bookings')
          .select('member_id, status, class_id, classes:class_id ( starts_at )')

        const memberFirstMonth: Record<string, string> = {}
        const memberBookingsByMonth: Record<string, Set<string>> = {}

        if (bookingsWithMember) {
          // First pass: find each member's first booking month
          for (const row of bookingsWithMember as any[]) {
            const status = row.status as string
            if (status === 'cancelled' || status === 'late_cancelled') continue
            const memberId = row.member_id
            if (!memberId) continue
            const startsAt = row.classes?.starts_at
            if (!startsAt) continue
            const d = new Date(startsAt)
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

            if (!memberFirstMonth[memberId] || ym < memberFirstMonth[memberId]!) {
              memberFirstMonth[memberId] = ym
            }

            if (!memberBookingsByMonth[ym]) memberBookingsByMonth[ym] = new Set()
            memberBookingsByMonth[ym]!.add(memberId)
          }
        }

        // Second pass: classify each month's unique members as new or returning
        const newReturningByMonth: Record<string, { newMembers: number; returning: number }> = {}
        for (const [ym, memberSet] of Object.entries(memberBookingsByMonth)) {
          let newCount = 0
          let returningCount = 0
          for (const memberId of memberSet) {
            if (memberFirstMonth[memberId] === ym) {
              newCount++
            } else {
              returningCount++
            }
          }
          newReturningByMonth[ym] = { newMembers: newCount, returning: returningCount }
        }

        // 5. Member status funnel from member_360
        const { data: m360Rows } = await supabase
          .from('member_360')
          .select('engagement_status')

        const statusMap: Record<string, number> = {}
        if (m360Rows) {
          for (const row of m360Rows as any[]) {
            const s = row.engagement_status as string
            if (s) {
              statusMap[s] = (statusMap[s] ?? 0) + 1
            }
          }
        }

        if (cancelled) return

        // ── Build sorted arrays ───────────────────────────
        const allMonths = new Set([
          ...Object.keys(revenueByMonth),
          ...Object.keys(attendanceByMonth),
          ...Object.keys(signupsByMonth),
          ...Object.keys(newReturningByMonth),
        ])
        const sortedMonths = Array.from(allMonths).sort()

        setRevenueData(
          sortedMonths.map((m) => ({
            month: monthLabel(m),
            revenue: revenueByMonth[m] ?? 0,
            isCurrent: m >= TAKEOVER_MONTH,
          }))
        )

        setAttendanceData(
          sortedMonths.map((m) => ({
            month: monthLabel(m),
            attended: attendanceByMonth[m] ?? 0,
            isCurrent: m >= TAKEOVER_MONTH,
          }))
        )

        setSignupsData(
          sortedMonths.map((m) => ({
            month: monthLabel(m),
            signups: signupsByMonth[m] ?? 0,
            isCurrent: m >= TAKEOVER_MONTH,
          }))
        )

        setRpvData(
          sortedMonths.map((m) => {
            const rev = revenueByMonth[m] ?? 0
            const att = attendanceByMonth[m] ?? 0
            return {
              month: monthLabel(m),
              rpv: att > 0 ? Math.round((rev / att) * 100) / 100 : 0,
              isCurrent: m >= TAKEOVER_MONTH,
            }
          })
        )

        setNewReturningData(
          sortedMonths.map((m) => {
            const nr = newReturningByMonth[m] ?? { newMembers: 0, returning: 0 }
            return {
              month: monthLabel(m),
              newMembers: nr.newMembers,
              returning: nr.returning,
              isCurrent: m >= TAKEOVER_MONTH,
            }
          })
        )

        setStatusCounts(
          STATUS_ORDER.map((s) => ({
            status: s,
            count: statusMap[s] ?? 0,
          })).filter((s) => s.count > 0)
        )
      } catch (err) {
        console.error('KPI fetch error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [supabase])

  // ── Period filter ─────────────────────────────────────────
  const filteredRevenue = useMemo(() => {
    if (period === 'all') return revenueData
    if (period === 'takeover') return revenueData.filter((d) => d.isCurrent)
    return revenueData.slice(-12)
  }, [revenueData, period])

  const filteredAttendance = useMemo(() => {
    if (period === 'all') return attendanceData
    if (period === 'takeover') return attendanceData.filter((d) => d.isCurrent)
    return attendanceData.slice(-12)
  }, [attendanceData, period])

  const filteredSignups = useMemo(() => {
    if (period === 'all') return signupsData
    if (period === 'takeover') return signupsData.filter((d) => d.isCurrent)
    return signupsData.slice(-12)
  }, [signupsData, period])

  const filteredRpv = useMemo(() => {
    if (period === 'all') return rpvData
    if (period === 'takeover') return rpvData.filter((d) => d.isCurrent)
    return rpvData.slice(-12)
  }, [rpvData, period])

  const filteredNewReturning = useMemo(() => {
    if (period === 'all') return newReturningData
    if (period === 'takeover') return newReturningData.filter((d) => d.isCurrent)
    return newReturningData.slice(-12)
  }, [newReturningData, period])

  // ── Render ────────────────────────────────────────────────
  const { current, baselineMonthly } = initialSummary

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header ──────────────────────────────────── */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/analytics"
              className="w-8 h-8 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">KPI Deep Dive</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Revenue, attendance, and member trends with period comparison
              </p>
            </div>
          </div>
          <div className="flex bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap',
                  period === opt.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ─── Summary Cards ───────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.03 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <SummaryCard
            label="Revenue (Since Takeover)"
            currentValue={current.revenue}
            baselineValue={baselineMonthly.revenue}
            format="currency"
            icon={DollarSign}
          />
          <SummaryCard
            label="Attendance (Since Takeover)"
            currentValue={current.attendance}
            baselineValue={baselineMonthly.attendance}
            format="number"
            icon={CalendarCheck}
          />
          <SummaryCard
            label="New Members (Since Takeover)"
            currentValue={current.newMembers}
            baselineValue={baselineMonthly.newMembers}
            format="number"
            icon={UserPlus}
          />
        </motion.div>

        {/* ─── Charts Grid ─────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
              >
                <LoadingSkeleton className="h-4 w-32 mb-2" />
                <LoadingSkeleton className="h-3 w-48 mb-4" />
                <LoadingSkeleton className="h-[280px] w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ─── Section 1: Revenue Trend ─────────────── */}
            <ChartSection
              title="Revenue Trend"
              subtitle="Monthly gross revenue from all transactions"
              delay={0.06}
            >
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredRevenue} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                      interval={filteredRevenue.length > 18 ? 2 : filteredRevenue.length > 12 ? 1 : 0}
                      angle={filteredRevenue.length > 12 ? -45 : 0}
                      textAnchor={filteredRevenue.length > 12 ? 'end' : 'middle'}
                      height={filteredRevenue.length > 12 ? 50 : 30}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                      tickFormatter={(v: number) => formatCompact(v)}
                    />
                    <Tooltip content={<RevenueBarTooltip />} />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {filteredRevenue.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.isCurrent ? '#6366F1' : '#C7D2FE'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-indigo-200" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Pre-Takeover</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-indigo-500" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Since Takeover</span>
                </div>
              </div>
            </ChartSection>

            {/* ─── Section 2: Attendance Trend ──────────── */}
            <ChartSection
              title="Attendance Trend"
              subtitle="Monthly check-ins (excluding cancellations)"
              delay={0.09}
            >
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredAttendance} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                      interval={filteredAttendance.length > 18 ? 2 : filteredAttendance.length > 12 ? 1 : 0}
                      angle={filteredAttendance.length > 12 ? -45 : 0}
                      textAnchor={filteredAttendance.length > 12 ? 'end' : 'middle'}
                      height={filteredAttendance.length > 12 ? 50 : 30}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip content={<AttendanceTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="attended"
                      stroke="#6366F1"
                      strokeWidth={2.5}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props
                        return (
                          <circle
                            key={`dot-${props.index}`}
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill={payload.isCurrent ? '#4F46E5' : '#A5B4FC'}
                            stroke={payload.isCurrent ? '#4F46E5' : '#A5B4FC'}
                            strokeWidth={2}
                          />
                        )
                      }}
                      activeDot={{ r: 6, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-indigo-300" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Pre-Takeover</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-indigo-600" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Since Takeover</span>
                </div>
              </div>
            </ChartSection>

            {/* ─── Section 3: New Signups ───────────────── */}
            <ChartSection
              title="New Signups Per Month"
              subtitle="Members by join date"
              delay={0.12}
            >
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredSignups} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                      interval={filteredSignups.length > 18 ? 2 : filteredSignups.length > 12 ? 1 : 0}
                      angle={filteredSignups.length > 12 ? -45 : 0}
                      textAnchor={filteredSignups.length > 12 ? 'end' : 'middle'}
                      height={filteredSignups.length > 12 ? 50 : 30}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip content={<SignupsTooltip />} />
                    <Bar dataKey="signups" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {filteredSignups.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.isCurrent ? '#10B981' : '#A7F3D0'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-200" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Pre-Takeover</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Since Takeover</span>
                </div>
              </div>
            </ChartSection>

            {/* ─── Section 4: Revenue Per Visit ─────────── */}
            <ChartSection
              title="Revenue Per Visit"
              subtitle="Monthly revenue divided by monthly check-ins"
              delay={0.15}
            >
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredRpv} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                      interval={filteredRpv.length > 18 ? 2 : filteredRpv.length > 12 ? 1 : 0}
                      angle={filteredRpv.length > 12 ? -45 : 0}
                      textAnchor={filteredRpv.length > 12 ? 'end' : 'middle'}
                      height={filteredRpv.length > 12 ? 50 : 30}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip content={<RpvTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="rpv"
                      stroke="#F59E0B"
                      strokeWidth={2.5}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props
                        return (
                          <circle
                            key={`rpv-dot-${props.index}`}
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill={payload.isCurrent ? '#F59E0B' : '#FDE68A'}
                            stroke={payload.isCurrent ? '#F59E0B' : '#FDE68A'}
                            strokeWidth={2}
                          />
                        )
                      }}
                      activeDot={{ r: 6, fill: '#F59E0B', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-200" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Pre-Takeover</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Since Takeover</span>
                </div>
              </div>
            </ChartSection>

            {/* ─── Section 5: New vs Returning ──────────── */}
            <ChartSection
              title="New vs Returning Members"
              subtitle="Unique members per month by first booking date"
              delay={0.18}
            >
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredNewReturning} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                      interval={filteredNewReturning.length > 18 ? 2 : filteredNewReturning.length > 12 ? 1 : 0}
                      angle={filteredNewReturning.length > 12 ? -45 : 0}
                      textAnchor={filteredNewReturning.length > 12 ? 'end' : 'middle'}
                      height={filteredNewReturning.length > 12 ? 50 : 30}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip content={<NewReturningTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    />
                    <Bar
                      dataKey="newMembers"
                      name="New"
                      stackId="stack"
                      fill="#6366F1"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="returning"
                      name="Returning"
                      stackId="stack"
                      fill="#A5B4FC"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartSection>

            {/* ─── Section 6: Member Status Funnel ──────── */}
            <ChartSection
              title="Member Status Funnel"
              subtitle="Current engagement status distribution"
              delay={0.21}
            >
              {statusCounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <Users className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400 dark:text-gray-500">No member status data</p>
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={statusCounts}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        axisLine={{ stroke: '#E5E7EB' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="status"
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                        width={110}
                        tickFormatter={(v: string) => STATUS_LABELS[v] ?? v}
                      />
                      <Tooltip content={<FunnelTooltip />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {statusCounts.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={STATUS_COLORS[entry.status] ?? '#6B7280'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {statusCounts.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  {statusCounts.map((s) => (
                    <div key={s.status} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[s.status] ?? '#6B7280' }}
                      />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {STATUS_LABELS[s.status] ?? s.status}: {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ChartSection>
          </div>
        )}
      </div>
    </div>
  )
}
