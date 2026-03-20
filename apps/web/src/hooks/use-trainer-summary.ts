'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface TrainerSummaryData {
  narrative: string
  highlights: string[]
  areasForGrowth: string[]
  overallRating: 'exceptional' | 'strong' | 'solid' | 'developing' | 'needs_attention'
  bonusSummary: string
  cached: boolean
  generatedAt: string | null
}

interface UseTrainerSummaryReturn {
  summary: TrainerSummaryData | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Fetch and manage an AI-generated trainer performance summary.
 * Automatically fetches on mount when trainerId is provided.
 */
export function useTrainerSummary(
  trainerId: string | null
): UseTrainerSummaryReturn {
  const [summary, setSummary] = useState<TrainerSummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchSummary = useCallback(async () => {
    if (!trainerId) {
      setSummary(null)
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
      const response = await fetch('/api/ai/trainer-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainer_id: trainerId }),
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
        const summaryData = result.summary ?? result
        setSummary({
          narrative: summaryData.narrative,
          highlights: summaryData.highlights ?? [],
          areasForGrowth: summaryData.areas_for_growth ?? [],
          overallRating: summaryData.overall_rating,
          bonusSummary: summaryData.bonus_summary,
          cached: result.cached ?? false,
          generatedAt: result.generated_at ?? null,
        })
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return // request was cancelled, ignore
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to fetch trainer summary'
      if (!controller.signal.aborted) {
        setError(message)
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [trainerId])

  // Fetch on mount and when trainerId changes
  useEffect(() => {
    fetchSummary()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [fetchSummary])

  return {
    summary,
    isLoading,
    error,
    refresh: fetchSummary,
  }
}
