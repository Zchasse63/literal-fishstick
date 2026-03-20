'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { BookingPatternResult } from '@/lib/ai/booking-patterns'

interface UseBookingPatternsReturn {
  data: BookingPatternResult | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Fetch and manage AI-generated booking pattern analysis.
 * Automatically fetches on mount.
 */
export function useBookingPatterns(): UseBookingPatternsReturn {
  const [data, setData] = useState<BookingPatternResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchPatterns = useCallback(async () => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/booking-patterns', {
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
          recommendations: result.recommendations,
          peak_hours: result.peak_hours,
          underperforming: result.underperforming,
          summary: result.summary,
        })
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return // request was cancelled, ignore
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to fetch booking patterns'
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
    fetchPatterns()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [fetchPatterns])

  return {
    data,
    isLoading,
    error,
    refresh: fetchPatterns,
  }
}
