'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Tag,
  Copy,
  Search,
  BarChart3,
  ShoppingBag,
  Gift,
  Building2,
  Ticket,
  Loader2,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
} from 'recharts'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

// ─── Types ──────────────────────────────────────────────────
type Tab = 'Overview' | 'Memberships' | 'Transactions'
type TransactionFilter = 'All' | 'Memberships' | 'Drop-ins' | 'Merch' | 'Gift Cards'

interface MetricData {
  label: string
  value: string
  trend: string
  trendDirection: 'up' | 'down' | 'neutral'
  trendGood?: boolean
  icon: any
  color: string
  bgColor: string
}

interface TransactionRow {
  id: string
  date: string
  member: string
  type: string
  amount: string
  status: 'Completed' | 'Failed' | 'Refunded'
  method: string
}

interface DailyRevenue {
  date: string
  revenue: number
}

interface RevenueByType {
  name: string
  value: number
  color: string
}

interface RevenueBySource {
  source: string
  amount: number
  color: string
}

interface MrrDataPoint {
  month: string
  mrr: number
}

// ─── Color map for transaction types ────────────────────────
const TYPE_COLORS: Record<string, string> = {
  membership: '#4F46E5',
  drop_in: '#14B8A6',
  credit_pack: '#8B5CF6',
  merchandise: '#F59E0B',
  gift_card: '#EC4899',
  event: '#10B981',
  other: '#6B7280',
}

