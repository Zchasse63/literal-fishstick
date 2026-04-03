'use client'

import { cn } from '@/lib/utils'
import { DAYS, SCHEDULE_TIMES, TRAINER_SCHEDULE } from './types'

export default function ScheduleTab() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Trainer Schedule</h2>
          <p className="text-xs text-gray-500 mt-0.5">Week of Mar 16 – 22, 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="h-2.5 w-2.5 rounded-sm bg-indigo-100 border border-indigo-200" /> Guided
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="h-2.5 w-2.5 rounded-sm bg-gray-100 border border-gray-200" /> Open
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 w-20">Time</th>
              {DAYS.map(day => (
                <th key={day} className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_TIMES.map(time => (
              <tr key={time} className="border-t border-gray-50">
                <td className="px-3 py-2 text-xs font-medium text-gray-600 tabular-nums">{time}</td>
                {DAYS.map(day => {
                  const slot = TRAINER_SCHEDULE[`${day}-${time}`]
                  if (!slot) return <td key={day} className="px-2 py-2"><div className="h-16" /></td>
                  return (
                    <td key={day} className="px-2 py-2">
                      <div className={cn(
                        'rounded-xl border p-2.5 h-16 flex flex-col justify-between transition-colors hover:shadow-sm cursor-pointer',
                        slot.type === 'guided'
                          ? 'bg-indigo-50/70 border-indigo-200 hover:bg-indigo-50'
                          : 'bg-gray-50 border-gray-150 hover:bg-gray-100/50'
                      )}>
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            'text-[10px] font-semibold',
                            slot.type === 'guided' ? 'text-indigo-700' : 'text-gray-600'
                          )}>
                            {slot.type === 'guided' ? 'Guided' : 'Open'}
                          </span>
                          <span className="text-[10px] text-gray-400 tabular-nums">{slot.booked}/{slot.capacity}</span>
                        </div>
                        {slot.trainer && (
                          <span className="text-[10px] font-medium text-indigo-600 truncate">{slot.trainer}</span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
