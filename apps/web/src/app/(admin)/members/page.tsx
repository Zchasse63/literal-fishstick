'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
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
} from 'lucide-react'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

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
}

// ─── Mock Data ──────────────────────────────────────────────
const MEMBERS: Member[] = [
  {
    id: '1', firstName: 'Sarah', lastName: 'Martinez', email: 'sarah.martinez@gmail.com', phone: '(813) 555-0142',
    avatar: 'SM', avatarColor: 'bg-indigo-500', membership: 'Unlimited', membershipPrice: 225, membershipType: 'unlimited',
    status: 'active', lastVisit: 'Today', credits: null, ltv: 2475, joinDate: 'Mar 15, 2025',
    totalVisits: 156, avgVisitsPerWeek: 3.2, nextBilling: 'Apr 1, 2026', paymentMethod: 'Visa •••• 4242',
    preferredTime: '6:00 PM', preferredType: 'Open Sauna', guidedSessions: 24, avgDuration: '52 min',
  },
  {
    id: '2', firstName: 'James', lastName: 'Kim', email: 'james.kim@outlook.com', phone: '(813) 555-0198',
    avatar: 'JK', avatarColor: 'bg-emerald-500', membership: '10-Class Pack', membershipPrice: 180, membershipType: '10-class',
    status: 'active', lastVisit: 'Yesterday', credits: 6, ltv: 1440, joinDate: 'Jun 2, 2025',
    totalVisits: 84, avgVisitsPerWeek: 2.1, nextBilling: 'Apr 8, 2026', paymentMethod: 'Apple Pay',
    preferredTime: '7:00 PM', preferredType: 'Open Sauna', guidedSessions: 8, avgDuration: '48 min',
  },
  {
    id: '3', firstName: 'Priya', lastName: 'Sharma', email: 'priya.s@gmail.com', phone: '(813) 555-0267',
    avatar: 'PS', avatarColor: 'bg-violet-500', membership: 'Unlimited', membershipPrice: 225, membershipType: 'unlimited',
    status: 'at-risk', lastVisit: '12 days ago', credits: null, ltv: 3150, joinDate: 'Jan 10, 2025',
    totalVisits: 201, avgVisitsPerWeek: 1.0, nextBilling: 'Apr 1, 2026', paymentMethod: 'Mastercard •••• 8891',
    preferredTime: '5:00 PM', preferredType: 'Guided', guidedSessions: 45, avgDuration: '55 min',
  },
  {
    id: '4', firstName: 'Marcus', lastName: 'Johnson', email: 'mjohnson@yahoo.com', phone: '(813) 555-0334',
    avatar: 'MJ', avatarColor: 'bg-amber-500', membership: '6-Class Pack', membershipPrice: 120, membershipType: '6-class',
    status: 'active', lastVisit: '3 days ago', credits: 2, ltv: 840, joinDate: 'Sep 18, 2025',
    totalVisits: 42, avgVisitsPerWeek: 1.8, nextBilling: 'Apr 15, 2026', paymentMethod: 'Visa •••• 1234',
    preferredTime: '8:00 PM', preferredType: 'Open Sauna', guidedSessions: 3, avgDuration: '45 min',
  },
  {
    id: '5', firstName: 'Emily', lastName: 'Chen', email: 'emily.chen@icloud.com', phone: '(813) 555-0411',
    avatar: 'EC', avatarColor: 'bg-pink-500', membership: 'Unlimited', membershipPrice: 225, membershipType: 'unlimited',
    status: 'new', lastVisit: '2 days ago', credits: null, ltv: 225, joinDate: 'Mar 5, 2026',
    totalVisits: 4, avgVisitsPerWeek: 2.0, nextBilling: 'Apr 5, 2026', paymentMethod: 'Google Pay',
    preferredTime: '6:00 PM', preferredType: 'Guided', guidedSessions: 3, avgDuration: '58 min',
  },
  {
    id: '6', firstName: 'David', lastName: 'Thompson', email: 'dthompson@gmail.com', phone: '(813) 555-0489',
    avatar: 'DT', avatarColor: 'bg-sky-500', membership: '10-Class Pack', membershipPrice: 180, membershipType: '10-class',
    status: 'paused', lastVisit: '28 days ago', credits: 4, ltv: 1980, joinDate: 'Apr 22, 2025',
    totalVisits: 112, avgVisitsPerWeek: 0, nextBilling: 'Paused', paymentMethod: 'Visa •••• 5678',
    preferredTime: '7:00 PM', preferredType: 'Open Sauna', guidedSessions: 12, avgDuration: '50 min',
  },
  {
    id: '7', firstName: 'Laura', lastName: 'Garcia', email: 'laura.g@gmail.com', phone: '(813) 555-0556',
    avatar: 'LG', avatarColor: 'bg-rose-500', membership: 'Credit Pack (20)', membershipPrice: 300, membershipType: 'credit-pack',
    status: 'active', lastVisit: 'Today', credits: 14, ltv: 1500, joinDate: 'Aug 1, 2025',
    totalVisits: 68, avgVisitsPerWeek: 2.4, nextBilling: 'N/A', paymentMethod: 'Amex •••• 3456',
    preferredTime: '5:00 PM', preferredType: 'Open Sauna', guidedSessions: 6, avgDuration: '47 min',
  },
  {
    id: '8', firstName: 'Chris', lastName: 'Brooks', email: 'cbrooks@gmail.com', phone: '(813) 555-0612',
    avatar: 'CB', avatarColor: 'bg-teal-500', membership: 'Unlimited', membershipPrice: 225, membershipType: 'unlimited',
    status: 'at-risk', lastVisit: '18 days ago', credits: null, ltv: 2700, joinDate: 'Dec 1, 2024',
    totalVisits: 178, avgVisitsPerWeek: 0.5, nextBilling: 'Apr 1, 2026', paymentMethod: 'Visa •••• 9012',
    preferredTime: '8:00 PM', preferredType: 'Open Sauna', guidedSessions: 15, avgDuration: '42 min',
  },
]

