'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  CreditCard,
  DollarSign,
  Building2,
  Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

interface PayStub {
  id: string
  period: string
  payDate: string
  grossPay: number
  netPay: number
  hoursWorked: number
  bonus: number
  taxes: number
  deductions: number
}

const payStubs: PayStub[] = [
  { id: '1', period: 'Mar 1 – 15, 2026', payDate: 'Mar 20, 2026', grossPay: 2280, netPay: 1768, hoursWorked: 72, bonus: 180, taxes: 387.60, deductions: 124.40 },
  { id: '2', period: 'Feb 16 – 28, 2026', payDate: 'Mar 5, 2026', grossPay: 2100, netPay: 1628, hoursWorked: 64, bonus: 140, taxes: 357, deductions: 115 },
  { id: '3', period: 'Feb 1 – 15, 2026', payDate: 'Feb 20, 2026', grossPay: 2340, netPay: 1814, hoursWorked: 76, bonus: 200, taxes: 397.80, deductions: 128.20 },
  { id: '4', period: 'Jan 16 – 31, 2026', payDate: 'Feb 5, 2026', grossPay: 2460, netPay: 1907, hoursWorked: 80, bonus: 260, taxes: 418.20, deductions: 134.80 },
]

function PayStubRow({ stub }: { stub: PayStub }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">{stub.period}</p>
            <p className="text-xs text-gray-500">Paid {stub.payDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-gray-900">${stub.netPay.toLocaleString()}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Net Pay</p>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
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
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Gross Pay</p>
                  <p className="text-lg font-bold tabular-nums text-gray-900">${stub.grossPay.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Hours</p>
                  <p className="text-lg font-bold tabular-nums text-gray-900">{stub.hoursWorked}h</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Bonus</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-600">${stub.bonus}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Taxes</p>
                  <p className="text-lg font-bold tabular-nums text-red-500">-${stub.taxes}</p>
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
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl font-bold text-gray-900">Pay & Taxes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your earnings, pay stubs, and tax documents</p>
      </motion.div>

      {/* YTD Summary */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900 mb-4">Year-to-Date Summary</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Gross Earnings</p>
            <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">$26,340</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Net Earnings</p>
            <p className="text-[28px] font-black tabular-nums text-emerald-600 leading-none">$20,424</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Bonuses</p>
            <p className="text-[28px] font-black tabular-nums text-violet-600 leading-none">$2,140</p>
          </div>
        </div>
      </motion.div>

      {/* Pay Stubs */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Pay Stubs</h3>
        </div>
        {payStubs.map((stub) => (
          <PayStubRow key={stub.id} stub={stub} />
        ))}
      </motion.div>

      {/* Tax Documents + Direct Deposit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Tax Documents */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <h3 className="text-sm font-bold text-gray-900 mb-4">Tax Documents</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">W-2 — 2024</p>
                  <p className="text-xs text-gray-500">Annual wage statement</p>
                </div>
              </div>
              <button className="p-2 rounded-lg hover:bg-white transition-colors">
                <Download className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">W-4 — Current</p>
                  <p className="text-xs text-gray-500">Withholding certificate</p>
                </div>
              </div>
              <button className="p-2 rounded-lg hover:bg-white transition-colors">
                <Pencil className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Direct Deposit */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <h3 className="text-sm font-bold text-gray-900 mb-4">Direct Deposit</h3>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Chase Checking</p>
                <p className="text-xs text-gray-500 tabular-nums">****4821</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">Primary account — 100% of net pay</span>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
              <Pencil className="w-3.5 h-3.5" />
              Update
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
