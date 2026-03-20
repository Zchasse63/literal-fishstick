'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface IntakeEnrichmentData {
  memberPersona: 'enthusiast' | 'explorer' | 'social' | 'wellness_seeker' | 'casual'
  engagementPrediction: 'high' | 'moderate' | 'low'
  narrative: string
  suggestedNextSteps: string[]
  idealClassRecommendations: string[]
  retentionRiskEarly: 'low' | 'medium' | 'high'
  personalizationTags: string[]
  cached: boolean
  generatedAt: string | null
}

interface UseIntakeEnrichmentReturn {
  enrichment: IntakeEnrichmentData | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Fetch and manage a new member's AI-generated intake profile enrichment.
 * Automatically fetches on mount when memberId is provided.
 */
export function useIntakeEnrichment(
  memberId: string | null
): UseIntakeEnrichmentReturn {
  const [enrichment, setEnrichment] = useState<IntakeEnrichmentData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchEnrichment = useCallback(async () => {
    if (!memberId) {
      setEnrichment(null)
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
      const response = await fetch('/api/ai/intake-enrichment', {
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
        setEnrichment({
          memberPersona: result.member_persona,
          engagementPrediction: result.engagement_prediction,
          narrative: result.narrative,
          suggestedNextSteps: result.suggested_next_steps,
          idealClassRecommendations: result.ideal_class_recommendations,
          retentionRiskEarly: result.retention_risk_early,
          personalizationTags: result.personalization_tags,
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
          : 'Failed to fetch intake enrichment'
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
    fetchEnrichment()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [fetchEnrichment])

  return {
    enrichment,
    isLoading,
    error,
    refresh: fetchEnrichment,
  }
}
