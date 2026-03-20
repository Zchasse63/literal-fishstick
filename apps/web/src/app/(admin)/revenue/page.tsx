'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
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

// ─── Types ──────────────────────────────────────────────────
type Tab = 'Overview' | 'Memberships' | 'Transactions'
type TransactionFilter = 'All' | 'Memberships' | 'Drop-ins' | 'Merch' | 'Gift Cards'

// ─── Mock Data ──────────────────────────────────────────────
const METRICS = [
  {
    label: 'MRR',
    value: '$4,850',
    trend: '+12%',
    trendDirection: 'up' as const,
    icon: DollarSign,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    label: 'ARPM',
    value: '$142',
    trend: '+8%',
    trendDirection: 'up' as const,
    icon: Users,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
  {
    label: 'Churn Rate',
    value: '3.2%',
    trend: '-15%',
    trendDirection: 'down' as const,
    trendGood: true,
    icon: TrendingDown,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    label: 'Revenue Today',
    value: '$2,847',
    trend: '+8.2%',
    trendDirection: 'up' as const,
    icon: BarChart3,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    label: 'Failed Payments',
    value: '2',
    trend: 'action needed',
    trendDirection: 'neutral' as const,
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
]

const REVENUE_TREND = [
  { month: 'Sep', Subscriptions: 3200, 'Credit Packs': 1100, 'Drop-ins': 380, Merch: 290, Corporate: 120 },
  { month: 'Oct', Subscriptions: 3400, 'Credit Packs': 1250, 'Drop-ins': 420, Merch: 310, Corporate: 140 },
  { month: 'Nov', Subscriptions: 3650, 'Credit Packs': 1300, 'Drop-ins': 390, Merch: 350, Corporate: 180 },
  { month: 'Dec', Subscriptions: 3500, 'Credit Packs': 1150, 'Drop-ins': 350, Merch: 420, Corporate: 200 },
  { month: 'Jan', Subscriptions: 3800, 'Credit Packs': 1400, 'Drop-ins': 410, Merch: 380, Corporate: 220 },
  { month: 'Feb', Subscriptions: 4200, 'Credit Packs': 1500, 'Drop-ins': 440, Merch: 340, Corporate: 250 },
  { month: 'Mar', Subscriptions: 4850, 'Credit Packs': 1600, 'Drop-ins': 460, Merch: 360, Corporate: 280 },
]

const AREA_COLORS = ['#4F46E5', '#8B5CF6', '#14B8A6', '#F59E0B', '#10B981']
const AREA_KEYS = ['Subscriptions', 'Credit Packs', 'Drop-ins', 'Merch', 'Corporate']

const DONUT_DATA = [
  { name: 'Subscriptions', value: 52, color: '#4F46E5' },
  { name: 'Credit Packs', value: 28, color: '#8B5CF6' },
  { name: 'Drop-ins', value: 8, color: '#14B8A6' },
  { name: 'Merch', value: 7, color: '#F59E0B' },
  { name: 'Corporate', value: 3, color: '#10B981' },
  { name: 'Gift Cards', value: 2, color: '#EC4899' },
]

// ─── 30-Day Daily Revenue Trend ──────────────────────────────
const DAILY_REVENUE = (() => {
  const base = 800
  const data = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date(2026, 2, 20) // Mar 20, 2026
    date.setDate(date.getDate() - i)
    const dayOfWeek = date.getDay()
    // Weekends are busier
    const weekendBoost = dayOfWeek === 0 || dayOfWeek === 6 ? 1.4 : 1.0
    // Slight upward trend
    const trendFactor = 1 + (29 - i) * 0.008
    const noise = 0.8 + Math.random() * 0.4
    const revenue = Math.round(base * weekendBoost * trendFactor * noise)
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      revenue,
    })
  }
  return data
})()

