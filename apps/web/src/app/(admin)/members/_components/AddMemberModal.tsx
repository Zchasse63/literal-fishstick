'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export default function AddMemberModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [addForm, setAddForm] = useState({ full_name: '', email: '', phone: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const handleClose = () => {
    onOpenChange(false)
    setAddForm({ full_name: '', email: '', phone: '' })
    setAddError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="members-add-modal-dialog"
        className="sm:max-w-md bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add New Member
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
            Enter the new member&apos;s details below.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setAddLoading(true)
            setAddError(null)
            try {
              const res = await fetch('/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addForm),
              })
              const json = await res.json()
              if (!res.ok) throw new Error(json.error || 'Failed to add member')
              handleClose()
              onSuccess()
            } catch (err) {
              setAddError(err instanceof Error ? err.message : 'Something went wrong')
            } finally {
              setAddLoading(false)
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name *</label>
            <input
              data-testid="members-add-modal-name-input"
              type="text"
              required
              value={addForm.full_name}
              onChange={(e) => setAddForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Jane Smith"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white dark:bg-gray-950"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
            <input
              data-testid="members-add-modal-email-input"
              type="email"
              required
              value={addForm.email}
              onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jane@example.com"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white dark:bg-gray-950"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
            <input
              data-testid="members-add-modal-phone-input"
              type="tel"
              value={addForm.phone}
              onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 123-4567"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white dark:bg-gray-950"
            />
          </div>

          {addError && (
            <p data-testid="members-add-modal-error" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              data-testid="members-add-modal-cancel-btn"
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="members-add-modal-submit-btn"
              type="submit"
              disabled={addLoading || !addForm.full_name || !addForm.email}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </span>
              ) : 'Add Member'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
