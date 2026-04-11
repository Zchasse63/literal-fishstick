'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FilterTab, SortKey } from './types'

/**
 * Tier 8.5.A3 — Saved Views hook.
 *
 * Persists named filter/sort combos in localStorage so owners can re-run
 * their most common questions in one click instead of rebuilding filters
 * from scratch every time ("my at-risk unlimited members sorted by LTV",
 * "new members from the last 30 days", etc).
 *
 * Storage key is versioned so we can add/change fields later without
 * corrupting existing saves.
 */
const STORAGE_KEY = 'meridian.members.savedViews.v1'

export type TierFilter = 'all' | 'unlimited' | '10_class' | '6_class' | 'credit_pack'

export interface SavedView {
  id: string
  name: string
  filter: FilterTab
  sortKey: SortKey
  tierFilter: TierFilter
  search: string
  createdAt: string
}

function loadFromStorage(): SavedView[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v): v is SavedView =>
        typeof v === 'object' &&
        v !== null &&
        typeof v.id === 'string' &&
        typeof v.name === 'string'
    )
  } catch {
    return []
  }
}

function saveToStorage(views: SavedView[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch {
    // Storage quota or disabled — silently fail, the views just don't persist.
  }
}

export interface UseSavedViewsReturn {
  views: SavedView[]
  saveView: (input: Omit<SavedView, 'id' | 'createdAt'>) => SavedView
  deleteView: (id: string) => void
  renameView: (id: string, name: string) => void
}

export function useSavedViews(): UseSavedViewsReturn {
  const [views, setViews] = useState<SavedView[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Hydrate once on mount (client-only — avoids SSR mismatch).
  useEffect(() => {
    setViews(loadFromStorage())
    setHydrated(true)
  }, [])

  // Persist on every change, but only after hydration so we don't wipe the
  // store with an empty initial state during the first render pass.
  useEffect(() => {
    if (hydrated) saveToStorage(views)
  }, [views, hydrated])

  const saveView = useCallback(
    (input: Omit<SavedView, 'id' | 'createdAt'>): SavedView => {
      const id = `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const view: SavedView = {
        ...input,
        id,
        createdAt: new Date().toISOString(),
      }
      setViews((prev) => [...prev, view])
      return view
    },
    []
  )

  const deleteView = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id))
  }, [])

  const renameView = useCallback((id: string, name: string) => {
    setViews((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)))
  }, [])

  return { views, saveView, deleteView, renameView }
}
