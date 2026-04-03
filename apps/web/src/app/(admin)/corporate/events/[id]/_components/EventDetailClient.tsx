'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  MapPin,
  DollarSign,
  FileText,
  CheckCircle2,
  Circle,
  UserPlus,
  Check,
  Sparkles,
  MessageSquare,
  Shield,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
type EventStatus = 'inquiry' | 'quoted' | 'confirmed' | 'deposit_paid' | 'completed' | 'invoiced' | 'paid'
type RSVPStatus = 'confirmed' | 'pending' | 'declined'

// ─── Helpers ────────────────────────────────────────────────
const STATUS_FLOW: EventStatus[] = ['inquiry', 'quoted', 'confirmed', 'deposit_paid', 'completed', 'invoiced', 'paid']

const statusLabels: Record<EventStatus, string> = {
  inquiry: 'Inquiry',
  quoted: 'Quoted',
  confirmed: 'Confirmed',
  deposit_paid: 'Deposit Paid',
  completed: 'Completed',
  invoiced: 'Invoiced',
  paid: 'Paid',
}

const eventTypeConfig = {
  team_building: { label: 'Team Building', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  corporate: { label: 'Corporate', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  private_party: { label: 'Private Party', className: 'bg-violet-50 text-violet-700 border border-violet-200' },
  birthday: { label: 'Birthday', className: 'bg-pink-50 text-pink-700 border border-pink-200' },
  community: { label: 'Community', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  workshop: { label: 'Workshop', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
}

const rsvpConfig: Record<RSVPStatus, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  declined: { label: 'Declined', className: 'bg-red-50 text-red-700 border border-red-200' },
}

const statusBadgeConfig: Record<EventStatus, { className: string }> = {
  inquiry: { className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  quoted: { className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  confirmed: { className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  deposit_paid: { className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  completed: { className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  invoiced: { className: 'bg-orange-50 text-orange-700 border border-orange-200' },
  paid: { className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
}

function getActionButton(status: EventStatus) {
  switch (status) {
    case 'inquiry':
      return { label: 'Generate Quote', className: 'bg-amber-500 hover:bg-amber-600 text-white' }
    case 'quoted':
      return { label: 'Confirm Event', className: 'bg-emerald-600 hover:bg-emerald-700 text-white' }
    case 'confirmed':
    case 'deposit_paid':
      return { label: 'Mark Complete', className: 'bg-indigo-600 hover:bg-indigo-700 text-white' }
    default:
      return null
  }
}

// ─── Props ──────────────────────────────────────────────────
interface EventDetailClientProps {
  initialEvent: any | null
  initialGuests: any[]
}

// ─── Client Component ───────────────────────────────────────
export default function EventDetailClient({ initialEvent, initialGuests }: EventDetailClientProps) {
  const [EVENT] = useState<any>(initialEvent)
  const [GUESTS] = useState<any[]>(initialGuests)

  if (!EVENT) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11] flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">Event not found</h3>
          <Link href="/corporate/events" className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-indigo-600">
            Back to Events
          </Link>
        </div>
      </div>
    )
  }

  const currentStepIndex = STATUS_FLOW.indexOf(EVENT.status as EventStatus)
  const action = getActionButton(EVENT.status as EventStatus)
  const typeConfig = eventTypeConfig[EVENT.eventType as keyof typeof eventTypeConfig] || eventTypeConfig['corporate']

  const confirmedCount = GUESTS.filter((g: any) => g.rsvp === 'confirmed').length
  const checkedInCount = GUESTS.filter((g: any) => g.checkedIn).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]"
    >
      <Link
        href="/corporate/events"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Events
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{EVENT.name}</h1>
            <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', typeConfig.className)}>
              {typeConfig.label}
            </span>
            <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', statusBadgeConfig[EVENT.status as EventStatus]?.className)}>
              {statusLabels[EVENT.status as EventStatus]}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              {EVENT.date}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {EVENT.time}
            </span>
            <Link
              href={`/corporate/${EVENT.companyId}`}
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
            >
              {EVENT.company}
            </Link>
          </div>
        </div>
        {action && (
          <button className={cn('inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm', action.className)}>
            {action.label}
          </button>
        )}
      </div>

      {/* Status Flow */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 mb-6"
      >
        <div className="flex items-center justify-between">
          {STATUS_FLOW.map((step, i) => {
            const isCompleted = i < currentStepIndex
            const isCurrent = i === currentStepIndex
            const isLast = i === STATUS_FLOW.length - 1
            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center transition-all', isCompleted && 'bg-emerald-500', isCurrent && 'bg-indigo-600 ring-4 ring-indigo-100', !isCompleted && !isCurrent && 'bg-gray-100 dark:bg-gray-800')}>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4 text-white" /> : isCurrent ? <Circle className="h-4 w-4 text-white fill-white" /> : <Circle className="h-4 w-4 text-gray-300" />}
                  </div>
                  <p className={cn('text-[10px] font-bold uppercase tracking-widest mt-2', isCompleted && 'text-emerald-600', isCurrent && 'text-indigo-600', !isCompleted && !isCurrent && 'text-gray-300')}>
                    {statusLabels[step]}
                  </p>
                </div>
                {!isLast && <div className={cn('flex-1 h-0.5 mx-2 mt-[-20px]', i < currentStepIndex ? 'bg-emerald-500' : 'bg-gray-100 dark:bg-gray-800')} />}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.1 }} className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">Event Details</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{EVENT.description}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Location</p>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{EVENT.location}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Capacity</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{EVENT.guests} / {EVENT.capacity} guests</p>
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Pricing Breakdown</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Base price</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">${EVENT.basePrice.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Per-person ({EVENT.guests} guests x ${EVENT.perPersonPrice})</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">${(EVENT.perPersonPrice * EVENT.guests).toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-2">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Total</p>
                  <p className="text-lg font-black text-gray-900 dark:text-gray-100 tabular-nums">${EVENT.totalPrice.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-amber-500" />
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Special Requests</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{EVENT.specialRequests}</p>
          </div>

          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-indigo-500" />
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Assigned Staff</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {EVENT.assignedStaff.map((name: string) => (
                <span key={name} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-900 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600">
                    {name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">Internal Notes</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{EVENT.internalNotes}</p>
          </div>
        </motion.div>

        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.15 }} className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Guest List</h3>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
                  <UserPlus className="h-3 w-3" />
                  Add Guest
                </button>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-gray-400 dark:text-gray-500"><span className="font-semibold text-gray-600 dark:text-gray-400 tabular-nums">{confirmedCount}</span> confirmed</span>
                <span className="text-xs text-gray-400 dark:text-gray-500"><span className="font-semibold text-gray-600 dark:text-gray-400 tabular-nums">{checkedInCount}</span> checked in</span>
                <span className="text-xs text-gray-400 dark:text-gray-500"><span className="font-semibold text-gray-600 dark:text-gray-400 tabular-nums">{GUESTS.length}</span> total</span>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {GUESTS.map((guest: { id: string; name: string; email: string; rsvp: string; checkedIn: boolean }) => (
                <div key={guest.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400 shrink-0">
                    {guest.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{guest.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{guest.email}</p>
                  </div>
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0', rsvpConfig[guest.rsvp as RSVPStatus]?.className)}>
                    {rsvpConfig[guest.rsvp as RSVPStatus]?.label}
                  </span>
                  <button
                    className={cn(
                      'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      guest.checkedIn
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
                    )}
                    title={guest.checkedIn ? 'Checked in' : 'Check in'}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Invoice Section */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.2 }}
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Invoice</h3>
          </div>
          {EVENT.invoiceId ? (
            <Link
              href={`/corporate/${EVENT.companyId}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-gray-300 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              View Invoice
            </Link>
          ) : (
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
              <DollarSign className="h-3.5 w-3.5" />
              Create Invoice from Event
            </button>
          )}
        </div>
        {!EVENT.invoiceId && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            No invoice has been created for this event yet. Create one to bill {EVENT.company} for ${EVENT.totalPrice.toLocaleString()}.
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}
