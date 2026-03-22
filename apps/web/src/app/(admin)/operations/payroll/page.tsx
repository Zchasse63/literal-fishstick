'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Loader2,
  ArrowLeft,
  Plus,
  Download,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Calculator,
  FileText,
  DollarSign,
  Users,
  CalendarDays,
  Banknote,
  TrendingUp,
  X,
} from 'lucide-react'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type PeriodStatus = 'open' | 'processing' | 'approved' | 'reopened' | 'exported' | 'paid'

interface PayrollLineItem {
  employeeId: string
  name: string
  initials: string
  role: string
  regularHours: number
  overtimeHours: number
  basePay: number
  overtimePay: number
  bonuses: number
  commissions: number
  grossPay: number
  estimatedTaxes: number
  estimatedNet: number
}

interface PayrollPeriod {
  id: string
  startDate: string
  endDate: string
  payDate: string
  status: PeriodStatus
  totalGross: number
  totalBonuses: number
  totalCommissions: number
  totalPayroll: number
  employeesCalculated: number
  totalEmployees: number
  lineItems: PayrollLineItem[]
}

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Helpers ────────────────────────────────────────────────
function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

const statusConfig: Record<PeriodStatus, { label: string; bg: string; text: string; icon: typeof Clock }> = {
  open: { label: 'Open', bg: 'bg-blue-50', text: 'text-blue-700', icon: Clock },
  processing: { label: 'Processing', bg: 'bg-amber-50', text: 'text-amber-700', icon: Calculator },
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  reopened: { label: 'Reopened', bg: 'bg-orange-50', text: 'text-orange-700', icon: RotateCcw },
  exported: { label: 'Exported', bg: 'bg-violet-50', text: 'text-violet-700', icon: Download },
  paid: { label: 'Paid', bg: 'bg-gray-100', text: 'text-gray-600', icon: CheckCircle2 },
}

const roleBadgeClasses: Record<string, string> = {
  Trainer: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Front Desk': 'bg-teal-50 text-teal-700 border-teal-200',
  Manager: 'bg-amber-50 text-amber-700 border-amber-200',
  Owner: 'bg-violet-50 text-violet-700 border-violet-200',
}

