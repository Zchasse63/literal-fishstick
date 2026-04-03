'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
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

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
interface MemberProfile {
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

const PLAN_TIERS = [
  { key: 'unlimited', label: 'Unlimited', price: '$225/mo', tier: 3 },
  { key: '10_class', label: '10-Class Pack', price: '$180/mo', tier: 2 },
  { key: '6_class', label: '6-Class Pack', price: '$120/mo', tier: 1 },
] as const

interface Booking {
  className: string
  startsAt: string
  status: string
}

interface Transaction {
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email Preferences</h3>
        {saving && <Loader2 className="h-3 w-3 text-gray-300 animate-spin" />}
      </div>
      <div className="space-y-2">
        {prefItems.map(item => (
          <label key={item.key} className="flex items-center justify-between cursor-pointer group">
            <span className="text-xs text-gray-700">{item.label}</span>
            <button
              onClick={() => togglePref(item.key)}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                prefs?.[item.key] ? 'bg-indigo-600' : 'bg-gray-200'
              )}
            >
              <span className={cn(
                'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm',
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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Send SMS</h3>
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
        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
export default function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const supabase = useRef(createBrowserClient()).current
  const [member, setMember] = useState<MemberProfile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'financials'>('overview')
  const [planActionLoading, setPlanActionLoading] = useState(false)
  const [planActionMsg, setPlanActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmPlan, setConfirmPlan] = useState<{ key: string; label: string; direction: 'upgrade' | 'downgrade' } | null>(null)

  const fetchMember = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select(`
          id, profile_id, membership_tier, membership_status, credits_remaining, total_visits,
          join_date, notes, last_visit, lifetime_value,
          profiles!inner ( full_name, email, phone, avatar_url )
        `)
        .eq('id', id)
        .eq('studio_id', STUDIO_ID)
        .single()

      if (error || !data) {
        setLoading(false)
        return
      }

      const profile = (data as any).profiles
      const fullName = profile.full_name || 'Unknown'
      const parts = fullName.trim().split(/\s+/)
      const tierInfo = mapTier(data.membership_tier)

      setMember({
        id: data.id,
        profileId: data.profile_id,
        firstName: parts[0] || fullName,
        lastName: parts.length >= 2 ? parts.slice(1).join(' ') : '',
        email: profile.email || '',
        phone: profile.phone || '',
        avatar: getInitials(fullName),
        avatarColor: getAvatarColor(fullName),
        ...tierInfo,
        status: mapStatus(data.membership_status, data.join_date, data.last_visit),
        lastVisit: formatLastVisit(data.last_visit),
        credits: data.credits_remaining > 0 || tierInfo.membershipType !== 'unlimited' ? data.credits_remaining : null,
        ltv: Math.round((data.lifetime_value || 0) / 100),
        joinDate: formatDate(data.join_date),
        totalVisits: data.total_visits || 0,
        avgVisitsPerWeek: data.total_visits
          ? Math.round((data.total_visits / Math.max(1, Math.ceil((Date.now() - new Date(data.join_date).getTime()) / (7 * 24 * 60 * 60 * 1000)))) * 10) / 10
          : 0,
        nextBilling: data.membership_status === 'paused' ? 'Paused' : 'N/A',
        notes: data.notes,
        guidedSessions: 0,
      })

      // Fetch related data
      const [bookingsRes, txRes, tagsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('status, checked_in_at, classes!inner ( title, starts_at )')
          .eq('member_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('transactions')
          .select('amount, type, status, description, created_at')
          .eq('member_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('member_tags')
          .select('tag')
          .eq('member_id', id),
      ])

      if (bookingsRes.data) {
        setBookings(bookingsRes.data.map((b: any) => ({
          className: b.classes?.title || 'Unknown',
          startsAt: b.classes?.starts_at || '',
          status: b.status,
        })))
      }
      if (txRes.data) {
        setTransactions(txRes.data.map((t: any) => ({
          amount: t.amount,
          type: t.type,
          status: t.status,
          description: t.description,
          createdAt: t.created_at,
        })))
      }
      if (tagsRes.data) {
        setTags(tagsRes.data.map((t: any) => t.tag))
      }
    } catch (err) {
      console.error('Error fetching member:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, id])

  useEffect(() => {
    fetchMember()
  }, [fetchMember])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <div className="mb-6">
          <Link href="/members" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Members
          </Link>
        </div>
        <ProfileSkeleton />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <div className="mb-6">
          <Link href="/members" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Members
          </Link>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-500">Member not found.</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div {...fadeInUp} className="min-h-screen bg-[#FAFAFA]">
      {/* Back link */}
      <div className="mb-6">
        <Link href="/members" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Members
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Profile + Stats */}
        <div className="lg:col-span-1 space-y-4">
          {/* Profile Header */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                'h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-bold',
                member.avatarColor
              )}>
                {member.avatar}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {member.firstName} {member.lastName}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border',
                    membershipBadgeColor(member.membershipType)
                  )}>
                    {member.membership}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className={cn('h-1.5 w-1.5 rounded-full', statusDot(member.status))} />
                    <span className="text-xs text-gray-500">{statusLabel(member.status)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">Joined {member.joinDate}</p>
              </div>
            </div>

            {/* Contact */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors">
                <Mail className="h-3 w-3" />
                Email
              </a>
              {member.phone && (
                <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors">
                  <Phone className="h-3 w-3" />
                  Call
                </a>
              )}
            </div>

            {/* Contact details */}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Email</span>
                <span className="text-xs text-gray-700">{member.email}</span>
              </div>
              {member.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Phone</span>
                  <span className="text-xs text-gray-700">{member.phone}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[11px] font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Lifetime Value', value: `$${member.ltv.toLocaleString()}`, icon: TrendingUp },
              { label: 'Total Visits', value: member.totalVisits.toString(), icon: Activity },
              { label: 'Avg Visits/Wk', value: member.avgVisitsPerWeek.toFixed(1), icon: Flame },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stat.label}</p>
                <p className="text-xl font-black text-gray-900 tabular-nums leading-tight mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Credits</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">
                {member.credits !== null ? member.credits : '\u221E'}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Last Visit</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">{member.lastVisit}</p>
            </div>
          </div>

          {/* AI Insights */}
          <div className="rounded-xl p-[1px] bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500">
            <div className="bg-white rounded-[11px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">AI Predictive Insights</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className={cn(
                    'mt-0.5 h-5 w-5 rounded-md flex items-center justify-center shrink-0',
                    member.status === 'at-risk' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
                  )}>
                    {member.status === 'at-risk' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">
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
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{member.notes}</p>
            </div>
          )}
        </div>

        {/* Right column — Tabbed content */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {(['overview', 'history', 'financials'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-1 py-3.5 text-sm font-semibold transition-colors relative capitalize',
                    activeTab === tab ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
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
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Membership Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Plan</p>
                        <p className="text-sm font-medium text-gray-900 mt-1">{member.membership}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Price</p>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          {member.membershipPrice > 0 ? `$${member.membershipPrice}/mo` : '--'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className={cn('h-2 w-2 rounded-full', statusDot(member.status))} />
                          <span className="text-sm text-gray-900">{statusLabel(member.status)}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Next Billing</p>
                        <p className="text-sm font-medium text-gray-900 mt-1">{member.nextBilling}</p>
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
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Change Plan</h3>

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
                            <p className="text-sm font-semibold text-gray-900 mb-1">
                              {confirmPlan.direction === 'upgrade' ? 'Upgrade' : 'Downgrade'} to {confirmPlan.label}?
                            </p>
                            <p className="text-xs text-gray-500 mb-3">
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
                                    fetchMember()
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
                                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
                              >
                                <TrendingDown className="h-3 w-3" />
                                Downgrade to {p.label}
                              </button>
                            ))}
                            {upgrades.length === 0 && downgrades.length === 0 && (
                              <p className="text-xs text-gray-400">No plan changes available</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Recent Bookings */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Bookings</h3>
                    {bookings.length === 0 ? (
                      <p className="text-sm text-gray-400">No bookings found.</p>
                    ) : (
                      <div className="space-y-2">
                        {bookings.slice(0, 5).map((b, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-3">
                              <CalendarDays className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{b.className}</p>
                                <p className="text-xs text-gray-400">
                                  {b.startsAt ? formatDate(b.startsAt) : 'Unknown date'}
                                </p>
                              </div>
                            </div>
                            <span className={cn(
                              'text-xs font-semibold px-2 py-0.5 rounded-full',
                              b.status === 'checked_in' ? 'bg-emerald-50 text-emerald-700' :
                              b.status === 'booked' ? 'bg-indigo-50 text-indigo-700' :
                              b.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                              'bg-gray-100 text-gray-500'
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
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Visit History</h3>
                  {bookings.length === 0 ? (
                    <p className="text-sm text-gray-400">No visit history.</p>
                  ) : (
                    <div className="space-y-2">
                      {bookings.map((b, i) => (
                        <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                              <CalendarDays className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{b.className}</p>
                              <p className="text-xs text-gray-400">
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
                            'bg-gray-100 text-gray-500'
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
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Transaction History</h3>
                  {transactions.length === 0 ? (
                    <p className="text-sm text-gray-400">No transactions found.</p>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx, i) => (
                        <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                              <CreditCard className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 capitalize">{tx.type.replace('_', ' ')}</p>
                              <p className="text-xs text-gray-400">
                                {tx.createdAt ? formatDate(tx.createdAt) : '--'}
                                {tx.description && ` — ${tx.description}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900 tabular-nums">
                              ${(tx.amount / 100).toFixed(2)}
                            </p>
                            <span className={cn(
                              'text-[10px] font-semibold',
                              tx.status === 'completed' ? 'text-emerald-600' :
                              tx.status === 'refunded' ? 'text-red-500' :
                              'text-gray-400'
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