// ─── Revenue Breakdown by Source ─────────────────────────────
const REVENUE_BY_SOURCE = [
  { source: 'Memberships', amount: 4850, color: '#4F46E5' },
  { source: 'Drop-ins', amount: 1170, color: '#8B5CF6' },
  { source: 'Class Packs', amount: 1600, color: '#10B981' },
  { source: 'Events', amount: 780, color: '#F59E0B' },
  { source: 'Merchandise', amount: 540, color: '#F97316' },
]

// ─── 6-Month MRR Growth ─────────────────────────────────────
const MRR_GROWTH = [
  { month: 'Oct', mrr: 3100 },
  { month: 'Nov', mrr: 3350 },
  { month: 'Dec', mrr: 3200 },
  { month: 'Jan', mrr: 3650 },
  { month: 'Feb', mrr: 4200 },
  { month: 'Mar', mrr: 4850 },
]

const MEMBERSHIP_PLANS = [
  { name: 'Unlimited', price: '$225/mo', type: 'Recurring', active: 14, mrr: '$3,150' },
  { name: '10-Class Pack', price: '$180/mo', type: 'Recurring', active: 6, mrr: '$1,080' },
  { name: '6-Class Pack', price: '$120/mo', type: 'Recurring', active: 4, mrr: '$480' },
  { name: '8-Pack Credits', price: '$225', type: 'Credit Pack', active: 8, mrr: '—' },
  { name: '4-Pack Credits', price: '$120', type: 'Credit Pack', active: 12, mrr: '—' },
  { name: 'Sampler', price: '$60', type: 'Credit Pack', active: 5, mrr: '—' },
  { name: 'Drop-In', price: '$39', type: 'Single', active: null, mrr: '—' },
]

const PROMO_CODES = [
  { code: 'WHITNEY', trainer: 'Whitney Cooper', uses: 23, revenue: '$2,760', lastUsed: 'Mar 18' },
  { code: 'DRENNEN', trainer: 'Drennen Hayes', uses: 17, revenue: '$1,980', lastUsed: 'Mar 15' },
  { code: 'TRENT', trainer: 'Trent Michaels', uses: 11, revenue: '$1,320', lastUsed: 'Mar 12' },
]

const TRANSACTIONS = [
  { id: 'TXN-001', date: 'Mar 20, 2:14 PM', member: 'Sarah Martinez', type: 'Membership', amount: '$225.00', status: 'Completed' as const, method: 'Visa •••• 4242' },
  { id: 'TXN-002', date: 'Mar 20, 1:45 PM', member: 'James Kirkland', type: 'Drop-in', amount: '$39.00', status: 'Completed' as const, method: 'Apple Pay' },
  { id: 'TXN-003', date: 'Mar 20, 11:30 AM', member: 'Laura Garcia', type: 'Merch', amount: '$48.00', status: 'Completed' as const, method: 'Mastercard •••• 5555' },
  { id: 'TXN-004', date: 'Mar 19, 6:20 PM', member: 'Chris Bennett', type: 'Membership', amount: '$180.00', status: 'Failed' as const, method: 'Visa •••• 1234' },
  { id: 'TXN-005', date: 'Mar 19, 4:10 PM', member: 'Emily Watson', type: 'Gift Cards', amount: '$100.00', status: 'Completed' as const, method: 'Google Pay' },
  { id: 'TXN-006', date: 'Mar 19, 2:55 PM', member: 'Mark Torres', type: 'Membership', amount: '$120.00', status: 'Completed' as const, method: 'Visa •••• 9876' },
  { id: 'TXN-007', date: 'Mar 18, 7:30 PM', member: 'Priya Sharma', type: 'Drop-in', amount: '$39.00', status: 'Refunded' as const, method: 'Mastercard •••• 3333' },
  { id: 'TXN-008', date: 'Mar 18, 5:15 PM', member: 'David Sanchez', type: 'Merch', amount: '$32.00', status: 'Completed' as const, method: 'Apple Pay' },
]

