'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type EditFields = {
  full_name: string
  email: string
  phone: string
  notes: string
  exclude_from_analytics: boolean
}

type EditableInitial = {
  full_name: string
  email: string
  phone: string
  notes: string | null
  exclude_from_analytics?: boolean
}

export default function EditMemberModal({
  open,
  onOpenChange,
  profileId,
  initial,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * BUG-013: PUT /api/members/[id] expects URL [id] = profile_id (the
   * profiles.id PK), NOT members.id. The panel passes member.profileId.
   */
  profileId: string
  initial: EditableInitial
  onSuccess: () => void
}) {
  const [form, setForm] = useState<EditFields>({
    full_name: initial.full_name ?? '',
    email: initial.email ?? '',
    phone: initial.phone ?? '',
    notes: initial.notes ?? '',
    exclude_from_analytics: initial.exclude_from_analytics ?? false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-seed the form whenever the modal is reopened or the underlying member
  // changes (e.g. switching between members in the directory).
  useEffect(() => {
    if (open) {
      setForm({
        full_name: initial.full_name ?? '',
        email: initial.email ?? '',
        phone: initial.phone ?? '',
        notes: initial.notes ?? '',
        exclude_from_analytics: initial.exclude_from_analytics ?? false,
      })
      setError(null)
    }
  }, [
    open,
    initial.full_name,
    initial.email,
    initial.phone,
    initial.notes,
    initial.exclude_from_analytics,
  ])

  const handleClose = () => {
    onOpenChange(false)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="members-edit-modal-dialog"
        className="sm:max-w-md bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Edit Member
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
            Update the member&apos;s contact details and notes.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setLoading(true)
            setError(null)
            try {
              // Send only fields the user actually changed. Empty strings
              // for phone/notes are treated as explicit clears.
              const payload: Record<string, unknown> = {}
              if (form.full_name !== (initial.full_name ?? '')) payload.full_name = form.full_name
              if (form.email !== (initial.email ?? '')) payload.email = form.email
              if (form.phone !== (initial.phone ?? '')) payload.phone = form.phone
              if (form.notes !== (initial.notes ?? '')) payload.notes = form.notes
              if (form.exclude_from_analytics !== (initial.exclude_from_analytics ?? false)) {
                payload.exclude_from_analytics = form.exclude_from_analytics
              }

              if (Object.keys(payload).length === 0) {
                // Nothing actually changed — close cleanly without hitting
                // the API. Avoids cluttering activity_log with no-op rows.
                handleClose()
                onSuccess()
                return
              }

              const res = await fetch(`/api/members/${profileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              })
              const json = await res.json()
              if (!res.ok) throw new Error(json.error || 'Failed to update member')
              handleClose()
              onSuccess()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Something went wrong')
            } finally {
              setLoading(false)
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name *</label>
            <input
              data-testid="members-edit-modal-name-input"
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Jane Smith"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white dark:bg-gray-950"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
            <input
              data-testid="members-edit-modal-email-input"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jane@example.com"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white dark:bg-gray-950"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
            <input
              data-testid="members-edit-modal-phone-input"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 123-4567"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white dark:bg-gray-950"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
            <textarea
              data-testid="members-edit-modal-notes-input"
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Internal notes about this member..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white dark:bg-gray-950 resize-none"
            />
          </div>

          <div className="flex items-start gap-2.5">
            <input
              data-testid="members-edit-modal-exclude-analytics-checkbox"
              type="checkbox"
              id="edit-member-exclude-analytics"
              checked={form.exclude_from_analytics}
              onChange={(e) =>
                setForm(f => ({ ...f, exclude_from_analytics: e.target.checked }))
              }
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            <label
              htmlFor="edit-member-exclude-analytics"
              className="text-sm text-gray-700 dark:text-gray-300 leading-tight select-none cursor-pointer"
            >
              <span className="font-medium">Exclude from analytics</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Hide this member from revenue, attendance, and engagement reports
                (e.g., comped members, former owners).
              </span>
            </label>
          </div>

          {error && (
            <p data-testid="members-edit-modal-error" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              data-testid="members-edit-modal-cancel-btn"
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="members-edit-modal-submit-btn"
              type="submit"
              disabled={loading || !form.full_name || !form.email}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : 'Save Changes'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
