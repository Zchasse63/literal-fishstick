'use client'

import { cn } from '@/lib/utils'
import {
  X,
  Mail,
  Phone,
  Check,
} from 'lucide-react'
import type { Employee, DetailTab } from './types'
import { roleBadgeClasses, formatCurrency } from './types'

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-[18px] font-black text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
    </div>
  )
}

export default function EmployeeDetailPanel({
  employee,
  onClose,
  detailTab,
  setDetailTab,
}: {
  employee: Employee
  onClose: () => void
  detailTab: DetailTab
  setDetailTab: (t: DetailTab) => void
}) {
  const isTrainer = employee.role === 'Trainer'
  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(isTrainer ? [{ id: 'performance' as DetailTab, label: 'Performance' }] : []),
    { id: 'pay', label: 'Pay' },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-100 dark:border-gray-800 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold',
              employee.role === 'Owner' ? 'bg-violet-100 text-violet-700' :
              employee.role === 'Trainer' ? 'bg-indigo-100 text-indigo-700' :
              employee.role === 'Front Desk' ? 'bg-teal-100 text-teal-700' :
              'bg-amber-100 text-amber-700'
            )}>
              {employee.initials}
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{employee.name}</h3>
              <div className="mt-1 flex items-center gap-2">
                <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', roleBadgeClasses[employee.role])}>
                  {employee.role}
                </span>
                <div className="flex items-center gap-1">
                  <div className={cn('h-1.5 w-1.5 rounded-full', employee.status === 'Active' ? 'bg-emerald-500' : employee.status === 'On Leave' ? 'bg-amber-500' : 'bg-gray-300')} />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{employee.status}</span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Mail className="h-3 w-3" />
            {employee.email}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Phone className="h-3 w-3" />
            {employee.phone}
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setDetailTab(tab.id)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors',
              detailTab === tab.id
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub Tab Content */}
      <div className="p-5">
        {detailTab === 'overview' && (
          <div className="space-y-4">
            <DetailRow label="Employment Type" value={employee.employmentType} />
            <DetailRow label="Hire Date" value={employee.hireDate} />
            <DetailRow label="Pay Rate" value={employee.payRate ?? 'N/A'} />
            <DetailRow label="Clock Status" value={
              employee.clockStatus === 'in' ? `Clocked In since ${employee.clockedInSince}` :
              employee.clockStatus === 'out' ? 'Clocked Out' : 'N/A'
            } />
            {employee.hoursThisPeriod != null && (
              <DetailRow label="Hours This Period" value={`${employee.hoursThisPeriod}h`} />
            )}
          </div>
        )}
        {detailTab === 'performance' && isTrainer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Classes Led" value={String(employee.classesLed ?? 0)} />
              <MiniStat label="Avg Attendance" value={String(employee.avgAttendance ?? 0)} />
              <MiniStat label="Bonus Hit Rate" value={`${employee.bonusHitRate ?? 0}%`} />
              <MiniStat label="Promo Code" value={employee.promoCode ?? '\u2014'} />
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Promo Code Stats</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Redemptions</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{employee.promoRedemptions}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Revenue Attributed</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(employee.promoRevenue ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {detailTab === 'pay' && (
          <div className="space-y-4">
            {employee.currentPeriodHours != null ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Current Hours" value={`${employee.currentPeriodHours}h`} />
                  <MiniStat label="Gross Pay Est." value={formatCurrency(employee.grossPayEstimate ?? 0)} />
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Year to Date</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Gross Pay</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(employee.ytdGross ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Bonuses</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(employee.ytdBonuses ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-t border-gray-200 dark:border-gray-800 pt-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Total</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency((employee.ytdGross ?? 0) + (employee.ytdBonuses ?? 0))}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">No payroll data for this employee</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
