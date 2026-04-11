'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  BellOff,
  DollarSign,
  User,
  AlertTriangle,
  Calendar,
  Mail,
  Star,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  NotificationItem,
  NotificationsResponse,
} from '@/app/api/notifications/route'

/**
 * Tier 8.5.A8 — Notification dropdown.
 *
 * Replaces the previous "No new notifications" empty shell with a live feed
 * from /api/notifications. Auto-polls every 60 seconds while mounted.
 * Click the bell to open the dropdown; click outside or press Esc to close.
 * Clicking a notification navigates + marks all read.
 */
const POLL_INTERVAL_MS = 60_000

const ICON_MAP: Record<NotificationItem['icon'], React.ElementType> = {
  dollar: DollarSign,
  user: User,
  alert: AlertCircle,
  calendar: Calendar,
  mail: Mail,
  star: Star,
  warning: AlertTriangle,
}

const ICON_BG: Record<NotificationItem['icon'], string> = {
  dollar: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400',
  user: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
  alert: 'bg-gray-50 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400',
  calendar: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
  mail: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400',
  star: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  warning: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const body = (await res.json()) as NotificationsResponse
      setData(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + 60s polling
  useEffect(() => {
    fetchNotifications({ silent: true })
    const interval = setInterval(
      () => fetchNotifications({ silent: true }),
      POLL_INTERVAL_MS
    )
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // Mark all read (optimistic)
  const markAllRead = useCallback(async () => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            unread_count: 0,
            items: prev.items.map((i) => ({ ...i, unread: false })),
            last_read_at: new Date().toISOString(),
          }
        : prev
    )
    try {
      await fetch('/api/notifications', { method: 'POST' })
    } catch {
      // silent — next poll will reconcile
    }
  }, [])

  const unreadCount = data?.unread_count ?? 0
  const items = data?.items ?? []

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => {
          setOpen((prev) => !prev)
          if (!open && !loading && !data) {
            fetchNotifications()
          }
        }}
        aria-label="Notifications"
        data-testid="header-notifications-btn"
        className="relative text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
            data-testid="header-notifications-badge"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notifications-dropdown"
          className="absolute right-0 top-full mt-2 w-96 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-2xl z-50 max-h-[32rem] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-red-500 text-white text-[9px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                data-testid="notifications-mark-all-read-btn"
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : error && items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
                <p className="text-xs text-gray-600 dark:text-gray-400">{error}</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10">
                <BellOff className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">All clear</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  No new events or alerts
                </p>
              </div>
            ) : (
              <ul data-testid="notifications-list">
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} onNavigate={() => setOpen(false)} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationRow({
  item,
  onNavigate,
}: {
  item: NotificationItem
  onNavigate: () => void
}) {
  const Icon = ICON_MAP[item.icon]
  const iconClasses = ICON_BG[item.icon]
  const body = (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-colors border-b border-gray-50 dark:border-gray-800/60 last:border-b-0">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', iconClasses)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-xs font-semibold truncate',
              item.unread
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-700 dark:text-gray-300'
            )}
          >
            {item.title}
          </p>
          {item.unread && (
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1" />
          )}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
          {item.description}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
          {formatRelative(item.timestamp)}
        </p>
      </div>
    </div>
  )
  if (item.href) {
    return (
      <li data-testid="notifications-item">
        <Link href={item.href} onClick={onNavigate} className="block">
          {body}
        </Link>
      </li>
    )
  }
  return <li data-testid="notifications-item">{body}</li>
}
