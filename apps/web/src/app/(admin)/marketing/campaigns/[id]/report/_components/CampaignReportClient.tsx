'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
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
import { fadeInUp } from '@/lib/motion'

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

const ITEMS_PER_PAGE = 6

const recipientStatusConfig: Record<RecipientStatus, { label: string; className: string }> = {
  delivered: { label: 'Delivered', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  opened: { label: 'Opened', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  clicked: { label: 'Clicked', className: 'bg-violet-50 text-violet-700 border border-violet-200' },
  bounced: { label: 'Bounced', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  unsubscribed: { label: 'Unsubscribed', className: 'bg-red-50 text-red-600 border border-red-200' },
}

function MetricCard({ label, value, pct, icon: Icon, color, bg, delay = 0 }: { label: string; value: number; pct: number; icon: typeof Send; color: string; bg: string; delay?: number }) {
  return (
    <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</p>
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', bg)}><Icon className={cn('h-3.5 w-3.5', color)} /></div>
      </div>
      <p className="text-[28px] font-black text-gray-900 dark:text-gray-100 tabular-nums leading-none">{value.toLocaleString()}</p>
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 tabular-nums">{pct}%</p>
    </motion.div>
  )
}

function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  const config = recipientStatusConfig[status]
  return <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className)}>{config.label}</span>
}

// ─── Props ──────────────────────────────────────────────────
interface CampaignReportClientProps {
  initialCampaign: { id: string; name: string; sentDate: string; channel: string; segment: string; abTestEnabled: boolean } | null
  initialRecipients: Recipient[]
}

