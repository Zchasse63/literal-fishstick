'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Pause } from 'lucide-react'

interface MemberPauseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId: string
  memberName: string
  onSuccess: () => void
}

export default function MemberPauseModal({
  open,
  onOpenChange,
  memberId,
  memberName,
  onSuccess,
}: MemberPauseModalProps) {
  const [resumeDate, setResumeDate] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePause = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/members/${memberId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_date: resumeDate || null,
          reason: reason || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to pause membership')
        return
      }

      onOpenChange(false)
      onSuccess()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pause Membership</DialogTitle>
          <DialogDescription>
            Pause membership for {memberName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Resume Date (optional)</Label>
            <input
              type="date"
              value={resumeDate}
              onChange={(e) => setResumeDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="mt-1 h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Leave empty for an indefinite pause
            </p>
          </div>

          <div>
            <Label>Reason (optional)</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm resize-none"
              placeholder="Why is this membership being paused?"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handlePause}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
            Pause Membership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
