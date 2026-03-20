'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Plus,
  Zap,
  Mail,
  UserPlus,
  ShieldAlert,
  CreditCard,
  TrendingDown,
  Clock,
  Users,
  CheckCircle2,
  Percent,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Eye,
  Sparkles,
  GitBranch,
  ArrowRight,
} from 'lucide-react'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type TriggerType =
  | 'signup'
  | 'no_show'
  | 'churn_risk'
  | 'credit_expiry'
  | 'birthday'
  | 'milestone'
  | 'membership_change'
  | 'booking_completed'
  | 'failed_payment'
  | 'inactivity'
  | 'referral'

interface Template {
  id: string
  name: string
  icon: typeof Mail
  iconBg: string
  iconColor: string
  trigger: string
  steps: number
  description: string
}

interface Automation {
  id: string
  name: string
  triggerType: TriggerType
  triggerLabel: string
  active: boolean
  enrolled: number
  completed: number
  conversionRate: number
  lastTriggered: string
  steps: number
}

// ─── Mock Data ──────────────────────────────────────────────
const TEMPLATES: Template[] = [
  {
    id: 'welcome',
    name: 'Welcome Sequence',
    icon: UserPlus,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    trigger: 'Triggered when a new member signs up',
    steps: 4,
    description: 'Onboard new members with a 5-day email sequence introducing your studio, trainers, and first-class tips.',
  },
  {
    id: 'winback',
    name: 'Win-Back',
    icon: TrendingDown,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    trigger: 'Triggered after 14 days of inactivity',
    steps: 3,
    description: 'Re-engage inactive members with personalized offers and a reminder of what they are missing.',
  },
  {
    id: 'failed_payment',
    name: 'Failed Payment Recovery',
    icon: CreditCard,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    trigger: 'Triggered on failed payment',
    steps: 5,
    description: 'Recover failed payments with escalating reminders: friendly nudge, update card link, and final notice.',
  },
  {
    id: 'churn',
    name: 'Churn Prevention',
    icon: ShieldAlert,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    trigger: 'Triggered by AI churn risk score',
    steps: 4,
    description: 'Intervene before members cancel with personalized retention offers based on their engagement pattern.',
  },
]

const AUTOMATIONS: Automation[] = [
  {
    id: '1',
    name: 'Welcome Sequence',
    triggerType: 'signup',
    triggerLabel: 'New Signup',
    active: true,
    enrolled: 312,
    completed: 287,
    conversionRate: 72,
    lastTriggered: '2 hours ago',
    steps: 4,
  },
  {
    id: '2',
    name: 'Win-Back: 14-Day Inactive',
    triggerType: 'inactivity',
    triggerLabel: 'Inactivity',
    active: true,
    enrolled: 47,
    completed: 31,
    conversionRate: 17,
    lastTriggered: '45 min ago',
    steps: 3,
  },
  {
    id: '3',
    name: 'Failed Payment Recovery',
    triggerType: 'failed_payment',
    triggerLabel: 'Failed Payment',
    active: true,
    enrolled: 12,
    completed: 9,
    conversionRate: 42,
    lastTriggered: '6 hours ago',
    steps: 5,
  },
]

const triggerBadgeConfig: Partial<Record<TriggerType, { label: string; className: string }>> = {
  signup: { label: 'New Signup', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  inactivity: { label: 'Inactivity', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  failed_payment: { label: 'Failed Payment', className: 'bg-red-50 text-red-700 border border-red-200' },
  churn_risk: { label: 'Churn Risk', className: 'bg-violet-50 text-violet-700 border border-violet-200' },
  no_show: { label: 'No-Show', className: 'bg-orange-50 text-orange-700 border border-orange-200' },
  credit_expiry: { label: 'Credit Expiry', className: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  birthday: { label: 'Birthday', className: 'bg-pink-50 text-pink-700 border border-pink-200' },
  milestone: { label: 'Milestone', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  membership_change: { label: 'Membership Change', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  booking_completed: { label: 'Booking Completed', className: 'bg-teal-50 text-teal-700 border border-teal-200' },
  referral: { label: 'Referral', className: 'bg-cyan-50 text-cyan-700 border border-cyan-200' },
}

// ─── Components ─────────────────────────────────────────────

function TemplateCard({ template, delay }: { template: Template; delay: number }) {
  const Icon = template.icon
  return (
    <motion.div
      {...fadeInUp}
      transition={{ ...fadeInUp.transition, delay }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4 hover:border-indigo-200 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', template.iconBg)}>
          <Icon className={cn('h-5 w-5', template.iconColor)} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900">{template.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{template.trigger}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{template.description}</p>
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-500">{template.steps} steps</span>
        </div>
        <Link
          href={`/marketing/automations/new?template=${template.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors"
        >
          Use Template
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

function AutomationCard({ automation, delay }: { automation: Automation; delay: number }) {
  const [active, setActive] = useState(automation.active)
  const badge = triggerBadgeConfig[automation.triggerType]

  return (
    <motion.div
      {...fadeInUp}
      transition={{ ...fadeInUp.transition, delay }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-all"
    >
      {/* Top row: name + trigger badge + toggle */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', active ? 'bg-emerald-50' : 'bg-gray-100')}>
            <Zap className={cn('h-5 w-5', active ? 'text-emerald-600' : 'text-gray-400')} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{automation.name}</h3>
            {badge && (
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1', badge.className)}>
                {badge.label}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setActive(!active)}
          className="shrink-0 focus:outline-none"
          aria-label={active ? 'Deactivate automation' : 'Activate automation'}
        >
          {active ? (
            <ToggleRight className="h-8 w-8 text-emerald-500" />
          ) : (
            <ToggleLeft className="h-8 w-8 text-gray-300" />
          )}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Enrolled</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Users className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-lg font-bold text-gray-900 tabular-nums">{automation.enrolled}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Completed</p>
          <div className="flex items-center gap-1.5 mt-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-lg font-bold text-gray-900 tabular-nums">{automation.completed}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Conversion</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Percent className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-lg font-bold text-gray-900 tabular-nums">{automation.conversionRate}%</p>
          </div>
        </div>
      </div>

      {/* Last triggered + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">Last triggered {automation.lastTriggered}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/marketing/automations/${automation.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Link>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors">
            <Eye className="h-3 w-3" />
            Enrollments
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <motion.div
      {...fadeInUp}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center text-center"
    >
      <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-indigo-400" />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">No automations yet</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        Create your first automation to engage members automatically. Start from a template or build from scratch.
      </p>
      <Link
        href="/marketing/automations/new"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
      >
        <Plus className="h-4 w-4" />
        New Automation
      </Link>
    </motion.div>
  )
}

// ─── Page ───────────────────────────────────────────────────
export default function AutomationsPage() {
  const hasAutomations = AUTOMATIONS.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Automations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Set up automated workflows to engage members at the right time</p>
        </div>
        <Link
          href="/marketing/automations/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Automation
        </Link>
      </div>

      {/* Template Gallery */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Template Gallery</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEMPLATES.map((template, i) => (
            <TemplateCard key={template.id} template={template} delay={i * 0.05} />
          ))}
        </div>
      </div>

      {/* Active Automations */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-emerald-600" />
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Active Automations</h2>
        </div>
        {hasAutomations ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {AUTOMATIONS.map((automation, i) => (
              <AutomationCard key={automation.id} automation={automation} delay={i * 0.05} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </motion.div>
  )
}
