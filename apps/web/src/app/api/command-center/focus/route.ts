import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/require-role'

/**
 * Tier 8.5.A9 — Command Center "Today's Focus" queue.
 *
 * Scores + ranks the 5 most time-sensitive things an owner needs to act on
 * right now, pulling from multiple sources and weighting them by business
 * impact + recency. Unlike the notification center (A8), which is a
 * reverse-chronological stream, this is an ACTION list: each item has a
 * primary CTA and an estimated impact.
 *
 * Scoring rubric (higher = more urgent):
 *   failed_payment               → 100  (direct lost revenue)
 *   credit_pack_expiring_1d      → 85   (member frustration imminent)
 *   credit_pack_expiring_2-3d    → 70
 *   credit_pack_expiring_4-7d    → 50
 *   at_risk_member (14+d lapsed) → 65   (churn risk)
 *   class_low_capacity_today     → 60   (reminders can save the class)
 *   unassigned_lead_24h          → 55   (stale lead = lost lead)
 *   class_oversold               → 90   (service failure risk)
 *
 * Returns up to `limit` items (default 5, max 10).
 */
export interface FocusItem {
  id: string
  kind:
    | 'failed_payment'
    | 'credit_expiring'
    | 'at_risk_member'
    | 'class_low_capacity'
    | 'unassigned_lead'
    | 'class_oversold'
  priority: number
  title: string
  description: string
  cta: string
  href: string
  icon: 'dollar' | 'clock' | 'user' | 'calendar' | 'alert'
  context?: Record<string, string | number>
}

export interface FocusResponse {
  items: FocusItem[]
  generated_at: string
}

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