const FILTER_COUNTS: Record<FilterTab, number> = {
  All: 8,
  Active: 4,
  Paused: 1,
  'At Risk': 2,
  New: 1,
}

const UPCOMING_BOOKINGS = [
  { id: '1', className: 'Open Sauna', date: 'Tomorrow', time: '6:00 PM', spots: '9/12' },
  { id: '2', className: 'Guided — Breathwork', date: 'Wed, Mar 25', time: '7:00 PM', trainer: 'Whitney' },
  { id: '3', className: 'Open Sauna', date: 'Sat, Mar 28', time: '10:00 AM', spots: '5/12' },
]

// ─── Helpers ────────────────────────────────────────────────
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
      // Weight toward Mon-Fri evenings
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

// ─── Component ──────────────────────────────────────────────
export default function MembersPage() {
  const [filter, setFilter] = useState<FilterTab>('All')
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [profileTab, setProfileTab] = useState<ProfileTab>('Overview')

  const filtered = MEMBERS.filter((m) => {
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Active' && m.status === 'active') ||
      (filter === 'Paused' && m.status === 'paused') ||
      (filter === 'At Risk' && m.status === 'at-risk') ||
      (filter === 'New' && m.status === 'new')

    const matchesSearch =
      search === '' ||
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())

    return matchesFilter && matchesSearch
  })

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
                {MEMBERS.length} total members
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
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
                  {(Object.keys(FILTER_COUNTS) as FilterTab[]).map((tab) => (
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
                        {FILTER_COUNTS[tab]}
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
                  {filtered.map((member) => (
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
                          {member.credits !== null ? member.credits : '—'}
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

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                        No members found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Showing {filtered.length} of {MEMBERS.length} members
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
                  {selectedMember.membershipType !== 'unlimited' && (
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      <Tag className="h-2.5 w-2.5" />
                      10% Member Discount
                    </span>
                  )}
                  {selectedMember.membershipType === 'unlimited' && (
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      <Tag className="h-2.5 w-2.5" />
                      10% Member Discount
                    </span>
                  )}
                </div>
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

                        {/* Upcoming Bookings */}
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Upcoming Bookings</h4>
                          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                            {UPCOMING_BOOKINGS.map((booking) => (
                              <div key={booking.id} className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    'h-8 w-8 rounded-lg flex items-center justify-center',
                                    booking.trainer
                                      ? 'bg-violet-100 text-violet-600'
                                      : 'bg-indigo-100 text-indigo-600'
                                  )}>
                                    {booking.trainer ? (
                                      <Heart className="h-3.5 w-3.5" />
                                    ) : (
                                      <Flame className="h-3.5 w-3.5" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-900">{booking.className}</p>
                                    <p className="text-[11px] text-gray-500">
                                      {booking.date} at {booking.time}
                                      {booking.trainer && <span> w/ {booking.trainer}</span>}
                                    </p>
                                  </div>
                                </div>
                                <button className="text-[11px] font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                                  Cancel
                                </button>
                              </div>
                            ))}
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
                        className="py-8 text-center"
                      >
                        <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Visit history will appear here</p>
                        <p className="text-xs text-gray-400 mt-1">Full session log with check-in times and class details</p>
                      </motion.div>
                    )}

                    {profileTab === 'Financials' && (
                      <motion.div
                        key="financials"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="py-8 text-center"
                      >
                        <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Payment history will appear here</p>
                        <p className="text-xs text-gray-400 mt-1">Invoices, transactions, and billing details</p>
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
    </motion.div>
  )
}
