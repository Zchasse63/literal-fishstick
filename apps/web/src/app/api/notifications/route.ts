import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/require-role'

/**
 * Tier 8.5.A8 — Notification feed.
 *
 * Merges two sources into a single reverse-chronological notification list:
 *   1. activity_log rows of notable types (failed payments, new members,
 *      waitlist promotions, AI insights generated, etc.) from the last 7
 *      days — these are historical facts.
 *   2. Derived "live alerts" — situational checks that don't have a
 *      corresponding activity_log entry but owners need to see now:
 *        - Members with failed-payment transactions in the last 7 days
 *        - Active members with 0 visits in 14+ days (at-risk)
 *        - Credit packs expiring in the next 7 days
 *
 * Unread count: the client reads `unread_count` which is the number of
 * activity_log entries since the last `notifications_last_read_at` on the
 * current user's profile. The derived alerts don't affect unread count —
 * they're a contextual "stuff that needs attention" view, not an
 * append-only event stream.
 */
export interface NotificationItem {
  id: string
  type: 'event' | 'alert'      // event = activity_log row, alert = derived
  icon: 'dollar' | 'user' | 'alert' | 'calendar' | 'mail' | 'star' | 'warning'
  title: string
  description: string
  href?: string
  timestamp: string            // ISO — for activity events this is created_at;
                               // for alerts this is server now()
  unread: boolean              // for event type only; alerts never count as unread
}

export interface NotificationsResponse {
  items: NotificationItem[]
  unread_count: number
  last_read_at: string | null
}

// Activity log types worth surfacing in the notification center.
// Tuned to owner-manager attention: money, membership changes, lead/booking
// events, AI insights. Noise-y types like clock_in/out are excluded.
const NOTIFIABLE_TYPES = [
  'failed_payment',
  'refund',
  'new_member',
  'member_created',
  'membership_change',
  'membership_paused',
  'booking_cancelled',
  'booking_late_cancelled',
  'waitlist_promoted',
  'lead_created',
  'lead_converted',
  'ai_insight_generated',
  'ai_insights_generated',
  'churn_prediction',
  'revenue_anomaly_detected',
  'campaign_sent',
  'campaign_ab_winner_selected',
  'strike',
  'trainer_bonus_triggered',
]

function iconFor(type: string): NotificationItem['icon'] {
  if (type === 'failed_payment' || type === 'refund') return 'dollar'
  if (type === 'new_member' || type === 'member_created' || type === 'lead_created') return 'user'
  if (type === 'revenue_anomaly_detected' || type === 'strike') return 'warning'
  if (type === 'waitlist_promoted' || type === 'booking_cancelled' || type === 'booking_late_cancelled') return 'calendar'
  if (type === 'campaign_sent' || type === 'campaign_ab_winner_selected') return 'mail'
  if (type === 'ai_insight_generated' || type === 'ai_insights_generated' || type === 'churn_prediction') return 'star'
  return 'alert'
}

function hrefFor(row: { type: string; subject_type: string | null; subject_id: string | null }): string | undefined {
  if (!row.subject_id) return undefined
  switch (row.subject_type) {
    case 'member':
    case 'profile':
      return `/members?focus=${row.subject_id}`
    case 'booking':
      return `/schedule?bookingId=${row.subject_id}`
    case 'campaign':
      return `/marketing?campaignId=${row.subject_id}`
    case 'lead':
      return `/marketing?leadId=${row.subject_id}`
    case 'transaction':
      return `/revenue?txn=${row.subject_id}`
    case 'ai_insight':
      return `/analytics/insights#${row.subject_id}`
    default:
      return undefined
  }
}

