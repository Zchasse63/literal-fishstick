'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Tier 8.5.A6/A7 — Recent members hook.
 *
 * Tracks the last N members the user has opened in the palette/search.
 * Persisted in localStorage under a versioned key. Safe on SSR (lazy
 * initializer guarded by `typeof window`).
 */
const STORAGE_KEY = 'meridian.recents.members.v1'
const MAX_RECENTS = 5

export interface RecentMember {
  id: string           // members.id (stable)
  profileId: string    // for /members URL (BUG-013)
  fullName: string
  email: string
  savedAt: number
}

function loadFromStorage(): RecentMember[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (r): r is RecentMember =>
          typeof r === 'object' &&
          r !== null &&
          typeof r.id === 'string' &&
          typeof r.profileId === 'string' &&
          typeof r.fullName === 'string' &&
          typeof r.savedAt === 'number'
      )
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_RECENTS)
  } catch {
    return []
  }
}

function saveToStorage(list: RecentMember[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Quota / disabled — silently drop
  }
}

export function useRecentMembers() {
  const [recents, setRecents] = useState<RecentMember[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setRecents(loadFromStorage())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) saveToStorage(recents)
  }, [recents, hydrated])

  const addRecent = useCallback(
    (member: Omit<RecentMember, 'savedAt'>) => {
      setRecents((prev) => {
        // Dedup by id, move to top, cap at MAX_RECENTS
        const withoutExisting = prev.filter((r) => r.id !== member.id)
        const next = [{ ...member, savedAt: Date.now() }, ...withoutExisting]
        return next.slice(0, MAX_RECENTS)
      })
    },
    []
  )

  const clearRecents = useCallback(() => setRecents([]), [])

  return { recents, addRecent, clearRecents }
}