export async function GET(request: NextRequest) {
  const auth = await requireRole(['owner', 'manager'])
  if (auth.error) return auth.error
  const { supabase, studioId } = auth

  const limit = Math.max(
    1,
    Math.min(
      MAX_LIMIT,
      parseInt(request.nextUrl.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
    )
  )

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [
    failedPaymentsRes,
    creditPacksRes,
    atRiskMembersRes,
    todaysClassesRes,
    oversoldClassesRes,
    staleLeadsRes,
  ] = await Promise.allSettled([
    // Failed payments in last 7 days
    supabase
      .from('transactions')
      .select('id, amount, created_at, members!inner(id, profile_id, profiles!inner(full_name))')
      .eq('studio_id', studioId)
      .eq('status', 'failed')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit),

    // Credit packs expiring within 7 days
    supabase
      .from('credit_packs')
      .select('id, credits_remaining, expires_at, members!inner(id, profile_id, profiles!inner(full_name))')
      .eq('studio_id', studioId)
      .gt('credits_remaining', 0)
      .gte('expires_at', now.toISOString())
      .lte('expires_at', sevenDaysFromNow.toISOString())
      .order('expires_at', { ascending: true })
      .limit(limit),

    // Active members with no visits in 14+ days (at-risk)
    // Uses members.last_visit if populated, else falls back to join_date.
    supabase
      .from('members')
      .select('id, profile_id, last_visit, join_date, profiles!inner(full_name)')
      .eq('studio_id', studioId)
      .eq('membership_status', 'active')
      .or(`last_visit.lt.${fourteenDaysAgo.toISOString()},last_visit.is.null`)
      .order('last_visit', { ascending: true, nullsFirst: false })
      .limit(limit),

    // Today's classes (any) — for low-capacity check below
    supabase
      .from('classes')
      .select('id, title, starts_at, capacity, booked_count')
      .eq('studio_id', studioId)
      .gte('starts_at', todayStart.toISOString())
      .lt('starts_at', todayEnd.toISOString())
      .order('starts_at', { ascending: true }),

    // Oversold classes in the next 24h (booked > capacity is a service failure)
    supabase
      .from('classes')
      .select('id, title, starts_at, capacity, booked_count')
      .eq('studio_id', studioId)
      .gte('starts_at', now.toISOString())
      .lte('starts_at', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .limit(20),

    // Stale leads (created 24h+ ago, status still 'new')
    supabase
      .from('leads')
      .select('id, first_name, last_name, email, created_at')
      .eq('studio_id', studioId)
      .eq('status', 'new')
      .lte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(limit),
  ])

  const items: FocusItem[] = []

  // ── Failed payments ──────────────────────────────────────────────────
  if (failedPaymentsRes.status === 'fulfilled' && failedPaymentsRes.value.data) {
    for (const row of failedPaymentsRes.value.data) {
      // Supabase typegen returns joined rows as either array or single;
      // cast through unknown since we know the runtime shape.
      const member = row.members as unknown as
        | { id: string; profile_id: string; profiles?: { full_name?: string } }
        | null
      const name = member?.profiles?.full_name ?? 'Unknown'
      const dollars = ((row.amount as number) / 100).toFixed(2)
      items.push({
        id: `focus-failed-${row.id as string}`,
        kind: 'failed_payment',
        priority: 100,
        title: `Failed payment — $${dollars}`,
        description: `${name} · retry before service lapses`,
        cta: 'View transaction',
        href: `/revenue?status=failed&txn=${row.id as string}`,
        icon: 'dollar',
      })
    }
  }

  // ── Expiring credits ─────────────────────────────────────────────────
  if (creditPacksRes.status === 'fulfilled' && creditPacksRes.value.data) {
    for (const row of creditPacksRes.value.data) {
      const member = row.members as unknown as
        | { id: string; profile_id: string; profiles?: { full_name?: string } }
        | null
      const name = member?.profiles?.full_name ?? 'Unknown'
      const expiresAt = new Date(row.expires_at as string)
      const daysUntil = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )
      const priority =
        daysUntil <= 1 ? 85 : daysUntil <= 3 ? 70 : 50
      items.push({
        id: `focus-credit-${row.id as string}`,
        kind: 'credit_expiring',
        priority,
        title: `${row.credits_remaining} credit${row.credits_remaining === 1 ? '' : 's'} expiring in ${daysUntil}d`,
        description: `${name} · send reminder to book`,
        cta: 'Open member',
        href: `/members?focus=${member?.profile_id ?? ''}`,
        icon: 'clock',
        context: { days_until: daysUntil, credits: row.credits_remaining as number },
      })
    }
  }

  // ── At-risk members ──────────────────────────────────────────────────
  if (atRiskMembersRes.status === 'fulfilled' && atRiskMembersRes.value.data) {
    for (const row of atRiskMembersRes.value.data) {
      const profile = row.profiles as { full_name?: string } | null
      const name = profile?.full_name ?? 'Unknown'
      const lastVisit = (row.last_visit as string | null) ?? (row.join_date as string | null)
      const daysSince = lastVisit
        ? Math.floor(
            (now.getTime() - new Date(lastVisit).getTime()) / (24 * 60 * 60 * 1000)
          )
        : 999
      items.push({
        id: `focus-atrisk-${row.id as string}`,
        kind: 'at_risk_member',
        priority: 65,
        title: `No visit in ${daysSince}+ days`,
        description: `${name} · send re-engagement outreach`,
        cta: 'Open profile',
        href: `/members?focus=${row.profile_id as string}`,
        icon: 'user',
        context: { days_since_visit: daysSince },
      })
    }
  }

  // ── Class low capacity (today) ───────────────────────────────────────
  if (todaysClassesRes.status === 'fulfilled' && todaysClassesRes.value.data) {
    for (const row of todaysClassesRes.value.data) {
      const capacity = (row.capacity as number) ?? 12
      const booked = (row.booked_count as number) ?? 0
      const rate = capacity > 0 ? booked / capacity : 0
      if (rate < 0.25) {
        const startsAt = new Date(row.starts_at as string)
        const hoursUntil = Math.round(
          (startsAt.getTime() - now.getTime()) / (60 * 60 * 1000)
        )
        if (hoursUntil >= 0) {
          items.push({
            id: `focus-lowcap-${row.id as string}`,
            kind: 'class_low_capacity',
            priority: 60,
            title: `${row.title ?? 'Class'} — under 25% capacity`,
            description: `${booked}/${capacity} booked · starts in ${hoursUntil}h`,
            cta: 'Send reminders',
            href: `/schedule?classId=${row.id as string}&action=remind`,
            icon: 'calendar',
          })
        }
      }
    }
  }

  // ── Oversold classes (next 24h) ──────────────────────────────────────
  if (oversoldClassesRes.status === 'fulfilled' && oversoldClassesRes.value.data) {
    for (const row of oversoldClassesRes.value.data) {
      const capacity = (row.capacity as number) ?? 12
      const booked = (row.booked_count as number) ?? 0
      if (booked > capacity) {
        items.push({
          id: `focus-oversold-${row.id as string}`,
          kind: 'class_oversold',
          priority: 90,
          title: `${row.title ?? 'Class'} is oversold`,
          description: `${booked}/${capacity} booked · move excess to waitlist`,
          cta: 'Resolve',
          href: `/schedule?classId=${row.id as string}`,
          icon: 'alert',
        })
      }
    }
  }

  // ── Stale leads ──────────────────────────────────────────────────────
  if (staleLeadsRes.status === 'fulfilled' && staleLeadsRes.value.data) {
    for (const row of staleLeadsRes.value.data) {
      const name = `${(row.first_name as string) ?? ''} ${(row.last_name as string) ?? ''}`.trim() || 'Unknown Lead'
      const createdAt = new Date(row.created_at as string)
      const hoursOld = Math.floor(
        (now.getTime() - createdAt.getTime()) / (60 * 60 * 1000)
      )
      items.push({
        id: `focus-lead-${row.id as string}`,
        kind: 'unassigned_lead',
        priority: 55,
        title: `Stale lead · ${hoursOld}h old`,
        description: `${name} · ${row.email ?? 'no email'}`,
        cta: 'Contact lead',
        href: `/marketing?leadId=${row.id as string}`,
        icon: 'user',
      })
    }
  }

  // Sort by priority desc, cap at limit.
  items.sort((a, b) => b.priority - a.priority)
  const capped = items.slice(0, limit)

  return NextResponse.json<FocusResponse>({
    items: capped,
    generated_at: now.toISOString(),
  })
}
