'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  CreditCard,
  ShoppingBag,
  Gift,
  Building2,
  Ticket,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
export type TransactionFilter = 'All' | 'Memberships' | 'Drop-ins' | 'Merch' | 'Gift Cards'

export interface TransactionRow {
  id: string
  date: string
  member: string
  type: string
  amount: string
  status: 'Completed' | 'Failed' | 'Refunded'
  method: string
}

const TX_FILTERS: TransactionFilter[] = ['All', 'Memberships', 'Drop-ins', 'Merch', 'Gift Cards']

export default function TransactionsTab({ transactions, loading }: { transactions: TransactionRow[]; loading: boolean }) {
  const [filter, setFilter] = useState<TransactionFilter>('All')

  const typeFilterMap: Record<TransactionFilter, string | null> = {
    All: null,
    Memberships: 'Membership',
    'Drop-ins': 'Drop-in',
    Merch: 'Merch',
    'Gift Cards': 'Gift Card',
  }

  const filtered = filter === 'All'
    ? transactions
    : transactions.filter((t) => t.type === typeFilterMap[filter])

  const statusStyles = {
    Completed: 'bg-emerald-50 text-emerald-700',
    Failed: 'bg-orange-50 text-orange-600',
    Refunded: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  }

  const typeIcons: Record<string, React.ReactNode> = {
    Membership: <CreditCard className="w-3 h-3" />,
    'Drop-in': <Ticket className="w-3 h-3" />,
    Merch: <ShoppingBag className="w-3 h-3" />,
    'Gift Card': <Gift className="w-3 h-3" />,
    Event: <Building2 className="w-3 h-3" />,
  }

  const typeStyles: Record<string, string> = {
    Membership: 'bg-indigo-50 text-indigo-700',
    'Drop-in': 'bg-teal-50 text-teal-700',
    Merch: 'bg-amber-50 text-amber-700',
    'Gift Card': 'bg-pink-50 text-pink-700',
    'Credit Pack': 'bg-violet-50 text-violet-700',
    Event: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <motion.div {...fadeInUp}>
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">Transactions</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Recent Activity</p>
            </div>
            <div className="flex gap-1.5">
              {TX_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                    filter === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-150'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">Date</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">Member</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">Type</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">Amount</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">Status</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">Payment Method</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-3.5"><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                    <td className="px-5 py-3.5"><div className="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : (
                <>
                  {filtered.map((tx, i) => (
                    <tr
                      key={tx.id}
                      className={cn(
                        'border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
                        i === filtered.length - 1 && 'border-b-0'
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{tx.date}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tx.member}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold',
                          typeStyles[tx.type] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        )}>
                          {typeIcons[tx.type]}
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={cn(
                          'text-sm font-bold tabular-nums',
                          tx.status === 'Refunded' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'
                        )}>
                          {tx.amount}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
                          statusStyles[tx.status]
                        )}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{tx.method}</span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                        No transactions found.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}
