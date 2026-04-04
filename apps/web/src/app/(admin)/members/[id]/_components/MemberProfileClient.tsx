'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Phone,
  Tag,
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  Sparkles,
  Zap,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  Clock,
  Loader2,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
export interface MemberProfile {
  id: string
  profileId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  avatar: string
  avatarColor: string
  membership: string
  membershipType: 'unlimited' | '10-class' | '6-class' | 'credit-pack'
  membershipPrice: number
  status: 'active' | 'paused' | 'at-risk' | 'new'
  lastVisit: string
  credits: number | null
  ltv: number
  joinDate: string
  totalVisits: number
  avgVisitsPerWeek: number
  nextBilling: string
  notes: string | null
  guidedSessions: number
}

export type EngagementStatus = 'engaged' | 'active' | 'cooling' | 'at_risk' | 'lapsed' | 'never_visited'
export type BehaviorSegment = 'power_user' | 'classpass_repeat' | 'new_never_booked' | 'one_and_done' | 'regular'
export type AcquisitionChannel = 'classpass' | 'website' | 'direct' | 'mobile_app'

export interface Member360Data {
  engagementStatus: EngagementStatus | null
  behaviorSegment: BehaviorSegment | null
  acquisitionChannel: AcquisitionChannel | null
  planName: string | null
  totalVisits: number
  daysSinceLastVisit: number | null
  favoriteClassType: string | null
  avgVisitsPerMonth: number | null
  churnRisk: string | null
}

const PLAN_TIERS = [
  { key: 'unlimited', label: 'Unlimited', price: '$225/mo', tier: 3 },
  { key: '10_class', label: '10-Class Pack', price: '$180/mo', tier: 2 },
  { key: '6_class', label: '6-Class Pack', price: '$120/mo', tier: 1 },
] as const

export interface Booking {
  className: string
  startsAt: string
  status: string
}

export interface Transaction {
  amount: number
  type: string
  status: string
  description: string | null
  createdAt: string
}

// ─── Helpers ────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-pink-500', 'bg-sky-500', 'bg-rose-500', 'bg-teal-500',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getAvatarColor(name: string) {
  return AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length]
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (fullName[0] || '?').toUpperCase()
}

function mapTier(tier: string | null) {
  switch (tier) {
    case 'unlimited': return { membership: 'Unlimited', membershipType: 'unlimited' as const, membershipPrice: 225 }
    case '10_class': return { membership: '10-Class Pack', membershipType: '10-class' as const, membershipPrice: 180 }
    case '6_class': return { membership: '6-Class Pack', membershipType: '6-class' as const, membershipPrice: 120 }
    default: return { membership: tier || 'Unknown', membershipType: 'credit-pack' as const, membershipPrice: 0 }
  }
}

function statusDot(status: MemberProfile['status']) {
  const colors: Record<MemberProfile['status'], string> = {
    active: 'bg-emerald-500', paused: 'bg-amber-500', 'at-risk': 'bg-orange-500', new: 'bg-indigo-500',
  }
  return colors[status]
}

function statusLabel(status: MemberProfile['status']) {
  const labels: Record<MemberProfile['status'], string> = {
    active: 'Active', paused: 'Paused', 'at-risk': 'At Risk', new: 'New',
  }
  return labels[status]
}

function membershipBadgeColor(type: MemberProfile['membershipType']) {
  const colors: Record<MemberProfile['membershipType'], string> = {
    unlimited: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    '10-class': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    '6-class': 'bg-amber-50 text-amber-700 border-amber-200',
    'credit-pack': 'bg-violet-50 text-violet-700 border-violet-200',
  }
  return colors[type]
}