export async function GET(_request: NextRequest) {
  const auth = await requireRole(['owner', 'manager'])
  if (auth.error) return auth.error
  const { user, supabase, studioId } = auth

  // ── Fetch recent activity + the user's last_read watermark ─────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [profileRes, activityRes, failedPaymentsRes, expiringCreditsRes] =
    await Promise.allSettled([
      supabase
        .from('profiles')
        .select('notifications_last_read_at')
        .eq('id', user.id)
        .maybeSingle(),

      supabase
        .from('activity_log')
        .select('id, type, subject_type, subject_id, description, created_at')
        .eq('studio_id', studioId)
        .in('type', NOTIFIABLE_TYPES)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(40),

      // Derived alert: failed payments last 7 days, joined to member name
      supabase
        .from('transactions')
        .select('id, amount, created_at, members!inner(id, profiles!inner(full_name))')
        .eq('studio_id', studioId)
        .eq('status', 'failed')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(10),

      // Derived alert: credit packs expiring in next 7 days with credits > 0
      supabase
        .from('credit_packs')
        .select('id, member_id, credits_remaining, expires_at, members!inner(id, profiles!inner(full_name))')
        .eq('studio_id', studioId)
        .gt('credits_remaining', 0)
        .gte('expires_at', new Date().toISOString())
        .lte('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('expires_at', { ascending: true })
        .limit(10),
    ])

  const lastReadAt =
    profileRes.status === 'fulfilled' && profileRes.value.data
      ? (profileRes.value.data.notifications_last_read_at as string | null) ?? null
      : null

  // ── Build event items from activity_log ────────────────────────────────
  const events: NotificationItem[] = []
  if (activityRes.status === 'fulfilled' && activityRes.value.data) {
    for (const row of activityRes.value.data) {
      const unread =
        !lastReadAt || new Date(row.created_at as string) > new Date(lastReadAt)
      events.push({
        id: `event-${row.id as string}`,
        type: 'event',
        icon: iconFor(row.type as string),
        title: humanizeType(row.type as string),
        description: (row.description as string) ?? '',
        href: hrefFor({
          type: row.type as string,
          subject_type: row.subject_type as string | null,
          subject_id: row.subject_id as string | null,
        }),
        timestamp: row.created_at as string,
        unread,
      })
    }
  }

  // ── Build derived alert items ──────────────────────────────────────────
  const alerts: NotificationItem[] = []

  if (failedPaymentsRes.status === 'fulfilled' && failedPaymentsRes.value.data) {
    for (const row of failedPaymentsRes.value.data) {
      const member = row.members as unknown as { id: string; profiles?: { full_name?: string } } | null
      const name = member?.profiles?.full_name ?? 'Unknown'
      const dollars = ((row.amount as number) / 100).toFixed(2)
      alerts.push({
        id: `alert-failed-${row.id as string}`,
        type: 'alert',
        icon: 'dollar',
        title: 'Failed payment',
        description: `${name} — $${dollars}`,
        href: `/revenue?status=failed&txn=${row.id as string}`,
        timestamp: row.created_at as string,
        unread: false,
      })
    }
  }

  if (expiringCreditsRes.status === 'fulfilled' && expiringCreditsRes.value.data) {
    for (const row of expiringCreditsRes.value.data) {
      const member = row.members as unknown as { id: string; profiles?: { full_name?: string } } | null
      const name = member?.profiles?.full_name ?? 'Unknown'
      const expiresAt = row.expires_at as string
      const daysUntil = Math.ceil(
        (new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      )
      alerts.push({
        id: `alert-credit-${row.id as string}`,
        type: 'alert',
        icon: 'warning',
        title: 'Credits expiring soon',
        description: `${name} — ${row.credits_remaining} credit${row.credits_remaining === 1 ? '' : 's'} expire in ${daysUntil}d`,
        href: `/members?focus=${member?.id ?? ''}`,
        timestamp: expiresAt,
        unread: false,
      })
    }
  }

  // Merge + sort reverse-chronological by timestamp
  const items = [...events, ...alerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const unreadCount = events.filter((e) => e.unread).length

  return NextResponse.json<NotificationsResponse>({
    items,
    unread_count: unreadCount,
    last_read_at: lastReadAt,
  })
}

/**
 * POST /api/notifications — mark all read (sets
 * `profiles.notifications_last_read_at = now()`).
 */
export async function POST() {
  const auth = await requireRole(['owner', 'manager'])
  if (auth.error) return auth.error
  const { user, supabase } = auth

  const { error } = await supabase
    .from('profiles')
    .update({ notifications_last_read_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

function humanizeType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
