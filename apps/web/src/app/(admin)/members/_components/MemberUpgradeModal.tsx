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
import { Loader2, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const PLANS = [
  { value: 'unlimited', label: 'Unlimited Monthly', price: '$149/mo', description: 'Unlimited sauna sessions, all time slots' },
  { value: '10_class', label: '10-Class Pack', price: '$120', description: '10 sessions, valid for 90 days' },
  { value: '6_class', label: '6-Class Pack', price: '$80', description: '6 sessions, valid for 60 days' },
] as const

interface MemberUpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId: string
  memberName: string
  currentTier: string
  onSuccess: () => void
}

export default function MemberUpgradeModal({
  open,
  onOpenChange,
  memberId,
  memberName,
  currentTier,
  onSuccess,
}: MemberUpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUpgrade = async () => {
    if (!selectedPlan) { setError('Please select a plan'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/members/${memberId}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_plan: selectedPlan }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to upgrade membership')
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
          <DialogTitle>Upgrade Membership</DialogTitle>
          <DialogDescription>
            Select a new plan for {memberName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {currentTier && (
            <p className="text-xs text-gray-500">
              Current plan: <span className="font-semibold text-gray-700">{currentTier}</span>
            </p>
          )}

          {PLANS.map((plan) => {
            const isCurrent = currentTier?.toLowerCase().replace(/[\s-]/g, '_') === plan.value
            return (
              <button
                key={plan.value}
                onClick={() => !isCurrent && setSelectedPlan(plan.value)}
                disabled={isCurrent}
                className={cn(
                  'w-full text-left p-3 rounded-xl border transition-all',
                  isCurrent
                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    : selectedPlan === plan.value
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                      : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{plan.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{plan.price}</span>
                </div>
                {isCurrent && (
                  <span className="text-[10px] font-bold text-gray-400 uppercase mt-1 block">Current Plan</span>
                )}
              </button>
            )
          })}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleUpgrade}
            disabled={loading || !selectedPlan}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            Upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
