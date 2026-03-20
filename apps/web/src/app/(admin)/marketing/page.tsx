'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Megaphone,
  Mail,
  Smartphone,
  Bell,
  Plus,
  TrendingUp,
  Eye,
  MousePointerClick,
  DollarSign,
  ArrowUpRight,
  Heart,
  MessageCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Zap,
  Clock,
  Send,
  GitBranch,
  Users,
  ShieldCheck,
  Star,
} from 'lucide-react'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type Tab = 'Campaigns' | 'Automations' | 'Community'
type CampaignFilter = 'All' | 'Active' | 'Sent' | 'Scheduled' | 'Draft'
type CampaignStatus = 'sent' | 'active' | 'scheduled' | 'draft'
type Channel = 'email' | 'sms' | 'push'

interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  channels: Channel[]
  recipients: number
  openRate?: number
  clicks?: number
  conversions?: number
  sentDate?: string
  scheduledDate?: string
}

interface AutomationNode {
  id: string
  type: 'trigger' | 'wait' | 'action' | 'condition' | 'result'
  label: string
  sublabel?: string
  color: string
  branch?: 'yes' | 'no'
}

interface CommunityPost {
  id: string
  author: string
  avatar: string
  role: 'trainer' | 'studio' | 'member'
  timestamp: string
  content: string
  likes: number
  comments: number
  status: 'approved' | 'pending'
}

// ─── Mock Data ──────────────────────────────────────────────
const CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    name: 'Win-Back: 14-Day Inactive',
    status: 'active',
    channels: ['email', 'sms'],
    recipients: 47,
    openRate: 52,
    clicks: 19,
    conversions: 8,
  },
  {
    id: '2',
    name: 'Guided Upsell — Whitney',
    status: 'sent',
    channels: ['email'],
    recipients: 134,
    openRate: 44,
    clicks: 31,
    conversions: 12,
    sentDate: 'Mar 14',
  },
  {
    id: '3',
    name: 'June Promo: Bring a Friend',
    status: 'scheduled',
    channels: ['email', 'push'],
    recipients: 289,
    scheduledDate: 'Jun 1, 9:00 AM',
  },
  {
    id: '4',
    name: 'Failed Payment Recovery',
    status: 'active',
    channels: ['email', 'sms'],
    recipients: 12,
    openRate: 67,
    clicks: 8,
    conversions: 5,
  },
  {
    id: '5',
    name: 'New Member Welcome Series',
    status: 'active',
    channels: ['email'],
    recipients: 63,
    openRate: 71,
    clicks: 42,
    conversions: 28,
  },
  {
    id: '6',
    name: 'Holiday Promo Dec Prep',
    status: 'draft',
    channels: ['email', 'sms', 'push'],
    recipients: 0,
  },
]

const AUTOMATION_NODES: AutomationNode[] = [
  { id: 'trigger', type: 'trigger', label: 'No booking in 14 days', sublabel: 'Trigger', color: 'bg-blue-500' },
  { id: 'wait', type: 'wait', label: '2 days', sublabel: 'Wait', color: 'bg-gray-400' },
  { id: 'action', type: 'action', label: 'Send email: We miss you!', sublabel: 'Action', color: 'bg-indigo-600' },
  { id: 'condition', type: 'condition', label: 'Opened email?', sublabel: 'Condition', color: 'bg-amber-500' },
  { id: 'yes', type: 'result', label: 'Send 10% off code', sublabel: 'Yes', color: 'bg-emerald-500', branch: 'yes' },
  { id: 'no', type: 'result', label: 'Send SMS reminder', sublabel: 'No', color: 'bg-orange-500', branch: 'no' },
]

const COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: '1',
    author: 'Whitney Cooper',
    avatar: 'WC',
    role: 'trainer',
    timestamp: '2h ago',
    content:
      'Special breathwork class this Wednesday at 7 PM! We\'re doing a deep-dive into Wim Hof-style cold exposure breathing techniques. Limited to 10 spots — book now before it fills up. Bring your A-game and an open mind.',
    likes: 24,
    comments: 7,
    status: 'approved',
  },
  {
    id: '2',
    author: 'The Sauna Guys',
    avatar: 'SG',
    role: 'studio',
    timestamp: '5h ago',
    content:
      'Community event this Saturday! We\'re hosting a recovery workshop with cold plunge demos and guided breathwork sessions. Free for all members, plus bring a friend for free. Food trucks on-site. RSVP in the app.',
    likes: 41,
    comments: 13,
    status: 'approved',
  },
  {
    id: '3',
    author: 'Marcus Johnson',
    avatar: 'MJ',
    role: 'member',
    timestamp: '1d ago',
    content:
      'Just hit my 50-session milestone! When I started 4 months ago I could barely handle 2 minutes in the cold plunge. Now I\'m doing 5+ minutes easy. This community changed my life. Shoutout to Whitney for pushing me through those early guided sessions.',
    likes: 38,
    comments: 11,
    status: 'pending',
  },
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

