'use client'

import { useEffect, useState } from 'react'
import { Activity, TrendingDown, TrendingUp, AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member } from './types'

/**
 * Tier 8.5.A5 — Health score explanation card.
 *
 * The existing MemberProfilePanel shows `member.engagementStatus` as a color
 * dot with no explanation. This card calls the existing POST /api/ai/health-score
 * endpoint (Tier 5.7 regression-verified) to fetch the cached score plus
 * narrative + top factors + recommended action, so staff can answer
 * "why is this member at risk?" without hopping to the AI module.
 */
interface HealthScoreCardProps {
  memberId: string        // the members.id (not profile_id)
  memberFirstName: string
}

interface HealthScoreResult {
  score: number
  risk_level: 'healthy' | 'watch' | 'at_risk' | 'critical'
  narrative: string
  top_factors: string[]
  recommended_action: string
  cached: boolean
  generated_at: string
}

const LEVEL_STYLES: Record<HealthScoreResult['risk_level'], { bg: string; fg: string; ring: string; Icon: typeof TrendingUp; label: string }> = {
  healthy: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', fg: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-500/30', Icon: TrendingUp, label: 'Healthy' },
  watch:   { bg: 'bg-amber-50 dark:bg-amber-900/20',     fg: 'text-amber-700 dark:text-amber-300',     ring: 'ring-amber-500/30',   Icon: Activity,   label: 'Watch' },
  at_risk: { bg: 'bg-orange-50 dark:bg-orange-900/20',   fg: 'text-orange-700 dark:text-orange-300',   ring: 'ring-orange-500/30',  Icon: TrendingDown, label: 'At Risk' },
  critical:{ bg: 'bg-red-50 dark:bg-red-900/20',         fg: 'text-red-700 dark:text-red-300',         ring: 'ring-red-500/30',     Icon: AlertTriangle, label: 'Critical' },
}

export function HealthScoreCard({ memberId, memberFirstName }: HealthScoreCardProps) {
  const [data, setData] = useState<HealthScoreResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Tier 8.5.A5 (review fix #3): Effect-driven fetch with AbortController so
  // rapid member switching doesn't let a stale response overwrite the
  // current member's score.
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const res = await fetch('/api/ai/health-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: memberId }),
          signal: controller.signal,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        const body = (await res.json()) as HealthScoreResult
        setData(body)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        // Only flip loading off if we weren't aborted — the next effect
        // run owns its own loading state.
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [memberId])

  // Manual refresh (user-initiated, always for the current member — no race)
  async function refreshScore() {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/health-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const body = (await res.json()) as HealthScoreResult
      setData(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400 dark:text-gray-500" />
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Loading health score…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-4">
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Health score unavailable: {error}</span>
        </div>
      </div>
    )
  }

  if (!data) return null

  const style = LEVEL_STYLES[data.risk_level]
  const { Icon } = style

  return (
    <div
      className={cn('rounded-xl border p-4 space-y-3', 'border-gray-200 dark:border-gray-800', style.bg)}
      data-testid="members-health-score-card"
    >
      {/* Header: score + level + refresh */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('h-12 w-12 rounded-xl bg-white dark:bg-gray-950 flex items-center justify-center shadow-sm ring-2', style.ring)}>
            <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {data.score}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Icon className={cn('h-3 w-3', style.fg)} />
              <span className={cn('text-[10px] font-bold uppercase tracking-widest', style.fg)}>
                {style.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Health score for {memberFirstName}</p>
          </div>
        </div>
        <button
          onClick={refreshScore}
          disabled={refreshing}
          data-testid="members-health-score-refresh-btn"
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50 p-1 rounded"
          title="Recalculate"
          aria-label="Recalculate health score"
        >
          <RotateCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Narrative */}
      {data.narrative && (
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed" data-testid="members-health-score-narrative">
          {data.narrative}
        </p>
      )}

      {/* Top factors */}
      {Array.isArray(data.top_factors) && data.top_factors.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
            Why
          </p>
          <ul className="space-y-1" data-testid="members-health-score-factors">
            {data.top_factors.slice(0, 4).map((factor, i) => (
              <li key={i} className="text-[11px] text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                <span className="text-gray-400 dark:text-gray-600 mt-0.5">•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended action */}
      {data.recommended_action && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
            Recommended action
          </p>
          <p className="text-xs text-gray-900 dark:text-gray-100 font-medium" data-testid="members-health-score-action">
            {data.recommended_action}
          </p>
        </div>
      )}

      {/* Cache indicator */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        {data.cached ? 'Cached' : 'Fresh'} · {new Date(data.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </p>
    </div>
  )
}
