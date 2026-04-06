'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  X,
  CheckCircle2,
  Clock,
  Users,
  UserCheck,
  Send,
  Edit3,
  Receipt,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useClasses, useSupabase } from '@/hooks/use-supabase'
import type { ClassInstance } from '@meridian/types'
import { fadeInUp } from '@/lib/motion'
import { useToast } from '@/hooks/use-toast'
import { ToastNotification } from '@/components/ui/toast-notification'

// ─── Types ──────────────────────────────────────────────────
type ViewMode = 'Day' | 'Week' | 'Month'
type ClassFilter = 'All Classes' | 'Open Sauna' | 'Guided' | 'Private'

interface ClassBlock {
  id: string
  time: string
  type: 'open' | 'guided' | 'private'
  name: string
  trainer?: string
  booked: number
  capacity: number
  checkedIn: number
  attendees: Attendee[]
  date: string // YYYY-MM-DD
}

interface Attendee {
  id: string
  name: string
  email: string
  status: 'checked_in' | 'booked' | 'no_show' | 'waitlisted'
  isWalkIn: boolean
  isGuest: boolean
  checkedInAt: string | null
}

// ─── Date Helpers (Eastern Time) ────────────────────────────
const EASTERN_TZ = 'America/New_York'
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getEasternNow(): Date {
  // Create a date object representing "now" in Eastern time
  const now = new Date()
  return now
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // Monday start
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getWeekDays(weekStart: Date): { label: string; date: number; dateISO: string; dayOfWeek: number }[] {
  const days: { label: string; date: number; dateISO: string; dayOfWeek: number }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    days.push({
      label: DAY_LABELS[d.getDay()],
      date: d.getDate(),
      dateISO: formatDateISO(d),
      dayOfWeek: d.getDay(), // 0=Sun, 6=Sat
    })
  }
  return days
}

function formatWeekHeader(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short', timeZone: EASTERN_TZ })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: EASTERN_TZ })
  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
  }
  return `${startMonth} ${weekStart.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`
}

/**
 * Convert 24hr "HH:MM" to 12hr display "H:MM AM/PM" in Eastern time.
 * We receive raw HH:MM from the database (already in Eastern since studio operates in ET).
 */
