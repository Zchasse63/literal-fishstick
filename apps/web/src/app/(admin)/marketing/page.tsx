'use client'

import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { ToastNotification } from '@/components/ui/toast-notification'
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
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

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

const STUDIO_ID = DEFAULT_STUDIO_ID

const NAV_CARDS = [
  { label: 'Campaigns', href: '/marketing/campaigns', icon: Megaphone, description: 'Email & SMS campaigns' },
  { label: 'Automations', href: '/marketing/automations', icon: GitBranch, description: 'Triggered workflows' },
  { label: 'Leads', href: '/marketing/leads', icon: Target, description: 'Lead pipeline & tracking' },
  { label: 'Content', href: '/marketing/content', icon: FileText, description: 'Templates & media' },
]

// ─── Helpers ────────────────────────────────────────────────
const statusConfig: Record<CampaignStatus, { label: string; className: string }> = {
  sent: { label: 'Sent', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  scheduled: { label: 'Scheduled', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  draft: { label: 'Draft', className: 'border border-gray-300 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-950' },
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
      className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</p>
        <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Icon className="h-4 w-4 text-indigo-600" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-[28px] font-black text-gray-900 dark:text-gray-100 tabular-nums leading-none">{value}</p>
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
  count?: string
  delay?: number
}) {
  return (
    <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay }}>
      <Link
        href={href}
        className="group bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 flex items-center gap-4 hover:border-indigo-200 hover:shadow-md transition-all"
      >
        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
          <Icon className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 transition-colors">{label}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 tabular-nums">{count}</span>
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
  const { toast, showToast } = useToast()
  const [campaigns, setCampaigns] = useState<RecentCampaign[]>([])
  const [leadCounts, setLeadCounts] = useState<{ new: number; contacted: number; trial: number; converted: number }>({ new: 0, contacted: 0, trial: 0, converted: 0 })
  const [automationCount, setAutomationCount] = useState(0)
  const [scheduledCampaigns, setScheduledCampaigns] = useState<{ id: string; name: string; date: string; channel: Channel }[]>([])
  const [navCounts, setNavCounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [aiDismissed, setAiDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserClient()

    async function loadData() {
      const [campaignsRes, leadsRes, automationsRes, scheduledRes, contentRes] = await Promise.all([
        supabase
          .from('campaigns')
          .select('id, name, status, created_at')
          .eq('studio_id', STUDIO_ID)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('leads')
          .select('status')
          .eq('studio_id', STUDIO_ID),
        supabase
          .from('automation_flows')
          .select('id', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .eq('active', true),
        supabase
          .from('campaigns')
          .select('id, name, scheduled_at, channel')
          .eq('studio_id', STUDIO_ID)
          .eq('status', 'scheduled')
          .order('scheduled_at', { ascending: true })
          .limit(3),
        supabase
          .from('content_posts')
          .select('id', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID),
      ])

      if (cancelled) return

      // Map campaigns
      if (campaignsRes.data) {
        setCampaigns(
          campaignsRes.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            status: c.status || 'draft',
            openRate: 0,
            clickRate: 0,
            revenueAttributed: 0,
            openHistory: [],
          }))
        )
      }

      // Count leads by status
      if (leadsRes.data) {
        const counts = { new: 0, contacted: 0, trial: 0, converted: 0 }
        leadsRes.data.forEach((l: any) => {
          if (l.status in counts) counts[l.status as keyof typeof counts]++
        })
        setLeadCounts(counts)
      }

      setAutomationCount(automationsRes.count ?? 0)

      // Scheduled campaigns
      if (scheduledRes.data) {
        setScheduledCampaigns(
          scheduledRes.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            date: c.scheduled_at ? new Date(c.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD',
            channel: (c.channel || 'email') as Channel,
          }))
        )
      }

      // Nav counts
      const campaignActiveCount = campaignsRes.data?.filter((c: any) => c.status === 'active' || c.status === 'sending').length ?? 0
      const totalLeads = leadsRes.data?.length ?? 0
      const contentCount = contentRes.count ?? 0
      setNavCounts({
        Campaigns: campaignActiveCount > 0 ? `${campaignActiveCount} active` : '0 campaigns',
        Automations: automationsRes.count ? `${automationsRes.count} live` : '0 flows',
        Leads: totalLeads > 0 ? `${totalLeads} open` : '0 leads',
        Content: contentCount > 0 ? `${contentCount} assets` : '0 posts',
      })

      setLoading(false)
    }

    loadData()
    return () => { cancelled = true }
  }, [])

  const funnelData = useMemo(() => [
    { name: 'New', value: leadCounts.new, fill: '#6366F1' },
    { name: 'Contacted', value: leadCounts.contacted, fill: '#818CF8' },
    { name: 'Trial', value: leadCounts.trial, fill: '#A5B4FC' },
    { name: 'Converted', value: leadCounts.converted, fill: '#10B981' },
  ], [leadCounts])

  const totalLeads = leadCounts.new + leadCounts.contacted + leadCounts.trial + leadCounts.converted
  const conversionRate = totalLeads > 0 ? ((leadCounts.converted / totalLeads) * 100).toFixed(1) : '0'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Marketing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Overview of campaigns, automations, and leads</p>
        </div>
      </div>

      {/* ─── Quick Nav ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {NAV_CARDS.map((card, i) => (
          <NavCard key={card.label} {...card} count={navCounts[card.label] ?? '--'} delay={i * 0.04} />
        ))}
      </div>

      {/* ─── Metrics Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Megaphone} label="Active Campaigns" value={navCounts['Campaigns']?.split(' ')[0] ?? '0'} change="--" delay={0} />
        <MetricCard icon={Zap} label="Active Automations" value={String(automationCount)} change="--" delay={0.05} />
        <MetricCard icon={Users} label="Open Leads" value={String(totalLeads)} change={leadCounts.new > 0 ? `+${leadCounts.new} new` : '--'} delay={0.1} />
        <MetricCard icon={Send} label="Conversion Rate" value={`${conversionRate}%`} change="--" delay={0.15} />
      </div>

      {/* ─── Recent Campaigns + Lead Pipeline ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Recent Campaigns Table */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="lg:col-span-2 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Recent Campaigns</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Last 5 campaigns by activity</p>
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
          <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
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
            ) : campaigns.length === 0 ? (
              <div className="py-12 text-center">
                <Megaphone className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No campaigns yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Create your first campaign to see results here</p>
                <Link href="/marketing/campaigns/new" className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                  Create Campaign
                </Link>
              </div>
            ) : (
            campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/marketing/campaigns/${campaign.id}/report`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 transition-colors">
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
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                    {campaign.openRate > 0 ? `${campaign.openRate}%` : '--'}
                  </p>
                </div>
                <div className="w-14 text-right">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                    {campaign.clickRate > 0 ? `${campaign.clickRate}%` : '--'}
                  </p>
                </div>
                <div className="w-20 text-right">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
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
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Lead Pipeline</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Conversion funnel</p>
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
            {funnelData.map((stage, i) => {
              const maxVal = Math.max(funnelData[0].value, 1)
              const widthPct = Math.max((stage.value / maxVal) * 100, 20)
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <div className="w-20 shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{stage.name}</p>
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

          {totalLeads === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Target className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No leads yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Add leads to see your conversion funnel</p>
            </div>
          )}

          {/* Conversion rate */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Overall Conversion</p>
            <p className="text-lg font-black text-gray-900 dark:text-gray-100 tabular-nums">{conversionRate}%</p>
          </div>
        </motion.div>
      </div>

      {/* ─── AI Recommendation + Upcoming Scheduled ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Recommendation */}
        {!aiDismissed && (<motion.div
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
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">AI Recommendation</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600">
                    Smart
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                  You have <span className="font-bold text-gray-900 dark:text-gray-100">23 members</span> at churn risk based on declining visit frequency.
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
                  <button
                    onClick={() => setAiDismissed(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:border-gray-300 hover:text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>)}

        {/* Upcoming Scheduled */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.25 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Upcoming Scheduled</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Next 3 campaigns</p>
            </div>
            <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          </div>

          <div className="space-y-3">
            {scheduledCampaigns.length > 0 ? scheduledCampaigns.map((item) => {
              const ChannelIcon = channelIcon[item.channel] || Mail
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500">{item.date}</p>
                      <div className="h-5 w-5 rounded bg-gray-200 flex items-center justify-center">
                        <ChannelIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            }) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Nothing scheduled</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Schedule a campaign to see it here</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <ToastNotification message={toast} />
    </motion.div>
  )
}
