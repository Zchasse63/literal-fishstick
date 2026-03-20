'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Flag,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

interface TimesheetEntry {
  day: string
  date: string
  clockIn: string
  clockOut: string
  breakMins: number
  totalHours: number
  status: 'verified' | 'pending' | 'flagged'
}

const entries: TimesheetEntry[] = [
  { day: 'Monday', date: 'Mar 17', clockIn: '9:58 AM', clockOut: '4:02 PM', breakMins: 32, totalHours: 5.72, status: 'verified' },
  { day: 'Tuesday', date: 'Mar 18', clockIn: '1:55 PM', clockOut: '6:08 PM', breakMins: 15, totalHours: 3.97, status: 'verified' },
  { day: 'Wednesday', date: 'Mar 19', clockIn: '9:52 AM', clockOut: '4:15 PM', breakMins: 45, totalHours: 5.63, status: 'verified' },
  { day: 'Thursday', date: 'Mar 20', clockIn: '9:48 AM', clockOut: '—', breakMins: 28, totalHours: 3.70, status: 'pending' },
  { day: 'Friday', date: 'Mar 21', clockIn: '—', clockOut: '—', breakMins: 0, totalHours: 0, status: 'pending' },
]

const statusConfig = {
  verified: { icon: CheckCircle2, label: 'Verified', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  pending: { icon: Clock, label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50' },
  flagged: { icon: AlertCircle, label: 'Flagged', color: 'text-red-600', bg: 'bg-red-50' },
}

export default function TimesheetsPage() {
  const totalHours = entries.reduce((acc, e) => acc + e.totalHours, 0)
  const totalBreak = entries.reduce((acc, e) => acc + e.breakMins, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track and review your hours</p>
      </motion.div>

      {/* Pay Period Selector */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900">Mar 16 – Mar 22, 2026</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Current Pay Period</p>
          </div>
          <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors border border-amber-200">
          <Flag className="w-4 h-4" />
          Flag for Review
        </button>
      </motion.div>

      {/* Timesheet Table */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Day</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Clock In</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Clock Out</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Break</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Hours</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const status = statusConfig[entry.status]
              return (
                <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-900">{entry.day}</p>
                    <p className="text-xs text-gray-500">{entry.date}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium tabular-nums text-gray-700">{entry.clockIn}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium tabular-nums text-gray-700">{entry.clockOut}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium tabular-nums text-gray-700">
                      {entry.breakMins > 0 ? `${entry.breakMins}m` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-bold tabular-nums text-gray-900">
                      {entry.totalHours > 0 ? `${entry.totalHours.toFixed(1)}h` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold',
                      status.bg, status.color
                    )}>
                      <status.icon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Period Totals */}
        <div className="border-t border-gray-200 bg-gray-50/50 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Period Totals</span>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Break</p>
                <p className="text-sm font-bold tabular-nums text-gray-700">{totalBreak}m</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Hours</p>
                <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">{totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
