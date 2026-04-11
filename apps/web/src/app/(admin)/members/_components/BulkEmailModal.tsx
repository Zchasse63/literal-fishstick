'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Mail } from 'lucide-react'
import type { Member } from './types'

/**
 * Tier 8.5.A2 — Bulk email compose modal.
 *
 * v1 STUB: displays a confirmation toast listing the first 3 recipients.
 * When the real implementation lands, the submit handler will loop over
 * `recipients` and call POST /api/campaigns/send-test per address, OR
 * a new POST /api/campaigns/bulk-send batch route (preferred v2 path).
 */
interface BulkEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipients: Member[]
  onShowToast: (msg: string) => void
}

export function BulkEmailModal({ open, onOpenChange, recipients, onShowToast }: BulkEmailModalProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  function handleSend() {
    if (!subject.trim() || !body.trim()) {
      onShowToast('Subject and message are required')
      return
    }
    setSending(true)
    // TODO: replace this stub with a per-recipient loop calling
    // POST /api/campaigns/send-test, or a new bulk-send batch route.
    // See feature-dev backlog note for B18 context — preserving the existing
    // contract until the Resend integration lands in Tier 5.2.
    const preview = recipients
      .slice(0, 3)
      .map((r) => r.firstName)
      .join(', ')
    const more = recipients.length > 3 ? ` +${recipients.length - 3} more` : ''
    onShowToast(`Email queued for ${recipients.length} recipients: ${preview}${more}`)
    setSending(false)
    setSubject('')
    setBody('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl"
        showCloseButton
        data-testid="members-bulk-email-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            <Mail className="h-4 w-4 text-indigo-600" />
            Email {recipients.length} members
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
            Send a quick message to the selected members. Drafts are not saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="members-bulk-email-subject-input"
              placeholder="e.g. Welcome back — your spot is still warm"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              data-testid="members-bulk-email-body-input"
              rows={6}
              placeholder="Hey {{first_name}}, just checking in…"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all resize-none"
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10 px-3 py-2">
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              <strong>v1 stub:</strong> The actual Resend delivery integration is tracked in the feature-dev backlog (Tier 5.2 / B12). This composer currently queues a confirmation toast only — no email leaves the building yet.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              data-testid="members-bulk-email-cancel-btn"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              data-testid="members-bulk-email-send-btn"
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Queuing…' : `Send to ${recipients.length}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
