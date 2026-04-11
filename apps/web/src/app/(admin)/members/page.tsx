// LOW-009: This page uses 'use client' because it has heavy interactive state
// (search, filters, polling, detail panel selection). Converting to an RSC
// pattern (server query + client component) is planned for Phase 5 when
// server-side filtering, pagination, and URL-based state are added.
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
  User,
  Mail,
  Trash2,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
import { useToast } from '@/hooks/use-toast'
import { ToastNotification } from '@/components/ui/toast-notification'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import type { FilterTab, ProfileTab, Member, MemberBooking, MemberTransaction, EngagementStatus, AcquisitionChannel, SortKey } from './_components/types'
import { statusDot, statusLabel, membershipBadgeColor, engagementDotColor, acquisitionBadgeConfig } from './_components/types'
import MemberProfilePanel from './_components/MemberProfilePanel'
import AddMemberModal from './_components/AddMemberModal'
import { useMemberSelection } from './_components/useMemberSelection'
import { BulkActionsBar } from './_components/BulkActionsBar'
import { BulkEmailModal } from './_components/BulkEmailModal'
import { BulkTagModal } from './_components/BulkTagModal'
import { useSavedViews, type SavedView } from './_components/useSavedViews'
import { SavedViewsBar } from './_components/SavedViewsBar'

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
      {/* Tier 8.5.A2 — placeholder for selection checkbox column */}
      <td className="w-10 px-2 py-3">
        <div className="h-4 w-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-36 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell"><div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" /></td>
      <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 w-14 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td>
      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td>
      <td className="px-4 py-3 hidden md:table-cell text-right"><div className="h-4 w-6 bg-gray-100 dark:bg-gray-800 rounded animate-pulse ml-auto" /></td>
      <td className="px-4 py-3 hidden md:table-cell text-right"><div className="h-4 w-6 bg-gray-100 dark:bg-gray-800 rounded animate-pulse ml-auto" /></td>
      <td className="px-4 py-3 hidden lg:table-cell text-right"><div className="h-4 w-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse ml-auto" /></td>
      <td className="px-4 py-3 text-right"><div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse ml-auto" /></td>
    </tr>
  )
}

