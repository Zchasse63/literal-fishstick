'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Sparkles,
  Brain,
  DollarSign,
  Calendar,
  Users,
  TrendingUp,
  AlertTriangle,
  Check,
  X,
  ChevronRight,
  RefreshCw,
  Clock,
  Inbox,
  BarChart3,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
type InsightType = 'scheduling' | 'pricing' | 'retention' | 'revenue' | 'trainer' | 'growth' | 'anomaly'
type Urgency = 'info' | 'suggestion' | 'attention' | 'urgent'
type FilterTab = 'all' | InsightType
type ViewTab = 'active' | 'history'
type HistoryStatus = 'dismissed' | 'done'

interface Insight {
  id: string
  type: InsightType
  urgency: Urgency
  title: string
  summary: string
  action: string
  actionLink: string
  createdAt: string
  status: 'active' | HistoryStatus
  resolvedAt?: string
}

// ─── Constants ──────────────────────────────────────────────
const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'retention', label: 'Retention' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'growth', label: 'Growth' },
  { value: 'anomaly', label: 'Anomaly' },
]

const TYPE_ICONS: Record<InsightType, typeof Brain> = {
  retention: Brain,
  pricing: DollarSign,
  revenue: DollarSign,
  scheduling: Calendar,
  growth: Users,
  trainer: TrendingUp,
  anomaly: AlertTriangle,
}

const TYPE_COLORS: Record<InsightType, { bg: string; text: string }> = {
  retention: { bg: 'bg-violet-100', text: 'text-violet-600' },
  pricing: { bg: 'bg-amber-100', text: 'text-amber-600' },
  revenue: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  scheduling: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  growth: { bg: 'bg-blue-100', text: 'text-blue-600' },
  trainer: { bg: 'bg-teal-100', text: 'text-teal-600' },
  anomaly: { bg: 'bg-red-100', text: 'text-red-600' },
}

const URGENCY_STYLES: Record<Urgency, { bg: string; text: string; label: string }> = {
  info: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'Info' },
  suggestion: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Suggestion' },
  attention: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Attention' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent' },
}

const HISTORY_STATUS_STYLES: Record<HistoryStatus, { bg: string; text: string; label: string }> = {
  dismissed: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'Dismissed' },
  done: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Done' },
}

