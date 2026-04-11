'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tag } from 'lucide-react'
import type { Member } from './types'

/**
 * Tier 8.5.A2 — Bulk tag apply modal.
 *
 * Applies a tag to every selected member by looping over
 * POST /api/members/[id]/tags with the member's `id` (NOT `profileId`) in
 * the URL path — because `member_tags.member_id` FKs to `members.id`. This
 * is the OPPOSITE of the archive route, which uses `profileId`. The two
 * routes have different URL contracts per BUG-013 — see Member type.
 *
 * 409 (tag already exists) is treated as success (idempotent). Any other
 * non-2xx counts as a failure.
 */
interface BulkTagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMembers: Member[]
  onShowToast: (msg: string) => void
  onSuccess: () => void
}

export function BulkTagModal({
  open,
  onOpenChange,
  selectedMembers,
  onShowToast,
  onSuccess,
}: BulkTagModalProps) {
  const [tag, setTag] = useState('')
  const [applying, setApplying] = useState(false)

  async function handleApply() {
    const trimmed = tag.trim()
    if (!trimmed) {
      onShowToast('Tag name is required')
      return
    }

    setApplying(true)
    let succeeded = 0
    let failed = 0

    // Sequential fetches — avoids hammering the API and produces a clean
    // "N of M applied" toast if anything goes sideways. Change to
    // Promise.allSettled if perf becomes a concern with large selections.
    for (const member of selectedMembers) {
      try {
        // BUG-013 note: tag route uses members.id (the `id` field), not
        // profile_id. Do NOT swap to member.profileId here.
        const res = await fetch(`/api/members/${member.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: trimmed }),
        })
        if (res.ok || res.status === 409) {
          succeeded++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    setApplying(false)
    setTag('')
    onOpenChange(false)

    if (failed === 0) {
      onShowToast(`Tag "${trimmed}" applied to ${succeeded} members`)
    } else {
      onShowToast(`Applied to ${succeeded}, failed ${failed} — check console`)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl"
        showCloseButton
        data-testid="members-bulk-tag-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            <Tag className="h-4 w-4 text-indigo-600" />
            Tag {selectedMembers.length} members
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
            Create or reuse a tag. Members who already have the tag are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Tag name
            </label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply()
              }}
              data-testid="members-bulk-tag-input"
              placeholder="e.g. winback-q2, vip, needs-followup"
              autoFocus
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => onOpenChange(false)}
              data-testid="members-bulk-tag-cancel-btn"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              data-testid="members-bulk-tag-apply-btn"
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {applying ? 'Applying…' : `Apply to ${selectedMembers.length}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
