'use client'

import { useState } from 'react'
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

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

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
  info: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Info' },
  suggestion: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Suggestion' },
  attention: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Attention' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent' },
}

const HISTORY_STATUS_STYLES: Record<HistoryStatus, { bg: string; text: string; label: string }> = {
  dismissed: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Dismissed' },
  done: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Done' },
}

// ─── Mock Data ──────────────────────────────────────────────
const INITIAL_INSIGHTS: Insight[] = [
  {
    id: '1',
    type: 'scheduling',
    urgency: 'suggestion',
    title: 'Wednesday 7pm class consistently at 95% capacity',
    summary: 'The Wednesday 7pm Guided session with Whitney Cooper has averaged 95% fill rate over the past 4 weeks. Waitlist has been activated 3 times. Adding a second session on Thursday at the same time could capture unmet demand.',
    action: 'Add Thursday 7pm Guided session',
    actionLink: '/schedule',
    createdAt: '2 hours ago',
    status: 'active',
  },
  {
    id: '2',
    type: 'retention',
    urgency: 'attention',
    title: '12 members haven\'t visited in 14+ days',
    summary: 'These members had been averaging 2.3 visits per week before going inactive. 8 of 12 are on unlimited plans. A targeted win-back campaign could re-engage them before they churn.',
    action: 'View at-risk members',
    actionLink: '/members',
    createdAt: '4 hours ago',
    status: 'active',
  },
  {
    id: '3',
    type: 'revenue',
    urgency: 'info',
    title: 'Revenue up 8% month-over-month',
    summary: 'Total revenue reached $31,150 this month, driven primarily by a 14% increase in credit pack purchases and 3 new corporate account sign-ups. Subscription revenue held steady.',
    action: 'View revenue breakdown',
    actionLink: '/revenue',
    createdAt: '6 hours ago',
    status: 'active',
  },
  {
    id: '4',
    type: 'trainer',
    urgency: 'info',
    title: 'Trainer Whitney\'s classes average 9.2 check-ins vs team average of 6.8',
    summary: 'Whitney Cooper continues to outperform with a 35% higher average attendance than the team mean. Her bonus hit rate is 83%. Consider featuring her in promotional content or offering a premium guided tier.',
    action: 'View trainer details',
    actionLink: '/analytics/trainers',
    createdAt: '8 hours ago',
    status: 'active',
  },
  {
    id: '5',
    type: 'pricing',
    urgency: 'suggestion',
    title: '5-class pack has lowest conversion rate',
    summary: 'Only 2 purchases of the 5-class pack in the last 90 days. The 10-class pack outsells it 8:1. Consider replacing the 5-class option with a "Sampler 3-Pack" for first-timers or removing it entirely.',
    action: 'Review pricing tiers',
    actionLink: '/revenue',
    createdAt: '12 hours ago',
    status: 'active',
  },
  {
    id: '6',
    type: 'anomaly',
    urgency: 'urgent',
    title: 'Unusual spike in cancellations — Monday 6pm',
    summary: 'Monday 6pm Open sessions have seen a 340% increase in late cancellations over the past 2 weeks. This coincides with a local gym opening a competing hot yoga class at the same time. No-show rate also up 25%.',
    action: 'View cancellation details',
    actionLink: '/schedule',
    createdAt: '1 day ago',
    status: 'active',
  },
  {
    id: '7',
    type: 'growth',
    urgency: 'suggestion',
    title: 'Referral members have 40% higher LTV',
    summary: 'Members acquired through trainer promo codes and guest passes have a 40% higher lifetime value and 28% lower churn rate. Expanding the referral program could significantly improve unit economics.',
    action: 'View referral analytics',
    actionLink: '/analytics',
    createdAt: '1 day ago',
    status: 'active',
  },
  {
    id: '8',
    type: 'scheduling',
    urgency: 'attention',
    title: 'Saturday 8-9am consistently underperforming',
    summary: 'Saturday morning early slots average only 25% fill rate over the past 6 weeks. This slot has the highest no-show rate at 18%. Consider shifting it to 9-10am or converting to a Guided session to drive interest.',
    action: 'Edit Saturday schedule',
    actionLink: '/schedule',
    createdAt: '2 days ago',
    status: 'active',
  },
  {
    id: '9',
    type: 'retention',
    urgency: 'info',
    title: 'New member 30-day retention hit 91%',
    summary: 'The latest cohort of new members (signed up in February) has a 91% 30-day retention rate, up from 84% in January. The new welcome email series may be contributing to the improvement.',
    action: 'View cohort details',
    actionLink: '/analytics',
    createdAt: '2 days ago',
    status: 'active',
  },
  {
    id: '10',
    type: 'revenue',
    urgency: 'suggestion',
    title: 'Gift card sales opportunity — Spring holidays approaching',
    summary: 'Last year, gift card purchases spiked 180% in the 2 weeks before Mother\'s Day. Setting up a promotional campaign now could capture early buyers. Current gift card balance outstanding: $2,340.',
    action: 'Create gift card campaign',
    actionLink: '/marketing/campaigns/new',
    createdAt: '3 days ago',
    status: 'active',
  },
]