// ─── Client Component ───────────────────────────────────────
export default function CampaignReportClient({ initialCampaign, initialRecipients }: CampaignReportClientProps) {
  const [campaign] = useState(initialCampaign)
  const [recipients] = useState<Recipient[]>(initialRecipients)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const totalSent = recipients.length
  const delivered = recipients.filter((r) => r.status !== 'bounced').length
  const opened = recipients.filter((r) => ['opened', 'clicked'].includes(r.status)).length
  const clicked = recipients.filter((r) => r.status === 'clicked').length
  const bounced = recipients.filter((r) => r.status === 'bounced').length
  const unsubscribed = recipients.filter((r) => r.status === 'unsubscribed').length
  const pct = (v: number) => totalSent > 0 ? +((v / totalSent) * 100).toFixed(1) : 0

  const METRICS = [
    { label: 'Sent', value: totalSent, pct: 100, icon: Send, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900' },
    { label: 'Delivered', value: delivered, pct: pct(delivered), icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Opened', value: opened, pct: pct(opened), icon: Eye, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Clicked', value: clicked, pct: pct(clicked), icon: MousePointerClick, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Bounced', value: bounced, pct: pct(bounced), icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Unsubscribed', value: unsubscribed, pct: pct(unsubscribed), icon: UserMinus, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  const FUNNEL_DATA = [
    { name: 'Sent', value: totalSent, fill: '#9CA3AF' },
    { name: 'Delivered', value: delivered, fill: '#3B82F6' },
    { name: 'Opened', value: opened, fill: '#6366F1' },
    { name: 'Clicked', value: clicked, fill: '#8B5CF6' },
  ]

  const filteredRecipients = recipients.filter((r) => r.name.toLowerCase().includes(recipientSearch.toLowerCase()) || r.email.toLowerCase().includes(recipientSearch.toLowerCase()))
  const totalPages = Math.ceil(filteredRecipients.length / ITEMS_PER_PAGE)
  const paginatedRecipients = filteredRecipients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  if (!campaign) {
    return (
      <div className="space-y-6">
        <Link href="/marketing/campaigns" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>
        <div className="py-16 text-center">
          <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">Campaign not found</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">This campaign may have been deleted or does not exist.</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }} className="space-y-6">
      <Link href="/marketing/campaigns" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Campaigns
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{campaign.name}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-sm text-gray-500 dark:text-gray-400">Sent {campaign.sentDate}</p>
            <div className="h-5 w-5 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center" title="Email"><Mail className="h-3 w-3 text-gray-500 dark:text-gray-400" /></div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">{campaign.segment}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {METRICS.map((metric, i) => (<MetricCard key={metric.label} {...metric} delay={i * 0.03} />))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.1 }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">Delivery Funnel</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">From send to conversion</p>
          <div className="space-y-2.5">
            {FUNNEL_DATA.map((stage, i) => {
              const maxVal = FUNNEL_DATA[0].value
              const widthPct = Math.max((stage.value / maxVal) * 100, 12)
              const prevVal = i > 0 ? FUNNEL_DATA[i - 1].value : null
              const dropoff = prevVal ? ((1 - stage.value / prevVal) * 100).toFixed(1) : null
              return (
                <div key={stage.name}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{stage.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100 tabular-nums">{stage.value.toLocaleString()}</span>
                      {dropoff && <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">-{dropoff}%</span>}
                    </div>
                  </div>
                  <div className="h-6 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${widthPct}%` }} transition={{ duration: 0.5, delay: i * 0.08, ease: [0.25, 1, 0.5, 1] }} className="h-full rounded-lg" style={{ backgroundColor: stage.fill }} />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.15 }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">Click Map</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Top 5 clicked URLs</p>
          <div className="space-y-3">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MousePointerClick className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No click data yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Click tracking data will appear once recipients interact with your email</p>
            </div>
          </div>
        </motion.div>
      </div>

      {totalSent > 0 && (
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.2 }} className="relative overflow-hidden rounded-2xl border shadow-sm mb-4" style={{ borderImage: 'linear-gradient(135deg, #6366F1, #8B5CF6, #6366F1) 1' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50" />
          <div className="relative p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0"><Sparkles className="h-5 w-5 text-white" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">AI Performance Summary</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600">Analysis</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  This campaign was sent to <span className="font-bold text-gray-900 dark:text-gray-100">{totalSent} recipients</span>.
                  {opened > 0 && <> The open rate was <span className="font-bold text-indigo-600">{pct(opened)}%</span>.</>}
                  {clicked > 0 && <> Click-through rate: <span className="font-bold text-violet-600">{pct(clicked)}%</span>.</>}
                  {bounced > 0 && <> {bounced} emails bounced ({pct(bounced)}%).</>}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.3 }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Recipients</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{recipients.length} total recipients</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input type="text" value={recipientSearch} onChange={(e) => { setRecipientSearch(e.target.value); setCurrentPage(1) }} placeholder="Search recipients..." aria-label="Search recipients" className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" />
          </div>
        </div>
        <div className="flex items-center gap-4 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
          <div className="flex-1 min-w-0">Name</div>
          <div className="w-48">Email</div>
          <div className="w-[90px]">Status</div>
          <div className="w-32">Opened At</div>
          <div className="w-32">Clicked At</div>
        </div>
        <div className="divide-y divide-gray-50">
          {paginatedRecipients.map((recipient) => (
            <div key={recipient.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors">
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{recipient.name}</p></div>
              <div className="w-48"><p className="text-sm text-gray-500 dark:text-gray-400 truncate">{recipient.email}</p></div>
              <div className="w-[90px]"><RecipientStatusBadge status={recipient.status} /></div>
              <div className="w-32"><p className="text-xs text-gray-500 dark:text-gray-400">{recipient.openedAt ?? '--'}</p></div>
              <div className="w-32"><p className="text-xs text-gray-500 dark:text-gray-400">{recipient.clickedAt ?? '--'}</p></div>
            </div>
          ))}
          {paginatedRecipients.length === 0 && <div className="px-5 py-12 text-center"><p className="text-sm text-gray-400 dark:text-gray-500">No recipients match your search</p></div>}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500">Page <span className="font-semibold text-gray-600 dark:text-gray-400">{currentPage}</span> of <span className="font-semibold text-gray-600 dark:text-gray-400">{totalPages}</span></p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className={cn('h-8 w-8 rounded-lg flex items-center justify-center transition-colors', currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')}><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button key={page} onClick={() => setCurrentPage(page)} className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors', page === currentPage ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')}>{page}</button>
              ))}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={cn('h-8 w-8 rounded-lg flex items-center justify-center transition-colors', currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')}><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </motion.div>

      {recipients.length === 0 && (
        <div className="py-12 text-center bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mt-4">
          <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">No recipients yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">This campaign has not been sent to any recipients yet.</p>
        </div>
      )}
    </motion.div>
  )
}
