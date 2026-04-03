'use client'

import { cn } from '@/lib/utils'
import {
  Download,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import type { PayPeriod } from './types'
import { roleBadgeClasses, formatCurrency } from './types'

export default function PayrollTab({
  payPeriods,
  selectedPeriod,
  setSelectedPeriod,
  currentPayPeriod,
}: {
  payPeriods: PayPeriod[]
  selectedPeriod: string
  setSelectedPeriod: (id: string) => void
  currentPayPeriod: PayPeriod
}) {
  const totals = currentPayPeriod.rows.reduce(
    (acc, row) => ({
      grossPay: acc.grossPay + row.grossPay,
      bonuses: acc.bonuses + row.trainerBonuses,
      commissions: acc.commissions + row.promoCommissions,
      total: acc.total + row.total,
    }),
    { grossPay: 0, bonuses: 0, commissions: 0, total: 0 }
  )

  return (
    <div className="space-y-4">
      {/* Period Selector + Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            {payPeriods.map(pp => (
              <option key={pp.id} value={pp.id}>{pp.label} — {pp.range}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {currentPayPeriod.rows.some(r => r.status === 'Pending Review') && (
            <button className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Approve All
            </button>
          )}
          <button className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Gross Pay</p>
          <p className="mt-1 text-[28px] font-black text-gray-900 tabular-nums">{formatCurrency(totals.grossPay)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Trainer Bonuses</p>
          <p className="mt-1 text-[28px] font-black text-gray-900 tabular-nums">{formatCurrency(totals.bonuses)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Promo Commissions</p>
          <p className="mt-1 text-[28px] font-black text-gray-900 tabular-nums">{formatCurrency(totals.commissions)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Payroll</p>
          <p className="mt-1 text-[28px] font-black text-indigo-600 tabular-nums">{formatCurrency(totals.total)}</p>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Employee</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Regular Hrs</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Overtime</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Gross Pay</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden md:table-cell">Bonuses</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden md:table-cell">Commissions</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentPayPeriod.rows.map(row => (
                <tr key={row.employeeId} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{row.name}</span>
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', roleBadgeClasses[row.role])}>
                        {row.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-700 tabular-nums">{row.regularHours}h</td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums">
                    {row.overtime > 0 ? (
                      <span className="text-amber-600 font-medium">{row.overtime}h</span>
                    ) : (
                      <span className="text-gray-400">{'\u2014'}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(row.grossPay)}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-700 tabular-nums hidden md:table-cell">
                    {row.trainerBonuses > 0 ? formatCurrency(row.trainerBonuses) : <span className="text-gray-400">{'\u2014'}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-700 tabular-nums hidden md:table-cell">
                    {row.promoCommissions > 0 ? formatCurrency(row.promoCommissions) : <span className="text-gray-400">{'\u2014'}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(row.total)}</td>
                  <td className="px-5 py-3.5 text-right">
                    {row.status === 'Pending Review' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">
                        <AlertCircle className="h-3 w-3" />
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Approved
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50/50">
                <td className="px-5 py-3 text-sm font-semibold text-gray-700">Totals</td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700 tabular-nums">
                  {currentPayPeriod.rows.reduce((s, r) => s + r.regularHours, 0)}h
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700 tabular-nums">
                  {currentPayPeriod.rows.reduce((s, r) => s + r.overtime, 0)}h
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700 tabular-nums">
                  {formatCurrency(totals.grossPay)}
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700 tabular-nums hidden md:table-cell">
                  {formatCurrency(totals.bonuses)}
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700 tabular-nums hidden md:table-cell">
                  {formatCurrency(totals.commissions)}
                </td>
                <td className="px-5 py-3 text-right text-sm font-bold text-indigo-600 tabular-nums">
                  {formatCurrency(totals.total)}
                </td>
                <td className="px-5 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
