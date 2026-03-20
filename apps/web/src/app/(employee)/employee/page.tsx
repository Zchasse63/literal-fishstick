'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  MapPin,
  Coffee,
  Calendar,
  DollarSign,
  AlertTriangle,
  FileText,
  ChevronRight,
  Pause,
  Play,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

const upcomingShifts = [
  { time: '2:00 PM – 6:00 PM', type: 'Shift', label: 'Front Desk', date: 'Today' },
  { time: '5:00 PM – 6:00 PM', type: 'Class', label: 'Guided Breathwork', date: 'Today', bookings: '8/12' },
  { time: '10:00 AM – 4:00 PM', type: 'Shift', label: 'Front Desk', date: 'Tomorrow' },
]

const alerts = [
  { icon: AlertTriangle, text: 'CPR certification expires in 12 days', color: 'text-amber-600', bg: 'bg-amber-50' },
  { icon: FileText, text: 'Latest pay stub available — Mar 1–15', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { icon: CheckCircle2, text: 'Time-off request approved: Mar 28–30', color: 'text-emerald-600', bg: 'bg-emerald-50' },
]

export default function EmployeeHomePage() {
  const [clockedIn, setClockedIn] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const now = new Date()
  const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl font-bold text-gray-900">Good afternoon, Whitney</h1>
        <p className="text-sm text-gray-500 mt-0.5">{dateString}</p>
      </motion.div>

      {/* Clock In/Out Hero Card */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8"
      >
        <div className="flex flex-col items-center text-center">
          {/* Status */}
          <div className="flex items-center gap-2 mb-6">
            {clockedIn ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {onBreak ? 'On Break' : 'Clocked In — 3h 42m'}
              </span>
            ) : (
              <span className="text-sm font-medium text-gray-400">You are not clocked in</span>
            )}
          </div>

          {/* Big Clock Button */}
          <button
            onClick={() => {
              if (clockedIn) setOnBreak(false)
              setClockedIn(!clockedIn)
            }}
            className={cn(
              'w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95',
              clockedIn
                ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                : 'bg-gradient-to-br from-indigo-600 to-violet-500 hover:from-indigo-700 hover:to-violet-600'
            )}
          >
            {clockedIn ? (
              <>
                <Clock className="w-10 h-10 text-white mb-2" />
                <span className="text-white text-lg font-bold">Clock Out</span>
              </>
            ) : (
              <>
                <Play className="w-10 h-10 text-white mb-2 ml-1" />
                <span className="text-white text-lg font-bold">Clock In</span>
              </>
            )}
          </button>

          {/* Current Time */}
          <p className="text-[28px] font-black tabular-nums text-gray-900 mt-5">{timeString}</p>

          {/* Geofencing Badge */}
          <div className="flex items-center gap-1.5 mt-3">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600">At Studio</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>

          {/* Break Button */}
          {clockedIn && (
            <motion.button
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setOnBreak(!onBreak)}
              className={cn(
                'mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                onBreak
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {onBreak ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {onBreak ? 'End Break' : 'Start Break'}
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Today's Summary + Upcoming Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Today's Summary */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <h3 className="text-sm font-bold text-gray-900 mb-4">Today&apos;s Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Hours Today</p>
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">3h 42m</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Break Time</p>
              <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">28m</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Est. Pay</p>
              <p className="text-[28px] font-black tabular-nums text-emerald-600 leading-none">$83</p>
              <span className="text-xs text-gray-400">.25</span>
            </div>
          </div>
        </motion.div>

        {/* Upcoming Schedule */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Upcoming Schedule</h3>
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-3">
            {upcomingShifts.map((shift, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={cn(
                  'w-1 h-10 rounded-full flex-shrink-0',
                  shift.type === 'Class' ? 'bg-indigo-500' : 'bg-teal-500'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{shift.label}</p>
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md',
                      shift.type === 'Class'
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-teal-50 text-teal-600'
                    )}>
                      {shift.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{shift.date} &middot; {shift.time}</p>
                </div>
                {shift.bookings && (
                  <span className="text-xs font-semibold text-gray-500 tabular-nums">{shift.bookings}</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Alerts & Quick Links */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.2 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900 mb-4">Alerts & Quick Links</h3>
        <div className="space-y-2.5">
          {alerts.map((alert, i) => (
            <button
              key={i}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:opacity-80',
                alert.bg
              )}
            >
              <alert.icon className={cn('w-4 h-4 flex-shrink-0', alert.color)} />
              <span className={cn('text-sm font-medium flex-1 text-left', alert.color)}>{alert.text}</span>
              <ChevronRight className={cn('w-4 h-4 flex-shrink-0', alert.color)} />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
