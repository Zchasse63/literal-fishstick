'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Crown,
  UserPlus,
  Sparkles,
  CreditCard,
  Clock,
  Heart,
  X,
  Send,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Zap,
  Activity,
  Infinity,
  Star,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
interface SegmentRule {
  field: string
  operator: string
  value: string | number | string[]
}

interface SegmentRules {
  logic: 'AND' | 'OR'
  conditions: SegmentRule[]
}

export interface DbSegment {
  id: string
  name: string
  description: string | null
  rules: SegmentRules
  color: string
  icon: string
  is_system: boolean
  member_count: number
  last_computed_at: string | null
  created_at: string
  updated_at: string
}

interface DisplaySegment {
  id: string
  name: string
  count: number
  description: string
  trend: 'up' | 'down' | 'stable'
  trendValue: string
  color: string
  bgColor: string
  iconBg: string
  icon: React.ElementType
  type: 'auto' | 'manual'
  dbColor: string
}

// ─── Icon Mapping ──────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  'activity': Activity,
  'alert-triangle': AlertTriangle,
  'credit-card': CreditCard,
  'star': Star,
  'crown': Crown,
  'clock': Clock,
  'user-plus': UserPlus,
  'infinity': Infinity,
  'heart': Heart,
  'sparkles': Sparkles,
  'users': Users,
  'zap': Zap,
}

// ─── Color Mapping ──────────────────────────────────────────────
function getColorClasses(hex: string): { color: string; bgColor: string; iconBg: string } {
  const colorMap: Record<string, { color: string; bgColor: string; iconBg: string }> = {
    '#10B981': { color: 'text-emerald-500', bgColor: 'bg-emerald-50', iconBg: 'bg-emerald-100' },
    '#F97316': { color: 'text-orange-500', bgColor: 'bg-orange-50', iconBg: 'bg-orange-100' },
    '#06B6D4': { color: 'text-cyan-500', bgColor: 'bg-cyan-50', iconBg: 'bg-cyan-100' },
    '#F59E0B': { color: 'text-amber-500', bgColor: 'bg-amber-50', iconBg: 'bg-amber-100' },
    '#EF4444': { color: 'text-red-500', bgColor: 'bg-red-50', iconBg: 'bg-red-100' },
    '#8B5CF6': { color: 'text-violet-500', bgColor: 'bg-violet-50', iconBg: 'bg-violet-100' },
    '#4F46E5': { color: 'text-indigo-600', bgColor: 'bg-indigo-50', iconBg: 'bg-indigo-100' },
    '#EC4899': { color: 'text-pink-500', bgColor: 'bg-pink-50', iconBg: 'bg-pink-100' },
  }
  return colorMap[hex] ?? { color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-900', iconBg: 'bg-gray-100 dark:bg-gray-800' }
}

function mapDbSegmentToDisplay(seg: DbSegment): DisplaySegment {
  const colors = getColorClasses(seg.color)
  return {
    id: seg.id,
    name: seg.name,
    count: seg.member_count ?? 0,
    description: seg.description ?? '',
    trend: 'stable',
    trendValue: '0%',
    ...colors,
    icon: ICON_MAP[seg.icon] ?? Users,
    type: seg.is_system ? 'auto' : 'manual',
    dbColor: seg.color,
  }
}

// ─── Trend Icon ──────────────────────────────────────────────
function TrendIndicator({ trend, value }: { trend: 'up' | 'down' | 'stable'; value: string }) {
  if (trend === 'stable') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500">
        <Minus className="h-3 w-3" />
        Stable
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        trend === 'up' ? 'text-emerald-500' : 'text-orange-500'
      )}
    >
      {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {value}
    </span>
  )
}

// ─── Page Component ──────────────────────────────────────────
interface SegmentsClientProps {
  initialSegments: DbSegment[]
}

