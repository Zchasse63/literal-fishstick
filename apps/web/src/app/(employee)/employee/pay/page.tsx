'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  CreditCard,
  Building2,
  Pencil,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useEmployeeProfile,
  usePayrollPeriods,
  useClockEntries,
  useTrainerClassLog,
} from '@/hooks/use-employee'
import { fadeInUp } from '@/lib/motion'

function PayStubRow({ period, payRate, bonusForPeriod }: {
  period: { id: string; period_start: string; period_end: string; total_gross: number | null; total_bonuses: number | null; total_payroll: number | null; status: string }
  payRate: number
  bonusForPeriod: number
}) {
  const [expanded, setExpanded] = useState(false)

  const periodStart = new Date(period.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const periodEnd = new Date(period.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const periodLabel = `${periodStart} – ${periodEnd}`

  const grossPay = period.total_gross ?? 0
  const bonuses = period.total_bonuses ?? bonusForPeriod
  const totalPayroll = period.total_payroll ?? grossPay
  // Estimate taxes at ~17% and deductions at ~5.5%
  const estimatedTaxes = Math.round(grossPay * 0.17 * 100) / 100
  const estimatedDeductions = Math.round(grossPay * 0.055 * 100) / 100
  const netPay = Math.round((totalPayroll - estimatedTaxes - estimatedDeductions) * 100) / 100
  const hoursWorked = payRate > 0 ? Math.round(((grossPay - bonuses) / payRate) * 10) / 10 : 0

  // Pay date is typically 5 days after period end
  const payDate = new Date(period.period_end)
  payDate.setDate(payDate.getDate() + 5)
  const payDateStr = payDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{periodLabel}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Paid {payDateStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">${netPay > 0 ? netPay.toLocaleString() : totalPayroll.toLocaleString()}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Net Pay</p>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          )}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-0">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Gross Pay</p>
                  <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">${grossPay.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Hours</p>
                  <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{hoursWorked}h</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Bonus</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-600">${bonuses}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Taxes</p>
                  <p className="text-lg font-bold tabular-nums text-red-500">-${estimatedTaxes}</p>
                </div>
              </div>
              <button className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function PayPage() {
  const { employee, trainer, loading: profileLoading } = useEmployeeProfile()
  const { periods, loading: periodsLoading } = usePayrollPeriods()
  const { entries: classLog } = useTrainerClassLog(trainer?.id)

  const loading = profileLoading || periodsLoading
  const payRate = employee?.pay_rate ?? 0

  // YTD calculations
  const currentYear = new Date().getFullYear()
  const ytdPeriods = periods.filter((p) => new Date(p.period_start).getFullYear() === currentYear)
  const ytdGross = ytdPeriods.reduce((acc, p) => acc + (p.total_gross ?? 0), 0)
  const ytdBonuses = ytdPeriods.reduce((acc, p) => acc + (p.total_bonuses ?? 0), 0)
  const ytdNet = Math.round(ytdGross * 0.775 * 100) / 100 // Approximate net after taxes/deductions

  // Map bonus amounts per period from class log
  const bonusByPeriod = useMemo(() => {
    const map: Record<string, number> = {}
    for (const entry of classLog) {
      if (!entry.bonus_earned) continue
      const d = new Date(entry.created_at)
      // Find which period this falls in
      for (const p of periods) {
        if (d >= new Date(p.period_start) && d <= new Date(p.period_end)) {
          map[p.id] = (map[p.id] ?? 0) + (entry.bonus_amount ?? 0)
          break
        }
      }
    }
    return map
  }, [classLog, periods])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pay & Taxes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your earnings, pay stubs, and tax documents</p>
      </motion.div>

      {/* YTD Summary */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Year-to-Date Summary</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Gross Earnings</p>
            <p className="text-[28px] font-black tabular-nums text-gray-900 dark:text-gray-100 leading-none">${ytdGross.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Net Earnings</p>
            <p className="text-[28px] font-black tabular-nums text-emerald-600 leading-none">${ytdNet.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Bonuses</p>
            <p className="text-[28px] font-black tabular-nums text-violet-600 leading-none">${ytdBonuses.toLocaleString()}</p>
          </div>
        </div>
      </motion.div>

      {/* Pay Stubs */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Pay Stubs</h3>
        </div>
        {periods.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No pay stubs available</div>
        ) : (
          periods.map((period) => (
            <PayStubRow
              key={period.id}
              period={period}
              payRate={payRate}
              bonusForPeriod={bonusByPeriod[period.id] ?? 0}
            />
          ))
        )}
      </motion.div>

      {/* Tax Documents + Direct Deposit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Tax Documents */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Tax Documents</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">W-2 — {currentYear - 1}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Annual wage statement</p>
                </div>
              </div>
              <button className="p-2 rounded-lg hover:bg-white dark:bg-gray-950 transition-colors">
                <Download className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">W-4 — Current</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Withholding certificate</p>
                </div>
              </div>
              <button className="p-2 rounded-lg hover:bg-white dark:bg-gray-950 transition-colors">
                <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Direct Deposit */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Direct Deposit</h3>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {employee?.bank_account_last4 ? 'Bank Account' : 'No Account on File'}
                </p>
                {employee?.bank_account_last4 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">****{employee.bank_account_last4}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {employee?.bank_account_last4 ? 'Primary account — 100% of net pay' : 'Set up direct deposit to receive payments'}
              </span>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm">
              <Pencil className="w-3.5 h-3.5" />
              Update
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
