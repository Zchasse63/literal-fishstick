'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Megaphone,
  Mail,
  Smartphone,
  Bell,
  Zap,
  Users,
  Send,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  Eye,
  MousePointerClick,
  Sparkles,
  Calendar,
  Clock,
  GitBranch,
  FileText,
  Target,
  ChevronRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  Cell,
} from 'recharts'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type CampaignStatus = 'sent' | 'active' | 'scheduled' | 'draft'
type Channel = 'email' | 'sms' | 'push'

interface RecentCampaign {
  id: string
  name: string
  status: CampaignStatus
  openRate: number
  clickRate: number
  revenueAttributed: number
  openHistory: number[]
}

// ─── Mock Data ──────────────────────────────────────────────
const RECENT_CAMPAIGNS: RecentCampaign[] = [
  {
    id: '1',
    name: 'Win-Back: 14-Day Inactive',
    status: 'active',
    openRate: 52,
    clickRate: 12.4,
    revenueAttributed: 1240,
    openHistory: [30, 42, 38, 52, 48, 52],
  },
  {
    id: '2',
    name: 'Guided Upsell — Whitney',
    status: 'sent',
    openRate: 44,
    clickRate: 9.1,
    revenueAttributed: 890,
    openHistory: [20, 35, 44, 42, 44, 40],
  },
  {
    id: '3',
    name: 'New Member Welcome Series',
    status: 'active',
    openRate: 71,
    clickRate: 18.2,
    revenueAttributed: 2340,
    openHistory: [55, 60, 65, 68, 71, 71],
  },
  {
    id: '4',
    name: 'Failed Payment Recovery',
    status: 'active',
    openRate: 67,
    clickRate: 14.8,
    revenueAttributed: 560,
    openHistory: [50, 55, 60, 63, 67, 67],
  },
  {
    id: '5',
    name: 'June Promo: Bring a Friend',
    status: 'scheduled',
    openRate: 0,
    clickRate: 0,
    revenueAttributed: 0,
    openHistory: [],
  },
]

const FUNNEL_DATA = [
  { name: 'New', value: 142, fill: '#6366F1' },
  { name: 'Contacted', value: 98, fill: '#818CF8' },
  { name: 'Trial', value: 47, fill: '#A5B4FC' },
  { name: 'Converted', value: 23, fill: '#10B981' },
]

const UPCOMING_SCHEDULED = [
  { id: '1', name: 'June Promo: Bring a Friend', date: 'Jun 1, 2026 at 9:00 AM', channel: 'email' as Channel },
  { id: '2', name: 'Summer Solstice Event Blast', date: 'Jun 15, 2026 at 10:00 AM', channel: 'email' as Channel },
  { id: '3', name: 'July 4th Special — Free Class', date: 'Jun 28, 2026 at 8:00 AM', channel: 'sms' as Channel },
]

const NAV_CARDS = [
  { label: 'Campaigns', href: '/marketing/campaigns', icon: Megaphone, description: 'Email & SMS campaigns', count: '6 active' },
  { label: 'Automations', href: '/marketing/automations', icon: GitBranch, description: 'Triggered workflows', count: '3 live' },
  { label: 'Leads', href: '/marketing/leads', icon: Target, description: 'Lead pipeline & tracking', count: '142 open' },
  { label: 'Content', href: '/marketing/content', icon: FileText, description: 'Templates & media', count: '24 assets' },
]

// ─── Helpers ────────────────────────────────────────────────
const statusConfig: Record<CampaignStatus, { label: string; className: string }> = {
  sent: { label: 'Sent', className: 'bg-gray-100 text-gray-600' },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  scheduled: { label: 'Scheduled', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  draft: { label: 'Draft', className: 'border border-gray-300 text-gray-500 bg-white' },
}

const channelIcon: Record<Channel, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  push: Bell,
}

