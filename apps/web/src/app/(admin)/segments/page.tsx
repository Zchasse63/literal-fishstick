'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Crown,
  UserPlus,
  Sparkles,
  Building2,
  Heart,
  X,
  Send,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Zap,
} from 'lucide-react'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
interface Segment {
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
  members: SampleMember[]
}

interface SampleMember {
  name: string
  lastVisit: string
  ltv: number
}

// ─── Mock Data ──────────────────────────────────────────────
const SEGMENTS: Segment[] = [
  {
    id: 'churn-risk',
    name: 'Churn Risk',
    count: 47,
    description: 'No visit in 14+ days',
    trend: 'up',
    trendValue: '12%',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    icon: AlertTriangle,
    type: 'auto',
    members: [
      { name: 'Marcus Chen', lastVisit: '18 days ago', ltv: 420 },
      { name: 'Priya Sharma', lastVisit: '21 days ago', ltv: 680 },
      { name: 'David Ortiz', lastVisit: '16 days ago', ltv: 310 },
      { name: 'Emily Watson', lastVisit: '25 days ago', ltv: 540 },
      { name: 'Ryan Thompson', lastVisit: '14 days ago', ltv: 190 },
    ],
  },
  {
    id: 'high-value',
    name: 'High Value',
    count: 89,
    description: 'Top 10% by LTV',
    trend: 'up',
    trendValue: '5%',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    icon: Crown,
    type: 'auto',
    members: [
      { name: 'Sarah Martinez', lastVisit: '1 day ago', ltv: 2840 },
      { name: 'James Kowalski', lastVisit: '2 days ago', ltv: 2610 },
      { name: 'Laura Gonzalez', lastVisit: 'Today', ltv: 2390 },
      { name: 'Michael Park', lastVisit: '3 days ago', ltv: 2150 },
      { name: 'Anna Li', lastVisit: '1 day ago', ltv: 1980 },
    ],
  },
  {
    id: 'new-members',
    name: 'New Members',
    count: 23,
    description: 'Joined in last 30 days',
    trend: 'up',
    trendValue: '18%',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    iconBg: 'bg-indigo-100',
    icon: UserPlus,
    type: 'auto',
    members: [
      { name: 'Tyler Brooks', lastVisit: 'Today', ltv: 89 },
      { name: 'Mia Johnson', lastVisit: '2 days ago', ltv: 149 },
      { name: 'Chris Nguyen', lastVisit: '1 day ago', ltv: 89 },
      { name: 'Sophia Davis', lastVisit: '4 days ago', ltv: 59 },
      { name: 'Noah Williams', lastVisit: 'Today', ltv: 129 },
    ],
  },
  {
    id: 'guided-prospects',
    name: 'Guided Prospects',
    count: 61,
    description: "Haven't tried Guided yet",
    trend: 'stable',
    trendValue: '0%',
    color: 'text-violet-500',
    bgColor: 'bg-violet-50',
    iconBg: 'bg-violet-100',
    icon: Sparkles,
    type: 'auto',
    members: [
      { name: 'Rachel Kim', lastVisit: '3 days ago', ltv: 440 },
      { name: 'Kevin Patel', lastVisit: '5 days ago', ltv: 320 },
      { name: 'Jasmine Torres', lastVisit: '1 day ago', ltv: 580 },
      { name: 'Brandon Lee', lastVisit: '7 days ago', ltv: 210 },
      { name: 'Olivia Brown', lastVisit: '2 days ago', ltv: 670 },
    ],
  },
  {
    id: 'corporate',
    name: 'Corporate',
    count: 34,
    description: 'Company account members',
    trend: 'up',
    trendValue: '8%',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    icon: Building2,
    type: 'manual',
    members: [
      { name: 'Jessica Rivera', lastVisit: '1 day ago', ltv: 0 },
      { name: 'Tom Anderson', lastVisit: '3 days ago', ltv: 0 },
      { name: 'Amy Chang', lastVisit: 'Today', ltv: 0 },
      { name: 'Derek Foster', lastVisit: '5 days ago', ltv: 0 },
      { name: 'Nina Petrova', lastVisit: '2 days ago', ltv: 0 },
    ],
  },
  {
    id: 'ambassadors',
    name: 'Ambassadors',
    count: 18,
    description: '3+ referrals',
    trend: 'up',
    trendValue: '22%',
    color: 'text-teal-500',
    bgColor: 'bg-teal-50',
    iconBg: 'bg-teal-100',
    icon: Heart,
    type: 'auto',
    members: [
      { name: 'Carlos Mendez', lastVisit: 'Today', ltv: 1890 },
      { name: 'Whitney Cooper', lastVisit: '1 day ago', ltv: 1540 },
      { name: 'Aiden Moore', lastVisit: '2 days ago', ltv: 1320 },
      { name: 'Grace Taylor', lastVisit: 'Today', ltv: 1780 },
      { name: 'Ethan Reeves', lastVisit: '3 days ago', ltv: 1150 },
    ],
  },
]

// ─── Trend Icon ──────────────────────────────────────────────
function TrendIndicator({ trend, value }: { trend: 'up' | 'down' | 'stable'; value: string }) {
  if (trend === 'stable') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
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
export default function SegmentsPage() {
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null)

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6 lg:p-8">
      {/* Header */}
      <motion.div {...fadeInUp} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Smart Segments</h1>
            <p className="mt-1 text-sm text-gray-500">
              AI-powered member segments that update automatically
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
            <Zap className="h-4 w-4" />
            Create Segment
          </button>
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
          {SEGMENTS.map((segment, i) => {
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
                    'group w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md',
                    isSelected
                      ? 'border-indigo-300 ring-2 ring-indigo-100'
                      : 'border-gray-200 hover:border-gray-300'
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {segment.name}
                    </p>
                    <p className="mt-1 text-[28px] font-black tabular-nums text-gray-900">
                      {segment.count}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{segment.description}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest',
                        segment.type === 'auto'
                          ? 'bg-violet-50 text-violet-600'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {segment.type === 'auto' ? 'AI Auto' : 'Manual'}
                    </span>
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 transition-transform',
                        isSelected
                          ? 'translate-x-0 text-indigo-500'
                          : 'text-gray-300 group-hover:translate-x-1 group-hover:text-gray-400'
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
              <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
                {/* Panel Header */}
                <div className="flex items-center justify-between border-b border-gray-100 p-5">
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
                      <h3 className="text-sm font-semibold text-gray-900">
                        {selectedSegment.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {selectedSegment.description}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSegment(null)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Stats */}
                <div className="border-b border-gray-100 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Members
                      </p>
                      <p className="mt-1 text-[28px] font-black tabular-nums text-gray-900">
                        {selectedSegment.count}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
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
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {selectedSegment.type === 'auto' ? 'Auto' : 'Manual'}
                    </span>
                  </div>
                </div>

                {/* Sample Members */}
                <div className="p-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Sample Members
                  </p>
                  <div className="space-y-3">
                    {selectedSegment.members.map((member) => (
                      <div
                        key={member.name}
                        className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                            {member.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {member.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {member.lastVisit}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-gray-700">
                          ${member.ltv.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-100 p-5">
                  <div className="flex gap-3">
                    <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
                      <Send className="h-4 w-4" />
                      Send Campaign
                    </button>
                    <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
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
