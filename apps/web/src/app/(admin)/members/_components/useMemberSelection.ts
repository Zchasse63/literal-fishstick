'use client'

import { useCallback, useState } from 'react'
import type { Member } from './types'

/**
 * Tier 8.5.A2 — Member selection hook.
 *
 * Owns a Set<string> of member IDs (members.id, NOT profile_id) and exposes
 * the minimal API needed to power a checkbox column + bulk-actions bar. Range
 * selection via shift-click is supported; the caller tracks lastClickedId in
 * a ref and passes it into toggleRange.
 */
export interface UseMemberSelectionReturn {
  selectedIds: Set<string>
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleRange: (fromId: string | null, toId: string, visibleMembers: Member[]) => void
  toggleAll: (visibleMembers: Member[]) => void
  clearSelection: () => void
  isAllSelected: (visibleMembers: Member[]) => boolean
  isIndeterminate: (visibleMembers: Member[]) => boolean
}

export function useMemberSelection(): UseMemberSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  /**
   * Shift-click range selection. Adds every member between `fromId` and
   * `toId` (inclusive) in the currently-visible array to the selection.
   * If `fromId` is null or not found, falls back to toggling `toId` alone.
   */
  const toggleRange = useCallback(
    (fromId: string | null, toId: string, visibleMembers: Member[]) => {
      if (!fromId) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(toId)) next.delete(toId)
          else next.add(toId)
          return next
        })
        return
      }
      const fromIdx = visibleMembers.findIndex((m) => m.id === fromId)
      const toIdx = visibleMembers.findIndex((m) => m.id === toId)
      if (fromIdx === -1 || toIdx === -1) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(toId)) next.delete(toId)
          else next.add(toId)
          return next
        })
        return
      }
      const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (let i = start; i <= end; i++) {
          next.add(visibleMembers[i].id)
        }
        return next
      })
    },
    []
  )

  const toggleAll = useCallback((visibleMembers: Member[]) => {
    setSelectedIds((prev) => {
      const allVisibleIds = new Set(visibleMembers.map((m) => m.id))
      const allSelected = visibleMembers.every((m) => prev.has(m.id))
      if (allSelected) {
        // Deselect all visible (preserves any selections outside the visible set)
        const next = new Set(prev)
        for (const id of allVisibleIds) next.delete(id)
        return next
      }
      // Select all visible (union with prior selection)
      const next = new Set(prev)
      for (const id of allVisibleIds) next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const isAllSelected = useCallback(
    (visibleMembers: Member[]) => {
      if (visibleMembers.length === 0) return false
      return visibleMembers.every((m) => selectedIds.has(m.id))
    },
    [selectedIds]
  )

  const isIndeterminate = useCallback(
    (visibleMembers: Member[]) => {
      if (visibleMembers.length === 0) return false
      const anySelected = visibleMembers.some((m) => selectedIds.has(m.id))
      const allSelected = visibleMembers.every((m) => selectedIds.has(m.id))
      return anySelected && !allSelected
    },
    [selectedIds]
  )

  return {
    selectedIds,
    isSelected,
    toggle,
    toggleRange,
    toggleAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
  }
}