function formatTime24to12(time24: string): string {
  const [hStr, mStr] = time24.split(':')
  let h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${mStr} ${ampm}`
}

function classTypeToBlockType(classType: string): 'open' | 'guided' | 'private' {
  if (classType === 'open_sauna') return 'open'
  if (classType === 'guided') return 'guided'
  return 'private'
}

function isToday(dateISO: string): boolean {
  return formatDateISO(new Date()) === dateISO
}

// ─── Transform DB class to UI ClassBlock ────────────────────
function classInstanceToBlock(cls: ClassInstance & { class_types: Record<string, unknown> | null }): ClassBlock {
  // Derive time and date from starts_at (ISO timestamptz)
  const startsAt = new Date(cls.starts_at)
  const hours = startsAt.getHours()
  const minutes = startsAt.getMinutes().toString().padStart(2, '0')
  const time24 = `${hours}:${minutes}`

  // Derive class type from joined class_types record
  const classTypeName = ((cls.class_types as Record<string, unknown> | null)?.name as string ?? 'open').toLowerCase()
  const blockType: 'open' | 'guided' | 'private' = classTypeName.includes('guided') ? 'guided'
    : classTypeName.includes('private') ? 'private' : 'open'

  return {
    id: cls.id,
    time: formatTime24to12(time24),
    type: blockType,
    name: cls.title,
    trainer: cls.trainer_name ?? undefined,
    booked: cls.booked_count,
    capacity: cls.capacity,
    checkedIn: cls.checked_in_count,
    attendees: [], // loaded on click
    date: cls.starts_at.split('T')[0],
  }
}

// ─── Loading Skeleton ───────────────────────────────────────
function ScheduleSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="w-20 p-3 text-left">
                <Skeleton className="h-3 w-10" />
              </th>
              {Array.from({ length: 7 }).map((_, i) => (
                <th key={i} className="p-3 text-center">
                  <Skeleton className="h-3 w-8 mx-auto mb-1" />
                  <Skeleton className="h-5 w-6 mx-auto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-50 last:border-0">
                <td className="p-3 align-top">
                  <Skeleton className="h-4 w-14" />
                </td>
                {Array.from({ length: 7 }).map((_, colIdx) => (
                  <td key={colIdx} className="p-2 align-top">
                    {(rowIdx + colIdx) % 3 !== 0 && (
                      <Skeleton className="h-16 w-full rounded-lg" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-6 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
    </div>
  )
}

// ─── Price Breakdown Panel ─────────────────────────────────
interface PriceBreakdownData {
  subtotal: number
  discount_amount: number
  discount_name: string | null
  member_discount_applied: boolean
  member_discount_amount: number
  tax_rate: number
  tax_name: string | null
  tax_amount: number
  total: number
  currency: string
}

function PriceBreakdownPanel({
  classId,
  memberId,
  discountId,
  promoCode,
}: {
  classId: string
  memberId: string
  discountId?: string
  promoCode?: string
}) {
  const [breakdown, setBreakdown] = useState<PriceBreakdownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!classId || !memberId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ class_id: classId, member_id: memberId })
    if (promoCode) params.set('promo_code', promoCode)
    else if (discountId) params.set('discount_id', discountId)

    fetch(`/api/pricing?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) {
          setError(json.error)
        } else {
          setBreakdown(json.data)
        }
      })
      .catch(() => !cancelled && setError('Failed to load pricing'))
      .finally(() => !cancelled && setLoading(false))

    return () => { cancelled = true }
  }, [classId, memberId, discountId, promoCode])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-gray-400 dark:text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading pricing...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
    )
  }

  if (!breakdown) return null

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Receipt className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Price Breakdown</p>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{fmt(breakdown.subtotal)}</span>
      </div>
      {breakdown.discount_amount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-emerald-600">Discount{breakdown.discount_name ? ` (${breakdown.discount_name})` : ''}</span>
          <span className="font-semibold text-emerald-600 tabular-nums">-{fmt(breakdown.discount_amount)}</span>
        </div>
      )}
      {breakdown.member_discount_applied && breakdown.member_discount_amount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-emerald-600">Member Discount (10%)</span>
          <span className="font-semibold text-emerald-600 tabular-nums">-{fmt(breakdown.member_discount_amount)}</span>
        </div>
      )}
      {breakdown.tax_amount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{breakdown.tax_name || 'Tax'} ({(breakdown.tax_rate * 100).toFixed(2)}%)</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{fmt(breakdown.tax_amount)}</span>
        </div>
      )}
      <div className="flex justify-between text-sm pt-1.5 border-t border-gray-100 dark:border-gray-800">
        <span className="font-bold text-gray-900 dark:text-gray-100">Total</span>
        <span className="font-black text-gray-900 dark:text-gray-100 tabular-nums">{fmt(breakdown.total)}</span>
      </div>
    </div>
  )
}

// ─── Class Block Component ──────────────────────────────────
function ClassBlockCard({ cls, onClick, isSelected }: { cls: ClassBlock; onClick: () => void; isSelected: boolean }) {
  const fillRate = cls.booked / cls.capacity
  const bgColor = cls.type === 'guided' ? 'bg-violet-50 border-violet-200 hover:bg-violet-100' :
                  cls.type === 'private' ? 'bg-teal-50 border-teal-200 hover:bg-teal-100' :
                  'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
  const textColor = cls.type === 'guided' ? 'text-violet-700' :
                    cls.type === 'private' ? 'text-teal-700' : 'text-indigo-700'

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded-lg border transition-all text-xs',
        bgColor,
        isSelected && 'ring-2 ring-indigo-500 shadow-md'
      )}
    >
      <p className={cn('font-bold truncate', textColor)}>{cls.name}</p>
      <p className="text-gray-500 dark:text-gray-400 tabular-nums">{cls.booked}/{cls.capacity}</p>
      {cls.trainer && <p className="text-gray-400 dark:text-gray-500 truncate">{cls.trainer}</p>}
    </motion.button>
  )
}