export default function SegmentsClient({ initialSegments }: SegmentsClientProps) {
  const mapped = initialSegments.map(mapDbSegmentToDisplay)
  mapped.sort((a, b) => b.count - a.count)

  const [segments] = useState<DisplaySegment[]>(mapped)
  const [selectedSegment, setSelectedSegment] = useState<DisplaySegment | null>(null)

  return (
    <div data-testid="segments-page-root" className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Smart Segments</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              AI-powered member segments that update automatically
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
            <Zap className="h-4 w-4" />
            Create Segment
          </button>
        </div>

        {/* Summary stats */}
        <div className="mt-6 flex gap-6">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total Segments</p>
            <p className="mt-1 text-xl font-black tabular-nums text-gray-900 dark:text-gray-100">{segments.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total Members Tracked</p>
            <p className="mt-1 text-xl font-black tabular-nums text-gray-900 dark:text-gray-100">
              {segments.reduce((sum, s) => sum + s.count, 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">System Segments</p>
            <p className="mt-1 text-xl font-black tabular-nums text-gray-900 dark:text-gray-100">
              {segments.filter(s => s.type === 'auto').length}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-6">
        {/* Segment Grid */}
        <div
          className={cn(
            'grid grid-cols-1 gap-4 transition-all md:grid-cols-2',
            selectedSegment ? 'lg:grid-cols-2' : 'lg:grid-cols-3'
          )}
          style={{ flex: selectedSegment ? '1 1 60%' : '1 1 100%' }}
        >
          {segments.map((segment, i) => {
            const Icon = segment.icon
            const isSelected = selectedSegment?.id === segment.id

            return (
              <motion.div
                key={segment.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: i * 0.05,
                  ease: [0.25, 1, 0.5, 1],
                }}
              >
                <button
                  onClick={() =>
                    setSelectedSegment(isSelected ? null : segment)
                  }
                  className={cn(
                    'group w-full rounded-2xl border bg-white dark:bg-gray-950 p-5 text-left shadow-sm transition-all hover:shadow-md',
                    isSelected
                      ? 'border-indigo-300 ring-2 ring-indigo-100'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        segment.iconBg
                      )}
                    >
                      <Icon className={cn('h-5 w-5', segment.color)} />
                    </div>
                    <TrendIndicator trend={segment.trend} value={segment.trendValue} />
                  </div>

                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                      {segment.name}
                    </p>
                    <p className="mt-1 text-[28px] font-black tabular-nums text-gray-900 dark:text-gray-100">
                      {segment.count.toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{segment.description}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest',
                        segment.type === 'auto'
                          ? 'bg-violet-50 text-violet-600'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      )}
                    >
                      {segment.type === 'auto' ? 'AI Auto' : 'Manual'}
                    </span>
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 transition-transform',
                        isSelected
                          ? 'translate-x-0 text-indigo-500'
                          : 'text-gray-300 group-hover:translate-x-1 group-hover:text-gray-400 dark:text-gray-500'
                      )}
                    />
                  </div>
                </button>
              </motion.div>
            )
          })}
        </div>

        {/* Detail Panel */}
        <AnimatePresence mode="wait">
          {selectedSegment && (
            <motion.div
              key={selectedSegment.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className="hidden w-[380px] shrink-0 lg:block"
            >
              <div className="sticky top-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
                {/* Panel Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full',
                        selectedSegment.iconBg
                      )}
                    >
                      <selectedSegment.icon
                        className={cn('h-4 w-4', selectedSegment.color)}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {selectedSegment.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedSegment.description}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSegment(null)}
                    className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Stats */}
                <div className="border-b border-gray-100 dark:border-gray-800 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Members
                      </p>
                      <p className="mt-1 text-[28px] font-black tabular-nums text-gray-900 dark:text-gray-100">
                        {selectedSegment.count.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Trend
                      </p>
                      <div className="mt-2">
                        <TrendIndicator
                          trend={selectedSegment.trend}
                          value={selectedSegment.trendValue}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest',
                        selectedSegment.type === 'auto'
                          ? 'bg-violet-50 text-violet-600'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      )}
                    >
                      {selectedSegment.type === 'auto' ? 'Auto' : 'Manual'}
                    </span>
                  </div>
                </div>

                {/* Segment Info */}
                <div className="p-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    Segment Details
                  </p>
                  <div className="space-y-3">
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Description</p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedSegment.description}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {selectedSegment.type === 'auto'
                          ? 'System — auto-computed from member data'
                          : 'Custom — manually defined rules'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Color</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: selectedSegment.dbColor }}
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100">{selectedSegment.dbColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-100 dark:border-gray-800 p-5">
                  <div className="flex gap-3">
                    <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
                      <Send className="h-4 w-4" />
                      Send Campaign
                    </button>
                    <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                      <Users className="h-4 w-4" />
                      View All
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
