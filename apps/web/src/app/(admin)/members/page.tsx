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
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import type { FilterTab, ProfileTab, Member, MemberBooking, MemberTransaction } from './_components/types'
import { statusDot, statusLabel, membershipBadgeColor } from './_components/types'
import MemberProfilePanel from './_components/MemberProfilePanel'
import AddMemberModal from './_components/AddMemberModal'

const STUDIO_ID = DEFAULT_STUDIO_ID

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
              onClick={() => setShowAddModal(true)}
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
            <MemberProfilePanel
              member={selectedMember}
              onClose={() => setSelectedMember(null)}
              profileTab={profileTab}
              setProfileTab={setProfileTab}
              memberBookings={memberBookings}
              memberTransactions={memberTransactions}
              memberTags={memberTags}
              detailLoading={detailLoading}
            />
          )}
        </AnimatePresence>
      </div>


      {/* ─── Add Member Modal ─── */}
      <AnimatePresence>
        {showAddModal && (
          <AddMemberModal
            onClose={() => setShowAddModal(false)}
            onSuccess={() => { fetchMembers(); fetchCounts() }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