// ─── Member 360 Helpers ────────────────────────────────────
function acquisitionBadge(channel: AcquisitionChannel | null) {
  if (!channel) return null
  const config: Record<AcquisitionChannel, { label: string; classes: string }> = {
    classpass: { label: 'ClassPass', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
    website: { label: 'Website', classes: 'bg-gray-50 text-gray-600 border-gray-200' },
    direct: { label: 'Direct', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    mobile_app: { label: 'Mobile App', classes: 'bg-purple-50 text-purple-700 border-purple-200' },
  }
  return config[channel] || null
}

function engagementConfig(status: EngagementStatus | null) {
  if (!status) return null
  const config: Record<EngagementStatus, { label: string; dotColor: string }> = {
    engaged: { label: 'Engaged', dotColor: 'bg-emerald-500' },
    active: { label: 'Active', dotColor: 'bg-blue-500' },
    cooling: { label: 'Cooling Off', dotColor: 'bg-yellow-500' },
    at_risk: { label: 'At Risk', dotColor: 'bg-orange-500' },
    lapsed: { label: 'Lapsed', dotColor: 'bg-red-500' },
    never_visited: { label: 'Never Visited', dotColor: 'bg-gray-400' },
  }
  return config[status] || null
}

function behaviorTag(segment: BehaviorSegment | null) {
  if (!segment) return null
  const config: Record<BehaviorSegment, { label: string; classes: string }> = {
    power_user: { label: 'Power User', classes: 'bg-purple-100 text-purple-700' },
    classpass_repeat: { label: 'ClassPass Repeat', classes: 'bg-blue-100 text-blue-700' },
    new_never_booked: { label: 'Never Booked', classes: 'bg-red-100 text-red-700' },
    one_and_done: { label: 'One & Done', classes: 'bg-orange-100 text-orange-700' },
    regular: { label: 'Regular', classes: 'bg-emerald-100 text-emerald-700' },
  }
  return config[segment] || null
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatLastVisit(dt: string | null): string {
  if (!dt) return 'Never'
  const diffDays = Math.floor((Date.now() - new Date(dt).getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

function mapStatus(dbStatus: string, joinDate: string, lastVisit: string | null): MemberProfile['status'] {
  if (dbStatus === 'paused') return 'paused'
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  if (new Date(joinDate) >= thirtyDaysAgo) return 'new'
  if (dbStatus === 'active' && lastVisit && new Date(lastVisit) < thirtyDaysAgo) return 'at-risk'
  return 'active'
}

// ─── Skeleton ───────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
            <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-8 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Email Preferences Panel ────────────────────────────────
function EmailPreferencesPanel({ memberId }: { memberId: string }) {
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/email-preferences/${memberId}`)
      .then(r => r.json())
      .then(json => { if (json.data) setPrefs(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [memberId])

  async function togglePref(key: string) {
    if (!prefs) return
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    setSaving(true)
    try {
      await fetch(`/api/email-preferences/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: updated[key] }),
      })
    } catch {} finally { setSaving(false) }
  }

  if (loading) return null

  const prefItems = [
    { key: 'marketing_email', label: 'Marketing Emails' },
    { key: 'booking_confirmations', label: 'Booking Confirmations' },
    { key: 'booking_reminders', label: 'Booking Reminders' },
    { key: 'membership_updates', label: 'Membership Updates' },
    { key: 'promotions', label: 'Promotions' },
    { key: 'newsletter', label: 'Newsletter' },
  ]

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Email Preferences</h3>
        {saving && <Loader2 className="h-3 w-3 text-gray-300 animate-spin" />}
      </div>
      <div className="space-y-2">
        {prefItems.map(item => (
          <label key={item.key} className="flex items-center justify-between cursor-pointer group">
            <span className="text-xs text-gray-700 dark:text-gray-300">{item.label}</span>
            <button
              onClick={() => togglePref(item.key)}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                prefs?.[item.key] ? 'bg-indigo-600' : 'bg-gray-200'
              )}
            >
              <span className={cn(
                'inline-block h-3.5 w-3.5 rounded-full bg-white dark:bg-gray-950 transition-transform shadow-sm',
                prefs?.[item.key] ? 'translate-x-4' : 'translate-x-0.5'
              )} />
            </button>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── SMS Compose Panel ──────────────────────────────────────
function SMSComposePanel({ phone }: { phone: string }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSend() {
    if (!message.trim() || !phone) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, body: message }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Send failed')
      setResult({ type: 'success', text: 'SMS sent successfully' })
      setMessage('')
    } catch (err: any) {
      setResult({ type: 'error', text: err.message })
    } finally {
      setSending(false)
    }
  }

  if (!phone) return null

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Send SMS</h3>
      {result && (
        <div className={cn(
          'rounded-lg p-2 text-xs mb-2',
          result.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        )}>
          {result.text}
        </div>
      )}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
        rows={2}
        className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
      <button
        onClick={handleSend}
        disabled={sending || !message.trim()}
        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
        Send SMS
      </button>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────
export interface MemberProfileClientProps {
  member: MemberProfile | null
  member360: Member360Data | null
  bookings: Booking[]
  transactions: Transaction[]
  tags: string[]
}

export default function MemberProfileClient({
  member: initialMember,
  member360,
  bookings: initialBookings,
  transactions: initialTransactions,
  tags: initialTags,
}: MemberProfileClientProps) {
  const [member] = useState<MemberProfile | null>(initialMember)
  const [bookings] = useState<Booking[]>(initialBookings)
  const [transactions] = useState<Transaction[]>(initialTransactions)
  const [tags] = useState<string[]>(initialTags)
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'financials'>('overview')
  const [planActionLoading, setPlanActionLoading] = useState(false)
  const [planActionMsg, setPlanActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmPlan, setConfirmPlan] = useState<{ key: string; label: string; direction: 'upgrade' | 'downgrade' } | null>(null)

  if (!member) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]">
        <div className="mb-6">
          <Link href="/members" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Members
          </Link>
        </div>
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Member not found.</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div {...fadeInUp} className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]">
      {/* Back link */}
      <div className="mb-6">
        <Link href="/members" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Members
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Profile + Stats */}
        <div className="lg:col-span-1 space-y-4">
          {/* Profile Header */}
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                'h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-bold',
                member.avatarColor
              )}>
                {member.avatar}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {member.firstName} {member.lastName}
                  </h1>
                  {/* Acquisition channel badge */}
                  {member360?.acquisitionChannel && (() => {
                    const acq = acquisitionBadge(member360.acquisitionChannel)
                    return acq ? (
                      <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border', acq.classes)}>
                        {acq.label}
                      </span>
                    ) : null
                  })()}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border',
                    membershipBadgeColor(member.membershipType)
                  )}>
                    {member360?.planName || member.membership}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className={cn('h-1.5 w-1.5 rounded-full', statusDot(member.status))} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{statusLabel(member.status)}</span>
                  </div>
                </div>
                {/* Engagement status + behavior segment */}
                {member360 && (member360.engagementStatus || member360.behaviorSegment) && (
                  <div className="flex items-center gap-2 mt-1.5">
                    {member360.engagementStatus && (() => {
                      const eng = engagementConfig(member360.engagementStatus)
                      return eng ? (
                        <div className="flex items-center gap-1">
                          <div className={cn('h-2 w-2 rounded-full', eng.dotColor)} />
                          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{eng.label}</span>
                        </div>
                      ) : null
                    })()}
                    {member360.behaviorSegment && (() => {
                      const seg = behaviorTag(member360.behaviorSegment)
                      return seg ? (
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold', seg.classes)}>
                          {seg.label}
                        </span>
                      ) : null
                    })()}
                  </div>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Joined {member.joinDate}</p>
              </div>
            </div>

            {/* Contact */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 transition-colors">
                <Mail className="h-3 w-3" />
                Email
              </a>
              {member.phone && (
                <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 transition-colors">
                  <Phone className="h-3 w-3" />
                  Call
                </a>
              )}
            </div>

            {/* Contact details */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">Email</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">{member.email}</span>
              </div>
              {member.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Phone</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">{member.phone}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[11px] font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Lifetime Value', value: `$${member.ltv.toLocaleString()}` },
              { label: 'Total Visits', value: (member360?.totalVisits ?? member.totalVisits).toString() },
              { label: 'Avg Visits/Wk', value: member.avgVisitsPerWeek.toFixed(1) },
            ].map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{stat.label}</p>
                <p className="text-xl font-black text-gray-900 dark:text-gray-100 tabular-nums leading-tight mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Credits</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">
                {member.credits !== null ? member.credits : '\u221E'}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Last Visit</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">
                {member360?.daysSinceLastVisit != null
                  ? member360.daysSinceLastVisit === 0 ? 'Today' : `${member360.daysSinceLastVisit}d ago`
                  : member.lastVisit}
              </p>
            </div>
          </div>

          {/* Favorite Class + Churn Risk (from member_360) */}
          {member360 && (member360.favoriteClassType || member360.churnRisk) && (
            <div className="grid grid-cols-2 gap-2">
              {member360.favoriteClassType && (
                <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Fav. Class</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">{member360.favoriteClassType}</p>
                </div>
              )}
              {member360.avgVisitsPerMonth != null && (
                <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Visits/Mo</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">{member360.avgVisitsPerMonth.toFixed(1)}</p>
                </div>
              )}
            </div>
          )}

          {/* AI Insights */}
          <div className="rounded-xl p-[1px] bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500">
            <div className="bg-white dark:bg-gray-950 rounded-[11px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">AI Predictive Insights</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className={cn(
                    'mt-0.5 h-5 w-5 rounded-md flex items-center justify-center shrink-0',
                    member.status === 'at-risk' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
                  )}>
                    {member.status === 'at-risk' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    {member.status === 'at-risk'
                      ? `Visit frequency declining. Churn probability elevated. Consider a personal re-engagement.`
                      : `Strong retention pattern. ${member.avgVisitsPerWeek >= 3 ? 'Power user — candidate for referral program.' : 'Consistent visitor — trending toward upgrade.'}`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Email Preferences */}
          <EmailPreferencesPanel memberId={member.id} />

          {/* SMS Compose */}
          <SMSComposePanel phone={member.phone} />

          {/* Notes */}
          {member.notes && (
            <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Notes</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{member.notes}</p>
            </div>
          )}
        </div>

        {/* Right column — Tabbed content */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-800">
              {(['overview', 'history', 'financials'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-1 py-3.5 text-sm font-semibold transition-colors relative capitalize',
                    activeTab === tab ? 'text-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="memberProfileTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* Overview tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Membership Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Plan</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{member.membership}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Price</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                          {member.membershipPrice > 0 ? `$${member.membershipPrice}/mo` : '--'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Status</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className={cn('h-2 w-2 rounded-full', statusDot(member.status))} />
                          <span className="text-sm text-gray-900 dark:text-gray-100">{statusLabel(member.status)}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Next Billing</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{member.nextBilling}</p>
                      </div>
                    </div>
                  </div>

                  {/* Plan Actions */}
                  {member.membershipType !== 'credit-pack' && (() => {
                    const currentTier = PLAN_TIERS.find(p => p.key === member.membershipType.replace('-', '_'))?.tier ?? 0
                    const upgrades = PLAN_TIERS.filter(p => p.tier > currentTier)
                    const downgrades = PLAN_TIERS.filter(p => p.tier < currentTier)

                    return (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Change Plan</h3>

                        {planActionMsg && (
                          <div className={cn(
                            'rounded-xl p-3 text-sm mb-3',
                            planActionMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
                          )}>
                            {planActionMsg.text}
                          </div>
                        )}

                        {confirmPlan ? (
                          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                              {confirmPlan.direction === 'upgrade' ? 'Upgrade' : 'Downgrade'} to {confirmPlan.label}?
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                              {confirmPlan.direction === 'upgrade'
                                ? 'Immediate with Stripe proration — member will be charged the difference today.'
                                : 'Takes effect at next billing cycle — member keeps current plan until then.'}
                            </p>
                            <div className="flex gap-2">
                              <button
                                disabled={planActionLoading}
                                onClick={async () => {
                                  setPlanActionLoading(true)
                                  setPlanActionMsg(null)
                                  try {
                                    const endpoint = confirmPlan.direction === 'upgrade' ? 'upgrade' : 'downgrade'
                                    const res = await fetch(`/api/members/${member.profileId}/${endpoint}`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ new_plan: confirmPlan.key }),
                                    })
                                    const json = await res.json()
                                    if (!res.ok) throw new Error(json.error || 'Failed')
                                    setPlanActionMsg({ type: 'success', text: `Plan ${confirmPlan.direction === 'upgrade' ? 'upgraded' : 'downgrade scheduled'} successfully.` })
                                    setConfirmPlan(null)
                                  } catch (err: any) {
                                    setPlanActionMsg({ type: 'error', text: err.message })
                                  } finally {
                                    setPlanActionLoading(false)
                                  }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                              >
                                {planActionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmPlan(null)}
                                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {upgrades.map(p => (
                              <button
                                key={p.key}
                                onClick={() => setConfirmPlan({ key: p.key, label: p.label, direction: 'upgrade' })}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                              >
                                <TrendingUp className="h-3 w-3" />
                                Upgrade to {p.label}
                              </button>
                            ))}
                            {downgrades.map(p => (
                              <button
                                key={p.key}
                                onClick={() => setConfirmPlan({ key: p.key, label: p.label, direction: 'downgrade' })}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                <TrendingDown className="h-3 w-3" />
                                Downgrade to {p.label}
                              </button>
                            ))}
                            {upgrades.length === 0 && downgrades.length === 0 && (
                              <p className="text-xs text-gray-400 dark:text-gray-500">No plan changes available</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Recent Bookings */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Recent Bookings</h3>
                    {bookings.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500">No bookings found.</p>
                    ) : (
                      <div className="space-y-2">
                        {bookings.slice(0, 5).map((b, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-3">
                              <CalendarDays className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.className}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  {b.startsAt ? formatDate(b.startsAt) : 'Unknown date'}
                                </p>
                              </div>
                            </div>
                            <span className={cn(
                              'text-xs font-semibold px-2 py-0.5 rounded-full',
                              b.status === 'checked_in' ? 'bg-emerald-50 text-emerald-700' :
                              b.status === 'booked' ? 'bg-indigo-50 text-indigo-700' :
                              b.status === 'cancelled' ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' :
                              'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            )}>
                              {b.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* History tab */}
              {activeTab === 'history' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Visit History</h3>
                  {bookings.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">No visit history.</p>
                  ) : (
                    <div className="space-y-2">
                      {bookings.map((b, i) => (
                        <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                              <CalendarDays className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.className}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {b.startsAt ? new Date(b.startsAt).toLocaleString('en-US', {
                                  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                }) : '--'}
                              </p>
                            </div>
                          </div>
                          <span className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full',
                            b.status === 'checked_in' ? 'bg-emerald-50 text-emerald-700' :
                            b.status === 'no_show' ? 'bg-red-50 text-red-600' :
                            'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                          )}>
                            {b.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Financials tab */}
              {activeTab === 'financials' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Transaction History</h3>
                  {transactions.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">No transactions found.</p>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx, i) => (
                        <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                              <CreditCard className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{tx.type.replace('_', ' ')}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {tx.createdAt ? formatDate(tx.createdAt) : '--'}
                                {tx.description && ` — ${tx.description}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                              ${(tx.amount / 100).toFixed(2)}
                            </p>
                            <span className={cn(
                              'text-[10px] font-semibold',
                              tx.status === 'completed' ? 'text-emerald-600' :
                              tx.status === 'refunded' ? 'text-red-500' :
                              'text-gray-400 dark:text-gray-500'
                            )}>
                              {tx.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
