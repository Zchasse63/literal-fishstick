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
import Link from 'next/link'
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'
import { ToastNotification } from '@/components/ui/toast-notification'
import OverviewTab from './_components/OverviewTab'
import type { DailyRevenue, RevenueByType, RevenueBySource, MrrDataPoint } from './_components/OverviewTab'
import TransactionsTab from './_components/TransactionsTab'
import type { TransactionRow } from './_components/TransactionsTab'
import MembershipsTab from './_components/MembershipsTab'

const STUDIO_ID = DEFAULT_STUDIO_ID

// ─── Types ──────────────────────────────────────────────────
type Tab = 'Overview' | 'Memberships' | 'Transactions'

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
      className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 transition-shadow group"
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
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
        {metric.label}
      </p>
      {loading ? (
        <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mt-1" />
      ) : (
        <p className={cn(
          'text-[28px] font-black tabular-nums',
          isNeutral ? 'text-orange-600' : 'text-gray-900 dark:text-gray-100'
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
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-all',
            active === tab
              ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-500 dark:text-gray-400">{entry.name}:</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100 ml-auto tabular-nums">
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

// ─── OverviewTab, MembershipsTab, TransactionsTab extracted to _components/ (MED-22)

// REMOVED: inline OverviewTab, MembershipsTab, TransactionsTab — now imported from _components/

export default function RevenuePage() {
  const { toast, showToast } = useToast()
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
            members:member_id ( profiles:profile_id ( full_name ) )
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
          .select('promo_code, attributed_sale_amount, created_at, trainers:trainer_id ( profiles:profile_id ( full_name ) )')
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
      const churnRate = '\u2014' // Real churn calculation coming in Phase 3

      setMetrics([
        {
          label: 'MRR',
          value: `$${mrr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          trend: '\u2014',
          trendDirection: 'neutral',
          icon: DollarSign,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
        },
        {
          label: 'ARPM',
          value: `$${arpm}`,
          trend: '\u2014',
          trendDirection: 'neutral',
          icon: Users,
          color: 'text-violet-600',
          bgColor: 'bg-violet-50',
        },
        {
          label: 'Churn Rate',
          value: churnRate,
          trend: '\u2014',
          trendDirection: 'neutral',
          trendGood: true,
          icon: TrendingDown,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
        },
        {
          label: 'Revenue Today',
          value: `$${(todayFromDaily / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          trend: '\u2014',
          trendDirection: 'neutral',
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Revenue</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Financial overview and transaction management</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/revenue/products"
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            Products
          </Link>
          <Link
            href="/revenue/orders"
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Tag className="w-4 h-4" />
            Orders
          </Link>
          <button
            onClick={() => showToast('Manual payment recording coming in Phase 2')}
            className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Record Payment
          </button>
        </div>
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

      <ToastNotification message={toast} />
    </motion.div>
  )
}
