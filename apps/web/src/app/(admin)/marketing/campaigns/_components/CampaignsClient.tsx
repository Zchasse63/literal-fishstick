'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Megaphone,
  Mail,
  Smartphone,
  Bell,
  Plus,
  Sparkles,
  Search,
  MoreHorizontal,
  Copy,
  Trash2,
  Pencil,
  ChevronDown,
  Calendar,
  ArrowUpDown,
  Filter,
  Inbox,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
export type Channel = 'email' | 'sms' | 'push'
type StatusFilter = 'All' | 'Draft' | 'Scheduled' | 'Sending' | 'Sent' | 'Cancelled'

export interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  channels: Channel[]
  recipients: number
  openRate: number | null
  clickRate: number | null
  revenue: number | null
  sentDate: string | null
  scheduledDate: string | null
}

// ─── Helpers ────────────────────────────────────────────────
const statusConfig: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'border border-gray-300 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-950' },
  scheduled: { label: 'Scheduled', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  sending: { label: 'Sending', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  sent: { label: 'Sent', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-600 border border-red-200' },
}

const channelIcon: Record<Channel, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  push: Bell,
}

const FILTERS: StatusFilter[] = ['All', 'Draft', 'Scheduled', 'Sending', 'Sent', 'Cancelled']

function StatusBadge({ status }: { status: CampaignStatus }) {
  const config = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className)}>
      {status === 'sending' && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse mr-1.5" />}
      {config.label}
    </span>
  )
}

function ChannelIcons({ channels }: { channels: Channel[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {channels.map((ch) => {
        const Icon = channelIcon[ch]
        return (
          <div key={ch} className="h-6 w-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center" title={ch}>
            <Icon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
          </div>
        )
      })}
    </div>
  )
}

function ActionDropdown({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }} aria-label="Campaign actions" className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <MoreHorizontal className="h-4 w-4 text-gray-400 dark:text-gray-500" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.15 }} className="absolute right-0 top-10 z-20 w-44 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg py-1.5">
              <Link href={`/marketing/campaigns/${campaignId}`} onClick={(e) => { e.stopPropagation(); setOpen(false) }} className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <Pencil className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /> Edit
              </Link>
              <button onClick={(e) => {
                e.preventDefault(); e.stopPropagation(); setOpen(false)
                if (!confirm('Duplicate this campaign?')) return
                fetch(`/api/marketing/campaigns/${campaignId}/duplicate`, {
                  method: 'POST',
                }).then(r => r.ok ? window.location.reload() : r.json().then(d => alert(d.error || 'Failed to duplicate campaign')))
                  .catch(() => alert('Failed to duplicate campaign'))
              }} className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <Copy className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /> Duplicate
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
              <button onClick={(e) => {
                e.preventDefault(); e.stopPropagation(); setOpen(false)
                if (!confirm('Delete this campaign? This cannot be undone.')) return
                fetch(`/api/marketing/campaigns/${campaignId}`, {
                  method: 'DELETE',
                }).then(r => r.ok ? window.location.reload() : r.json().then(d => alert(d.error || 'Failed to delete campaign')))
                  .catch(() => alert('Failed to delete campaign'))
              }} className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="h-3.5 w-3.5 text-red-400" /> Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Props ──────────────────────────────────────────────────
interface CampaignsClientProps {
  initialCampaigns: Campaign[]
}

// ─── Client Component ───────────────────────────────────────
export default function CampaignsClient({ initialCampaigns }: CampaignsClientProps) {
  const [campaigns] = useState<Campaign[]>(initialCampaigns)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter.toLowerCase()
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <motion.div
      data-testid="marketing-campaigns-page-root"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Campaigns</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Create, manage, and track email and SMS campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:border-indigo-200 hover:text-indigo-600 transition-colors shadow-sm">
            <Sparkles className="h-4 w-4" /> AI Generate
          </button>
          <Link href="/marketing/campaigns/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> New Campaign
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          {FILTERS.map((filter) => (
            <button key={filter} onClick={() => setStatusFilter(filter)} className={cn('px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all', statusFilter === filter ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 hover:text-gray-800 dark:text-gray-200')}>
              {filter}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px] max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search campaigns..." aria-label="Search campaigns" className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" />
        </div>
      </div>

      <motion.div {...fadeInUp} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        {filteredCampaigns.length > 0 ? (
          <>
            <div className="flex items-center gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <div className="flex-1 min-w-0">Campaign</div>
              <div className="w-[80px]">Status</div>
              <div className="w-[84px]">Channels</div>
              <div className="w-20 text-right">Recipients</div>
              <div className="w-16 text-right">Open %</div>
              <div className="w-16 text-right">Click %</div>
              <div className="w-20 text-right">Revenue</div>
              <div className="w-10" />
            </div>
            <div className="divide-y divide-gray-50">
              {filteredCampaigns.map((campaign, i) => (
                <motion.div key={campaign.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <Link href={`/marketing/campaigns/${campaign.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 transition-colors">{campaign.name}</p>
                      {campaign.sentDate && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Sent {campaign.sentDate}</p>}
                      {campaign.scheduledDate && <p className="text-xs text-amber-500 mt-0.5">Scheduled for {campaign.scheduledDate}</p>}
                    </div>
                    <div className="w-[80px]"><StatusBadge status={campaign.status} /></div>
                    <div className="w-[84px]"><ChannelIcons channels={campaign.channels} /></div>
                    <div className="w-20 text-right"><p className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">{campaign.recipients > 0 ? campaign.recipients.toLocaleString() : '--'}</p></div>
                    <div className="w-16 text-right"><p className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">{campaign.openRate !== null ? `${campaign.openRate}%` : '--'}</p></div>
                    <div className="w-16 text-right"><p className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">{campaign.clickRate !== null ? `${campaign.clickRate}%` : '--'}</p></div>
                    <div className="w-20 text-right"><p className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">{campaign.revenue !== null ? `$${campaign.revenue.toLocaleString()}` : '--'}</p></div>
                    <div className="w-10 flex justify-end"><ActionDropdown campaignId={campaign.id} /></div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4"><Inbox className="h-8 w-8 text-gray-300" /></div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">No campaigns found</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">{searchQuery ? `No results for "${searchQuery}"` : 'Get started by creating your first campaign'}</p>
            <Link href="/marketing/campaigns/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus className="h-4 w-4" /> New Campaign
            </Link>
          </div>
        )}
      </motion.div>

      {filteredCampaigns.length > 0 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-xs text-gray-400 dark:text-gray-500">Showing <span className="font-semibold text-gray-600 dark:text-gray-400">{filteredCampaigns.length}</span> of <span className="font-semibold text-gray-600 dark:text-gray-400">{campaigns.length}</span> campaigns</p>
        </div>
      )}
    </motion.div>
  )
}