// ─── Component ──────────────────────────────────────────────
export default function PayrollPage() {
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [reopenModal, setReopenModal] = useState<PayrollPeriod | null>(null)

  useEffect(() => {
    async function fetchPayroll() {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .order('start_date', { ascending: false })

      if (data && data.length > 0) {
        const mapped: PayrollPeriod[] = data.map((pp: any) => ({
          id: pp.id,
          startDate: new Date(pp.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          endDate: new Date(pp.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          payDate: pp.pay_date ? new Date(pp.pay_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
          status: pp.status ?? 'open',
          totalGross: pp.total_gross ?? 0,
          totalBonuses: pp.total_bonuses ?? 0,
          totalCommissions: pp.total_commissions ?? 0,
          totalPayroll: pp.total_payroll ?? 0,
          employeesCalculated: pp.employees_calculated ?? 0,
          totalEmployees: pp.total_employees ?? 0,
          lineItems: (pp.line_items ?? []).map((li: any) => ({
            employeeId: li.employee_id ?? '',
            name: li.name ?? '',
            initials: getInitials(li.name ?? 'U'),
            role: li.role ?? 'Trainer',
            regularHours: li.regular_hours ?? 0,
            overtimeHours: li.overtime_hours ?? 0,
            basePay: li.base_pay ?? 0,
            overtimePay: li.overtime_pay ?? 0,
            bonuses: li.bonuses ?? 0,
            commissions: li.commissions ?? 0,
            grossPay: li.gross_pay ?? 0,
            estimatedTaxes: li.estimated_taxes ?? 0,
            estimatedNet: li.estimated_net ?? 0,
          })),
        }))
        setPayrollPeriods(mapped)
        setExpandedPeriod(mapped[0].id)
      }
      setLoading(false)
    }
    fetchPayroll()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (payrollPeriods.length === 0) {
    return (
      <motion.div {...fadeInUp} className="min-h-screen bg-[#FAFAFA] p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/operations" className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
              <p className="mt-0.5 text-sm text-gray-500">Manage pay periods, review calculations, and export payroll</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center shadow-sm">
          <DollarSign className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-base font-semibold text-gray-900">No payroll periods yet</h3>
          <p className="mt-1 text-sm text-gray-500">Create your first pay period to start tracking payroll.</p>
          <button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            New Period
          </button>
        </div>
      </motion.div>
    )
  }

  const activePeriod = payrollPeriods[0]

  return (
    <motion.div {...fadeInUp} className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/operations"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
            <p className="mt-0.5 text-sm text-gray-500">Manage pay periods, review calculations, and export payroll</p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
          <Plus className="h-4 w-4" />
          New Period
        </button>
      </div>

      {/* Active Period Card */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="mb-6 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-6 shadow-sm"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Active Period</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{activePeriod.startDate} &ndash; {activePeriod.endDate}</p>
            <div className="mt-2 flex items-center gap-3">
              <StatusBadge status={activePeriod.status} />
              <span className="text-sm text-gray-500">Pay date: <span className="font-semibold text-gray-700">{activePeriod.payDate}</span></span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Progress</p>
            <p className="mt-1 text-[28px] font-black tabular-nums text-gray-900">
              {activePeriod.employeesCalculated}<span className="text-lg text-gray-400">/{activePeriod.totalEmployees}</span>
            </p>
            <p className="text-xs text-gray-500">employees calculated</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${(activePeriod.employeesCalculated / activePeriod.totalEmployees) * 100}%` }}
          />
        </div>
      </motion.div>

      {/* Summary Metrics */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="mb-6 grid grid-cols-4 gap-4"
      >
        {[
          { label: 'Total Gross', value: formatCurrency(activePeriod.totalGross), icon: DollarSign },
          { label: 'Total Bonuses', value: formatCurrency(activePeriod.totalBonuses), icon: TrendingUp },
          { label: 'Total Commissions', value: formatCurrency(activePeriod.totalCommissions), icon: Banknote },
          { label: 'Total Payroll', value: formatCurrency(activePeriod.totalPayroll), icon: Users },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <metric.icon className="h-4 w-4 text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{metric.label}</p>
            </div>
            <p className="text-[28px] font-black tabular-nums text-gray-900">{metric.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Payroll Periods Table */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.15 }}
        className="rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-bold text-gray-900">Payroll Periods</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {payrollPeriods.map((period) => {
            const isExpanded = expandedPeriod === period.id
            const config = statusConfig[period.status]

            return (
              <div key={period.id}>
                {/* Period Row */}
                <div
                  className="flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50"
                  onClick={() => setExpandedPeriod(isExpanded ? null : period.id)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{period.startDate} &ndash; {period.endDate}</p>
                    <p className="text-xs text-gray-500">Pay date: {period.payDate}</p>
                  </div>
                  <StatusBadge status={period.status} />
                  <div className="w-28 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Gross</p>
                    <p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(period.totalGross)}</p>
                  </div>
                  <div className="w-28 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bonuses</p>
                    <p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(period.totalBonuses)}</p>
                  </div>
                  <div className="w-28 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Commissions</p>
                    <p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(period.totalCommissions)}</p>
                  </div>
                  <div className="w-28 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</p>
                    <p className="text-sm font-bold tabular-nums text-indigo-600">{formatCurrency(period.totalPayroll)}</p>
                  </div>
                  {/* Actions */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActionMenu(actionMenu === period.id ? null : period.id)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <AnimatePresence>
                      {actionMenu === period.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.1 }}
                          className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                        >
                          {period.status === 'open' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActionMenu(null) }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Calculator className="h-4 w-4" />
                              Calculate All
                            </button>
                          )}
                          {(period.status === 'open' || period.status === 'reopened') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActionMenu(null) }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </button>
                          )}
                          {(period.status === 'approved' || period.status === 'exported' || period.status === 'paid') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActionMenu(null); setReopenModal(period) }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Reopen
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setActionMenu(null) }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Download className="h-4 w-4" />
                            Export CSV
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Expanded Line Items */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-gray-50 px-6 py-4">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200">
                                {['Employee', 'Reg Hours', 'OT Hours', 'Base Pay', 'OT Pay', 'Bonuses', 'Commissions', 'Gross Pay', 'Est. Taxes', 'Est. Net'].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {period.lineItems.map((item) => (
                                <tr key={item.employeeId} className="hover:bg-white/60">
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                                        {item.initials}
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                                        <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', roleBadgeClasses[item.role] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                                          {item.role}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-sm tabular-nums text-gray-700">{item.regularHours}</td>
                                  <td className="px-3 py-3 text-sm tabular-nums text-gray-700">{item.overtimeHours || '—'}</td>
                                  <td className="px-3 py-3 text-sm font-medium tabular-nums text-gray-900">{formatCurrency(item.basePay)}</td>
                                  <td className="px-3 py-3 text-sm tabular-nums text-gray-700">{item.overtimePay ? formatCurrency(item.overtimePay) : '—'}</td>
                                  <td className="px-3 py-3 text-sm tabular-nums text-gray-700">{item.bonuses ? formatCurrency(item.bonuses) : '—'}</td>
                                  <td className="px-3 py-3 text-sm tabular-nums text-gray-700">{item.commissions ? formatCurrency(item.commissions) : '—'}</td>
                                  <td className="px-3 py-3 text-sm font-bold tabular-nums text-gray-900">{formatCurrency(item.grossPay)}</td>
                                  <td className="px-3 py-3 text-sm tabular-nums text-red-600">{item.estimatedTaxes ? `-${formatCurrency(item.estimatedTaxes)}` : '—'}</td>
                                  <td className="px-3 py-3 text-sm font-bold tabular-nums text-emerald-600">{formatCurrency(item.estimatedNet)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-gray-300 bg-white/80">
                                <td className="px-3 py-3 text-sm font-bold text-gray-900">Totals</td>
                                <td className="px-3 py-3 text-sm font-bold tabular-nums text-gray-900">
                                  {period.lineItems.reduce((s, i) => s + i.regularHours, 0)}
                                </td>
                                <td className="px-3 py-3 text-sm font-bold tabular-nums text-gray-900">
                                  {period.lineItems.reduce((s, i) => s + i.overtimeHours, 0) || '—'}
                                </td>
                                <td className="px-3 py-3 text-sm font-bold tabular-nums text-gray-900">
                                  {formatCurrency(period.lineItems.reduce((s, i) => s + i.basePay, 0))}
                                </td>
                                <td className="px-3 py-3 text-sm font-bold tabular-nums text-gray-900">
                                  {formatCurrency(period.lineItems.reduce((s, i) => s + i.overtimePay, 0))}
                                </td>
                                <td className="px-3 py-3 text-sm font-bold tabular-nums text-gray-900">
                                  {formatCurrency(period.lineItems.reduce((s, i) => s + i.bonuses, 0))}
                                </td>
                                <td className="px-3 py-3 text-sm font-bold tabular-nums text-gray-900">
                                  {formatCurrency(period.lineItems.reduce((s, i) => s + i.commissions, 0))}
                                </td>
                                <td className="px-3 py-3 text-sm font-bold tabular-nums text-indigo-600">
                                  {formatCurrency(period.lineItems.reduce((s, i) => s + i.grossPay, 0))}
                                </td>
                                <td className="px-3 py-3 text-sm font-bold tabular-nums text-red-600">
                                  -{formatCurrency(period.lineItems.reduce((s, i) => s + i.estimatedTaxes, 0))}
                                </td>
                                <td className="px-3 py-3 text-sm font-bold tabular-nums text-emerald-600">
                                  {formatCurrency(period.lineItems.reduce((s, i) => s + i.estimatedNet, 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Reopen Confirmation Modal */}
      <AnimatePresence>
        {reopenModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setReopenModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Reopen Payroll Period?</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {reopenModal.startDate} &ndash; {reopenModal.endDate}
                  </p>
                  {(reopenModal.status === 'exported' || reopenModal.status === 'paid') && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-sm font-semibold text-red-700">
                        This period has already been {reopenModal.status}.
                      </p>
                      <p className="mt-0.5 text-xs text-red-600">
                        Reopening may cause discrepancies with already-processed payments.
                        Verify with your payroll provider before making changes.
                      </p>
                    </div>
                  )}
                  <p className="mt-3 text-sm text-gray-600">
                    Reopening will set the status back to &ldquo;Open&rdquo; and allow
                    recalculation. All approvals will be reset.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setReopenModal(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setReopenModal(null)}
                  className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
                >
                  Reopen Period
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-away for action menus */}
      {actionMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
      )}
    </motion.div>
  )
}

// ─── Status Badge ───────────────────────────────────────────
function StatusBadge({ status }: { status: PeriodStatus }) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', config.bg, config.text, `border-current/20`)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}