const roleConfig: Record<string, { label: string; className: string }> = {
  trainer: { label: 'Trainer', className: 'bg-indigo-50 text-indigo-700' },
  studio: { label: 'Studio', className: 'bg-violet-50 text-violet-700' },
  member: { label: 'Member', className: 'bg-gray-100 text-gray-600' },
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

function ChannelIcons({ channels }: { channels: Channel[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {channels.map((ch) => {
        const Icon = channelIcon[ch]
        return (
          <div key={ch} className="h-6 w-6 rounded-lg bg-gray-100 flex items-center justify-center" title={ch}>
            <Icon className="h-3.5 w-3.5 text-gray-500" />
          </div>
        )
      })}
    </div>
  )
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50/80 transition-colors rounded-xl group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
          {campaign.name}
        </p>
        {campaign.sentDate && <p className="text-xs text-gray-400 mt-0.5">Sent {campaign.sentDate}</p>}
        {campaign.scheduledDate && <p className="text-xs text-amber-500 mt-0.5">Scheduled for {campaign.scheduledDate}</p>}
      </div>
      <StatusBadge status={campaign.status} />
      <ChannelIcons channels={campaign.channels} />
      <div className="w-20 text-right">
        <p className="text-sm font-medium text-gray-700 tabular-nums">
          {campaign.recipients > 0 ? campaign.recipients.toLocaleString() : '—'}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">recipients</p>
      </div>
      {campaign.openRate !== undefined ? (
        <>
          <div className="w-16 text-right">
            <p className="text-sm font-medium text-gray-700 tabular-nums">{campaign.openRate}%</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">opens</p>
          </div>
          <div className="w-14 text-right">
            <p className="text-sm font-medium text-gray-700 tabular-nums">{campaign.clicks}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">clicks</p>
          </div>
          <div className="w-14 text-right">
            <p className="text-sm font-medium text-gray-700 tabular-nums">{campaign.conversions}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">conv</p>
          </div>
        </>
      ) : (
        <div className="w-[176px]" />
      )}
    </div>
  )
}

function AutomationFlow() {
  const mainNodes = AUTOMATION_NODES.filter((n) => !n.branch)
  const yesNode = AUTOMATION_NODES.find((n) => n.branch === 'yes')!
  const noNode = AUTOMATION_NODES.find((n) => n.branch === 'no')!

  return (
    <motion.div {...fadeInUp} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-gray-900">Win-Back: 14-Day Inactive</h3>
          <p className="text-sm text-gray-500 mt-0.5">Automation flow diagram</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      <div className="flex flex-col items-center">
        {/* Main vertical chain */}
        {mainNodes.map((node, i) => (
          <div key={node.id} className="flex flex-col items-center">
            {i > 0 && (
              <div className="w-px h-8 bg-gray-300" />
            )}
            {i > 0 && (
              <ChevronDown className="h-4 w-4 text-gray-300 -mt-1 -mb-1" />
            )}
            {node.type === 'condition' ? (
              <div className={cn('relative w-56 rotate-0')}>
                <div
                  className={cn(
                    'w-56 h-20 flex flex-col items-center justify-center',
                    'bg-amber-50 border-2 border-amber-300 text-amber-800',
                    'rounded-xl'
                  )}
                  style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">{node.sublabel}</p>
                  <p className="text-sm font-semibold mt-0.5">{node.label}</p>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  'w-64 px-4 py-3 rounded-xl text-white text-center shadow-sm',
                  node.color
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{node.sublabel}</p>
                <p className="text-sm font-semibold mt-0.5">{node.label}</p>
              </div>
            )}
          </div>
        ))}

        {/* Branch split */}
        <div className="w-px h-8 bg-gray-300" />
        <div className="flex items-start gap-16">
          {/* Yes branch */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-emerald-600 mb-2">Yes</span>
            <div className="w-px h-4 bg-emerald-300" />
            <ChevronDown className="h-4 w-4 text-emerald-400 -mt-1 -mb-1" />
            <div className={cn('w-52 px-4 py-3 rounded-xl text-white text-center shadow-sm', yesNode.color)}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{yesNode.sublabel}</p>
              <p className="text-sm font-semibold mt-0.5">{yesNode.label}</p>
            </div>
          </div>
          {/* No branch */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-orange-600 mb-2">No</span>
            <div className="w-px h-4 bg-orange-300" />
            <ChevronDown className="h-4 w-4 text-orange-400 -mt-1 -mb-1" />
            <div className={cn('w-52 px-4 py-3 rounded-xl text-white text-center shadow-sm', noNode.color)}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{noNode.sublabel}</p>
              <p className="text-sm font-semibold mt-0.5">{noNode.label}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-8 grid grid-cols-4 gap-4 pt-6 border-t border-gray-100">
        {[
          { label: 'Triggered', value: '47', icon: Zap },
          { label: 'Emails Sent', value: '42', icon: Send },
          { label: 'Converted', value: '8', icon: CheckCircle2 },
          { label: 'Conv. Rate', value: '17%', icon: TrendingUp },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <stat.icon className="h-4 w-4 text-gray-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900 tabular-nums">{stat.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function CommunityPostCard({ post }: { post: CommunityPost }) {
  const role = roleConfig[post.role]
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
            post.role === 'trainer'
              ? 'bg-indigo-100 text-indigo-700'
              : post.role === 'studio'
              ? 'bg-violet-100 text-violet-700'
              : 'bg-gray-100 text-gray-600'
          )}
        >
          {post.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900">{post.author}</p>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', role.className)}>
              {role.label}
            </span>
            <span className="text-xs text-gray-400">{post.timestamp}</span>
          </div>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">{post.content}</p>
          {/* Engagement */}
          <div className="flex items-center gap-5 mt-3">
            <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors">
              <Heart className="h-3.5 w-3.5" />
              {post.likes}
            </button>
            <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 transition-colors">
              <MessageCircle className="h-3.5 w-3.5" />
              {post.comments}
            </button>
          </div>
        </div>
        {/* Moderation */}
        <div className="flex items-center gap-1.5 shrink-0">
          {post.status === 'pending' && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mr-2">Pending</span>
          )}
          <button className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center hover:bg-emerald-100 transition-colors" title="Approve">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </button>
          <button className="h-8 w-8 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors" title="Reject">
            <XCircle className="h-4 w-4 text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────
export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Campaigns')
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>('All')

  const filteredCampaigns =
    campaignFilter === 'All'
      ? CAMPAIGNS
      : CAMPAIGNS.filter((c) => c.status === campaignFilter.toLowerCase())

  const tabs: Tab[] = ['Campaigns', 'Automations', 'Community']
  const filters: CampaignFilter[] = ['All', 'Active', 'Sent', 'Scheduled', 'Draft']

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA] p-6 lg:p-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Marketing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Campaigns, automations, and community engagement</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {/* ─── Metrics Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Megaphone} label="Campaigns Sent" value="24" change="4 this month" delay={0} />
        <MetricCard icon={Eye} label="Avg Open Rate" value="41%" change="+3.2%" delay={0.05} />
        <MetricCard icon={MousePointerClick} label="Conversions" value="312" change="+18%" delay={0.1} />
        <MetricCard icon={DollarSign} label="Revenue Attributed" value="$8,420" change="+12.4%" delay={0.15} />
      </div>

      {/* ─── Tab Navigation ──────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-semibold transition-all',
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'Campaigns' && (
          <motion.div key="campaigns" {...fadeInUp}>
            {/* Filter pills */}
            <div className="flex items-center gap-2 mb-4">
              {filters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setCampaignFilter(filter)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                    campaignFilter === filter
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Campaign list */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {/* Table header */}
              <div className="flex items-center gap-4 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <div className="flex-1">Campaign</div>
                <div className="w-[72px]">Status</div>
                <div className="w-[84px]">Channels</div>
                <div className="w-20 text-right">Recipients</div>
                <div className="w-16 text-right">Opens</div>
                <div className="w-14 text-right">Clicks</div>
                <div className="w-14 text-right">Conv</div>
              </div>
              {filteredCampaigns.map((campaign) => (
                <CampaignRow key={campaign.id} campaign={campaign} />
              ))}
              {filteredCampaigns.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm text-gray-400">No campaigns match this filter</p>
                </div>
              )}
            </div>

            {/* Bottom cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Megaphone className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Campaign Builder</h3>
                    <p className="text-xs text-gray-400">Drag-and-drop email and SMS builder</p>
                  </div>
                </div>
                <div className="h-40 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <Megaphone className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-400">Select a campaign to edit</p>
                    <p className="text-xs text-gray-300 mt-1">or create a new one</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-violet-50 flex items-center justify-center">
                    <Eye className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Email Preview</h3>
                    <p className="text-xs text-gray-400">Desktop and mobile preview</p>
                  </div>
                </div>
                <div className="h-40 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <Mail className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-400">No email selected</p>
                    <p className="text-xs text-gray-300 mt-1">Preview will appear here</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'Automations' && (
          <motion.div key="automations" {...fadeInUp}>
            <AutomationFlow />
          </motion.div>
        )}

        {activeTab === 'Community' && (
          <motion.div key="community" {...fadeInUp} className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-gray-900">Community Board</h3>
                <p className="text-sm text-gray-500">Manage posts from trainers, studio, and members</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                  <Clock className="h-3 w-3" />
                  1 pending review
                </span>
              </div>
            </div>
            {COMMUNITY_POSTS.map((post) => (
              <CommunityPostCard key={post.id} post={post} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
