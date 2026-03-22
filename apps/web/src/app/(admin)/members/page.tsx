'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Search,
  Plus,
  MoreHorizontal,
  X,
  Sparkles,
  CreditCard,
  CalendarDays,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  ChevronRight,
  Tag,
  Heart,
  Flame,
  Zap,
  AlertTriangle,
  Pause,
  ArrowUp,
  Mail,
  Phone,
  Loader2,
} from 'lucide-react'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

// ─── Types ──────────────────────────────────────────────────
type FilterTab = 'All' | 'Active' | 'Paused' | 'At Risk' | 'New'
type ProfileTab = 'Overview' | 'History' | 'Financials' | 'Communications'

interface Member {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  avatar: string // initials
  avatarColor: string
  membership: string
  membershipPrice: number
  membershipType: 'unlimited' | '10-class' | '6-class' | 'credit-pack'
  status: 'active' | 'paused' | 'at-risk' | 'new'
  lastVisit: string
  credits: number | null
  ltv: number
  joinDate: string
  totalVisits: number
  avgVisitsPerWeek: number
  nextBilling: string
  paymentMethod: string
  preferredTime: string
  preferredType: string
  guidedSessions: number
  avgDuration: string
  notes: string | null
}

interface MemberBooking {
  className: string
  startsAt: string
  status: string
}

interface MemberTransaction {
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
  'bg-cyan-500', 'bg-fuchsia-500', 'bg-lime-500', 'bg-orange-500',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length]
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return (fullName[0] || '?').toUpperCase()
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
  }
  return { firstName: fullName, lastName: '' }
}

function mapTier(tier: string | null): { membership: string; membershipType: Member['membershipType']; membershipPrice: number } {
  switch (tier) {
    case 'unlimited':
      return { membership: 'Unlimited', membershipType: 'unlimited', membershipPrice: 225 }
    case '10_class':
      return { membership: '10-Class Pack', membershipType: '10-class', membershipPrice: 180 }
    case '6_class':
      return { membership: '6-Class Pack', membershipType: '6-class', membershipPrice: 120 }
    case 'credit_pack':
    case 'credit-pack':
      return { membership: 'Credit Pack', membershipType: 'credit-pack', membershipPrice: 120 }
    default:
      return { membership: tier || 'Unknown', membershipType: 'credit-pack', membershipPrice: 0 }
  }
}

function mapStatus(dbStatus: string, joinDate: string, lastVisit: string | null, creditsRemaining: number = 0): Member['status'] {
  // Billing status takes precedence
  if (dbStatus === 'paused') return 'paused'
  if (dbStatus === 'cancelled') return 'at-risk'
  if (dbStatus === 'past_due') return 'at-risk'

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // "New" = joined in the last 30 days AND has active/none status
  if (dbStatus === 'active' || dbStatus === 'none') {
    const joinDt = new Date(joinDate)
    if (joinDt >= thirtyDaysAgo) return 'new'
  }

  // For "active" billing status, classify by engagement
  if (dbStatus === 'active') {
    // Never visited = at risk
    if (!lastVisit) return 'at-risk'
    const lastDt = new Date(lastVisit)
    if (lastDt >= thirtyDaysAgo) return 'active'    // Visited in last 30 days
    if (lastDt >= ninetyDaysAgo) return 'at-risk'    // 30-90 days ago
    return 'at-risk'                                  // 90+ days = at risk
  }

  // "none" status — check if they have credits (credit-pack members)
  if (dbStatus === 'none') {
    if (creditsRemaining > 0) {
      if (!lastVisit) return 'at-risk'
      const lastDt = new Date(lastVisit)
      if (lastDt >= thirtyDaysAgo) return 'active'
      return 'at-risk'
    }
    return 'at-risk' // No plan, no credits
  }

  return 'active'
}

