'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, DollarSign, Search } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

interface MemberOption {
  /** members.id — FK target for transactions.member_id */
  id: string
  full_name: string
  email: string
}

interface RecordPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// Must stay in lockstep with the `transactions_type_check` CHECK constraint
// (see `specs/bugs/revenue-record-payment-modal-broken.md` for prior mismatch).
const PAYMENT_TYPES = [
  { value: 'drop_in', label: 'Drop-in' },
  { value: 'membership', label: 'Membership' },
  { value: 'credit_pack', label: 'Credit Pack' },
  { value: 'merch', label: 'Merch' },
  { value: 'gift_card', label: 'Gift Card' },
  { value: 'private_event', label: 'Private Event' },
]

export default function RecordPaymentModal({ open, onOpenChange, onSuccess }: RecordPaymentModalProps) {
  const supabase = useRef(createBrowserClient()).current
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [memberId, setMemberId] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('drop_in')
  const [description, setDescription] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  // Member search
  const [memberSearch, setMemberSearch] = useState('')
  const [members, setMembers] = useState<MemberOption[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // Reset on open
  useEffect(() => {
    if (open) {
      setMemberId('')
      setAmount('')
      setType('drop_in')
      setDescription('')
      setPaymentMethod('cash')
      setMemberSearch('')
      setSelectedMember(null)
      setError('')
    }
  }, [open])

  // Member search — two-step query so the filter applies cleanly to the
  // searchable columns on `profiles`, then we look up the matching `members`
  // row (FK target for `transactions.member_id`).
  //
  // Previous approach used `.from('members').select('id, profiles:profile_id!inner(...)').or(..., { referencedTable: 'profiles' })`
  // but the embedded-resource filter returned an empty set in practice (see
  // BUG-006 council run) — likely a PostgREST serialization quirk. The two-step
  // form is explicit and resilient.
  useEffect(() => {
    if (memberSearch.length < 2) { setMembers([]); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('studio_id', DEFAULT_STUDIO_ID)
          .or(`full_name.ilike.%${memberSearch}%,email.ilike.%${memberSearch}%`)
          .limit(8)

        if (!profileRows || profileRows.length === 0) {
          setMembers([])
          return
        }

        const profileIds = profileRows.map((p: any) => p.id)
        const { data: memberRows } = await supabase
          .from('members')
          .select('id, profile_id')
          .eq('studio_id', DEFAULT_STUDIO_ID)
          .in('profile_id', profileIds)

        const profileById = new Map(
          profileRows.map((p: any) => [p.id, p] as const),
        )
        const rows: MemberOption[] = (memberRows ?? []).map((m: any) => {
          const p: any = profileById.get(m.profile_id)
          return {
            id: m.id,
            full_name: p?.full_name ?? 'Unknown',
            email: p?.email ?? '',
          }
        })
        setMembers(rows)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [memberSearch])

  const selectMember = (m: MemberOption) => {
    setSelectedMember(m)
    setMemberId(m.id)
    setMemberSearch('')
    setMembers([])
  }

  const handleSubmit = async () => {
    if (!memberId) { setError('Please select a member'); return }
    if (!amount || Number(amount) <= 0) { setError('Please enter a valid amount'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          amount: Math.round(Number(amount) * 100), // Convert to cents
          type,
          description: description || `Manual ${paymentMethod} payment`,
          status: 'completed',
          payment_method: paymentMethod,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to record payment')
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
      <DialogContent className="sm:max-w-md" data-testid="revenue-payment-form-dialog">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Log a manual or offline payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Member Search */}
          <div>
            <Label>Member *</Label>
            {selectedMember ? (
              <div
                className="mt-1 flex items-center justify-between p-2 rounded-lg border border-indigo-200 bg-indigo-50"
                data-testid="revenue-payment-form-member-selected"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedMember.full_name}</p>
                  <p className="text-xs text-gray-500">{selectedMember.email}</p>
                </div>
                <button
                  onClick={() => { setSelectedMember(null); setMemberId('') }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  data-testid="revenue-payment-form-member-change-btn"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="pl-8"
                  data-testid="revenue-payment-form-member-search-input"
                />
                {members.length > 0 && (
                  <div
                    className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    data-testid="revenue-payment-form-member-results"
                  >
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => selectMember(m)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                        data-testid="revenue-payment-form-member-result"
                        data-member-id={m.id}
                      >
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{m.full_name}</p>
                        <p className="text-xs text-gray-500">{m.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                {searchLoading && (
                  <div className="absolute right-2.5 top-2.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount ($) *</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-8"
                  data-testid="revenue-payment-form-amount-input"
                />
              </div>
            </div>
            <div>
              <Label>Type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                data-testid="revenue-payment-form-type-select"
              >
                {PAYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>Payment Method</Label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              data-testid="revenue-payment-form-method-select"
            >
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes..."
              className="mt-1"
              data-testid="revenue-payment-form-description-input"
            />
          </div>

          {error && (
            <p
              className="text-sm text-red-600"
              data-testid="revenue-payment-form-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="revenue-payment-form-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            data-testid="revenue-payment-form-submit-btn"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
