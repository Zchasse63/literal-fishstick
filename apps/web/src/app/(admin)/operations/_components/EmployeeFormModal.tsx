'use client'

import { useState, useEffect } from 'react'
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
import { Loader2 } from 'lucide-react'

interface EmployeeEditData {
  id: string
  name: string
  email: string
  phone: string
  role: string
  employmentType: string
  hireDate: string
  payRate: string
}

interface EmployeeFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editData?: EmployeeEditData | null
}

export default function EmployeeFormModal({ open, onOpenChange, onSuccess, editData }: EmployeeFormModalProps) {
  const isEdit = !!editData
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [hireDate, setHireDate] = useState('')
  const [payRate, setPayRate] = useState('')

  // Populate form when editing / reset for create
  useEffect(() => {
    if (editData) {
      setName(editData.name)
      setEmail(editData.email)
      setPhone(editData.phone)
      setRole(editData.role)
      setEmploymentType(editData.employmentType)
      setHireDate(editData.hireDate)
      setPayRate(editData.payRate)
    } else {
      setName('')
      setEmail('')
      setPhone('')
      setRole('')
      setEmploymentType('')
      setHireDate(new Date().toISOString().split('T')[0])
      setPayRate('')
    }
    setError('')
  }, [editData, open])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (!email.trim()) { setError('Email is required'); return }
    if (!role) { setError('Please select a role'); return }
    if (!employmentType) { setError('Please select an employment type'); return }

    setLoading(true)
    setError('')

    try {
      const url = isEdit ? `/api/employees/${editData!.id}` : '/api/employees'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role,
          employment_type: employmentType,
          hire_date: hireDate || null,
          pay_rate: payRate || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || `Failed to ${isEdit ? 'update' : 'create'} employee`)
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update employee details' : 'Add a new employee to the directory'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="mt-1" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role *</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Select role...</option>
                <option value="Trainer">Trainer</option>
                <option value="Front Desk">Front Desk</option>
                <option value="Manager">Manager</option>
              </select>
            </div>
            <div>
              <Label>Employment Type *</Label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Select type...</option>
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Contractor">Contractor</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Hire Date</Label>
              <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Pay Rate</Label>
              <Input value={payRate} onChange={(e) => setPayRate(e.target.value)} placeholder="$25/hr" className="mt-1" />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
