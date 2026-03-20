'use client'

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

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Mock Data ──────────────────────────────────────────────

const KPI_METRICS = [
  { label: 'MRR', value: '$18,420', trend: 12.3, href: '/revenue', icon: DollarSign },
  { label: 'ARPM', value: '$67.40', trend: 4.2, href: '/revenue', icon: Activity },
  { label: 'Active Members', value: '273', trend: 8.1, href: '/members', icon: Users },
  { label: 'Churn Rate', value: '3.2%', trend: -1.4, href: '/members', icon: Percent },
  { label: 'Revenue MTD', value: '$24,850', trend: 9.7, href: '/revenue', icon: CreditCard },
]

const MONTHLY_REVENUE = [
  { month: 'Apr', revenue: 16200 },
  { month: 'May', revenue: 17100 },
  { month: 'Jun', revenue: 16800 },
  { month: 'Jul', revenue: 18400 },
  { month: 'Aug', revenue: 19200 },
  { month: 'Sep', revenue: 18900 },
  { month: 'Oct', revenue: 20100 },
  { month: 'Nov', revenue: 19600 },
  { month: 'Dec', revenue: 17800 },
  { month: 'Jan', revenue: 21400 },
  { month: 'Feb', revenue: 22800 },
  { month: 'Mar', revenue: 24850 },
]

const REVENUE_DATA = [
  { name: 'Subscriptions', value: 18400, color: '#4F46E5' },
  { name: 'Credit Packs', value: 4200, color: '#6366F1' },
  { name: 'Drop-ins', value: 2800, color: '#8B5CF6' },
  { name: 'Merch', value: 1600, color: '#A78BFA' },
  { name: 'Corporate', value: 3200, color: '#C4B5FD' },
  { name: 'Gift Cards', value: 950, color: '#DDD6FE' },
]

const REVENUE_TOTAL = REVENUE_DATA.reduce((sum, d) => sum + d.value, 0)

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

const AI_INSIGHTS = [
  {
    id: '1',
    icon: CalendarCheck,
    title: 'Add Thursday 7pm Guided',
    summary: 'Wednesday Guided has been at 92% fill for 3 weeks. Strong demand signal for an additional session.',
    action: 'View Schedule',
    actionHref: '/schedule',
  },
  {
    id: '2',
    icon: CreditCard,
    title: 'Retire 5-Pack Pricing',
    summary: 'Only 2 purchases in 90 days. Redirect buyers to the 10-visit pack with better unit economics.',
    action: 'View Pricing',
    actionHref: '/revenue',
  },
  {
    id: '3',
    icon: UserPlus,
    title: 'Trial Campaign for Guided',
    summary: '61 members have never tried Guided. A free first-class email campaign could boost attendance.',
    action: 'Create Campaign',
    actionHref: '/marketing/campaigns/new',
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

function RevenueLineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900">{label}</p>
      <p className="text-gray-600">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

function RevenueDonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  const pct = ((value / REVENUE_TOTAL) * 100).toFixed(1)
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
          {KPI_METRICS.map((metric) => {
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
          })}
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

            {MONTHLY_REVENUE.length === 0 ? (
              <EmptyState icon={TrendingUp} message="No revenue trend data available" />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={MONTHLY_REVENUE} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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

            {REVENUE_DATA.length === 0 ? (
              <EmptyState icon={DollarSign} message="No revenue data available" />
            ) : (
              <>
                <div className="w-full h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={REVENUE_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {REVENUE_DATA.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<RevenueDonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 mb-3">
                  <p className="text-[28px] font-black text-gray-900 tabular-nums">{formatCurrency(REVENUE_TOTAL)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</p>
                </div>

                <div className="space-y-1.5">
                  {REVENUE_DATA.map((item) => (
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

            {COHORT_RETENTION.length === 0 ? (
              <EmptyState icon={Users} message="No cohort data available" />
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

            {AI_INSIGHTS.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <EmptyState icon={Sparkles} message="No insights available right now" />
              </div>
            ) : (
              AI_INSIGHTS.map((insight) => {
                const Icon = insight.icon
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
                      href={insight.actionHref}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      {insight.action}
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
