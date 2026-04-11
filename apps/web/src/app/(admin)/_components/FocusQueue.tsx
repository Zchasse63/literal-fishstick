'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  Clock,
  User,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Flame,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FocusItem, FocusResponse } from '@/app/api/command-center/focus/route'

/**
 * Tier 8.5.A9 — Command Center "Today's Focus" queue.
 *
 * Priority-ranked list of the 5 most urgent actions an owner needs to take.
 * Polls every 60 seconds. Clicking an item navigates to the CTA destination.
 * Auto-refreshes on page focus.
 */
const POLL_MS = 60_000

const ICON_MAP: Record<FocusItem['icon'], React.ElementType> = {
  dollar: DollarSign,
  clock: Clock,
  user: User,
  calendar: Calendar,
  alert: AlertTriangle,
}

const ICON_BG: Record<FocusItem['icon'], string> = {
  dollar: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400',
  clock: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  user: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
  calendar: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
  alert: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
}

function priorityBadge(priority: number): { label: string; classes: string } {
  if (priority >= 85) {
    return { label: 'Critical', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
  }
  if (priority >= 65) {
    return { label: 'High', classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' }
  }
  return { label: 'Medium', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
}

export function FocusQueue() {
  const [data, setData] = useState<FocusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchFocus() {
      try {
        const res = await fetch('/api/command-center/focus')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as FocusResponse
        if (!cancelled) {
          setData(body)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchFocus()
    const interval = setInterval(fetchFocus, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const items = data?.items ?? []

  return (
    <div
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden"
      data-testid="command-focus-queue"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Flame className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Today&apos;s Focus</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Highest-impact actions, ranked by urgency
            </p>
          </div>
        </div>
        {data?.generated_at && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Updated {new Date(data.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        ) : error && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <AlertTriangle className="w-6 h-6 text-red-400 mb-2" />
            <p className="text-xs text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nothing urgent</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              No failed payments, at-risk members, or overdue alerts.
            </p>
          </div>
        ) : (
          items.map((item) => <FocusRow key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}

function FocusRow({ item }: { item: FocusItem }) {
  const Icon = ICON_MAP[item.icon]
  const iconClasses = ICON_BG[item.icon]
  const badge = priorityBadge(item.priority)

  return (
    <Link
      href={item.href}
      data-testid="command-focus-item"
      data-focus-kind={item.kind}
      className="block group"
    >
      <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
        <div
          className={cn(
            'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
            iconClasses
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {item.title}
            </p>
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest shrink-0',
                badge.classes
              )}
            >
              {badge.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {item.description}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
          <span className="hidden sm:inline">{item.cta}</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </Link>
  )
}
