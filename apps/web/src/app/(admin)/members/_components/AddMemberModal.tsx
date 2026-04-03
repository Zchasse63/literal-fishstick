'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'

export default function AddMemberModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [addForm, setAddForm] = useState({ full_name: '', email: '', phone: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Add New Member</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

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
              onClose()
              setAddForm({ full_name: '', email: '', phone: '' })
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
            <input
              type="text"
              required
              value={addForm.full_name}
              onChange={(e) => setAddForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Jane Smith"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
            <input
              type="email"
              required
              value={addForm.email}
              onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jane@example.com"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              type="tel"
              value={addForm.phone}
              onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 123-4567"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
            />
          </div>

          {addError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
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
      </motion.div>
    </motion.div>
  )
}
