'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface HealthScoreData {
  score: number
  riskLevel: 'healthy' | 'watch' | 'at_risk' | 'critical'
  narrative: string
  topFactors: string[]
  recommendedAction: string
}

interface UseMemberHealthScoreReturn extends Partial<HealthScoreData> {
  isLoading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Fetch and manage a member's AI-generated health score.
 * Automatically fetches on mount when memberId is provided.
 */
export function useMemberHealthScore(
  memberId: string | null
): UseMemberHealthScoreReturn {
  const [data, setData] = useState<HealthScoreData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchHealthScore = useCallback(async () => {
    if (!memberId) {
      setData(null)
      setIsLoading(false)
      setError(null)
      return
    }

    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/health-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(
          (body as { error?: string }).error ??
            `Request failed with status ${response.status}`
        )
      }

      const result = await response.json()

      if (!controller.signal.aborted) {
        setData({
          score: result.score,
          riskLevel: result.risk_level,
          narrative: result.narrative,
          topFactors: result.top_factors,
          recommendedAction: result.recommended_action,
        })
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return // request was cancelled, ignore
      }
      const message =
        err instanceof Error ? err.message : 'Failed to fetch health score'
      if (!controller.signal.aborted) {
        setError(message)
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [memberId])

  // Fetch on mount and when memberId changes
  useEffect(() => {
    fetchHealthScore()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [fetchHealthScore])

  return {
    score: data?.score,
    riskLevel: data?.riskLevel,
    narrative: data?.narrative,
    topFactors: data?.topFactors,
    recommendedAction: data?.recommendedAction,
    isLoading,
    error,
    refresh: fetchHealthScore,
  }
}
