'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { fadeInUp } from '@/lib/motion'

// ─── Types (shared with page.tsx) ──────────────────────────
export interface DailyRevenue {
  date: string
  revenue: number
}

export interface RevenueByType {
  name: string
  value: number
  color: string
}

export interface RevenueBySource {
  source: string
  amount: number
  color: string
}

export interface MrrDataPoint {
  month: string
  mrr: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-sm font-bold tabular-nums" style={{ color: entry.color }}>
          {entry.name}: ${entry.value?.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="animate-pulse rounded-xl bg-gray-100" style={{ height }} />
  )
}

export default function OverviewTab({ dailyRevenue, revenueByType, revenueBySource, mrrGrowth, loading }: {
  dailyRevenue: DailyRevenue[]
  revenueByType: RevenueByType[]
  revenueBySource: RevenueBySource[]
  mrrGrowth: MrrDataPoint[]
  loading: boolean
}) {
  const AREA_COLORS = ['#4F46E5', '#8B5CF6', '#14B8A6', '#F59E0B', '#10B981']
  const AREA_KEYS = ['Subscriptions', 'Credit Packs', 'Drop-ins', 'Merch', 'Corporate']

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

  const mrrGrowthPct = mrrGrowth.length >= 2
    ? Math.round(((mrrGrowth[mrrGrowth.length - 1].mrr - mrrGrowth[0].mrr) / (mrrGrowth[0].mrr || 1)) * 100)
    : 0

  return (
    <motion.div {...fadeInUp} className="grid grid-cols-12 gap-5">
      {/* Revenue Trend */}
      <div className="lg:col-span-7 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Revenue Trend</p>
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
                <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={AREA_COLORS[i]} strokeWidth={2} fill={`url(#gradient-${i})`} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Revenue Breakdown Donut */}
      <div className="lg:col-span-5 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Revenue Breakdown</p>
        <p className="text-lg font-bold text-gray-900 mb-2">By Source</p>
        {loading ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={revenueByType} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={3} dataKey="value" stroke="none">
                {revenueByType.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => {
                  const total = revenueByType.reduce((s, r) => s + r.value, 0) || 1
                  return [`${Math.round((value / total) * 100)}%`, name]
                }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' }}
              />
              <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-xs text-gray-600">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 30-Day Revenue Trend */}
      <div className="col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Daily Revenue</p>
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
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toLocaleString()}`} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null
                  return (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                      <p className="text-lg font-bold text-gray-900 tabular-nums">${payload[0].value?.toLocaleString()}</p>
                    </div>
                  )
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2.5} fill="url(#dailyRevenueGradient)" dot={false} activeDot={{ r: 5, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Revenue Breakdown by Source (Horizontal Bar) */}
      <div className="lg:col-span-6 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Revenue Breakdown</p>
          <p className="text-lg font-bold text-gray-900">By Source (This Month)</p>
        </div>
        {loading ? <ChartSkeleton height={260} /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueBySource} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="source" tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const data = payload[0].payload
                  return (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{data.source}</p>
                      <p className="text-lg font-bold text-gray-900 tabular-nums">${data.amount.toLocaleString()}</p>
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

      {/* MRR Growth (Line Chart) */}
      <div className="lg:col-span-6 col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">MRR Growth</p>
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
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} domain={['dataMin - 200', 'dataMax + 200']} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null
                  return (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                      <p className="text-lg font-bold text-gray-900 tabular-nums">${payload[0].value?.toLocaleString()}/mo</p>
                    </div>
                  )
                }}
              />
              <Line type="monotone" dataKey="mrr" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 5, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  )
}
