'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ChurnPredictionData {
  churnProbability: number
  riskLevel: 'low' | 'moderate' | 'high' | 'critical'
  narrative: string
  contributingFactors: { factor: string; weight: 'high' | 'medium' | 'low' }[]
  recommendedInterventions: {
    action: string
    urgency: 'immediate' | 'this_week' | 'this_month'
  }[]
  retentionPlaybook: 'winback' | 're-engage' | 'save' | 'nurture'
  cached: boolean
  generatedAt: string | null
}

interface UseChurnPredictionReturn {
  prediction: ChurnPredictionData | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Fetch and manage a member's AI-generated churn prediction.
 * Automatically fetches on mount when memberId is provided.
 */
export function useChurnPrediction(
  memberId: string | null
): UseChurnPredictionReturn {
  const [prediction, setPrediction] = useState<ChurnPredictionData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchPrediction = useCallback(async () => {
    if (!memberId) {
      setPrediction(null)
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
      const response = await fetch('/api/ai/churn-prediction', {
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
        setPrediction({
          churnProbability: result.churn_probability,
          riskLevel: result.risk_level,
          narrative: result.narrative,
          contributingFactors: result.contributing_factors,
          recommendedInterventions: result.recommended_interventions,
          retentionPlaybook: result.retention_playbook,
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
          : 'Failed to fetch churn prediction'
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
    fetchPrediction()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [fetchPrediction])

  return {
    prediction,
    isLoading,
    error,
    refresh: fetchPrediction,
  }
}
