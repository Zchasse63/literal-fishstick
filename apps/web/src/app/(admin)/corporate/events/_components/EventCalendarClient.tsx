'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Users,
  MapPin,
  ArrowLeft,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
type EventType = 'corporate' | 'private_party' | 'team_building' | 'birthday' | 'community' | 'workshop'
type EventStatus = 'inquiry' | 'quoted' | 'confirmed' | 'deposit_paid' | 'completed' | 'invoiced' | 'paid'
type ViewMode = 'month' | 'week'
type FilterType = 'all' | EventType

export interface CalendarEvent {
  id: string
  name: string
  company: string
  date: string
  time: string
  eventType: EventType
  guests: number
  status: EventStatus
}

// ─── Helpers ────────────────────────────────────────────────
const eventTypeConfig: Record<EventType, { label: string; className: string; pillClass: string }> = {
  corporate: { label: 'Corporate', className: 'bg-indigo-50 text-indigo-700', pillClass: 'bg-indigo-500' },
  private_party: { label: 'Private Party', className: 'bg-violet-50 text-violet-700', pillClass: 'bg-violet-500' },
  team_building: { label: 'Team Building', className: 'bg-emerald-50 text-emerald-700', pillClass: 'bg-emerald-500' },
  birthday: { label: 'Birthday', className: 'bg-pink-50 text-pink-700', pillClass: 'bg-pink-500' },
  community: { label: 'Community', className: 'bg-blue-50 text-blue-700', pillClass: 'bg-blue-500' },
  workshop: { label: 'Workshop', className: 'bg-amber-50 text-amber-700', pillClass: 'bg-amber-500' },
}

const eventStatusConfig: Record<EventStatus, { label: string; className: string }> = {
  inquiry: { label: 'Inquiry', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  quoted: { label: 'Quoted', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  deposit_paid: { label: 'Deposit Paid', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  completed: { label: 'Completed', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  invoiced: { label: 'Invoiced', className: 'bg-orange-50 text-orange-700 border border-orange-200' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
}

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'private_party', label: 'Private Party' },
  { value: 'team_building', label: 'Team Building' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'community', label: 'Community' },
  { value: 'workshop', label: 'Workshop' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

// ─── Props ──────────────────────────────────────────────────
interface EventCalendarClientProps {
  initialEvents: CalendarEvent[]
}

// ─── Client Component ───────────────────────────────────────
export default function EventCalendarClient({ initialEvents }: EventCalendarClientProps) {
  const [allEvents] = useState<CalendarEvent[]>(initialEvents)
  const [filter, setFilter] = useState<FilterType>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const monthName = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const now = new Date()

  const filteredEvents = allEvents.filter((e) => filter === 'all' || e.eventType === filter)

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return filteredEvents.filter((e) => e.date === dateStr)
  }

  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const upcomingEvents = filteredEvents
    .filter((e) => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalSlots = firstDay + daysInMonth
  const rows = Math.ceil(totalSlots / 7)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Events</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage corporate events, parties, and bookings</p>
        </div>
        <button onClick={() => window.alert('Event creation coming in Phase 4')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          New Event
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                'inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                filter === opt.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              )}
            >
              {opt.value !== 'all' && (
                <span className={cn('w-2 h-2 rounded-full mr-1.5', eventTypeConfig[opt.value as EventType].pillClass)} />
              )}
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-1">
          <button
            onClick={() => setViewMode('month')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              viewMode === 'month' ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              viewMode === 'week' ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            Week
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.05 }}
          className="lg:col-span-3 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="h-8 w-8 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{monthName}</h3>
            <button
              onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="h-8 w-8 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px mb-1">
            {DAYS.map((day) => (
              <div key={day} className="text-center py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{day}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
            {Array.from({ length: rows * 7 }).map((_, i) => {
              const day = i - firstDay + 1
              const isValidDay = day >= 1 && day <= daysInMonth
              const isToday = day === now.getDate()
              const dayEvents = isValidDay ? getEventsForDay(day) : []

              return (
                <div
                  key={i}
                  className={cn(
                    'bg-white dark:bg-gray-950 min-h-[100px] p-1.5',
                    !isValidDay && 'bg-gray-50 dark:bg-gray-900/50'
                  )}
                >
                  {isValidDay && (
                    <>
                      <p
                        className={cn(
                          'text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                          isToday ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-300'
                        )}
                      >
                        {day}
                      </p>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((event) => (
                          <Link
                            key={event.id}
                            href={`/corporate/events/${event.id}`}
                            className={cn(
                              'block px-1.5 py-0.5 rounded text-[10px] font-semibold truncate hover:opacity-80 transition-opacity text-white',
                              eventTypeConfig[event.eventType].pillClass
                            )}
                          >
                            {event.name}
                          </Link>
                        ))}
                        {dayEvents.length > 2 && (
                          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 px-1.5">
                            +{dayEvents.length - 2} more
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>

        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">Upcoming</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{upcomingEvents.length} events</p>

          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/corporate/events/${event.id}`}
                className="block p-3 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors group"
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', eventTypeConfig[event.eventType].pillClass)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 transition-colors">
                      {event.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{event.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                    <Calendar className="h-3 w-3" />
                    {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                    <Clock className="h-3 w-3" />
                    {event.time}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                    <Users className="h-3 w-3" />
                    {event.guests}
                  </span>
                </div>
                <div className="mt-2 ml-4">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold', eventStatusConfig[event.status].className)}>
                    {eventStatusConfig[event.status].label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
