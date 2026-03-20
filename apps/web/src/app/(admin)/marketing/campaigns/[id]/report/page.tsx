'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Send,
  CheckCircle2,
  Eye,
  MousePointerClick,
  AlertTriangle,
  UserMinus,
  ShoppingCart,
  Sparkles,
  Trophy,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ArrowUpRight,
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
type RecipientStatus = 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed'

interface Recipient {
  id: string
  name: string
  email: string
  status: RecipientStatus
  openedAt: string | null
  clickedAt: string | null
}

// ─── Mock Data ──────────────────────────────────────────────
const CAMPAIGN = {
  id: '1',
  name: 'Win-Back: 14-Day Inactive',
  sentDate: 'March 14, 2026 at 9:00 AM',
  channel: 'email' as const,
  segment: 'Inactive 14+ Days',
  abTestEnabled: true,
}

const METRICS = [
  { label: 'Sent', value: 1247, pct: 100, icon: Send, color: 'text-gray-600', bg: 'bg-gray-50' },
  { label: 'Delivered', value: 1219, pct: 97.8, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Opened', value: 652, pct: 53.5, icon: Eye, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Clicked', value: 155, pct: 12.7, icon: MousePointerClick, color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Bounced', value: 28, pct: 2.2, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: 'Unsubscribed', value: 7, pct: 0.6, icon: UserMinus, color: 'text-red-600', bg: 'bg-red-50' },
  { label: 'Converted', value: 43, pct: 3.5, icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50' },
]

const FUNNEL_DATA = [
  { name: 'Sent', value: 1247, fill: '#9CA3AF' },
  { name: 'Delivered', value: 1219, fill: '#3B82F6' },
  { name: 'Opened', value: 652, fill: '#6366F1' },
  { name: 'Clicked', value: 155, fill: '#8B5CF6' },
  { name: 'Converted', value: 43, fill: '#10B981' },
]

const TOP_LINKS = [
  { url: 'https://meridian.studio/book', label: 'Book Now CTA', clicks: 78, pct: 50.3 },
  { url: 'https://meridian.studio/promo/comeback', label: 'Promo Landing Page', clicks: 34, pct: 21.9 },
  { url: 'https://meridian.studio/schedule', label: 'View Schedule', clicks: 22, pct: 14.2 },
  { url: 'https://meridian.studio/membership', label: 'Membership Page', clicks: 14, pct: 9.0 },
  { url: 'https://meridian.studio/unsubscribe', label: 'Unsubscribe', clicks: 7, pct: 4.5 },
]

const AB_VARIANTS = {
  a: {
    name: 'Variant A — Urgency Subject',
    subject: 'We miss you! Your spot is waiting...',
    openRate: 53.5,
    clickRate: 12.7,
    conversions: 28,
    revenue: 1240,
  },
  b: {
    name: 'Variant B — Discount Subject',
    subject: '15% off your next session — come back!',
    openRate: 48.2,
    clickRate: 10.3,
    conversions: 15,
    revenue: 680,
  },
}

const RECIPIENTS: Recipient[] = [
  { id: '1', name: 'Sarah Chen', email: 'sarah.chen@gmail.com', status: 'clicked', openedAt: 'Mar 14, 9:12 AM', clickedAt: 'Mar 14, 9:14 AM' },
  { id: '2', name: 'Michael Torres', email: 'mtorres@outlook.com', status: 'opened', openedAt: 'Mar 14, 9:23 AM', clickedAt: null },
  { id: '3', name: 'Emma Williams', email: 'emma.w@yahoo.com', status: 'clicked', openedAt: 'Mar 14, 9:45 AM', clickedAt: 'Mar 14, 9:47 AM' },
  { id: '4', name: 'James Brown', email: 'jbrown@gmail.com', status: 'delivered', openedAt: null, clickedAt: null },
  { id: '5', name: 'Olivia Martinez', email: 'olivia.m@gmail.com', status: 'bounced', openedAt: null, clickedAt: null },
  { id: '6', name: 'David Kim', email: 'dkim@proton.me', status: 'opened', openedAt: 'Mar 14, 10:02 AM', clickedAt: null },
  { id: '7', name: 'Sophia Anderson', email: 'sophia.a@icloud.com', status: 'clicked', openedAt: 'Mar 14, 10:15 AM', clickedAt: 'Mar 14, 10:18 AM' },
  { id: '8', name: 'Liam Johnson', email: 'liam.j@gmail.com', status: 'unsubscribed', openedAt: 'Mar 14, 10:30 AM', clickedAt: null },
  { id: '9', name: 'Ava Garcia', email: 'ava.g@hotmail.com', status: 'opened', openedAt: 'Mar 14, 11:05 AM', clickedAt: null },
  { id: '10', name: 'Noah Wilson', email: 'noah.w@gmail.com', status: 'delivered', openedAt: null, clickedAt: null },
  { id: '11', name: 'Isabella Davis', email: 'isabella.d@me.com', status: 'clicked', openedAt: 'Mar 14, 11:42 AM', clickedAt: 'Mar 14, 11:45 AM' },
  { id: '12', name: 'Ethan Moore', email: 'ethan.m@gmail.com', status: 'opened', openedAt: 'Mar 14, 12:01 PM', clickedAt: null },
]

const ITEMS_PER_PAGE = 6

// ─── Helpers ────────────────────────────────────────────────
const recipientStatusConfig: Record<RecipientStatus, { label: string; className: string }> = {
  delivered: { label: 'Delivered', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  opened: { label: 'Opened', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  clicked: { label: 'Clicked', className: 'bg-violet-50 text-violet-700 border border-violet-200' },
  bounced: { label: 'Bounced', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  unsubscribed: { label: 'Unsubscribed', className: 'bg-red-50 text-red-600 border border-red-200' },
}

// ─── Components ─────────────────────────────────────────────

function MetricCard({
  label,
  value,
  pct,
  icon: Icon,
  color,
  bg,
  delay = 0,
}: {
  label: string
  value: number
  pct: number
  icon: typeof Send
  color: string
  bg: string
  delay?: number
}) {
  return (
    <motion.div
      {...fadeInUp}
      transition={{ ...fadeInUp.transition, delay }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', bg)}>
          <Icon className={cn('h-3.5 w-3.5', color)} />
        </div>
      </div>
      <p className="text-[28px] font-black text-gray-900 tabular-nums leading-none">
        {value.toLocaleString()}
      </p>
      <p className="text-xs font-semibold text-gray-400 tabular-nums">{pct}%</p>
    </motion.div>
  )
}

function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  const config = recipientStatusConfig[status]
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}

// Custom funnel tooltip
function FunnelTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const data = payload[0].payload
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-2">
      <p className="text-xs font-bold text-gray-900">{data.name}</p>
      <p className="text-xs text-gray-500 tabular-nums">{data.value.toLocaleString()} recipients</p>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────
export default function CampaignReportPage() {
  const [recipientSearch, setRecipientSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const filteredRecipients = RECIPIENTS.filter(
    (r) =>
      r.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.email.toLowerCase().includes(recipientSearch.toLowerCase())
  )

  const totalPages = Math.ceil(filteredRecipients.length / ITEMS_PER_PAGE)
  const paginatedRecipients = filteredRecipients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA]"
    >
      {/* Back link */}
      <Link
        href="/marketing/campaigns"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{CAMPAIGN.name}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-sm text-gray-500">Sent {CAMPAIGN.sentDate}</p>
            <div className="h-5 w-5 rounded bg-gray-100 flex items-center justify-center" title="Email">
              <Mail className="h-3 w-3 text-gray-500" />
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              {CAMPAIGN.segment}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Metrics Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {METRICS.map((metric, i) => (
          <MetricCard key={metric.label} {...metric} delay={i * 0.03} />
        ))}
      </div>

      {/* ─── Funnel + Click Map ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Funnel Chart */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <h3 className="text-base font-bold text-gray-900 mb-1">Delivery Funnel</h3>
          <p className="text-xs text-gray-400 mb-4">From send to conversion</p>

          <div className="space-y-2.5">
            {FUNNEL_DATA.map((stage, i) => {
              const maxVal = FUNNEL_DATA[0].value
              const widthPct = Math.max((stage.value / maxVal) * 100, 12)
              const prevVal = i > 0 ? FUNNEL_DATA[i - 1].value : null
              const dropoff = prevVal ? ((1 - stage.value / prevVal) * 100).toFixed(1) : null
              return (
                <div key={stage.name}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-gray-700">{stage.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900 tabular-nums">{stage.value.toLocaleString()}</span>
                      {dropoff && (
                        <span className="text-[10px] font-medium text-gray-400 tabular-nums">-{dropoff}%</span>
                      )}
                    </div>
                  </div>
                  <div className="h-6 bg-gray-50 rounded-lg overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.08, ease: [0.25, 1, 0.5, 1] }}
                      className="h-full rounded-lg"
                      style={{ backgroundColor: stage.fill }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Click Map */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <h3 className="text-base font-bold text-gray-900 mb-1">Click Map</h3>
          <p className="text-xs text-gray-400 mb-4">Top 5 clicked URLs</p>

          <div className="space-y-3">
            {TOP_LINKS.map((link, i) => (
              <div key={link.url} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-300 tabular-nums w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{link.label}</p>
                  <p className="text-xs text-gray-400 truncate">{link.url}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900 tabular-nums">{link.clicks}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 tabular-nums">{link.pct}%</p>
                </div>
                <div className="w-24 shrink-0">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${link.pct}%` }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
                      className="h-full rounded-full bg-indigo-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── AI Summary ──────────────────────────────────────── */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.2 }}
        className="relative overflow-hidden rounded-2xl border shadow-sm mb-4"
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
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-gray-900">AI Performance Summary</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600">
                  Analysis
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                This campaign performed <span className="font-bold text-emerald-600">above average</span> compared to your last 10 campaigns.
                The 53.5% open rate is <span className="font-bold text-gray-900">12 points above</span> your account average of 41%.
                The &quot;urgency&quot; subject line (Variant A) outperformed the discount-based approach by 5.3 percentage points in open rate.
                <span className="font-bold text-gray-900"> 43 members converted</span>, generating an estimated{' '}
                <span className="font-bold text-emerald-600">$1,920 in attributed revenue</span>.
                Recommendation: use urgency-driven subject lines for your inactive member segments, and consider sending follow-ups
                to the 497 members who opened but did not click.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── A/B Test Comparison ──────────────────────────────── */}
      {CAMPAIGN.abTestEnabled && (
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.25 }}
          className="mb-4"
        >
          <h3 className="text-base font-bold text-gray-900 mb-3">A/B Test Results</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(AB_VARIANTS).map(([key, variant]) => {
              const isWinner = key === 'a'
              return (
                <div
                  key={key}
                  className={cn(
                    'bg-white rounded-2xl border shadow-sm p-5 relative',
                    isWinner ? 'border-emerald-200' : 'border-gray-200'
                  )}
                >
                  {isWinner && (
                    <div className="absolute -top-2.5 left-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white">
                        <Trophy className="h-3 w-3" />
                        Winner
                      </span>
                    </div>
                  )}
                  <h4 className="text-sm font-bold text-gray-900 mb-1">{variant.name}</h4>
                  <p className="text-xs text-gray-400 mb-4 italic">&quot;{variant.subject}&quot;</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Open Rate</p>
                      <p className="text-xl font-black text-gray-900 tabular-nums mt-0.5">{variant.openRate}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Click Rate</p>
                      <p className="text-xl font-black text-gray-900 tabular-nums mt-0.5">{variant.clickRate}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Conversions</p>
                      <p className="text-xl font-black text-gray-900 tabular-nums mt-0.5">{variant.conversions}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Revenue</p>
                      <p className="text-xl font-black text-gray-900 tabular-nums mt-0.5">${variant.revenue.toLocaleString()}</p>
                    </div>
                  </div>

                  {!isWinner && (
                    <button className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                      <Trophy className="h-3.5 w-3.5" />
                      Select as Winner
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ─── Recipient Table ────────────────────────────────── */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.3 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Recipients</h3>
            <p className="text-xs text-gray-400 mt-0.5">{RECIPIENTS.length} total recipients</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={recipientSearch}
              onChange={(e) => {
                setRecipientSearch(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search recipients..."
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
            />
          </div>
        </div>

        {/* Table header */}
        <div className="flex items-center gap-4 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
          <div className="flex-1 min-w-0">Name</div>
          <div className="w-48">Email</div>
          <div className="w-[90px]">Status</div>
          <div className="w-32">Opened At</div>
          <div className="w-32">Clicked At</div>
        </div>

        {/* Recipient rows */}
        <div className="divide-y divide-gray-50">
          {paginatedRecipients.map((recipient) => (
            <div
              key={recipient.id}
              className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/80 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{recipient.name}</p>
              </div>
              <div className="w-48">
                <p className="text-sm text-gray-500 truncate">{recipient.email}</p>
              </div>
              <div className="w-[90px]">
                <RecipientStatusBadge status={recipient.status} />
              </div>
              <div className="w-32">
                <p className="text-xs text-gray-500">{recipient.openedAt ?? '--'}</p>
              </div>
              <div className="w-32">
                <p className="text-xs text-gray-500">{recipient.clickedAt ?? '--'}</p>
              </div>
            </div>
          ))}
          {paginatedRecipients.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-gray-400">No recipients match your search</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Page <span className="font-semibold text-gray-600">{currentPage}</span> of{' '}
              <span className="font-semibold text-gray-600">{totalPages}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
                  currentPage === 1
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors',
                    page === currentPage
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
                  currentPage === totalPages
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
