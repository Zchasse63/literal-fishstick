'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { FormattedWeekMetric } from '@/hooks/use-kpi-data'

interface WeeklyReviewBarProps {
  week: FormattedWeekMetric[] | null
  isLoading?: boolean
}

export function WeeklyReviewBar({ week, isLoading }: WeeklyReviewBarProps) {
  const [expanded, setExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-4" />
        </div>
      </div>
    )
  }

  if (!week || week.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
      >
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Weekly Review
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        </motion.span>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {week.map((kpi) => (
                  <KpiPill key={kpi.label} kpi={kpi} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── KPI Pill ──────────────────────────────────────────────────

function KpiPill({ kpi }: { kpi: FormattedWeekMetric }) {
  const isPositive = kpi.delta > 0
  const isNegative = kpi.delta < 0
  const isNeutral = kpi.delta === 0

  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-900/60 px-3.5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
        {kpi.label}
      </p>
      <p className="text-lg font-black text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
        {kpi.value}
      </p>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
          {kpi.prior}
        </span>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        {isPositive && (
          <ArrowUpRight className="w-3 h-3 text-emerald-600" />
        )}
        {isNegative && (
          <ArrowDownRight className="w-3 h-3 text-red-500" />
        )}
        <span
          className={cn(
            'text-[11px] font-bold tabular-nums',
            isPositive && 'text-emerald-600',
            isNegative && 'text-red-500',
            isNeutral && 'text-gray-400 dark:text-gray-500',
          )}
        >
          {isNeutral ? '0%' : `${kpi.delta > 0 ? '+' : ''}${kpi.delta}%`}
        </span>
      </div>
    </div>
  )
}
