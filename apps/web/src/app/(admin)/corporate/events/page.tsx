'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
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

interface CalendarEvent {
  id: string
  name: string
  company: string
  date: string // YYYY-MM-DD
  time: string
  eventType: EventType
  guests: number
  status: EventStatus
}

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

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
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
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

// ─── Page ───────────────────────────────────────────────────
export default function EventCalendarPage() {
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserClient()

    async function loadEvents() {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .order('event_date', { ascending: true })

      if (cancelled) return

      if (data) {
        setAllEvents(data.map((e: any) => ({
          id: e.id,
          name: e.name || 'Unnamed Event',
          company: e.company_name || '',
          date: e.event_date ? e.event_date.split('T')[0] : '',
          time: e.event_time || '',
          eventType: (e.event_type || 'corporate') as EventType,
          guests: e.guest_count ?? 0,
          status: (e.status || 'inquiry') as EventStatus,
        })))
      }

      setLoading(false)
    }

    loadEvents()
    return () => { cancelled = true }
  }, [])

  // Current month
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const filteredEvents = allEvents.filter((e) => filter === 'all' || e.eventType === filter)

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return filteredEvents.filter((e) => e.date === dateStr)
  }

  // Upcoming events sorted by date
  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const upcomingEvents = filteredEvents
    .filter((e) => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Build calendar grid
  const totalSlots = firstDay + daysInMonth
  const rows = Math.ceil(totalSlots / 7)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage corporate events, parties, and bookings</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          New Event
        </button>
      </div>

      {/* Filters + View Toggle */}
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
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {opt.value !== 'all' && (
                <span className={cn('w-2 h-2 rounded-full mr-1.5', eventTypeConfig[opt.value as EventType].pillClass)} />
              )}
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
          <button
            onClick={() => setViewMode('month')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              viewMode === 'month' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              viewMode === 'week' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Week
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Calendar Grid */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.05 }}
          className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-500" />
            </button>
            <h3 className="text-base font-bold text-gray-900">{monthName}</h3>
            <button className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {DAYS.map((day) => (
              <div key={day} className="text-center py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{day}</p>
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden">
            {Array.from({ length: rows * 7 }).map((_, i) => {
              const day = i - firstDay + 1
              const isValidDay = day >= 1 && day <= daysInMonth
              const isToday = day === now.getDate()
              const dayEvents = isValidDay ? getEventsForDay(day) : []

              return (
                <div
                  key={i}
                  className={cn(
                    'bg-white min-h-[100px] p-1.5',
                    !isValidDay && 'bg-gray-50/50'
                  )}
                >
                  {isValidDay && (
                    <>
                      <p
                        className={cn(
                          'text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                          isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'
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
                          <p className="text-[10px] font-semibold text-gray-400 px-1.5">
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

        {/* Sidebar — Upcoming Events */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <h3 className="text-base font-bold text-gray-900 mb-1">Upcoming</h3>
          <p className="text-xs text-gray-400 mb-4">{upcomingEvents.length} events</p>

          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/corporate/events/${event.id}`}
                className="block p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors group"
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', eventTypeConfig[event.eventType].pillClass)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                      {event.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{event.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                    <Calendar className="h-3 w-3" />
                    {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock className="h-3 w-3" />
                    {event.time}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
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