// ─── Component ──────────────────────────────────────────────
export default function MembersPage() {
  const { toast, showToast } = useToast()
  const [filter, setFilter] = useState<FilterTab>('All')
  const [sortKey, setSortKey] = useState<SortKey>('last_visit_desc')
  const [tierFilter, setTierFilter] = useState<'all' | 'unlimited' | '10_class' | '6_class' | 'credit_pack'>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Tier 8.5.A2 — Bulk selection state
  const selection = useMemberSelection()
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false)
  const [bulkTagOpen, setBulkTagOpen] = useState(false)
  const lastClickedId = useRef<string | null>(null)
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null)

  // Tier 8.5.A3 — Saved views (filter/sort combos persisted to localStorage)
  const { views: savedViews, saveView, deleteView } = useSavedViews()
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [profileTab, setProfileTab] = useState<ProfileTab>('Overview')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
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

  // Tier 8.5.A2 — Sync header checkbox indeterminate state (React doesn't
  // expose this as a JSX attribute; has to be set imperatively via ref).
  // Narrow deps to the raw selectedIds Set so the effect doesn't re-fire on
  // every render (the `selection` object identity changes each render).
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = selection.isIndeterminate(members)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.selectedIds, members])

  // Escape key clears selection
  useEffect(() => {
    if (selection.selectedIds.size === 0) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') selection.clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection])

  // Fetch members
  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('members')
        .select(`
          id, profile_id, membership_tier, membership_status, credits_remaining, total_visits,
          join_date, notes, last_visit, lifetime_value,
          profiles!inner ( full_name, email, phone, avatar_url, exclude_from_analytics )
        `)
        .eq('studio_id', STUDIO_ID)
        .limit(50)

      // Apply sort — real columns, meaningful default. Previously `.order('id')`
      // which is UUID-sorted (no human value). `last_visit DESC NULLS LAST`
      // answers "who's engaging now?" — the question a dashboard should
      // answer first.
      switch (sortKey) {
        case 'last_visit_desc':
          query = query.order('last_visit', { ascending: false, nullsFirst: false })
          break
        case 'name_asc':
          query = query.order('full_name', { ascending: true, referencedTable: 'profiles' })
          break
        case 'join_date_desc':
          query = query.order('join_date', { ascending: false, nullsFirst: false })
          break
        case 'ltv_desc':
          query = query.order('lifetime_value', { ascending: false, nullsFirst: false })
          break
        case 'total_visits_desc':
          query = query.order('total_visits', { ascending: false, nullsFirst: false })
          break
      }

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

      // Apply tier filter (real column, real business question)
      if (tierFilter !== 'all') {
        query = query.eq('membership_tier', tierFilter)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching members:', error)
        setMembers([])
        setLoading(false)
        return
      }

      // Fetch member_360 enrichment data in parallel
      const profileIds = (data || []).map((row: any) => row.profiles?.id || row.profile_id).filter(Boolean)
      let m360Map: Record<string, { engagement_status: string | null; acquisition_channel: string | null; behavior_segment: string | null; total_visits: number | null }> = {}
      if (profileIds.length > 0) {
        const { data: m360Data } = await supabase
          .from('member_360')
          .select('profile_id, engagement_status, acquisition_channel, behavior_segment, total_visits')
          .in('profile_id', profileIds)
        if (m360Data) {
          for (const row of m360Data) {
            m360Map[(row as any).profile_id] = row as any
          }
        }
      }

      const mapped: Member[] = (data || []).map((row: any) => {
        const profile = row.profiles
        const fullName = profile.full_name || 'Unknown'
        const { firstName, lastName } = splitName(fullName)
        const tierInfo = mapTier(row.membership_tier)
        const computedStatus = mapStatus(row.membership_status, row.join_date, row.last_visit, row.credits_remaining ?? 0)
        const m360 = m360Map[row.profile_id] || null

        return {
          id: row.id,
          // BUG-013 bridge: per-member API routes (/pause, /upgrade, PUT,
          // DELETE, GET) all expect URL [id] = profile_id, but bookings/
          // transactions/member_tags FKs point at members.id. Pass both so
          // call sites can pick the right one.
          profileId: row.profile_id,
          firstName,
          lastName,
          email: profile.email || '',
          phone: profile.phone || '',
          avatar: getInitials(fullName),
          avatarColor: getAvatarColor(fullName),
          ...tierInfo,
          status: computedStatus,
          lastVisit: formatLastVisit(row.last_visit),
          lastVisitAt: row.last_visit ?? null,
          credits: row.credits_remaining > 0 || tierInfo.membershipType !== 'unlimited' ? row.credits_remaining : null,
          ltv: Math.round((row.lifetime_value || 0) / 100),
          joinDate: formatJoinDate(row.join_date),
          joinDateAt: row.join_date ?? null,
          totalVisits: m360?.total_visits ?? row.total_visits ?? 0,
          avgVisitsPerWeek: row.total_visits
            ? Math.round((row.total_visits / Math.max(1, Math.ceil((Date.now() - new Date(row.join_date).getTime()) / (7 * 24 * 60 * 60 * 1000)))) * 10) / 10
            : 0,
          notes: row.notes,
          excludeFromAnalytics: profile.exclude_from_analytics ?? false,
          // member_360 enrichment
          engagementStatus: (m360?.engagement_status as EngagementStatus) || null,
          acquisitionChannel: (m360?.acquisition_channel as AcquisitionChannel) || null,
          behaviorSegment: m360?.behavior_segment as Member['behaviorSegment'] || null,
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
  }, [supabase, debouncedSearch, filter, sortKey, tierFilter])

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

  // Tier 8.5.A2 — Bulk archive handler (sequential DELETE per member)
  const handleBulkArchive = useCallback(async () => {
    const selectedMembers = members.filter((m) => selection.isSelected(m.id))
    if (selectedMembers.length === 0) return
    if (!confirm(`Archive ${selectedMembers.length} members? This action cannot be undone.`)) return

    let failed = 0
    for (const m of selectedMembers) {
      try {
        // BUG-013: DELETE route expects profile_id in URL, NOT members.id.
        const res = await fetch(`/api/members/${m.profileId}`, { method: 'DELETE' })
        if (!res.ok) failed++
      } catch {
        failed++
      }
    }
    selection.clearSelection()
    setSelectedMember(null)
    fetchMembers()
    fetchCounts()
    showToast(
      failed === 0
        ? `${selectedMembers.length} members archived`
        : `Archived with ${failed} error${failed === 1 ? '' : 's'} — check console`
    )
  }, [members, selection, fetchMembers, fetchCounts, showToast])

  // Tier 8.5.A3 — Apply saved view (loads filter/sort/search into state)
  const handleApplyView = useCallback((view: SavedView) => {
    setFilter(view.filter)
    setSortKey(view.sortKey)
    setTierFilter(view.tierFilter)
    setSearch(view.search)
    setActiveViewId(view.id)
  }, [])

  // Tier 8.5.A3 — Save current dialed-in state as a new view
  const handleSaveCurrentView = useCallback((name: string) => {
    const view = saveView({ name, filter, sortKey, tierFilter, search })
    setActiveViewId(view.id)
    showToast(`Saved view "${name}"`)
  }, [saveView, filter, sortKey, tierFilter, search, showToast])

  // Tier 8.5.A3 — Clear active view marker whenever the user tweaks filters
  // manually (so the chip no longer claims to be active).
  useEffect(() => {
    if (!activeViewId) return
    const view = savedViews.find((v) => v.id === activeViewId)
    if (!view) return
    const matches =
      view.filter === filter &&
      view.sortKey === sortKey &&
      view.tierFilter === tierFilter &&
      view.search === search
    if (!matches) setActiveViewId(null)
  }, [filter, sortKey, tierFilter, search, activeViewId, savedViews])

  // Tier 8.5.A2 — Bulk CSV export handler (client-side Blob, no API)
  const handleBulkExport = useCallback(() => {
    const selected = members.filter((m) => selection.isSelected(m.id))
    if (selected.length === 0) return
    const headers = ['Name', 'Email', 'Phone', 'Membership', 'Status', 'Last Visit', 'Total Visits', 'LTV', 'Join Date']
    const rows = selected.map((m) => [
      `${m.firstName} ${m.lastName}`,
      m.email,
      m.phone,
      m.membership,
      m.status,
      m.lastVisit,
      String(m.totalVisits),
      String(m.ltv),
      m.joinDate,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `members-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`Exported ${selected.length} members to CSV`)
  }, [members, selection, showToast])

  return (
    <motion.div data-testid="members-page-root" {...fadeInUp}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── Left: Member Directory ──────────────────────────── */}
        <div className={cn(
          'transition-all duration-300',
          selectedMember ? 'lg:col-span-8' : 'lg:col-span-12'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Members</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {filterCounts.All} total members
              </p>
            </div>
            <button
              data-testid="members-add-btn"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Member
            </button>
          </div>

          {/* Search + Filters */}
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    aria-label="Search members"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
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
                      data-testid={`members-filter-${tab.toLowerCase().replace(/\s+/g, '-')}-btn`}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                        filter === tab
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                      )}
                    >
                      {tab}
                      <span className={cn(
                        'ml-1.5 text-[10px]',
                        filter === tab ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'
                      )}>
                        {filterCounts[tab]}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Tier 8.5.A1 — Sort + Tier dropdowns. Real columns, real
                    business questions. Replaces the UUID-order default. */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Sort</label>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    data-testid="members-sort-select"
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                  >
                    <option value="last_visit_desc">Last Visit (recent)</option>
                    <option value="name_asc">Name (A–Z)</option>
                    <option value="join_date_desc">Join Date (newest)</option>
                    <option value="ltv_desc">LTV (highest)</option>
                    <option value="total_visits_desc">Visits (most)</option>
                  </select>

                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-2">Tier</label>
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
                    data-testid="members-tier-filter-select"
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                  >
                    <option value="all">All tiers</option>
                    <option value="unlimited">Unlimited</option>
                    <option value="10_class">10-Class Pack</option>
                    <option value="6_class">6-Class Pack</option>
                    <option value="credit_pack">Credit Pack</option>
                  </select>
                </div>

                {/* Tier 8.5.A3 — Saved views (localStorage-backed chips) */}
                <SavedViewsBar
                  views={savedViews}
                  activeViewId={activeViewId}
                  onApplyView={handleApplyView}
                  onSaveCurrent={handleSaveCurrentView}
                  onDeleteView={(id) => {
                    deleteView(id)
                    if (activeViewId === id) setActiveViewId(null)
                  }}
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    {/* Tier 8.5.A2 — select all visible checkbox */}
                    <th className="w-10 px-2 py-3">
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        checked={selection.isAllSelected(members)}
                        onChange={() => selection.toggleAll(members)}
                        data-testid="members-select-all-checkbox"
                        aria-label="Select all visible members"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Member</span>
                    </th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Membership</span>
                    </th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Status</span>
                    </th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Last Visit</span>
                    </th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Visits</span>
                    </th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Credits</span>
                    </th>
                    <th className="text-right px-4 py-3 hidden lg:table-cell">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">LTV</span>
                    </th>
                    <th className="text-right px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Actions</span>
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
                          data-testid="members-directory-row"
                          data-row-key={member.profileId}
                          onClick={() => {
                            setSelectedMember(member)
                            setProfileTab('Overview')
                          }}
                          className={cn(
                            'border-b border-gray-50 cursor-pointer transition-colors group',
                            selection.isSelected(member.id)
                              ? 'bg-indigo-100/60 dark:bg-indigo-900/20'
                              : selectedMember?.id === member.id
                                ? 'bg-indigo-50/60'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/80'
                          )}
                        >
                          {/* Tier 8.5.A2 — row selection checkbox.
                              onClick stops propagation so the row click-to-open
                              handler doesn't fire. Shift-click selects a range
                              from the last-clicked row. */}
                          <td
                            className="w-10 px-2 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selection.isSelected(member.id)}
                              onChange={() => { /* controlled by onClick below */ }}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (e.shiftKey && lastClickedId.current) {
                                  selection.toggleRange(lastClickedId.current, member.id, members)
                                } else {
                                  selection.toggle(member.id)
                                }
                                lastClickedId.current = member.id
                              }}
                              data-testid="members-select-row-checkbox"
                              aria-label={`Select ${member.firstName} ${member.lastName}`}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          {/* Name + Avatar + Engagement Dot */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <div className={cn(
                                  'h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold',
                                  member.avatarColor
                                )}>
                                  {member.avatar}
                                </div>
                                {/* Engagement status dot overlay */}
                                {member.engagementStatus && (
                                  <div className={cn(
                                    'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-950',
                                    engagementDotColor(member.engagementStatus)
                                  )} title={member.engagementStatus.replace('_', ' ')} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {member.firstName} {member.lastName}
                                  </p>
                                  {/* Acquisition channel badge */}
                                  {member.acquisitionChannel && (() => {
                                    const acq = acquisitionBadgeConfig(member.acquisitionChannel)
                                    return acq ? (
                                      <span className={cn('inline-flex items-center px-1 py-0 rounded text-[9px] font-semibold border leading-tight', acq.classes)}>
                                        {acq.label}
                                      </span>
                                    ) : null
                                  })()}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</p>
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
                              <span className="text-sm text-gray-700 dark:text-gray-300">{statusLabel(member.status)}</span>
                            </div>
                          </td>

                          {/* Last Visit */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-sm text-gray-600 dark:text-gray-400">{member.lastVisit}</span>
                          </td>

                          {/* Visits */}
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                              {member.totalVisits}
                            </span>
                          </td>

                          {/* Credits */}
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                              {member.credits !== null ? member.credits : '\u2014'}
                            </span>
                          </td>

                          {/* LTV */}
                          <td className="px-4 py-3 text-right hidden lg:table-cell">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                              ${member.ltv.toLocaleString()}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="relative inline-block">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenDropdownId(openDropdownId === member.id ? null : member.id)
                                }}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {openDropdownId === member.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null) }} />
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 text-left">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setOpenDropdownId(null)
                                        setSelectedMember(member)
                                        setProfileTab('Overview')
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                      <User className="h-3.5 w-3.5" />
                                      View Profile
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setOpenDropdownId(null)
                                        if (member.email) window.location.href = `mailto:${member.email}`
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                      <Mail className="h-3.5 w-3.5" />
                                      Email
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setOpenDropdownId(null)
                                        // BUG-013: DELETE /api/members/[id] expects profile_id,
                                        // not members.id. Mirrors the fix in MemberProfilePanel's
                                        // Archive button from Tier 3.7.
                                        if (confirm('Archive this member? This can be reversed.')) { fetch(`/api/members/${member.profileId}`, { method: 'DELETE' }).then(r => r.ok ? window.location.reload() : alert('Failed to archive')).catch(() => alert('Network error')) }
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Remove
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}

                      {members.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
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
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Showing {members.length} of {filterCounts.All} members
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Page 1 of 1</span>
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
              onShowToast={showToast}
              onEditSuccess={() => { fetchMembers(); fetchCounts() }}
            />
          )}
        </AnimatePresence>
      </div>


      {/* ─── Add Member Modal ─── */}
      <AddMemberModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={() => { fetchMembers(); fetchCounts() }}
      />

      {/* Tier 8.5.A2 — Bulk actions bar (slides in when rows are selected) */}
      <AnimatePresence>
        {selection.selectedIds.size > 0 && (
          <BulkActionsBar
            selectedCount={selection.selectedIds.size}
            selectedMembers={members.filter((m) => selection.isSelected(m.id))}
            onEmail={() => setBulkEmailOpen(true)}
            onAddTag={() => setBulkTagOpen(true)}
            onArchive={handleBulkArchive}
            onExport={handleBulkExport}
            onClearSelection={selection.clearSelection}
          />
        )}
      </AnimatePresence>

      <BulkEmailModal
        open={bulkEmailOpen}
        onOpenChange={setBulkEmailOpen}
        recipients={members.filter((m) => selection.isSelected(m.id))}
        onShowToast={showToast}
      />

      <BulkTagModal
        open={bulkTagOpen}
        onOpenChange={setBulkTagOpen}
        selectedMembers={members.filter((m) => selection.isSelected(m.id))}
        onShowToast={showToast}
        onSuccess={() => { fetchMembers(); fetchCounts() }}
      />

      <ToastNotification message={toast} />
    </motion.div>
  )
}