// ─── Metric Card ────────────────────────────────────────────
function MetricCard({ metric, index }: { metric: typeof METRICS[0]; index: number }) {
  const isGood = metric.trendDirection === 'up' || (metric as any).trendGood
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
      <p className={cn(
        'text-[28px] font-black tabular-nums',
        isNeutral ? 'text-orange-600' : 'text-gray-900'
      )}>
        {metric.value}
      </p>
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

// ─── Overview Tab ───────────────────────────────────────────
function OverviewTab() {
  return (
    <motion.div {...fadeInUp} className="grid grid-cols-12 gap-5">
      {/* Revenue Trend */}
      <div className="lg:col-span-7 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
              Revenue Trend
            </p>
            <p className="text-lg font-bold text-gray-900">7-Month Overview</p>
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
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={REVENUE_TREND} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
      </div>

      {/* Revenue Breakdown Donut */}
      <div className="lg:col-span-5 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
          Revenue Breakdown
        </p>
        <p className="text-lg font-bold text-gray-900 mb-2">By Source</p>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={DONUT_DATA}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {DONUT_DATA.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`${value}%`, name]}
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
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={DAILY_REVENUE} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
      </div>

      {/* ─── Revenue Breakdown by Source (Horizontal Bar) ── */}
      <div className="lg:col-span-6 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
            Revenue Breakdown
          </p>
          <p className="text-lg font-bold text-gray-900">By Source (This Month)</p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={REVENUE_BY_SOURCE}
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
              {REVENUE_BY_SOURCE.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ─── MRR Growth (6-Month Line Chart) ──────────────── */}
      <div className="lg:col-span-6 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
              MRR Growth
            </p>
            <p className="text-lg font-bold text-gray-900">6-Month Trend</p>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-bold tabular-nums">+56%</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={MRR_GROWTH} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
      </div>
    </motion.div>
  )
}

// ─── Memberships Tab ────────────────────────────────────────
function MembershipsTab() {
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
              {MEMBERSHIP_PLANS.map((plan, i) => (
                <tr
                  key={plan.name}
                  className={cn(
                    'border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer',
                    i === MEMBERSHIP_PLANS.length - 1 && 'border-b-0'
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
                      {plan.active !== null ? plan.active : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">{plan.mrr}</span>
                  </td>
                </tr>
              ))}
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
          {PROMO_CODES.map((promo) => (
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
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Transactions Tab ───────────────────────────────────────
const TX_FILTERS: TransactionFilter[] = ['All', 'Memberships', 'Drop-ins', 'Merch', 'Gift Cards']

function TransactionsTab() {
  const [filter, setFilter] = useState<TransactionFilter>('All')

  const filtered = filter === 'All'
    ? TRANSACTIONS
    : TRANSACTIONS.filter((t) => t.type === filter || (filter === 'Memberships' && t.type === 'Membership'))

  const statusStyles = {
    Completed: 'bg-emerald-50 text-emerald-700',
    Failed: 'bg-orange-50 text-orange-600',
    Refunded: 'bg-gray-100 text-gray-600',
  }

  const typeIcons: Record<string, React.ReactNode> = {
    Membership: <CreditCard className="w-3 h-3" />,
    'Drop-in': <Ticket className="w-3 h-3" />,
    Merch: <ShoppingBag className="w-3 h-3" />,
    'Gift Cards': <Gift className="w-3 h-3" />,
  }

  const typeStyles: Record<string, string> = {
    Membership: 'bg-indigo-50 text-indigo-700',
    'Drop-in': 'bg-teal-50 text-teal-700',
    Merch: 'bg-amber-50 text-amber-700',
    'Gift Cards': 'bg-pink-50 text-pink-700',
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
        {METRICS.map((metric, i) => (
          <MetricCard key={metric.label} metric={metric} index={i} />
        ))}
      </div>

      {/* Tabs */}
      <TabNav active={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'Overview' && <OverviewTab key="overview" />}
        {activeTab === 'Memberships' && <MembershipsTab key="memberships" />}
        {activeTab === 'Transactions' && <TransactionsTab key="transactions" />}
      </AnimatePresence>
    </motion.div>
  )
}
