'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

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
}

interface Attendee {
  name: string
  status: 'checked_in' | 'booked' | 'no_show' | 'waitlisted'
}

// ─── Mock Data ──────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DATES = [12, 13, 14, 15, 16, 17, 18]
const TIME_SLOTS = ['5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM']

const SCHEDULE: Record<string, ClassBlock[]> = {
  'Mon-5:00 PM': [{ id: '1', time: '5:00 PM', type: 'open', name: 'Open Sauna', booked: 11, capacity: 12, checkedIn: 9, attendees: [
    { name: 'Sarah Martinez', status: 'checked_in' }, { name: 'James K.', status: 'checked_in' }, { name: 'Laura G.', status: 'checked_in' },
    { name: 'David S.', status: 'checked_in' }, { name: 'Emily W.', status: 'checked_in' }, { name: 'Mark T.', status: 'checked_in' },
    { name: 'Jessica R.', status: 'checked_in' }, { name: 'Chris B.', status: 'checked_in' }, { name: 'Anna L.', status: 'checked_in' },
    { name: 'Mike P.', status: 'booked' }, { name: 'Priya S.', status: 'booked' },
  ]}],
  'Mon-6:00 PM': [{ id: '2', time: '6:00 PM', type: 'guided', name: 'Guided', trainer: 'Trent', booked: 8, capacity: 12, checkedIn: 6, attendees: [
    { name: 'Alex M.', status: 'checked_in' }, { name: 'Jordan P.', status: 'checked_in' }, { name: 'Taylor R.', status: 'checked_in' },
    { name: 'Sam K.', status: 'checked_in' }, { name: 'Morgan B.', status: 'checked_in' }, { name: 'Casey L.', status: 'checked_in' },
    { name: 'Drew H.', status: 'booked' }, { name: 'Riley N.', status: 'booked' },
  ]}],
  'Mon-7:00 PM': [{ id: '3', time: '7:00 PM', type: 'open', name: 'Open Sauna', booked: 5, capacity: 12, checkedIn: 0, attendees: [
    { name: 'Pat D.', status: 'booked' }, { name: 'Quinn S.', status: 'booked' }, { name: 'Robin T.', status: 'booked' },
    { name: 'Skyler M.', status: 'booked' }, { name: 'Jamie R.', status: 'booked' },
  ]}],
  'Wed-5:00 PM': [{ id: '4', time: '5:00 PM', type: 'open', name: 'Open Sauna', booked: 6, capacity: 12, checkedIn: 0, attendees: [] }],
  'Wed-6:00 PM': [{ id: '5', time: '6:00 PM', type: 'open', name: 'Open Sauna', booked: 9, capacity: 12, checkedIn: 0, attendees: [] }],
  'Wed-7:00 PM': [{ id: '6', time: '7:00 PM', type: 'guided', name: 'Guided', trainer: 'Whitney', booked: 9, capacity: 12, checkedIn: 0, attendees: [
    { name: 'Sarah Martinez', status: 'booked' }, { name: 'James K.', status: 'booked' }, { name: 'Laura G.', status: 'booked' },
    { name: 'David S.', status: 'booked' }, { name: 'Emily W.', status: 'booked' }, { name: 'Mark T.', status: 'booked' },
    { name: 'Priya S.', status: 'booked' }, { name: 'Chris T.', status: 'booked' }, { name: 'John D.', status: 'booked' },
  ]}],
  'Sat-5:00 PM': [], // Weekend uses different times — remap below
  'Sat-9:00 AM': [{ id: '7', time: '9:00 AM', type: 'open', name: 'Open Sauna', booked: 10, capacity: 12, checkedIn: 0, attendees: [] }],
  'Sat-10:00 AM': [{ id: '8', time: '10:00 AM', type: 'open', name: 'Open Sauna', booked: 7, capacity: 12, checkedIn: 0, attendees: [] }],
  'Sun-9:00 AM': [{ id: '9', time: '9:00 AM', type: 'open', name: 'Open Sauna', booked: 8, capacity: 12, checkedIn: 0, attendees: [] }],
  'Sun-12:00 PM': [{ id: '10', time: '12:00 PM', type: 'guided', name: 'Guided', trainer: 'Drennen', booked: 8, capacity: 12, checkedIn: 0, attendees: [] }],
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
      <p className="text-gray-500 tabular-nums">{cls.booked}/{cls.capacity}</p>
      {cls.trainer && <p className="text-gray-400 truncate">{cls.trainer}</p>}
    </motion.button>
  )
}

// ─── Detail Panel ───────────────────────────────────────────
function ClassDetailPanel({ cls, onClose }: { cls: ClassBlock; onClose: () => void }) {
  const fillPercent = Math.round((cls.booked / cls.capacity) * 100)
  const typeBadgeColor = cls.type === 'guided' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.25 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900">{cls.time === '7:00 PM' && cls.type === 'guided' ? 'Wednesday 7pm Guided' : `${cls.time} ${cls.name}`}</h3>
            <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded-full', typeBadgeColor)}>
              {cls.type === 'guided' ? 'Guided' : 'Open'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {cls.trainer && `${cls.trainer} · `}{cls.booked}/{cls.capacity} booked · 60 min
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fill bar */}
      <div className="space-y-1">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${fillPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Attendees */}
      {cls.attendees.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            Attendees ({cls.checkedIn}/{cls.booked})
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {cls.attendees.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    a.status === 'checked_in' ? 'bg-emerald-500' :
                    a.status === 'no_show' ? 'bg-red-500' : 'bg-gray-300'
                  )} />
                  <span className="text-sm font-medium text-gray-900">{a.name}</span>
                </div>
                <span className={cn(
                  'text-xs font-medium capitalize',
                  a.status === 'checked_in' ? 'text-emerald-600' :
                  a.status === 'no_show' ? 'text-red-600' : 'text-gray-400'
                )}>
                  {a.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors">
          <UserCheck className="w-4 h-4" />
          Check In All
        </button>
        <button className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
          <Send className="w-4 h-4" />
          Send Reminder
        </button>
      </div>
      <button className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
        <Edit3 className="w-4 h-4" />
        Edit Class
      </button>
    </motion.div>
  )
}