// ─── Components ─────────────────────────────────────────────

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  delay = 0,
}: {
  label: string
  value: string
  change: string
  icon: typeof Megaphone
  delay?: number
}) {
  return (
    <motion.div
      {...fadeInUp}
      transition={{ ...fadeInUp.transition, delay }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Icon className="h-4 w-4 text-indigo-600" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-[28px] font-black text-gray-900 tabular-nums leading-none">{value}</p>
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
          <ArrowUpRight className="h-3 w-3" />
          {change}
        </span>
      </div>
    </motion.div>
  )
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const config = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}

function SparkLine({ data }: { data: number[] }) {
  if (data.length === 0) return <span className="text-xs text-gray-300">--</span>
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const height = 24
  const width = 64
  const step = width / (data.length - 1)

  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ')

  return (
    <svg width={width} height={height} className="text-indigo-500">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NavCard({
  label,
  href,
  icon: Icon,
  description,
  count,
  delay = 0,
}: {
  label: string
  href: string
  icon: typeof Megaphone
  description: string
  count: string
  delay?: number
}) {
  return (
    <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay }}>
      <Link
        href={href}
        className="group bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:border-indigo-200 hover:shadow-md transition-all"
      >
        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
          <Icon className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 tabular-nums">{count}</span>
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton Pulse ─────────────────────────────────────────
function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 animate-pulse rounded', className)} />
}

// ─── Page ───────────────────────────────────────────────────
export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<RecentCampaign[]>(RECENT_CAMPAIGNS)
  const [leadCount, setLeadCount] = useState<number>(142)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch('/api/campaigns?limit=5&status=sent')
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.data) setCampaigns(d.data)
        })
        .catch(() => {}),
      fetch('/api/leads?limit=1')
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && typeof d.count === 'number') setLeadCount(d.count)
        })
        .catch(() => {}),
    ]).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Marketing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overview of campaigns, automations, and leads</p>
        </div>
      </div>

      {/* ─── Quick Nav ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {NAV_CARDS.map((card, i) => (
          <NavCard key={card.label} {...card} delay={i * 0.04} />
        ))}
      </div>

      {/* ─── Metrics Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Megaphone} label="Active Campaigns" value="6" change="+2 this week" delay={0} />
        <MetricCard icon={Zap} label="Automation Enrollments" value="312" change="+18%" delay={0.05} />
        <MetricCard icon={Users} label="Open Leads" value="142" change="+24 new" delay={0.1} />
        <MetricCard icon={Send} label="Emails Sent This Month" value="4,218" change="+12.4%" delay={0.15} />
      </div>

      {/* ─── Recent Campaigns + Lead Pipeline ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Recent Campaigns Table */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Recent Campaigns</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 5 campaigns by activity</p>
            </div>
            <Link
              href="/marketing/campaigns"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
            <div className="flex-1 min-w-0">Campaign</div>
            <div className="w-[72px]">Status</div>
            <div className="w-16 text-center">Open Trend</div>
            <div className="w-14 text-right">Open %</div>
            <div className="w-14 text-right">Click %</div>
            <div className="w-20 text-right">Revenue</div>
          </div>

          {/* Campaign rows */}
          <div className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1"><SkeletonPulse className="h-4 w-40" /></div>
                  <div className="w-[72px]"><SkeletonPulse className="h-5 w-14 rounded-full" /></div>
                  <div className="w-16"><SkeletonPulse className="h-4 w-16" /></div>
                  <div className="w-14"><SkeletonPulse className="h-4 w-10 ml-auto" /></div>
                  <div className="w-14"><SkeletonPulse className="h-4 w-10 ml-auto" /></div>
                  <div className="w-20"><SkeletonPulse className="h-4 w-14 ml-auto" /></div>
                </div>
              ))
            ) : (
            campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/marketing/campaigns/${campaign.id}/report`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                    {campaign.name}
                  </p>
                </div>
                <div className="w-[72px]">
                  <StatusBadge status={campaign.status} />
                </div>
                <div className="w-16 flex justify-center">
                  <SparkLine data={campaign.openHistory} />
                </div>
                <div className="w-14 text-right">
                  <p className="text-sm font-medium text-gray-700 tabular-nums">
                    {campaign.openRate > 0 ? `${campaign.openRate}%` : '--'}
                  </p>
                </div>
                <div className="w-14 text-right">
                  <p className="text-sm font-medium text-gray-700 tabular-nums">
                    {campaign.clickRate > 0 ? `${campaign.clickRate}%` : '--'}
                  </p>
                </div>
                <div className="w-20 text-right">
                  <p className="text-sm font-medium text-gray-700 tabular-nums">
                    {campaign.revenueAttributed > 0 ? `$${campaign.revenueAttributed.toLocaleString()}` : '--'}
                  </p>
                </div>
              </Link>
            ))
            )}
          </div>
        </motion.div>

        {/* Lead Pipeline Funnel */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Lead Pipeline</h3>
              <p className="text-xs text-gray-400 mt-0.5">Conversion funnel</p>
            </div>
            <Link
              href="/marketing/leads"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Details
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Horizontal funnel visualization */}
          <div className="space-y-3">
            {FUNNEL_DATA.map((stage, i) => {
              const maxVal = FUNNEL_DATA[0].value
              const widthPct = Math.max((stage.value / maxVal) * 100, 20)
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <div className="w-20 shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stage.name}</p>
                  </div>
                  <div className="flex-1 relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.1, ease: [0.25, 1, 0.5, 1] }}
                      className="h-8 rounded-lg flex items-center justify-end pr-3"
                      style={{ backgroundColor: stage.fill }}
                    >
                      <span className="text-xs font-bold text-white tabular-nums">{stage.value}</span>
                    </motion.div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Conversion rate */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Overall Conversion</p>
            <p className="text-lg font-black text-gray-900 tabular-nums">16.2%</p>
          </div>
        </motion.div>
      </div>

      {/* ─── AI Recommendation + Upcoming Scheduled ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Recommendation */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
          className="lg:col-span-2 relative overflow-hidden rounded-2xl border shadow-sm"
          style={{
            borderImage: 'linear-gradient(135deg, #6366F1, #8B5CF6, #6366F1) 1',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50" />
          <div className="relative p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">AI Recommendation</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600">
                    Smart
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  You have <span className="font-bold text-gray-900">23 members</span> at churn risk based on declining visit frequency.
                  A targeted win-back campaign with a personalized offer could recover an estimated{' '}
                  <span className="font-bold text-emerald-600">$1,840/mo</span> in recurring revenue.
                  Members in this segment respond best to email campaigns sent Tuesday mornings.
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <Link
                    href="/marketing/automations/new"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Create Automation
                  </Link>
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-semibold hover:border-gray-300 hover:text-gray-800 transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Upcoming Scheduled */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.25 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Upcoming Scheduled</h3>
              <p className="text-xs text-gray-400 mt-0.5">Next 3 campaigns</p>
            </div>
            <Calendar className="h-4 w-4 text-gray-400" />
          </div>

          <div className="space-y-3">
            {UPCOMING_SCHEDULED.map((item) => {
              const ChannelIcon = channelIcon[item.channel]
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-400">{item.date}</p>
                      <div className="h-5 w-5 rounded bg-gray-200 flex items-center justify-center">
                        <ChannelIcon className="h-3 w-3 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
