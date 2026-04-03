import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import MemberProfileClient from './_components/MemberProfileClient'
import type {
  MemberProfile,
  Booking,
  Transaction,
} from './_components/MemberProfileClient'

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

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()

  // Fetch member with profile join
  const { data, error } = await supabase
    .from('members')
    .select(`
      id, profile_id, membership_tier, membership_status, credits_remaining, total_visits,
      join_date, notes, last_visit, lifetime_value,
      profiles!inner ( full_name, email, phone, avatar_url )
    `)
    .eq('id', id)
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .single()

  let member: MemberProfile | null = null

  if (data && !error) {
    const profile = (data as any).profiles
    const fullName = profile.full_name || 'Unknown'
    const parts = fullName.trim().split(/\s+/)
    const tierInfo = mapTier(data.membership_tier)

    member = {
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
    }
  }

  // Fetch related data in parallel (only if member found)
  let bookings: Booking[] = []
  let transactions: Transaction[] = []
  let tags: string[] = []

  if (member) {
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
      bookings = bookingsRes.data.map((b: any) => ({
        className: b.classes?.title || 'Unknown',
        startsAt: b.classes?.starts_at || '',
        status: b.status,
      }))
    }
    if (txRes.data) {
      transactions = txRes.data.map((t: any) => ({
        amount: t.amount,
        type: t.type,
        status: t.status,
        description: t.description,
        createdAt: t.created_at,
      }))
    }
    if (tagsRes.data) {
      tags = tagsRes.data.map((t: any) => t.tag)
    }
  }

  return (
    <MemberProfileClient
      member={member}
      bookings={bookings}
      transactions={transactions}
      tags={tags}
    />
  )
}