function formatLastVisit(dt: string | null): string {
  if (!dt) return 'Never'
  const visitDate = new Date(dt)
  const now = new Date()
  const diffMs = now.getTime() - visitDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

function formatJoinDate(dt: string): string {
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusDot(status: Member['status']) {
  const colors: Record<Member['status'], string> = {
    active: 'bg-emerald-500',
    paused: 'bg-amber-500',
    'at-risk': 'bg-orange-500',
    new: 'bg-indigo-500',
  }
  return colors[status]
}

function statusLabel(status: Member['status']) {
  const labels: Record<Member['status'], string> = {
    active: 'Active',
    paused: 'Paused',
    'at-risk': 'At Risk',
    new: 'New',
  }
  return labels[status]
}

function membershipBadgeColor(type: Member['membershipType']) {
  const colors: Record<Member['membershipType'], string> = {
    unlimited: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    '10-class': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    '6-class': 'bg-amber-50 text-amber-700 border-amber-200',
    'credit-pack': 'bg-violet-50 text-violet-700 border-violet-200',
  }
  return colors[type]
}

// ─── Heatmap Data (simplified GitHub-style) ─────────────────
const HEATMAP_WEEKS = 12
const HEATMAP_DAYS = 7
function generateHeatmap() {
  const data: number[][] = []
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const week: number[] = []
    for (let d = 0; d < HEATMAP_DAYS; d++) {
      const base = d < 5 ? 0.6 : 0.3
      week.push(Math.random() < base ? Math.floor(Math.random() * 4) + 1 : 0)
    }
    data.push(week)
  }
  return data
}

const heatmapData = generateHeatmap()

function heatmapColor(val: number) {
  if (val === 0) return 'bg-gray-100'
  if (val === 1) return 'bg-indigo-100'
  if (val === 2) return 'bg-indigo-200'
  if (val === 3) return 'bg-indigo-400'
  return 'bg-indigo-600'
}

// ─── Loading Skeleton ───────────────────────────────────────
function MemberRowSkeleton() {
  return (
    <tr className="border-b border-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-36 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell"><div className="h-6 w-20 bg-gray-100 rounded-lg animate-pulse" /></td>
      <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 w-14 bg-gray-100 rounded animate-pulse" /></td>
      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-16 bg-gray-100 rounded animate-pulse" /></td>
      <td className="px-4 py-3 hidden md:table-cell text-right"><div className="h-4 w-6 bg-gray-100 rounded animate-pulse ml-auto" /></td>
      <td className="px-4 py-3 hidden lg:table-cell text-right"><div className="h-4 w-12 bg-gray-100 rounded animate-pulse ml-auto" /></td>
      <td className="px-4 py-3 text-right"><div className="h-8 w-8 bg-gray-100 rounded-lg animate-pulse ml-auto" /></td>
    </tr>
  )
}

// ─── Component ──────────────────────────────────────────────
export default function MembersPage() {
  const [filter, setFilter] = useState<FilterTab>('All')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [profileTab, setProfileTab] = useState<ProfileTab>('Overview')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ full_name: '', email: '', phone: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [filterCounts, setFilterCounts] = useState<Record<FilterTab, number>>({
    All: 0, Active: 0, Paused: 0, 'At Risk': 0, New: 0,
  })

  // Detail panel data
  const [memberBookings, setMemberBookings] = useState<MemberBooking[]>([])
  const [memberTransactions, setMemberTransactions] = useState<MemberTransaction[]>([])
  const [memberTags, setMemberTags] = useState<string[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const supabase = useRef(createBrowserClient()).current

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch members
  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('members')
        .select(`
          id, membership_tier, membership_status, credits_remaining, total_visits,
          join_date, notes, last_visit, lifetime_value,
          profiles!inner ( full_name, email, phone, avatar_url )
        `)
        .eq('studio_id', STUDIO_ID)
        .order('id', { ascending: true })
        .limit(50)

      // Apply search filter
      if (debouncedSearch) {
        query = query.or(
          `full_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`,
          { referencedTable: 'profiles' }
        )
      }

      // Apply status filter at DB level where possible
      if (filter === 'Active') {
        query = query.eq('membership_status', 'active')
      } else if (filter === 'Paused') {
        query = query.eq('membership_status', 'paused')
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching members:', error)
        setMembers([])
        setLoading(false)
        return
      }

      const mapped: Member[] = (data || []).map((row: any) => {
        const profile = row.profiles
        const fullName = profile.full_name || 'Unknown'
        const { firstName, lastName } = splitName(fullName)
        const tierInfo = mapTier(row.membership_tier)
        const computedStatus = mapStatus(row.membership_status, row.join_date, row.last_visit, row.credits_remaining ?? 0)

        return {
          id: row.id,
          firstName,
          lastName,
          email: profile.email || '',
          phone: profile.phone || '',
          avatar: getInitials(fullName),
          avatarColor: getAvatarColor(fullName),
          ...tierInfo,
          status: computedStatus,
          lastVisit: formatLastVisit(row.last_visit),
          credits: row.credits_remaining > 0 || tierInfo.membershipType !== 'unlimited' ? row.credits_remaining : null,
          ltv: Math.round((row.lifetime_value || 0) / 100),
          joinDate: formatJoinDate(row.join_date),
          totalVisits: row.total_visits || 0,
          avgVisitsPerWeek: row.total_visits
            ? Math.round((row.total_visits / Math.max(1, Math.ceil((Date.now() - new Date(row.join_date).getTime()) / (7 * 24 * 60 * 60 * 1000)))) * 10) / 10
            : 0,
          nextBilling: row.membership_status === 'paused' ? 'Paused' : 'N/A',
          paymentMethod: 'On file',
          preferredTime: '6:00 PM',
          preferredType: 'Open Sauna',
          guidedSessions: 0,
          avgDuration: '50 min',
          notes: row.notes,
        }
      })

      // Client-side filter for statuses we can't easily do at DB level
      let filtered = mapped
      if (filter === 'At Risk') {
        filtered = mapped.filter((m) => m.status === 'at-risk')
      } else if (filter === 'New') {
        filtered = mapped.filter((m) => m.status === 'new')
      }

      setMembers(filtered)
    } catch (err) {
      console.error('Error fetching members:', err)
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [supabase, debouncedSearch, filter])

  // Fetch filter counts
  const fetchCounts = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().split('T')[0]

      const [allRes, activeRes, pausedRes, newRes] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('studio_id', STUDIO_ID),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('studio_id', STUDIO_ID).eq('membership_status', 'active'),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('studio_id', STUDIO_ID).eq('membership_status', 'paused'),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('studio_id', STUDIO_ID).gte('join_date', thirtyDaysAgoISO),
      ])

      // For "at risk" count active members with last_visit > 30 days ago OR never visited (null)
      const atRiskRes = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', STUDIO_ID)
        .eq('membership_status', 'active')
        .or(`last_visit.lt.${thirtyDaysAgo.toISOString()},last_visit.is.null`)

      setFilterCounts({
        All: allRes.count || 0,
        Active: activeRes.count || 0,
        Paused: pausedRes.count || 0,
        'At Risk': atRiskRes.count || 0,
        New: newRes.count || 0,
      })
    } catch (err) {
      console.error('Error fetching counts:', err)
    }
  }, [supabase])

  // Fetch member detail data
  const fetchMemberDetail = useCallback(async (memberId: string) => {
    setDetailLoading(true)
    try {
      const [bookingsRes, txRes, tagsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('status, checked_in_at, classes!inner ( title, starts_at )')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('transactions')
          .select('amount, type, status, description, created_at')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('member_tags')
          .select('tag')
          .eq('member_id', memberId),
      ])

      if (bookingsRes.data) {
        setMemberBookings(bookingsRes.data.map((b: any) => ({
          className: b.classes?.title || 'Unknown',
          startsAt: b.classes?.starts_at || '',
          status: b.status,
        })))
      } else {
        setMemberBookings([])
      }

      if (txRes.data) {
        setMemberTransactions(txRes.data.map((t: any) => ({
          amount: t.amount,
          type: t.type,
          status: t.status,
          description: t.description,
          createdAt: t.created_at,
        })))
      } else {
        setMemberTransactions([])
      }

      if (tagsRes.data) {
        setMemberTags(tagsRes.data.map((t: any) => t.tag))
      } else {
        setMemberTags([])
      }
    } catch (err) {
      console.error('Error fetching member details:', err)
      setMemberBookings([])
      setMemberTransactions([])
      setMemberTags([])
    } finally {
      setDetailLoading(false)
    }
  }, [supabase])

  // Initial load + polling
  useEffect(() => {
    fetchMembers()
    fetchCounts()
    const interval = setInterval(() => {
      fetchMembers()
      fetchCounts()
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchMembers, fetchCounts])

  // Fetch detail when member selected
  useEffect(() => {
    if (selectedMember) {
      fetchMemberDetail(selectedMember.id)
    }
  }, [selectedMember, fetchMemberDetail])

  return (
    <motion.div {...fadeInUp}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── Left: Member Directory ──────────────────────────── */}
        <div className={cn(
          'transition-all duration-300',
          selectedMember ? 'lg:col-span-8' : 'lg:col-span-12'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Members</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {filterCounts.All} total members
              </p>
            </div>
            <button
              onClick={() => { setShowAddModal(true); setAddError(null); setAddForm({ full_name: '', email: '', phone: '' }) }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Member
            </button>
          </div>

          {/* Search + Filters */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(Object.keys(filterCounts) as FilterTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilter(tab)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                        filter === tab
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {tab}
                      <span className={cn(
                        'ml-1.5 text-[10px]',
                        filter === tab ? 'text-indigo-200' : 'text-gray-400'
                      )}>
                        {filterCounts[tab]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Member</span>
                    </th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Membership</span>
                    </th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</span>
                    </th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Last Visit</span>
                    </th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Credits</span>
                    </th>
                    <th className="text-right px-4 py-3 hidden lg:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">LTV</span>
                    </th>
                    <th className="text-right px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <MemberRowSkeleton key={i} />)
                  ) : (
                    <>
                      {members.map((member) => (
                        <tr
                          key={member.id}
                          onClick={() => {
                            setSelectedMember(member)
                            setProfileTab('Overview')
                          }}
                          className={cn(
                            'border-b border-gray-50 cursor-pointer transition-colors group',
                            selectedMember?.id === member.id
                              ? 'bg-indigo-50/60'
                              : 'hover:bg-gray-50/80'
                          )}
                        >
                          {/* Name + Avatar */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
                                member.avatarColor
                              )}>
                                {member.avatar}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {member.firstName} {member.lastName}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{member.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Membership Badge */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={cn(
                              'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border',
                              membershipBadgeColor(member.membershipType)
                            )}>
                              {member.membership}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <div className={cn('h-2 w-2 rounded-full', statusDot(member.status))} />
                              <span className="text-sm text-gray-700">{statusLabel(member.status)}</span>
                            </div>
                          </td>

                          {/* Last Visit */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-sm text-gray-600">{member.lastVisit}</span>
                          </td>

                          {/* Credits */}
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            <span className="text-sm font-medium text-gray-700 tabular-nums">
                              {member.credits !== null ? member.credits : '\u2014'}
                            </span>
                          </td>

                          {/* LTV */}
                          <td className="px-4 py-3 text-right hidden lg:table-cell">
                            <span className="text-sm font-semibold text-gray-900 tabular-nums">
                              ${member.ltv.toLocaleString()}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {members.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                            No members found matching your search.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Showing {members.length} of {filterCounts.All} members
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Member Profile Panel ────────────────────── */}
        <AnimatePresence mode="wait">
          {selectedMember && (
            <motion.div
              key={selectedMember.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className="lg:col-span-4 space-y-4"
            >
              {/* Profile Header Card */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-14 w-14 rounded-full flex items-center justify-center text-white text-lg font-bold',
                      selectedMember.avatarColor
                    )}>
                      {selectedMember.avatar}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {selectedMember.firstName} {selectedMember.lastName}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border',
                          membershipBadgeColor(selectedMember.membershipType)
                        )}>
                          {selectedMember.membership}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className={cn('h-1.5 w-1.5 rounded-full', statusDot(selectedMember.status))} />
                          <span className="text-xs text-gray-500">{statusLabel(selectedMember.status)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Joined {selectedMember.joinDate}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Contact Row */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors">
                    <Mail className="h-3 w-3" />
                    Email
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors">
                    <Phone className="h-3 w-3" />
                    Call
                  </button>
                  <span className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    <Tag className="h-2.5 w-2.5" />
                    10% Member Discount
                  </span>
                </div>

                {/* Tags */}
                {memberTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                    {memberTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[11px] font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Lifetime Value', value: `$${selectedMember.ltv.toLocaleString()}`, icon: TrendingUp },
                  { label: 'Total Visits', value: selectedMember.totalVisits.toString(), icon: Activity },
                  { label: 'Avg Visits/Wk', value: selectedMember.avgVisitsPerWeek.toFixed(1), icon: Flame },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stat.label}</p>
                    <p className="text-[28px] font-black text-gray-900 tabular-nums leading-tight mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Credits', value: selectedMember.credits !== null ? selectedMember.credits.toString() : '\u221E' },
                  { label: 'Last Visit', value: selectedMember.lastVisit },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stat.label}</p>
                    <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Profile Tabs */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex border-b border-gray-100">
                  {(['Overview', 'History', 'Financials', 'Communications'] as ProfileTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setProfileTab(tab)}
                      className={cn(
                        'flex-1 py-3 text-xs font-semibold transition-colors relative',
                        profileTab === tab
                          ? 'text-indigo-600'
                          : 'text-gray-500 hover:text-gray-700'
                      )}
                    >
                      {tab}
                      {profileTab === tab && (
                        <motion.div
                          layoutId="profileTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  <AnimatePresence mode="wait">
                    {profileTab === 'Overview' && (
                      <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4"
                      >
                        {/* AI Predictive Insights */}
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
                                  selectedMember.status === 'at-risk'
                                    ? 'bg-orange-100 text-orange-600'
                                    : 'bg-emerald-100 text-emerald-600'
                                )}>
                                  {selectedMember.status === 'at-risk' ? (
                                    <TrendingDown className="h-3 w-3" />
                                  ) : (
                                    <TrendingUp className="h-3 w-3" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs text-gray-700 leading-relaxed">
                                    {selectedMember.status === 'at-risk'
                                      ? `Visit frequency dropped ${selectedMember.avgVisitsPerWeek < 1 ? '68%' : '42%'} over 3 weeks. Churn probability: ${selectedMember.avgVisitsPerWeek < 1 ? '73%' : '55%'}. Consider a personal re-engagement.`
                                      : `Strong retention pattern. ${selectedMember.avgVisitsPerWeek >= 3 ? 'Power user' : 'Consistent visitor'} — ${selectedMember.avgVisitsPerWeek >= 3 ? 'candidate for referral program' : 'trending toward upgrade'}.`}
                                  </p>
                                  <button className="mt-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5 transition-colors">
                                    {selectedMember.status === 'at-risk' ? 'Send re-engagement' : 'View details'}
                                    <ArrowUpRight className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-start gap-2.5">
                                <div className="mt-0.5 h-5 w-5 rounded-md bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                                  <Zap className="h-3 w-3" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-700 leading-relaxed">
                                    {selectedMember.guidedSessions > 10
                                      ? `${selectedMember.guidedSessions} guided sessions attended. High affinity for instructor-led experiences — prime candidate for workshop invitations.`
                                      : `Primarily uses open sessions. Consider introducing to guided classes — members who try guided have 40% higher retention.`}
                                  </p>
                                  <button className="mt-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5 transition-colors">
                                    {selectedMember.guidedSessions > 10 ? 'Invite to workshop' : 'Suggest guided class'}
                                    <ArrowUpRight className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Active Membership */}
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Active Membership</h4>
                          <div className="rounded-xl border border-gray-200 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-900">{selectedMember.membership}</span>
                              <span className="text-sm font-bold text-gray-900 tabular-nums">${selectedMember.membershipPrice}/mo</span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Next Billing</span>
                                <span className="text-gray-700 font-medium">{selectedMember.nextBilling}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Payment Method</span>
                                <span className="text-gray-700 font-medium">{selectedMember.paymentMethod}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1.5">
                              {selectedMember.status !== 'paused' && (
                                <button className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                                  <Pause className="h-3 w-3" />
                                  Pause
                                </button>
                              )}
                              <button className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
                                <ArrowUp className="h-3 w-3" />
                                Upgrade
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Visit Activity Heatmap */}
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Visit Activity</h4>
                          <div className="rounded-xl border border-gray-200 p-3.5">
                            <div className="flex gap-0.5">
                              {heatmapData.map((week, wi) => (
                                <div key={wi} className="flex flex-col gap-0.5 flex-1">
                                  {week.map((val, di) => (
                                    <div
                                      key={di}
                                      className={cn(
                                        'aspect-square rounded-[3px] transition-colors',
                                        heatmapColor(val)
                                      )}
                                      title={`${val} session${val !== 1 ? 's' : ''}`}
                                    />
                                  ))}
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-end gap-1 mt-2">
                              <span className="text-[10px] text-gray-400 mr-1">Less</span>
                              {[0, 1, 2, 3, 4].map((v) => (
                                <div key={v} className={cn('h-2.5 w-2.5 rounded-[2px]', heatmapColor(v))} />
                              ))}
                              <span className="text-[10px] text-gray-400 ml-1">More</span>
                            </div>
                          </div>
                        </div>

                        {/* Upcoming Bookings (from live data) */}
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Recent Bookings</h4>
                          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                            {detailLoading ? (
                              <div className="p-6 flex items-center justify-center">
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                              </div>
                            ) : memberBookings.length > 0 ? (
                              memberBookings.slice(0, 5).map((booking, i) => (
                                <div key={i} className="p-3 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-indigo-100 text-indigo-600">
                                      <Flame className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-gray-900">{booking.className}</p>
                                      <p className="text-[11px] text-gray-500">
                                        {new Date(booking.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        {' at '}
                                        {new Date(booking.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  </div>
                                  <span className={cn(
                                    'text-[11px] font-semibold',
                                    booking.status === 'checked_in' ? 'text-emerald-600' :
                                    booking.status === 'cancelled' ? 'text-gray-400' :
                                    booking.status === 'no_show' ? 'text-orange-500' :
                                    'text-indigo-600'
                                  )}>
                                    {booking.status === 'checked_in' ? 'Checked In' :
                                     booking.status === 'cancelled' ? 'Cancelled' :
                                     booking.status === 'no_show' ? 'No Show' :
                                     booking.status === 'booked' ? 'Booked' :
                                     booking.status}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center text-xs text-gray-400">No bookings found</div>
                            )}
                          </div>
                        </div>

                        {/* Session Preferences */}
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Session Preferences</h4>
                          <div className="rounded-xl border border-gray-200 p-3.5">
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { label: 'Preferred Time', value: selectedMember.preferredTime, icon: Clock },
                                { label: 'Preferred Type', value: selectedMember.preferredType, icon: Flame },
                                { label: 'Guided Sessions', value: selectedMember.guidedSessions.toString(), icon: Heart },
                                { label: 'Avg Duration', value: selectedMember.avgDuration, icon: Activity },
                              ].map((pref) => (
                                <div key={pref.label} className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                    <pref.icon className="h-3.5 w-3.5 text-gray-500" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-400 font-medium">{pref.label}</p>
                                    <p className="text-xs font-semibold text-gray-900">{pref.value}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {profileTab === 'History' && (
                      <motion.div
                        key="history"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                      >
                        {detailLoading ? (
                          <div className="py-8 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                          </div>
                        ) : memberBookings.length > 0 ? (
                          <div className="space-y-2">
                            {memberBookings.map((booking, i) => (
                              <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                    <Flame className="h-3.5 w-3.5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-900">{booking.className}</p>
                                    <p className="text-[11px] text-gray-500">
                                      {new Date(booking.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      {' at '}
                                      {new Date(booking.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                                <span className={cn(
                                  'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
                                  booking.status === 'checked_in' ? 'bg-emerald-50 text-emerald-700' :
                                  booking.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                                  booking.status === 'no_show' ? 'bg-orange-50 text-orange-600' :
                                  'bg-indigo-50 text-indigo-700'
                                )}>
                                  {booking.status === 'checked_in' ? 'Checked In' :
                                   booking.status === 'cancelled' ? 'Cancelled' :
                                   booking.status === 'no_show' ? 'No Show' :
                                   booking.status === 'booked' ? 'Booked' :
                                   booking.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center">
                            <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No visit history yet</p>
                            <p className="text-xs text-gray-400 mt-1">Bookings will appear here once the member checks in</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {profileTab === 'Financials' && (
                      <motion.div
                        key="financials"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                      >
                        {detailLoading ? (
                          <div className="py-8 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                          </div>
                        ) : memberTransactions.length > 0 ? (
                          <div className="space-y-2">
                            {memberTransactions.map((tx, i) => (
                              <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                                <div>
                                  <p className="text-xs font-semibold text-gray-900">
                                    {tx.description || tx.type}
                                  </p>
                                  <p className="text-[11px] text-gray-500">
                                    {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={cn(
                                    'text-sm font-bold tabular-nums',
                                    tx.status === 'refunded' ? 'text-gray-400 line-through' : 'text-gray-900'
                                  )}>
                                    ${(tx.amount / 100).toFixed(2)}
                                  </p>
                                  <span className={cn(
                                    'text-[10px] font-semibold',
                                    tx.status === 'completed' ? 'text-emerald-600' :
                                    tx.status === 'failed' ? 'text-orange-500' :
                                    'text-gray-400'
                                  )}>
                                    {tx.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center">
                            <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No transactions yet</p>
                            <p className="text-xs text-gray-400 mt-1">Payment history will appear here</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {profileTab === 'Communications' && (
                      <motion.div
                        key="communications"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="py-8 text-center"
                      >
                        <Mail className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Communication log will appear here</p>
                        <p className="text-xs text-gray-400 mt-1">Emails, SMS, and automated messages</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Add Member Modal ─── */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Add New Member</h2>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setAddLoading(true)
                  setAddError(null)
                  try {
                    const res = await fetch('/api/members', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(addForm),
                    })
                    const json = await res.json()
                    if (!res.ok) throw new Error(json.error || 'Failed to add member')
                    setShowAddModal(false)
                    setAddForm({ full_name: '', email: '', phone: '' })
                    // Refresh the member list
                    fetchMembers()
                    fetchCounts()
                  } catch (err) {
                    setAddError(err instanceof Error ? err.message : 'Something went wrong')
                  } finally {
                    setAddLoading(false)
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={addForm.full_name}
                    onChange={(e) => setAddForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jane@example.com"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={addForm.phone}
                    onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                  />
                </div>

                {addError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading || !addForm.full_name || !addForm.email}
                    className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {addLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Adding...
                      </span>
                    ) : 'Add Member'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