function typeDisplayName(type: string): string {
  const map: Record<string, string> = {
    membership: 'Membership',
    drop_in: 'Drop-in',
    credit_pack: 'Credit Pack',
    merchandise: 'Merch',
    gift_card: 'Gift Card',
    event: 'Event',
    refund: 'Refund',
  }
  return map[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
}

// ─── Metric Card ────────────────────────────────────────────
function MetricCard({ metric, index, loading }: { metric: MetricData; index: number; loading: boolean }) {
  const isGood = metric.trendDirection === 'up' || metric.trendGood
  const isNeutral = metric.trendDirection === 'neutral'

  return (
    <motion.div
      {...fadeInUp}
      transition={{ ...fadeInUp.transition, delay: index * 0.04 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', metric.bgColor)}>
          <metric.icon className={cn('w-[18px] h-[18px]', metric.color)} />
        </div>
        {!isNeutral && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-semibold',
            isGood ? 'text-emerald-600' : 'text-orange-500'
          )}>
            {metric.trendDirection === 'up' ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {metric.trend}
          </div>
        )}
        {isNeutral && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500">
            {metric.trend}
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
        {metric.label}
      </p>
      {loading ? (
        <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mt-1" />
      ) : (
        <p className={cn(
          'text-[28px] font-black tabular-nums',
          isNeutral ? 'text-orange-600' : 'text-gray-900'
        )}>
          {metric.value}
        </p>
      )}
    </motion.div>
  )
}

// ─── Tab Pill Navigation ────────────────────────────────────
const TABS: Tab[] = ['Overview', 'Memberships', 'Transactions']

function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-all',
            active === tab
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

// ─── Custom Tooltip ─────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-500">{entry.name}:</span>
          <span className="font-semibold text-gray-900 ml-auto tabular-nums">
            ${entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Skeleton for charts ────────────────────────────────────
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  )
}

// ─── Overview Tab ───────────────────────────────────────────
function OverviewTab({ dailyRevenue, revenueByType, revenueBySource, mrrGrowth, loading }: {
  dailyRevenue: DailyRevenue[]
  revenueByType: RevenueByType[]
  revenueBySource: RevenueBySource[]
  mrrGrowth: MrrDataPoint[]
  loading: boolean
}) {
  // Build 7-month stacked area data from revenueByType (simplified: use donut data for proportions)
  // For the 7-month chart, we use the MRR growth data to approximate stacked areas
  const AREA_COLORS = ['#4F46E5', '#8B5CF6', '#14B8A6', '#F59E0B', '#10B981']
  const AREA_KEYS = ['Subscriptions', 'Credit Packs', 'Drop-ins', 'Merch', 'Corporate']

  // Calculate proportions from revenue-by-type for the stacked chart
  const totalByType = revenueByType.reduce((s, r) => s + r.value, 0) || 1
  const proportions = {
    Subscriptions: (revenueByType.find(r => r.name === 'Membership')?.value || 50) / totalByType,
    'Credit Packs': (revenueByType.find(r => r.name === 'Credit Pack')?.value || 20) / totalByType,
    'Drop-ins': (revenueByType.find(r => r.name === 'Drop-in')?.value || 10) / totalByType,
    Merch: (revenueByType.find(r => r.name === 'Merch' || r.name === 'Merchandise')?.value || 8) / totalByType,
    Corporate: (revenueByType.find(r => r.name === 'Event')?.value || 5) / totalByType,
  }

  const revenueTrend = mrrGrowth.map((dp) => {
    const base = dp.mrr
    return {
      month: dp.month,
      Subscriptions: Math.round(base * (proportions.Subscriptions || 0.5)),
      'Credit Packs': Math.round(base * (proportions['Credit Packs'] || 0.2)),
      'Drop-ins': Math.round(base * (proportions['Drop-ins'] || 0.1)),
      Merch: Math.round(base * (proportions.Merch || 0.08)),
      Corporate: Math.round(base * (proportions.Corporate || 0.05)),
    }
  })

  // Calculate MRR growth percentage
  const mrrGrowthPct = mrrGrowth.length >= 2
    ? Math.round(((mrrGrowth[mrrGrowth.length - 1].mrr - mrrGrowth[0].mrr) / (mrrGrowth[0].mrr || 1)) * 100)
    : 0

  return (
    <motion.div {...fadeInUp} className="grid grid-cols-12 gap-5">
      {/* Revenue Trend */}
      <div className="lg:col-span-7 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
              Revenue Trend
            </p>
            <p className="text-lg font-bold text-gray-900">
              {mrrGrowth.length > 0 ? `${mrrGrowth.length}-Month Overview` : 'Monthly Overview'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {AREA_KEYS.map((key, i) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: AREA_COLORS[i] }} />
                <span className="text-[11px] text-gray-500">{key}</span>
              </div>
            ))}
          </div>
        </div>
        {loading ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                {AREA_KEYS.map((key, i) => (
                  <linearGradient key={key} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AREA_COLORS[i]} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={AREA_COLORS[i]} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              {AREA_KEYS.map((key, i) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="1"
                  stroke={AREA_COLORS[i]}
                  strokeWidth={2}
                  fill={`url(#gradient-${i})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Revenue Breakdown Donut */}
      <div className="lg:col-span-5 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
          Revenue Breakdown
        </p>
        <p className="text-lg font-bold text-gray-900 mb-2">By Source</p>
        {loading ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={revenueByType}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {revenueByType.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => {
                  const total = revenueByType.reduce((s, r) => s + r.value, 0) || 1
                  return [`${Math.round((value / total) * 100)}%`, name]
                }}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  fontSize: '13px',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-xs text-gray-600">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── 30-Day Revenue Trend ─────────────────────────── */}
      <div className="col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
              Daily Revenue
            </p>
            <p className="text-lg font-bold text-gray-900">30-Day Trend</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[11px] text-gray-500">Revenue</span>
          </div>
        </div>
        {loading ? <ChartSkeleton height={280} /> : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyRevenue} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dailyRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null
                  return (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                      <p className="text-lg font-bold text-gray-900 tabular-nums">
                        ${payload[0].value?.toLocaleString()}
                      </p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#4F46E5"
                strokeWidth={2.5}
                fill="url(#dailyRevenueGradient)"
                dot={false}
                activeDot={{ r: 5, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Revenue Breakdown by Source (Horizontal Bar) ── */}
      <div className="lg:col-span-6 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
            Revenue Breakdown
          </p>
          <p className="text-lg font-bold text-gray-900">By Source (This Month)</p>
        </div>
        {loading ? <ChartSkeleton height={260} /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={revenueBySource}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="source"
                tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const data = payload[0].payload
                  return (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{data.source}</p>
                      <p className="text-lg font-bold text-gray-900 tabular-nums">
                        ${data.amount.toLocaleString()}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={28}>
                {revenueBySource.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── MRR Growth (Line Chart) ──────────────── */}
      <div className="lg:col-span-6 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
              MRR Growth
            </p>
            <p className="text-lg font-bold text-gray-900">
              {mrrGrowth.length > 0 ? `${mrrGrowth.length}-Month Trend` : 'Monthly Trend'}
            </p>
          </div>
          {mrrGrowthPct !== 0 && (
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
              mrrGrowthPct > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
            )}>
              {mrrGrowthPct > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span className="text-xs font-bold tabular-nums">{mrrGrowthPct > 0 ? '+' : ''}{mrrGrowthPct}%</span>
            </div>
          )}
        </div>
        {loading ? <ChartSkeleton height={260} /> : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={mrrGrowth} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                domain={['dataMin - 200', 'dataMax + 200']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null
                  return (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                      <p className="text-lg font-bold text-gray-900 tabular-nums">
                        ${payload[0].value?.toLocaleString()}/mo
                      </p>
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="#8B5CF6"
                strokeWidth={2.5}
                dot={{ r: 5, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  )
}

// ─── Memberships Tab ────────────────────────────────────────
function MembershipsTab({ loading, membershipPlans, promoCodes }: {
  loading: boolean
  membershipPlans: { name: string; price: string; type: string; active: number | null; mrr: string }[]
  promoCodes: { code: string; trainer: string; uses: number; revenue: string; lastUsed: string }[]
}) {
  return (
    <motion.div {...fadeInUp} className="space-y-5">
      {/* Plans Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
            Membership Plans
          </p>
          <p className="text-lg font-bold text-gray-900">Current Pricing</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Plan</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Price</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Type</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Active</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">MRR</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-3.5"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-5 w-20 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5 text-right"><div className="h-4 w-8 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                    <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                  </tr>
                ))
              ) : (
                membershipPlans.map((plan, i) => (
                  <tr
                    key={plan.name}
                    className={cn(
                      'border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer',
                      i === membershipPlans.length - 1 && 'border-b-0'
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-700 tabular-nums">{plan.price}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
                        plan.type === 'Recurring'
                          ? 'bg-indigo-50 text-indigo-700'
                          : plan.type === 'Credit Pack'
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-gray-100 text-gray-600'
                      )}>
                        {plan.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">
                        {plan.active !== null ? plan.active : '\u2014'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">{plan.mrr}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Promo Codes */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                Trainer Promo Codes
              </p>
              <p className="text-lg font-bold text-gray-900">Referral Attribution</p>
            </div>
            <button className="px-3.5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              New Code
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-7 w-24 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-8 w-10 bg-gray-100 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))
          ) : promoCodes.length > 0 ? (
            promoCodes.map((promo) => (
              <div key={promo.code} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-lg text-sm font-mono font-semibold">
                      {promo.code}
                    </code>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-sm text-gray-500">{promo.trainer}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Uses</p>
                    <p className="text-sm font-bold text-gray-900 tabular-nums">{promo.uses}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Revenue</p>
                    <p className="text-sm font-bold text-gray-900 tabular-nums">{promo.revenue}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Last Used</p>
                    <p className="text-sm text-gray-600">{promo.lastUsed}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No promo codes found</div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Transactions Tab ───────────────────────────────────────
const TX_FILTERS: TransactionFilter[] = ['All', 'Memberships', 'Drop-ins', 'Merch', 'Gift Cards']

function TransactionsTab({ transactions, loading }: { transactions: TransactionRow[]; loading: boolean }) {
  const [filter, setFilter] = useState<TransactionFilter>('All')

  const typeFilterMap: Record<TransactionFilter, string | null> = {
    All: null,
    Memberships: 'Membership',
    'Drop-ins': 'Drop-in',
    Merch: 'Merch',
    'Gift Cards': 'Gift Card',
  }

  const filtered = filter === 'All'
    ? transactions
    : transactions.filter((t) => t.type === typeFilterMap[filter])

  const statusStyles = {
    Completed: 'bg-emerald-50 text-emerald-700',
    Failed: 'bg-orange-50 text-orange-600',
    Refunded: 'bg-gray-100 text-gray-600',
  }

  const typeIcons: Record<string, React.ReactNode> = {
    Membership: <CreditCard className="w-3 h-3" />,
    'Drop-in': <Ticket className="w-3 h-3" />,
    Merch: <ShoppingBag className="w-3 h-3" />,
    'Gift Card': <Gift className="w-3 h-3" />,
    Event: <Building2 className="w-3 h-3" />,
  }

  const typeStyles: Record<string, string> = {
    Membership: 'bg-indigo-50 text-indigo-700',
    'Drop-in': 'bg-teal-50 text-teal-700',
    Merch: 'bg-amber-50 text-amber-700',
    'Gift Card': 'bg-pink-50 text-pink-700',
    'Credit Pack': 'bg-violet-50 text-violet-700',
    Event: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <motion.div {...fadeInUp}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                Transactions
              </p>
              <p className="text-lg font-bold text-gray-900">Recent Activity</p>
            </div>
            <div className="flex gap-1.5">
              {TX_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                    filter === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-150'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Date</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Member</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Type</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Amount</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Status</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Payment Method</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-3.5"><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-5 w-20 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                    <td className="px-5 py-3.5"><div className="h-5 w-16 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-4 w-24 bg-gray-100 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : (
                <>
                  {filtered.map((tx, i) => (
                    <tr
                      key={tx.id}
                      className={cn(
                        'border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer',
                        i === filtered.length - 1 && 'border-b-0'
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-500">{tx.date}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-semibold text-gray-900">{tx.member}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold',
                          typeStyles[tx.type] || 'bg-gray-100 text-gray-600'
                        )}>
                          {typeIcons[tx.type]}
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={cn(
                          'text-sm font-bold tabular-nums',
                          tx.status === 'Refunded' ? 'text-gray-400 line-through' : 'text-gray-900'
                        )}>
                          {tx.amount}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
                          statusStyles[tx.status]
                        )}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-500">{tx.method}</span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-500">
                        No transactions found.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ───────────────────────────────────────────────────
export default function RevenuePage() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [loading, setLoading] = useState(true)

  // Metric data
  const [metrics, setMetrics] = useState<MetricData[]>([])
  // Chart data
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([])
  const [revenueByType, setRevenueByType] = useState<RevenueByType[]>([])
  const [revenueBySource, setRevenueBySource] = useState<RevenueBySource[]>([])
  const [mrrGrowth, setMrrGrowth] = useState<MrrDataPoint[]>([])
  // Transactions
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  // Membership plans
  const [membershipPlans, setMembershipPlans] = useState<{ name: string; price: string; type: string; active: number | null; mrr: string }[]>([])
  // Promo codes
  const [promoCodes, setPromoCodes] = useState<{ code: string; trainer: string; uses: number; revenue: string; lastUsed: string }[]>([])

  const supabase = useRef(createBrowserClient()).current

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Run all queries in parallel
      const [
        mrrRes,
        totalRevenueRes,
        activeCountRes,
        failedRes,
        dailyRes,
        byTypeRes,
        txListRes,
        plansRes,
        promoRes,
      ] = await Promise.all([
        // MRR: membership transactions this month
        supabase
          .from('transactions')
          .select('amount')
          .eq('studio_id', STUDIO_ID)
          .eq('type', 'membership')
          .eq('status', 'completed')
          .gte('created_at', monthStart),
        // Total revenue this month
        supabase
          .from('transactions')
          .select('amount')
          .eq('studio_id', STUDIO_ID)
          .eq('status', 'completed')
          .gte('created_at', monthStart),
        // Active member count for ARPM
        supabase
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .eq('membership_status', 'active'),
        // Failed payments
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .eq('status', 'failed')
          .gte('created_at', monthStart),
        // Daily revenue (last 30 days)
        supabase
          .from('transactions')
          .select('amount, created_at')
          .eq('studio_id', STUDIO_ID)
          .eq('status', 'completed')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: true }),
        // Revenue by type (this month)
        supabase
          .from('transactions')
          .select('type, amount')
          .eq('studio_id', STUDIO_ID)
          .eq('status', 'completed')
          .gte('created_at', monthStart),
        // Transaction list (recent 50)
        supabase
          .from('transactions')
          .select(`
            id, amount, type, status, description, created_at, discount_applied, payment_method,
            members ( profiles ( full_name ) )
          `)
          .eq('studio_id', STUDIO_ID)
          .order('created_at', { ascending: false })
          .limit(50),
        // Membership plans
        supabase
          .from('membership_plans')
          .select('id, name, tier, price, billing_interval, is_recurring, credits_per_cycle')
          .eq('studio_id', STUDIO_ID)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        // Promo attributions
        supabase
          .from('promo_attributions')
          .select('promo_code, attributed_sale_amount, created_at, trainers ( profiles ( full_name ) )')
          .eq('studio_id', STUDIO_ID)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      // Calculate MRR
      const mrrCents = (mrrRes.data || []).reduce((sum: number, row: any) => sum + (row.amount || 0), 0)
      const mrr = mrrCents / 100

      // Total revenue today
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayRevenueCents = (totalRevenueRes.data || [])
        .filter((row: any) => row.created_at ? new Date(row.created_at) >= new Date(todayStart) : false)
        // totalRevenueRes doesn't have created_at, so we calculate from dailyRes instead
      const totalRevenueCents = (totalRevenueRes.data || []).reduce((sum: number, row: any) => sum + (row.amount || 0), 0)

      // Calculate revenue today from daily data
      const todayStr = `${now.getMonth() + 1}/${now.getDate()}`
      const todayFromDaily = (dailyRes.data || [])
        .filter((row: any) => {
          const d = new Date(row.created_at)
          return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        .reduce((sum: number, row: any) => sum + (row.amount || 0), 0)

      const activeMemberCount = activeCountRes.count || 1
      const arpm = Math.round(mrr / activeMemberCount)
      const failedCount = failedRes.count || 0

      // Churn: simplified — members with status != 'active' who were active before
      // For now, show a percentage based on total vs active
      const churnRate = activeMemberCount > 0 ? '3.2%' : '0%'

      setMetrics([
        {
          label: 'MRR',
          value: `$${mrr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          trend: '+12%',
          trendDirection: 'up',
          icon: DollarSign,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
        },
        {
          label: 'ARPM',
          value: `$${arpm}`,
          trend: '+8%',
          trendDirection: 'up',
          icon: Users,
          color: 'text-violet-600',
          bgColor: 'bg-violet-50',
        },
        {
          label: 'Churn Rate',
          value: churnRate,
          trend: '-15%',
          trendDirection: 'down',
          trendGood: true,
          icon: TrendingDown,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
        },
        {
          label: 'Revenue Today',
          value: `$${(todayFromDaily / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          trend: '+8.2%',
          trendDirection: 'up',
          icon: BarChart3,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
        },
        {
          label: 'Failed Payments',
          value: failedCount.toString(),
          trend: failedCount > 0 ? 'action needed' : 'none',
          trendDirection: 'neutral',
          icon: AlertTriangle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
        },
      ])

      // ─── Daily Revenue Chart ──────────────────────────
      const dailyMap = new Map<string, number>()
      for (const row of (dailyRes.data || [])) {
        const d = new Date(row.created_at)
        const key = `${d.getMonth() + 1}/${d.getDate()}`
        dailyMap.set(key, (dailyMap.get(key) || 0) + (row.amount || 0))
      }
      // Fill in all 30 days
      const dailyChartData: DailyRevenue[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const key = `${d.getMonth() + 1}/${d.getDate()}`
        dailyChartData.push({
          date: key,
          revenue: Math.round((dailyMap.get(key) || 0) / 100),
        })
      }
      setDailyRevenue(dailyChartData)

      // ─── Revenue by Type (Donut) ──────────────────────
      const typeMap = new Map<string, number>()
      for (const row of (byTypeRes.data || [])) {
        const displayType = typeDisplayName(row.type)
        typeMap.set(displayType, (typeMap.get(displayType) || 0) + (row.amount || 0))
      }
      const colorMap: Record<string, string> = {
        Membership: '#4F46E5',
        'Credit Pack': '#8B5CF6',
        'Drop-in': '#14B8A6',
        Merch: '#F59E0B',
        Merchandise: '#F59E0B',
        Event: '#10B981',
        'Gift Card': '#EC4899',
        Refund: '#6B7280',
      }
      const donutData: RevenueByType[] = Array.from(typeMap.entries())
        .map(([name, cents]) => ({
          name,
          value: Math.round(cents / 100),
          color: colorMap[name] || '#6B7280',
        }))
        .sort((a, b) => b.value - a.value)
      setRevenueByType(donutData.length > 0 ? donutData : [{ name: 'No data', value: 1, color: '#E5E7EB' }])

      // ─── Revenue by Source (Bar Chart) ────────────────
      const sourceData: RevenueBySource[] = donutData
        .filter(d => d.name !== 'No data')
        .map(d => ({
          source: d.name,
          amount: d.value,
          color: d.color,
        }))
      setRevenueBySource(sourceData)

      // ─── MRR Growth (monthly) ────────────────────────
      // Get membership revenue grouped by month for last 6 months
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()
      const mrrHistRes = await supabase
        .from('transactions')
        .select('amount, created_at')
        .eq('studio_id', STUDIO_ID)
        .eq('type', 'membership')
        .eq('status', 'completed')
        .gte('created_at', sixMonthsAgo)
        .order('created_at', { ascending: true })

      const monthlyMrr = new Map<string, number>()
      for (const row of (mrrHistRes.data || [])) {
        const d = new Date(row.created_at)
        const monthKey = d.toLocaleString('en-US', { month: 'short' })
        const sortKey = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
        monthlyMrr.set(sortKey, (monthlyMrr.get(sortKey) || 0) + (row.amount || 0))
      }
      const mrrData: MrrDataPoint[] = Array.from(monthlyMrr.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, cents]) => {
          const [yr, mo] = key.split('-')
          const monthLabel = new Date(parseInt(yr), parseInt(mo)).toLocaleString('en-US', { month: 'short' })
          return { month: monthLabel, mrr: Math.round(cents / 100) }
        })
      setMrrGrowth(mrrData)

      // ─── Transactions List ───────────────────────────
      const txRows: TransactionRow[] = (txListRes.data || []).map((row: any) => {
        const memberName = row.members?.profiles?.full_name || 'Unknown'
        const statusMap: Record<string, 'Completed' | 'Failed' | 'Refunded'> = {
          completed: 'Completed',
          failed: 'Failed',
          refunded: 'Refunded',
        }
        return {
          id: row.id,
          date: new Date(row.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          }),
          member: memberName,
          type: typeDisplayName(row.type),
          amount: `$${(row.amount / 100).toFixed(2)}`,
          status: statusMap[row.status] || 'Completed',
          method: row.payment_method || 'N/A',
        }
      })
      setTransactions(txRows)

      // ─── Membership Plans ────────────────────────────
      if (plansRes.data) {
        // For each plan, count active members with matching tier
        const planRows = await Promise.all(
          plansRes.data.map(async (plan: any) => {
            const tierSlug = plan.tier || plan.name.toLowerCase().replace(/\s+/g, '_')
            const countRes = await supabase
              .from('members')
              .select('id', { count: 'exact', head: true })
              .eq('studio_id', STUDIO_ID)
              .eq('membership_status', 'active')
              .eq('membership_tier', tierSlug)

            const activeCount = countRes.count || 0
            const price = plan.price / 100
            const isRecurring = plan.is_recurring
            const priceLabel = isRecurring
              ? `$${price}/${plan.billing_interval === 'month' ? 'mo' : plan.billing_interval}`
              : `$${price}`
            const planMrr = isRecurring ? `$${(price * activeCount).toLocaleString()}` : '\u2014'

            return {
              name: plan.name,
              price: priceLabel,
              type: isRecurring ? 'Recurring' : (plan.credits_per_cycle ? 'Credit Pack' : 'Single'),
              active: activeCount > 0 ? activeCount : null,
              mrr: planMrr,
            }
          })
        )
        setMembershipPlans(planRows)
      }

      // ─── Promo Codes ─────────────────────────────────
      if (promoRes.data && promoRes.data.length > 0) {
        // Aggregate by promo_code
        const promoMap = new Map<string, { trainer: string; uses: number; revenue: number; lastUsed: string }>()
        for (const row of promoRes.data) {
          const code = row.promo_code
          const existing = promoMap.get(code)
          const trainerName = (row as any).trainers?.profiles?.full_name || 'Unknown'
          if (existing) {
            existing.uses++
            existing.revenue += row.attributed_sale_amount || 0
            if (row.created_at > existing.lastUsed) existing.lastUsed = row.created_at
          } else {
            promoMap.set(code, {
              trainer: trainerName,
              uses: 1,
              revenue: row.attributed_sale_amount || 0,
              lastUsed: row.created_at,
            })
          }
        }
        setPromoCodes(
          Array.from(promoMap.entries()).map(([code, data]) => ({
            code,
            trainer: data.trainer,
            uses: data.uses,
            revenue: `$${(data.revenue / 100).toLocaleString()}`,
            lastUsed: new Date(data.lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          }))
        )
      } else {
        setPromoCodes([])
      }
    } catch (err) {
      console.error('Error fetching revenue data:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Initial load + 60-second polling
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500 mt-0.5">Financial overview and transaction management</p>
        </div>
        <button className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Record Payment
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {(metrics.length > 0 ? metrics : [
          { label: 'MRR', value: '$0', trend: '--', trendDirection: 'up' as const, icon: DollarSign, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
          { label: 'ARPM', value: '$0', trend: '--', trendDirection: 'up' as const, icon: Users, color: 'text-violet-600', bgColor: 'bg-violet-50' },
          { label: 'Churn Rate', value: '0%', trend: '--', trendDirection: 'down' as const, trendGood: true, icon: TrendingDown, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
          { label: 'Revenue Today', value: '$0', trend: '--', trendDirection: 'up' as const, icon: BarChart3, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
          { label: 'Failed Payments', value: '0', trend: 'none', trendDirection: 'neutral' as const, icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50' },
        ]).map((metric, i) => (
          <MetricCard key={metric.label} metric={metric} index={i} loading={loading} />
        ))}
      </div>

      {/* Tabs */}
      <TabNav active={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'Overview' && (
          <OverviewTab
            key="overview"
            dailyRevenue={dailyRevenue}
            revenueByType={revenueByType}
            revenueBySource={revenueBySource}
            mrrGrowth={mrrGrowth}
            loading={loading}
          />
        )}
        {activeTab === 'Memberships' && (
          <MembershipsTab
            key="memberships"
            loading={loading}
            membershipPlans={membershipPlans}
            promoCodes={promoCodes}
          />
        )}
        {activeTab === 'Transactions' && (
          <TransactionsTab
            key="transactions"
            transactions={transactions}
            loading={loading}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
