'use client'

import { useEffect, useRef, useState } from 'react'
import type { SearchResponse } from '@/app/api/search/route'

/**
 * Tier 8.5.A6/A7 — Debounced entity search hook.
 *
 * Fires a GET /api/search request 300ms after the caller's query settles.
 * Uses an AbortController ref so rapid typing never lets a stale response
 * overwrite the current one. Caller is responsible for the initial
 * "don't fire below 2 chars" guard — this hook short-circuits that case.
 */
const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

const EMPTY_RESPONSE: SearchResponse = {
  members: [],
  classes: [],
  transactions: [],
  campaigns: [],
  leads: [],
}

export function useEntitySearch(query: string, enabled: boolean = true) {
  const [results, setResults] = useState<SearchResponse>(EMPTY_RESPONSE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Reset state below threshold / disabled — nothing to fetch.
    const trimmed = query.trim()
    if (!enabled || trimmed.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort()
      setResults(EMPTY_RESPONSE)
      setLoading(false)
      setError(null)
      return
    }

    // Debounce
    const timer = setTimeout(async () => {
      // Abort any in-flight request from a previous keystroke.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=5`,
          { signal: controller.signal }
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        const body = (await res.json()) as SearchResponse
        setResults(body)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Search failed')
        setResults(EMPTY_RESPONSE)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [query, enabled])

  // Cancel in-flight on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  return { results, loading, error }
}
