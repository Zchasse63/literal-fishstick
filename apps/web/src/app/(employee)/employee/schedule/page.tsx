'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  CalendarOff,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

type ViewMode = 'week' | 'day' | 'month'

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const weekDates = ['Mar 17', 'Mar 18', 'Mar 19', 'Mar 20', 'Mar 21', 'Mar 22', 'Mar 23']

interface ScheduleBlock {
  day: number
  startHour: number
  duration: number
  type: 'shift' | 'class' | 'off'
  label: string
  detail?: string
}

const blocks: ScheduleBlock[] = [
  { day: 0, startHour: 10, duration: 6, type: 'shift', label: 'Front Desk', detail: '10 AM – 4 PM' },
  { day: 0, startHour: 17, duration: 1, type: 'class', label: 'Guided Breathwork', detail: '5 – 6 PM · 8/12' },
  { day: 1, startHour: 14, duration: 4, type: 'shift', label: 'Front Desk', detail: '2 – 6 PM' },
  { day: 2, startHour: 10, duration: 6, type: 'shift', label: 'Front Desk', detail: '10 AM – 4 PM' },
  { day: 2, startHour: 19, duration: 1, type: 'class', label: 'Guided Breathwork', detail: '7 – 8 PM · 10/12' },
  { day: 3, startHour: 10, duration: 8, type: 'shift', label: 'Front Desk', detail: '10 AM – 6 PM' },
  { day: 3, startHour: 17, duration: 1, type: 'class', label: 'Open Sauna Lead', detail: '5 – 6 PM · 6/12' },
  { day: 4, startHour: 12, duration: 4, type: 'shift', label: 'Front Desk', detail: '12 – 4 PM' },
  { day: 5, startHour: 0, duration: 24, type: 'off', label: 'Day Off' },
  { day: 6, startHour: 0, duration: 24, type: 'off', label: 'Day Off' },
]

const typeStyles = {
  shift: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
  class: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  off: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', dot: 'bg-gray-400' },
}

export default function SchedulePage() {
  const [view, setView] = useState<ViewMode>('week')

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">Week of March 17 – 23, 2026</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" />
          Request Time Off
        </button>
      </motion.div>

      {/* View Toggle + Navigation */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-sm font-semibold text-gray-900">Mar 17 – 23, 2026</span>
          <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize',
                view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Weekly Calendar */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((day, i) => (
            <div
              key={day}
              className={cn(
                'px-3 py-3 text-center border-r border-gray-100 last:border-r-0',
                i === 3 && 'bg-indigo-50/50'
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{day}</p>
              <p className={cn(
                'text-lg font-bold mt-0.5',
                i === 3 ? 'text-indigo-600' : 'text-gray-900'
              )}>
                {weekDates[i].split(' ')[1]}
              </p>
            </div>
          ))}
        </div>

        {/* Schedule Blocks */}
        <div className="grid grid-cols-7 min-h-[320px]">
          {weekDays.map((_, dayIndex) => {
            const dayBlocks = blocks.filter((b) => b.day === dayIndex)
            return (
              <div key={dayIndex} className={cn(
                'border-r border-gray-100 last:border-r-0 p-2 space-y-2',
                dayIndex === 3 && 'bg-indigo-50/30'
              )}>
                {dayBlocks.map((block, bi) => {
                  const style = typeStyles[block.type]
                  return (
                    <div
                      key={bi}
                      className={cn(
                        'rounded-lg border p-2 text-xs',
                        style.bg
                      )}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', style.dot)} />
                        <span className={cn('font-semibold truncate', style.text)}>{block.label}</span>
                      </div>
                      {block.detail && (
                        <p className={cn('text-[10px] opacity-70', style.text)}>{block.detail}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Week Summary */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.15 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900 mb-4">Week Summary</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Scheduled Hours</p>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-500" />
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">32h</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Classes</p>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-indigo-500" />
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">4</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Time Off</p>
            <div className="flex items-center gap-2">
              <CalendarOff className="w-4 h-4 text-gray-400" />
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">2 days</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Legend */}
      <div className="flex items-center gap-6">
        {Object.entries(typeStyles).map(([key, style]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={cn('w-3 h-3 rounded-sm', style.dot)} />
            <span className="text-xs font-medium text-gray-500 capitalize">{key === 'off' ? 'Time Off' : key === 'class' ? 'Classes' : 'Shifts'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