function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 animate-pulse rounded', className)} />
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hours ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} days ago`
  return `${Math.floor(diffDays / 7)} week${diffDays >= 14 ? 's' : ''} ago`
}

// ─── Page Component ──────────────────────────────────────────
export default function AIInsightsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [viewTab, setViewTab] = useState<ViewTab>('active')
  const [insights, setInsights] = useState<Insight[]>([])
  const [history, setHistory] = useState<Insight[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [lastGenerated, setLastGenerated] = useState<string | null>(null)

  // ─── Transform API insight to local format ─────────────────
  const transformInsight = useCallback((raw: any): Insight => ({
    id: raw.id,
    type: raw.type ?? 'retention',
    urgency: raw.urgency ?? 'info',
    title: raw.title ?? '',
    summary: raw.summary ?? '',
    action: raw.action_label ?? 'View Details',
    actionLink: raw.action_link ?? '/analytics',
    createdAt: raw.generated_at ? getTimeAgo(raw.generated_at) : '',
    status: raw.status ?? 'active',
    resolvedAt: raw.resolved_at ? getTimeAgo(raw.resolved_at) : undefined,
  }), [])

  // ─── Fetch Active Insights ─────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/ai/insights?limit=20')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        const items = (d.data as any[]).map(transformInsight)
        setInsights(items)
        if (items.length > 0) {
          setLastGenerated(items[0].createdAt)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [transformInsight])

  // ─── Fetch History Insights ────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setHistoryLoading(true)
    fetch('/api/ai/insights/history?limit=50')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return
        // Filter to only dismissed and done
        const items = (d.data as any[])
          .filter((i: any) => i.status === 'dismissed' || i.status === 'done')
          .map(transformInsight)
        setHistory(items)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [transformInsight])

  const filteredInsights = insights.filter((i) => {
    if (activeFilter === 'all') return true
    return i.type === activeFilter
  })

  const filteredHistory = history.filter((i) => {
    if (activeFilter === 'all') return true
    return i.type === activeFilter
  })

  const handleDismiss = async (id: string) => {
    const insight = insights.find((i) => i.id === id)
    if (!insight) return
    // Call dismiss API
    try {
      await fetch(`/api/ai/insights/${id}/dismiss`, { method: 'POST' })
    } catch {}
    setInsights((prev) => prev.filter((i) => i.id !== id))
    setHistory((prev) => [
      { ...insight, status: 'dismissed' as const, resolvedAt: 'Just now' },
      ...prev,
    ])
  }

  const handleMarkDone = async (id: string) => {
    const insight = insights.find((i) => i.id === id)
    if (!insight) return
    // Call action API
    try {
      await fetch(`/api/ai/insights/${id}/action`, { method: 'POST' })
    } catch {}
    setInsights((prev) => prev.filter((i) => i.id !== id))
    setHistory((prev) => [
      { ...insight, status: 'done' as const, resolvedAt: 'Just now' },
      ...prev,
    ])
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      await fetch('/api/ai/insights/generate', { method: 'POST' })
      // Re-fetch active insights
      const res = await fetch('/api/ai/insights?limit=20')
      const d = await res.json()
      if (d.data) {
        const items = (d.data as any[]).map(transformInsight)
        setInsights(items)
        if (items.length > 0) setLastGenerated(items[0].createdAt)
      }
    } catch {}
    setIsGenerating(false)
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header ──────────────────────────────────── */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Insights</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Intelligent recommendations powered by your studio data
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span>{lastGenerated ? `Last generated ${lastGenerated}` : 'Loading...'}</span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                isGenerating
                  ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
              )}
            >
              <RefreshCw className={cn('w-4 h-4', isGenerating && 'animate-spin')} />
              {isGenerating ? 'Generating...' : 'Generate New Insights'}
            </button>
          </div>
        </motion.div>

        {/* ─── View Tabs (Active / History) ─────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.05 }}
          className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-800"
        >
          {(['active', 'history'] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setViewTab(tab)}
              className={cn(
                'pb-3 text-sm font-semibold capitalize transition-all border-b-2 -mb-px',
                viewTab === tab
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300'
              )}
            >
              {tab}
              <span
                className={cn(
                  'ml-2 text-xs px-1.5 py-0.5 rounded-full tabular-nums',
                  viewTab === tab
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                )}
              >
                {tab === 'active' ? insights.length : history.length}
              </span>
            </button>
          ))}
        </motion.div>

        {/* ─── Filter Tabs ──────────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.08 }}
          className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                activeFilter === tab.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* ─── Insight Feed ──────────────────────────────── */}
        <AnimatePresence mode="wait">
          {viewTab === 'active' ? (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
                      <div className="flex items-start gap-4">
                        <LoadingSkeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                        <div className="flex-1">
                          <LoadingSkeleton className="h-4 w-3/4 mb-2" />
                          <LoadingSkeleton className="h-3 w-full mb-1" />
                          <LoadingSkeleton className="h-3 w-2/3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredInsights.length === 0 ? (
                <motion.div
                  {...fadeInUp}
                  className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-12 text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                    <Inbox className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No active insights</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                    {activeFilter !== 'all'
                      ? `No ${activeFilter} insights right now. Try a different filter or generate new insights.`
                      : 'All caught up! Generate new insights to get fresh recommendations.'}
                  </p>
                  <button
                    onClick={handleGenerate}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    Generate Insights
                  </button>
                </motion.div>
              ) : (
                filteredInsights.map((insight, i) => {
                  const Icon = TYPE_ICONS[insight.type] ?? Brain
                  const typeColor = TYPE_COLORS[insight.type] ?? TYPE_COLORS.retention
                  const urgency = URGENCY_STYLES[insight.urgency] ?? URGENCY_STYLES.info

                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{
                        delay: i * 0.04,
                        duration: 0.25,
                        ease: [0.25, 1, 0.5, 1],
                      }}
                      className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                            typeColor.bg
                          )}
                        >
                          <Icon className={cn('w-5 h-5', typeColor.text)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                              {insight.title}
                            </h3>
                            <span
                              className={cn(
                                'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest',
                                urgency.bg,
                                urgency.text
                              )}
                            >
                              {urgency.label}
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                            {insight.summary}
                          </p>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Link
                                href={insight.actionLink}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors"
                              >
                                {insight.action}
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                              <button
                                onClick={() => handleMarkDone(insight.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-medium transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Mark as Done
                              </button>
                              <button
                                onClick={() => handleDismiss(insight.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-xs font-medium transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                Dismiss
                              </button>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                              {insight.createdAt}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {historyLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 opacity-75">
                      <div className="flex items-start gap-4">
                        <LoadingSkeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                        <div className="flex-1">
                          <LoadingSkeleton className="h-4 w-3/4 mb-2" />
                          <LoadingSkeleton className="h-3 w-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredHistory.length === 0 ? (
                <motion.div
                  {...fadeInUp}
                  className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-12 text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No history yet</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                    {activeFilter !== 'all'
                      ? `No resolved ${activeFilter} insights. Try a different filter.`
                      : 'Dismissed and completed insights will appear here.'}
                  </p>
                </motion.div>
              ) : (
                filteredHistory.map((insight, i) => {
                  const Icon = TYPE_ICONS[insight.type] ?? Brain
                  const typeColor = TYPE_COLORS[insight.type] ?? TYPE_COLORS.retention
                  const statusStyle = HISTORY_STATUS_STYLES[insight.status as HistoryStatus] ?? HISTORY_STATUS_STYLES.dismissed

                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: i * 0.04,
                        duration: 0.25,
                        ease: [0.25, 1, 0.5, 1],
                      }}
                      className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 opacity-75"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                            typeColor.bg
                          )}
                        >
                          <Icon className={cn('w-5 h-5', typeColor.text)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                              {insight.title}
                            </h3>
                            <span
                              className={cn(
                                'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest',
                                statusStyle.bg,
                                statusStyle.text
                              )}
                            >
                              {statusStyle.label}
                            </span>
                          </div>

                          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-2">
                            {insight.summary}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                            <span>Created {insight.createdAt}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span>Resolved {insight.resolvedAt}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