// ─── Detail Panel ───────────────────────────────────────────
function ClassDetailPanel({
  cls,
  attendees,
  loadingAttendees,
  onClose,
  onCheckInAll,
  checkingInAll,
  onSendReminder,
  onEditClass,
}: {
  cls: ClassBlock
  attendees: Attendee[]
  loadingAttendees: boolean
  onClose: () => void
  onCheckInAll: () => void
  checkingInAll: boolean
  onSendReminder: () => void
  onEditClass: () => void
}) {
  const fillPercent = Math.round((cls.booked / cls.capacity) * 100)
  const typeBadgeColor = cls.type === 'guided' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'
  const checkedInCount = attendees.filter(a => a.status === 'checked_in').length
  const bookedCount = attendees.filter(a => a.status === 'checked_in' || a.status === 'booked').length

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.25 }}
      className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">{cls.time} {cls.name}</h3>
            <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded-full', typeBadgeColor)}>
              {cls.type === 'guided' ? 'Guided' : cls.type === 'private' ? 'Private' : 'Open'}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {cls.trainer && `${cls.trainer} · `}{cls.booked}/{cls.capacity} booked · 60 min
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fill bar */}
      <div className="space-y-1">
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${fillPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Pricing */}
      {cls.id && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <PriceBreakdownPanel classId={cls.id} memberId="" />
        </div>
      )}

      {/* Attendees */}
      {loadingAttendees ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      ) : attendees.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
            Attendees ({checkedInCount}/{bookedCount})
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {attendees.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    a.status === 'checked_in' ? 'bg-emerald-500' :
                    a.status === 'no_show' ? 'bg-red-500' :
                    a.status === 'waitlisted' ? 'bg-amber-500' : 'bg-gray-300'
                  )} />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {a.name}
                    {a.isWalkIn && <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">(walk-in)</span>}
                    {a.isGuest && <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">(guest)</span>}
                  </span>
                </div>
                <span className={cn(
                  'text-xs font-medium capitalize',
                  a.status === 'checked_in' ? 'text-emerald-600' :
                  a.status === 'no_show' ? 'text-red-600' :
                  a.status === 'waitlisted' ? 'text-amber-600' : 'text-gray-400 dark:text-gray-500'
                )}>
                  {a.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No attendees yet</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onCheckInAll}
          disabled={checkingInAll}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {checkingInAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
          {checkingInAll ? 'Checking In...' : 'Check In All'}
        </button>
        <button
          onClick={onSendReminder}
          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Send className="w-4 h-4" />
          Send Reminder
        </button>
      </div>
      <button
        onClick={onEditClass}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <Edit3 className="w-4 h-4" />
        Edit Class
      </button>
    </motion.div>
  )
}

// ─── Schedule Page ──────────────────────────────────────────
export default function SchedulePage() {
  const supabase = useSupabase()
  const { toast, showToast } = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>('Week')
  const [activeFilter, setActiveFilter] = useState<ClassFilter>('All Classes')
  const [selectedClass, setSelectedClass] = useState<ClassBlock | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [loadingAttendees, setLoadingAttendees] = useState(false)
  const [checkingInAll, setCheckingInAll] = useState(false)

  const viewModes: ViewMode[] = ['Day', 'Week', 'Month']
  const filters: ClassFilter[] = ['All Classes', 'Open Sauna', 'Guided', 'Private']

  // ─── Week calculation ───────────────────────────────────────
  const weekStart = useMemo(() => {
    const base = getWeekStart(getEasternNow())
    base.setDate(base.getDate() + weekOffset * 7)
    return base
  }, [weekOffset])

  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart])
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const todayISO = formatDateISO(new Date())

  // ─── Fetch classes for current week ─────────────────────────
  const { data: rawClasses, loading: classesLoading, error: classesError } = useClasses({
    from: formatDateISO(weekStart),
    to: formatDateISO(weekEnd),
  })

  // ─── Transform classes into ClassBlocks ─────────────────────
  const classBlocks = useMemo<ClassBlock[]>(() => {
    if (!rawClasses) return []
    return rawClasses.map(classInstanceToBlock)
  }, [rawClasses])

  // ─── Collect all unique time slots from the data ────────────
  const allTimeSlots = useMemo(() => {
    const timesSet = new Set<string>()
    for (const cls of classBlocks) {
      timesSet.add(cls.time)
    }
    // If empty, provide some defaults so the grid isn't blank
    if (timesSet.size === 0) {
      return ['5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM']
    }
    // Sort time slots chronologically
    return Array.from(timesSet).sort((a, b) => {
      return parseTime12(a) - parseTime12(b)
    })
  }, [classBlocks])

  // ─── Get classes for a given day + time cell ────────────────
  const getClasses = useCallback(
    (dateISO: string, time: string): ClassBlock[] => {
      let filtered = classBlocks.filter(c => c.date === dateISO && c.time === time)
      if (activeFilter === 'Open Sauna') filtered = filtered.filter(c => c.type === 'open')
      else if (activeFilter === 'Guided') filtered = filtered.filter(c => c.type === 'guided')
      else if (activeFilter === 'Private') filtered = filtered.filter(c => c.type === 'private')
      return filtered
    },
    [classBlocks, activeFilter]
  )

  // ─── Fetch attendees when a class is selected ───────────────
  const fetchAttendees = useCallback(
    async (classId: string) => {
      setLoadingAttendees(true)
      setAttendees([])

      try {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id,
            status,
            is_walk_in,
            is_guest,
            checked_in_at,
            members!inner (
              profile_id,
              profiles:profile_id (
                full_name,
                email
              )
            )
          `)
          .eq('class_id', classId)
          .in('status', ['confirmed', 'checked_in', 'no_show', 'waitlisted'])
          .order('created_at', { ascending: true })

        if (error) throw error

        const mapped: Attendee[] = (data ?? []).map((row: any) => {
          const profile = row.members?.profiles
          return {
            id: row.id,
            name: profile?.full_name ?? 'Unknown',
            email: profile?.email ?? '',
            status: row.status === 'confirmed' ? 'booked' : row.status,
            isWalkIn: row.is_walk_in,
            isGuest: row.is_guest,
            checkedInAt: row.checked_in_at,
          }
        })

        // Sort: checked_in first, then booked, then waitlisted, then no_show
        const order: Record<string, number> = { checked_in: 0, booked: 1, waitlisted: 2, no_show: 3 }
        mapped.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4))

        setAttendees(mapped)
      } catch (err) {
        console.error('Failed to fetch attendees:', err)
        setAttendees([])
      } finally {
        setLoadingAttendees(false)
      }
    },
    [supabase]
  )

  // Poll attendees every 60s when a class is selected
  useEffect(() => {
    if (!selectedClass) return
    fetchAttendees(selectedClass.id)
    const timer = setInterval(() => fetchAttendees(selectedClass.id), 60_000)
    return () => clearInterval(timer)
  }, [selectedClass?.id, fetchAttendees])

  const handleClassClick = (cls: ClassBlock) => {
    if (selectedClass?.id === cls.id) {
      setSelectedClass(null)
      setAttendees([])
    } else {
      setSelectedClass(cls)
    }
  }

  const handleCheckInAll = useCallback(async () => {
    if (!selectedClass) return
    setCheckingInAll(true)
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'checked_in',
          attended: true,
          checked_in_at: new Date().toISOString(),
        })
        .eq('class_id', selectedClass.id)
        .in('status', ['booked', 'confirmed'])

      if (error) throw error

      showToast(`All attendees checked in for ${selectedClass.name}`)
      // Refresh attendee list
      fetchAttendees(selectedClass.id)
    } catch (err) {
      console.error('Failed to check in all:', err)
      showToast('Failed to check in all attendees')
    } finally {
      setCheckingInAll(false)
    }
  }, [supabase, selectedClass, fetchAttendees, showToast])

  // ─── Stats ──────────────────────────────────────────────────
  const totalBookings = classBlocks.reduce((sum, c) => sum + c.booked, 0)
  const avgCapacity = classBlocks.length > 0
    ? Math.round((classBlocks.reduce((sum, c) => sum + (c.booked / c.capacity), 0) / classBlocks.length) * 100)
    : 0
  const atCapacity = classBlocks.filter(c => c.booked >= c.capacity).length

  return (
    <motion.div {...fadeInUp} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {viewModes.map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                  viewMode === mode ? 'bg-white dark:bg-gray-950 shadow-sm text-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Week Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {formatWeekHeader(weekStart)}
            </button>
            <button
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="ml-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                Today
              </button>
            )}
          </div>

          {/* Filters */}
          {filters.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg border transition-all',
                activeFilter === filter
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        <button
          onClick={() => showToast('Class creation coming in Phase 2')}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Class
        </button>
      </div>

      {/* Error state */}
      {classesError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Failed to load schedule: {classesError.message}
        </div>
      )}

      {/* Calendar Grid + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Calendar */}
        <div className={cn(
          'bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden',
          selectedClass ? 'lg:col-span-8' : 'lg:col-span-12'
        )}>
          {classesLoading ? (
            <ScheduleSkeleton />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="w-20 p-3 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Time</span>
                      </th>
                      {weekDays.map((day) => (
                        <th key={day.dateISO} className="p-3 text-center">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{day.label}</span>
                          <p className={cn(
                            'text-lg font-bold mt-0.5',
                            day.dateISO === todayISO ? 'text-indigo-600' : 'text-gray-900 dark:text-gray-100'
                          )}>
                            {day.date}
                          </p>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allTimeSlots.map((time) => (
                      <tr key={time} className="border-b border-gray-50 last:border-0">
                        <td className="p-3 align-top">
                          <span className="text-sm font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">{time}</span>
                        </td>
                        {weekDays.map((day) => {
                          const classes = getClasses(day.dateISO, time)
                          return (
                            <td key={`${day.dateISO}-${time}`} className="p-2 align-top min-h-[80px]">
                              {classes.length > 0 ? (
                                <div className="space-y-1">
                                  {classes.map(cls => (
                                    <ClassBlockCard
                                      key={cls.id}
                                      cls={cls}
                                      onClick={() => handleClassClick(cls)}
                                      isSelected={selectedClass?.id === cls.id}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="h-16 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => showToast('Class creation coming in Phase 2')}
                                    className="w-full h-full rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-indigo-300 hover:bg-indigo-50/30 flex items-center justify-center transition-colors"
                                  >
                                    <Plus className="w-4 h-4 text-gray-300" />
                                  </button>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer stats */}
              <div className="flex items-center gap-6 px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                  {classBlocks.length} classes this week
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  {totalBookings} total bookings
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-amber-500 rounded-full" />
                  {avgCapacity}% avg capacity
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-orange-500 rounded-full" />
                  {atCapacity} at capacity
                </span>
              </div>
            </>
          )}
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedClass && (
            <div className="lg:col-span-4">
              <ClassDetailPanel
                cls={selectedClass}
                attendees={attendees}
                loadingAttendees={loadingAttendees}
                onClose={() => {
                  setSelectedClass(null)
                  setAttendees([])
                }}
                onCheckInAll={handleCheckInAll}
                checkingInAll={checkingInAll}
                onSendReminder={() => showToast('Reminders coming in Phase 2')}
                onEditClass={() => showToast('Class editing coming in Phase 2')}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      <ToastNotification message={toast} />
    </motion.div>
  )
}

// ─── Utility ────────────────────────────────────────────────
/** Parse "H:MM AM/PM" to minutes-since-midnight for sorting. */
function parseTime12(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return 0
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + m
}
