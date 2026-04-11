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
import { createBrowserClient } from '@/lib/supabase/client'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

interface ClassType {
  id: string
  name: string
  color: string | null
}

interface Trainer {
  id: string
  full_name: string
}

interface ClassFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editData?: {
    id: string
    class_type_id: string
    title: string | null
    starts_at: string
    ends_at: string
    capacity: number
    trainer_id: string | null
    /** BUG-018: field is `notes` (the actual DB column), not `description`.
     *  The UI still labels the form field "Description" — that's just a UI
     *  label, it's persisted as `classes.notes`. */
    notes: string | null
  } | null
}

export default function ClassFormModal({ open, onOpenChange, onSuccess, editData }: ClassFormModalProps) {
  const isEdit = !!editData
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [classTypeId, setClassTypeId] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('17:00')
  const [endTime, setEndTime] = useState('18:00')
  const [capacity, setCapacity] = useState(12)
  const [trainerId, setTrainerId] = useState('')
  const [description, setDescription] = useState('')

  // Lookup data
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loadingLookups, setLoadingLookups] = useState(true)

  // Load class types and trainers
  useEffect(() => {
    if (!open) return
    const supabase = createBrowserClient()
    setLoadingLookups(true)
    Promise.all([
      supabase.from('class_types').select('id, name, color').eq('studio_id', DEFAULT_STUDIO_ID),
      supabase.from('profiles').select('id, full_name').eq('studio_id', DEFAULT_STUDIO_ID).contains('roles', ['trainer']),
    ]).then(([typesRes, trainersRes]) => {
      setClassTypes(typesRes.data ?? [])
      setTrainers(trainersRes.data ?? [])
      setLoadingLookups(false)
    })
  }, [open])

  // Populate form when editing
  useEffect(() => {
    if (editData) {
      setClassTypeId(editData.class_type_id)
      setTitle(editData.title ?? '')
      setDate(editData.starts_at.split('T')[0])
      setStartTime(new Date(editData.starts_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }))
      setEndTime(new Date(editData.ends_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }))
      setCapacity(editData.capacity)
      setTrainerId(editData.trainer_id ?? '')
      // BUG-018: load from editData.notes (the real DB column), not a
      // phantom `description` field. Prevents note-wipe on every save.
      setDescription(editData.notes ?? '')
    } else {
      // Reset for create mode
      setClassTypeId('')
      setTitle('')
      setDate(new Date().toISOString().split('T')[0])
      setStartTime('17:00')
      setEndTime('18:00')
      setCapacity(12)
      setTrainerId('')
      setDescription('')
    }
    setError('')
  }, [editData, open])

  const handleSubmit = async () => {
    if (!classTypeId) { setError('Please select a class type'); return }
    if (!date) { setError('Please select a date'); return }

    setLoading(true)
    setError('')

    const startIso = new Date(`${date}T${startTime}`).toISOString()
    const endIso = new Date(`${date}T${endTime}`).toISOString()

    try {
      const url = isEdit ? `/api/classes/${editData!.id}` : '/api/classes'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_type_id: classTypeId,
          start_time: startIso,
          end_time: endIso,
          capacity,
          trainer_id: trainerId || null,
          title: title || null,
          description: description || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to save class')
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
      <DialogContent data-testid="schedule-class-form-modal" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Class' : 'Create New Class'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update class details' : 'Schedule a new class on the calendar'}
          </DialogDescription>
        </DialogHeader>

        {loadingLookups ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Class Type *</Label>
              <select
                data-testid="schedule-class-form-type-select"
                value={classTypeId}
                onChange={(e) => setClassTypeId(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Select type...</option>
                {classTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>{ct.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Title (optional)</Label>
              <Input
                data-testid="schedule-class-form-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Morning Flow"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Date *</Label>
                <Input
                  data-testid="schedule-class-form-date-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Start</Label>
                <Input
                  data-testid="schedule-class-form-start-time-input"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  data-testid="schedule-class-form-end-time-input"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Capacity</Label>
                <Input
                  data-testid="schedule-class-form-capacity-input"
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Trainer</Label>
                <select
                  data-testid="schedule-class-form-trainer-select"
                  value={trainerId}
                  onChange={(e) => setTrainerId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">None</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <textarea
                data-testid="schedule-class-form-description-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm resize-none"
                placeholder="Optional notes about this class..."
              />
            </div>

            {error && (
              <p data-testid="schedule-class-form-error" className="text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            data-testid="schedule-class-form-cancel-btn"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            data-testid="schedule-class-form-submit-btn"
            onClick={handleSubmit}
            disabled={loading || loadingLookups}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Save Changes' : 'Create Class'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
