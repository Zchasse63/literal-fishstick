'use client'

import { motion } from 'framer-motion'
import { Mail, Tag, Download, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member } from './types'

/**
 * Tier 8.5.A2 — Members bulk actions bar.
 *
 * Slide-in strip at the bottom of the viewport when ≥1 member is selected.
 * Caller gates rendering with <AnimatePresence> + selectedCount > 0 check.
 */
interface BulkActionsBarProps {
  selectedCount: number
  /** Full selected Member rows — used by the export + email handlers. */
  selectedMembers: Member[]
  onEmail: () => void
  onAddTag: () => void
  onArchive: () => void
  onExport: () => void
  onClearSelection: () => void
}

export function BulkActionsBar({
  selectedCount,
  onEmail,
  onAddTag,
  onArchive,
  onExport,
  onClearSelection,
}: BulkActionsBarProps) {
  return (
    <motion.div
      key="bulk-actions-bar"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="fixed bottom-4 left-0 right-0 z-40 flex justify-center pointer-events-none"
      data-testid="members-bulk-bar"
    >
      <div className="pointer-events-auto max-w-2xl mx-4 w-full md:w-auto">
        <div className="bg-gray-900 dark:bg-gray-950 text-white rounded-2xl shadow-2xl flex items-center gap-3 px-4 py-3 border border-white/10">
          {/* Count badge */}
          <div className="flex items-center gap-2 pr-3 border-r border-white/10">
            <span className="text-xs font-bold tabular-nums">{selectedCount}</span>
            <span className="text-[10px] uppercase tracking-widest text-gray-300">
              selected
            </span>
            <button
              onClick={onClearSelection}
              data-testid="members-bulk-clear-btn"
              className="ml-1 h-5 w-5 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors"
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <BulkButton icon={Mail} label="Email" onClick={onEmail} testId="members-bulk-email-btn" />
            <BulkButton icon={Tag} label="Add Tag" onClick={onAddTag} testId="members-bulk-tag-btn" />
            <BulkButton icon={Download} label="Export CSV" onClick={onExport} testId="members-bulk-export-btn" />
            <BulkButton
              icon={Trash2}
              label="Archive"
              onClick={onArchive}
              testId="members-bulk-archive-btn"
              variant="destructive"
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface BulkButtonProps {
  icon: typeof Mail
  label: string
  onClick: () => void
  testId: string
  variant?: 'default' | 'destructive'
}

function BulkButton({ icon: Icon, label, onClick, testId, variant = 'default' }: BulkButtonProps) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
        variant === 'destructive'
          ? 'text-red-300 hover:bg-red-500/20 hover:text-red-200'
          : 'text-white hover:bg-white/10'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
