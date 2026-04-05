'use client'

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export interface HeroMetricCardProps {
  label: string
  value: string
  delta: number
  deltaLabel?: string
  icon: React.ElementType
  isLoading?: boolean
}

export function HeroMetricCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  isLoading,
}: HeroMetricCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-9 w-24 mb-2" />
        <Skeleton className="h-3 w-28" />
      </div>
    )
  }

  const isPositive = delta > 0
  const isNegative = delta < 0
  const isNeutral = delta === 0

  // For cancellation-style metrics where down is good, the caller
  // can pass a negative delta and it will show green (since it's an
  // improvement). The card is agnostic — green = positive, red = negative.

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 transition-all">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {label}
        </p>
      </div>
      <p className="text-[28px] font-black text-gray-900 dark:text-gray-100 tabular-nums leading-none">
        {value}
      </p>
      <div className="flex items-center gap-1.5 mt-2">
        {isPositive && (
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
        )}
        {isNegative && (
          <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
        )}
        <span
          className={cn(
            'text-xs font-bold tabular-nums',
            isPositive && 'text-emerald-600',
            isNegative && 'text-red-500',
            isNeutral && 'text-gray-400 dark:text-gray-500',
          )}
        >
          {isNeutral ? '0%' : `${delta > 0 ? '+' : ''}${delta}%`}
        </span>
        {deltaLabel && (
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-0.5">
            {deltaLabel}
          </span>
        )}
      </div>
    </div>
  )
}
