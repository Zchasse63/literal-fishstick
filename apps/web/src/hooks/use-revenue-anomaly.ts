'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RevenueAnomalyResult } from '@/lib/ai/revenue-anomaly'

interface UseRevenueAnomalyReturn {
  data: RevenueAnomalyResult | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Fetch and manage AI-generated revenue anomaly detection.
 * Automatically fetches on mount.
 */
export function useRevenueAnomaly(): UseRevenueAnomalyReturn {
  const [data, setData] = useState<RevenueAnomalyResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchAnomaly = useCallback(async () => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/revenue-anomaly', {
        method: 'GET',
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
          has_anomaly: result.has_anomaly,
          anomaly_type: result.anomaly_type,
          severity: result.severity,
          summary: result.summary,
          comparisons: result.comparisons,
          recommendations: result.recommendations,
        })
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return // request was cancelled, ignore
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to fetch revenue anomaly data'
      if (!controller.signal.aborted) {
        setError(message)
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchAnomaly()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [fetchAnomaly])

  return {
    data,
    isLoading,
    error,
    refresh: fetchAnomaly,
  }
}
