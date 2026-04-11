'use client'

import { useMemo } from 'react'
import { Flame, CreditCard, CheckCircle2, XCircle, Clock, DollarSign, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MemberBooking, MemberTransaction } from './types'

/**
 * Tier 8.5.A4 — Unified activity timeline for a member.
 *
 * Merges bookings and transactions into a single reverse-chronological feed
 * so staff can answer "what's happened with this member?" without hopping
 * between tabs. Future expansion: layer in activity_log entries for notes,
 * tags, email sends, check-ins — once a GET endpoint for
 * `activity_log?subject_type=member&subject_id=X` exists.
 */
interface ActivityTimelineProps {
  bookings: MemberBooking[]
  transactions: MemberTransaction[]
  /** Lowest allowed cap — empty timeline should look intentional, not buggy. */
  emptyLabel?: string
}

type TimelineEvent =
  | { kind: 'booking'; at: string; booking: MemberBooking }
  | { kind: 'transaction'; at: string; transaction: MemberTransaction }

function iconFor(event: TimelineEvent): { Icon: typeof Flame; bg: string; fg: string } {
  if (event.kind === 'booking') {
    const status = event.booking.status
    if (status === 'checked_in') return { Icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/20', fg: 'text-emerald-600 dark:text-emerald-400' }
    if (status === 'cancelled' || status === 'late_cancelled') return { Icon: XCircle, bg: 'bg-gray-50 dark:bg-gray-900/20', fg: 'text-gray-500 dark:text-gray-400' }
    if (status === 'no_show') return { Icon: XCircle, bg: 'bg-red-50 dark:bg-red-900/20', fg: 'text-red-600 dark:text-red-400' }
    return { Icon: Flame, bg: 'bg-indigo-50 dark:bg-indigo-900/20', fg: 'text-indigo-600 dark:text-indigo-400' }
  }
  // transaction
  const status = event.transaction.status
  if (status === 'refunded') return { Icon: RotateCcw, bg: 'bg-amber-50 dark:bg-amber-900/20', fg: 'text-amber-600 dark:text-amber-400' }
  if (status === 'failed') return { Icon: XCircle, bg: 'bg-red-50 dark:bg-red-900/20', fg: 'text-red-600 dark:text-red-400' }
  return { Icon: DollarSign, bg: 'bg-violet-50 dark:bg-violet-900/20', fg: 'text-violet-600 dark:text-violet-400' }
}

function titleFor(event: TimelineEvent): string {
  if (event.kind === 'booking') {
    const { booking } = event
    const status = booking.status
    if (status === 'checked_in') return `Checked in — ${booking.className}`
    if (status === 'cancelled') return `Cancelled — ${booking.className}`
    if (status === 'late_cancelled') return `Late cancel — ${booking.className}`
    if (status === 'no_show') return `No-show — ${booking.className}`
    if (status === 'waitlisted') return `Waitlisted — ${booking.className}`
    return `Booked — ${booking.className}`
  }
  const { transaction } = event
  const dollars = (transaction.amount / 100).toFixed(2)
  if (transaction.status === 'refunded') return `Refunded $${dollars}${transaction.description ? ` — ${transaction.description}` : ''}`
  if (transaction.status === 'failed') return `Failed payment $${dollars}`
  return `Paid $${dollars}${transaction.description ? ` — ${transaction.description}` : ''}`
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.round(months / 12)
  return `${years}y ago`
}

export function ActivityTimeline({ bookings, transactions, emptyLabel = 'No activity yet' }: ActivityTimelineProps) {
  const events = useMemo<TimelineEvent[]>(() => {
    const all: TimelineEvent[] = []
    for (const b of bookings) {
      all.push({ kind: 'booking', at: b.startsAt, booking: b })
    }
    for (const t of transactions) {
      all.push({ kind: 'transaction', at: t.createdAt, transaction: t })
    }
    all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return all.slice(0, 30) // cap for perf; panel stays usable even with 1000s of rows
  }, [bookings, transactions])

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center text-xs text-gray-400 dark:text-gray-500" data-testid="members-activity-timeline-empty">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="space-y-2" data-testid="members-activity-timeline">
      {events.map((event, i) => {
        const { Icon, bg, fg } = iconFor(event)
        const title = titleFor(event)
        const when = formatRelative(event.at)
        const absoluteDate = new Date(event.at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        // Tier 8.5.A4 (review fix #4): data-derived stable key so React
        // doesn't re-mount all following rows when a new event is prepended
        // by a poll-driven refresh. `i` is appended as a tiebreaker for the
        // rare case where two events share status/timestamp/amount.
        const key =
          event.kind === 'booking'
            ? `b-${event.booking.startsAt}-${event.booking.status}-${i}`
            : `t-${event.transaction.createdAt}-${event.transaction.amount}-${event.transaction.status}-${i}`
        return (
          <div
            key={key}
            data-testid="members-activity-timeline-row"
            className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className={cn('mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0', bg)}>
              <Icon className={cn('h-4 w-4', fg)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate" title={title}>
                {title}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="h-2.5 w-2.5 text-gray-400 dark:text-gray-500" />
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {when} <span className="text-gray-300 dark:text-gray-600">· {absoluteDate}</span>
                </p>
              </div>
            </div>
            {event.kind === 'transaction' && (
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest',
                  event.transaction.status === 'completed' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                  event.transaction.status === 'refunded' && 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                  event.transaction.status === 'failed' && 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                )}
              >
                <CreditCard className="h-2.5 w-2.5 mr-0.5" />
                {event.transaction.status}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