const HISTORY_INSIGHTS: Insight[] = [
  {
    id: 'h1',
    type: 'pricing',
    urgency: 'suggestion',
    title: 'Drop-in price below market average',
    summary: 'Your $25 drop-in rate is 15% below the area average of $29. A $5 increase would add an estimated $400/month with minimal impact on volume.',
    action: 'Adjust pricing',
    actionLink: '/revenue',
    createdAt: '5 days ago',
    status: 'done',
    resolvedAt: '3 days ago',
  },
  {
    id: 'h2',
    type: 'scheduling',
    urgency: 'attention',
    title: 'Friday 7pm slot needs trainer coverage',
    summary: 'No trainer assigned for Friday 7pm starting next week. Auto-assigned as Open session.',
    action: 'Assign trainer',
    actionLink: '/schedule',
    createdAt: '1 week ago',
    status: 'dismissed',
    resolvedAt: '5 days ago',
  },
  {
    id: 'h3',
    type: 'growth',
    urgency: 'info',
    title: 'Instagram traffic up 23% this week',
    summary: 'Website visits from Instagram increased 23%. The trainer spotlight reel posted Tuesday received 4x average engagement.',
    action: 'View content hub',
    actionLink: '/marketing/content',
    createdAt: '1 week ago',
    status: 'done',
    resolvedAt: '6 days ago',
  },
]

// ─── Page Component ──────────────────────────────────────────
export default function AIInsightsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [viewTab, setViewTab] = useState<ViewTab>('active')
  const [insights, setInsights] = useState<Insight[]>(INITIAL_INSIGHTS)
  const [history, setHistory] = useState<Insight[]>(HISTORY_INSIGHTS)
  const [isGenerating, setIsGenerating] = useState(false)

  const filteredInsights = insights.filter((i) => {
    if (activeFilter === 'all') return true
    return i.type === activeFilter
  })

  const filteredHistory = history.filter((i) => {
    if (activeFilter === 'all') return true
    return i.type === activeFilter
  })

  const handleDismiss = (id: string) => {
    const insight = insights.find((i) => i.id === id)
    if (!insight) return
    setInsights((prev) => prev.filter((i) => i.id !== id))
    setHistory((prev) => [
      { ...insight, status: 'dismissed' as const, resolvedAt: 'Just now' },
      ...prev,
    ])
  }

  const handleMarkDone = (id: string) => {
    const insight = insights.find((i) => i.id === id)
    if (!insight) return
    setInsights((prev) => prev.filter((i) => i.id !== id))
    setHistory((prev) => [
      { ...insight, status: 'done' as const, resolvedAt: 'Just now' },
      ...prev,
    ])
  }

  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(() => setIsGenerating(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header ──────────────────────────────────── */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Intelligent recommendations powered by your studio data
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Last generated 2 hours ago</span>
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
          className="flex items-center gap-6 border-b border-gray-200"
        >
          {(['active', 'history'] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setViewTab(tab)}
              className={cn(
                'pb-3 text-sm font-semibold capitalize transition-all border-b-2 -mb-px',
                viewTab === tab
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              )}
            >
              {tab}
              <span
                className={cn(
                  'ml-2 text-xs px-1.5 py-0.5 rounded-full tabular-nums',
                  viewTab === tab
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-500'
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
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900'
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
              {filteredInsights.length === 0 ? (
                <motion.div
                  {...fadeInUp}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Inbox className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">No active insights</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
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
                  const Icon = TYPE_ICONS[insight.type]
                  const typeColor = TYPE_COLORS[insight.type]
                  const urgency = URGENCY_STYLES[insight.urgency]

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
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow"
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
                            <h3 className="text-sm font-bold text-gray-900 leading-snug">
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

                          <p className="text-sm text-gray-600 leading-relaxed mb-3">
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
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-medium transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Mark as Done
                              </button>
                              <button
                                onClick={() => handleDismiss(insight.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                Dismiss
                              </button>
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">
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
              {filteredHistory.length === 0 ? (
                <motion.div
                  {...fadeInUp}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">No history yet</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    {activeFilter !== 'all'
                      ? `No resolved ${activeFilter} insights. Try a different filter.`
                      : 'Dismissed and completed insights will appear here.'}
                  </p>
                </motion.div>
              ) : (
                filteredHistory.map((insight, i) => {
                  const Icon = TYPE_ICONS[insight.type]
                  const typeColor = TYPE_COLORS[insight.type]
                  const statusStyle = HISTORY_STATUS_STYLES[insight.status as HistoryStatus]

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
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 opacity-75"
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
                            <h3 className="text-sm font-bold text-gray-900 leading-snug">
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

                          <p className="text-sm text-gray-500 leading-relaxed mb-2">
                            {insight.summary}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-gray-400">
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
