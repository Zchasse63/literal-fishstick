'use client'

import { useState } from 'react'
import { Bookmark, BookmarkPlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SavedView } from './useSavedViews'

/**
 * Tier 8.5.A3 — Saved Views bar.
 *
 * Renders a horizontal strip of saved view chips. Clicking a chip applies
 * the stored filter/sort combo. A "+ Save current" button on the right
 * opens an inline prompt to save whatever the user has currently dialed in.
 *
 * Zero backend — everything lives in localStorage via useSavedViews hook.
 */
interface SavedViewsBarProps {
  views: SavedView[]
  activeViewId: string | null
  onApplyView: (view: SavedView) => void
  onSaveCurrent: (name: string) => void
  onDeleteView: (id: string) => void
}

export function SavedViewsBar({
  views,
  activeViewId,
  onApplyView,
  onSaveCurrent,
  onDeleteView,
}: SavedViewsBarProps) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      setSaving(false)
      return
    }
    onSaveCurrent(trimmed)
    setName('')
    setSaving(false)
  }

  return (
    <div
      className="flex items-center gap-2 flex-wrap pt-2"
      data-testid="members-saved-views-bar"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        <Bookmark className="h-3 w-3" />
        Views
      </div>

      {views.length === 0 && !saving && (
        <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">
          No saved views yet — dial in filters, then save the combo
        </span>
      )}

      {views.map((view) => (
        <div
          key={view.id}
          data-testid="members-saved-view-chip"
          data-view-id={view.id}
          className={cn(
            'group inline-flex items-center gap-1 rounded-lg border text-xs font-semibold transition-all',
            activeViewId === view.id
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-indigo-300 hover:text-indigo-600'
          )}
        >
          <button
            onClick={() => onApplyView(view)}
            className="px-2.5 py-1.5"
            title={`${view.filter} · ${view.sortKey}${view.tierFilter !== 'all' ? ` · ${view.tierFilter}` : ''}`}
          >
            {view.name}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`Delete view "${view.name}"?`)) onDeleteView(view.id)
            }}
            className={cn(
              'mr-1 opacity-0 group-hover:opacity-100 transition-opacity h-4 w-4 rounded flex items-center justify-center',
              activeViewId === view.id ? 'hover:bg-white/20' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
            )}
            aria-label={`Delete ${view.name}`}
            data-testid="members-saved-view-delete-btn"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}

      {saving ? (
        <div className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white dark:bg-gray-900 pl-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') {
                setSaving(false)
                setName('')
              }
            }}
            autoFocus
            placeholder="Name this view…"
            data-testid="members-save-view-input"
            className="py-1 text-xs font-semibold bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 w-32"
          />
          <button
            onClick={handleSave}
            data-testid="members-save-view-confirm-btn"
            className="px-2 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded"
          >
            Save
          </button>
          <button
            onClick={() => {
              setSaving(false)
              setName('')
            }}
            className="px-2 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setSaving(true)}
          data-testid="members-save-view-btn"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
        >
          <BookmarkPlus className="h-3 w-3" />
          Save current
        </button>
      )}
    </div>
  )
}