// ─── Schedule Page ──────────────────────────────────────────
export default function SchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('Week')
  const [activeFilter, setActiveFilter] = useState<ClassFilter>('All Classes')
  const [selectedClass, setSelectedClass] = useState<ClassBlock | null>(null)

  const viewModes: ViewMode[] = ['Day', 'Week', 'Month']
  const filters: ClassFilter[] = ['All Classes', 'Open Sauna', 'Guided', 'Private']

  const weekdayTimeSlots = ['5:00 PM', '6:00 PM', '7:00 PM']
  const weekendTimeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM']

  const getTimeSlots = (dayIndex: number) => {
    return dayIndex >= 5 ? weekendTimeSlots : weekdayTimeSlots
  }

  const getClasses = (day: string, time: string): ClassBlock[] => {
    const key = `${day}-${time}`
    const classes = SCHEDULE[key]
    if (!classes) return []
    if (activeFilter === 'All Classes') return classes
    if (activeFilter === 'Open Sauna') return classes.filter(c => c.type === 'open')
    if (activeFilter === 'Guided') return classes.filter(c => c.type === 'guided')
    if (activeFilter === 'Private') return classes.filter(c => c.type === 'private')
    return classes
  }

  // Stats
  const allClasses = Object.values(SCHEDULE).flat()
  const totalBookings = allClasses.reduce((sum, c) => sum + c.booked, 0)
  const avgCapacity = allClasses.length > 0 ? Math.round((allClasses.reduce((sum, c) => sum + (c.booked / c.capacity), 0) / allClasses.length) * 100) : 0
  const atCapacity = allClasses.filter(c => c.booked >= c.capacity).length

  return (
    <motion.div {...fadeInUp} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {viewModes.map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                  viewMode === mode ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {mode}
              </button>
            ))}
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
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          New Class
        </button>
      </div>

      {/* Calendar Grid + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Calendar */}
        <div className={cn(
          'bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden',
          selectedClass ? 'lg:col-span-8' : 'lg:col-span-12'
        )}>
          {/* Week header */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="w-20 p-3 text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Time</span>
                  </th>
                  {DAYS.map((day, i) => (
                    <th key={day} className="p-3 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{day}</span>
                      <p className={cn(
                        'text-lg font-bold mt-0.5',
                        i === 2 ? 'text-indigo-600' : 'text-gray-900' // Wednesday highlighted as today
                      )}>
                        {DATES[i]}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Render all unique time slots */}
                {['5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'].map((time) => (
                  <tr key={time} className="border-b border-gray-50 last:border-0">
                    <td className="p-3 align-top">
                      <span className="text-sm font-medium text-gray-400 whitespace-nowrap">{time}</span>
                    </td>
                    {DAYS.map((day, dayIndex) => {
                      const classes = getClasses(day, time)
                      const isWeekend = dayIndex >= 5

                      // Weekend doesn't have evening slots — show empty
                      if (isWeekend && ['5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'].includes(time)) {
                        // Map weekend times
                        const weekendMap: Record<string, string> = { '5:00 PM': '9:00 AM', '6:00 PM': '10:00 AM', '7:00 PM': '11:00 AM', '8:00 PM': '12:00 PM' }
                        const mappedTime = weekendMap[time]
                        const weekendClasses = getClasses(day, mappedTime)

                        return (
                          <td key={`${day}-${time}`} className="p-2 align-top min-h-[80px]">
                            {weekendClasses.length > 0 ? (
                              <div className="space-y-1">
                                <span className="text-[9px] font-medium text-gray-400">{mappedTime}</span>
                                {weekendClasses.map(cls => (
                                  <ClassBlockCard
                                    key={cls.id}
                                    cls={cls}
                                    onClick={() => setSelectedClass(cls)}
                                    isSelected={selectedClass?.id === cls.id}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="h-16 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <button className="w-full h-full rounded-lg border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 flex items-center justify-center transition-colors">
                                  <Plus className="w-4 h-4 text-gray-300" />
                                </button>
                              </div>
                            )}
                          </td>
                        )
                      }

                      return (
                        <td key={`${day}-${time}`} className="p-2 align-top min-h-[80px]">
                          {classes.length > 0 ? (
                            <div className="space-y-1">
                              {classes.map(cls => (
                                <ClassBlockCard
                                  key={cls.id}
                                  cls={cls}
                                  onClick={() => setSelectedClass(cls)}
                                  isSelected={selectedClass?.id === cls.id}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="h-16 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <button className="w-full h-full rounded-lg border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 flex items-center justify-center transition-colors">
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
          <div className="flex items-center gap-6 px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-indigo-500 rounded-full" />
              {allClasses.length} classes this week
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
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedClass && (
            <div className="lg:col-span-4">
              <ClassDetailPanel cls={selectedClass} onClose={() => setSelectedClass(null)} />
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
