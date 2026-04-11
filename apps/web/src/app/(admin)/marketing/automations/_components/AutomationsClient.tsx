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
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
export type TriggerType = 'signup' | 'no_show' | 'churn_risk' | 'credit_expiry' | 'birthday' | 'milestone' | 'membership_change' | 'booking_completed' | 'failed_payment' | 'inactivity' | 'referral'

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

export interface Automation {
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

// ─── Template Gallery (static) ──────────────────────────────
const TEMPLATES: Template[] = [
  { id: 'welcome', name: 'Welcome Sequence', icon: UserPlus, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', trigger: 'Triggered when a new member signs up', steps: 4, description: 'Onboard new members with a 5-day email sequence introducing your studio, trainers, and first-class tips.' },
  { id: 'winback', name: 'Win-Back', icon: TrendingDown, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', trigger: 'Triggered after 14 days of inactivity', steps: 3, description: 'Re-engage inactive members with personalized offers and a reminder of what they are missing.' },
  { id: 'failed_payment', name: 'Failed Payment Recovery', icon: CreditCard, iconBg: 'bg-red-50', iconColor: 'text-red-600', trigger: 'Triggered on failed payment', steps: 5, description: 'Recover failed payments with escalating reminders: friendly nudge, update card link, and final notice.' },
  { id: 'churn', name: 'Churn Prevention', icon: ShieldAlert, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', trigger: 'Triggered by AI churn risk score', steps: 4, description: 'Intervene before members cancel with personalized retention offers based on their engagement pattern.' },
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

function TemplateCard({ template, delay }: { template: Template; delay: number }) {
  const Icon = template.icon
  return (
    <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-4 hover:border-indigo-200 hover:shadow-md transition-all group">
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', template.iconBg)}><Icon className={cn('h-5 w-5', template.iconColor)} /></div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{template.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{template.trigger}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{template.description}</p>
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /><span className="text-xs font-medium text-gray-500 dark:text-gray-400">{template.steps} steps</span></div>
        <Link href={`/marketing/automations/new?template=${template.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors">Use Template<ArrowRight className="h-3 w-3" /></Link>
      </div>
    </motion.div>
  )
}

interface EnrollmentRecord {
  id: string
  status: string
  created_at: string
  member?: { id: string; full_name: string | null; email: string | null } | null
}

function AutomationCard({ automation, delay }: { automation: Automation; delay: number }) {
  const [active, setActive] = useState(automation.active)
  const [showEnrollments, setShowEnrollments] = useState(false)
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const badge = triggerBadgeConfig[automation.triggerType]

  const loadEnrollments = async () => {
    if (showEnrollments) {
      setShowEnrollments(false)
      return
    }
    setEnrollmentsLoading(true)
    try {
      const res = await fetch(`/api/automations/${automation.id}/enrollments?limit=20`)
      if (res.ok) {
        const json = await res.json()
        setEnrollments(json.data ?? [])
        setShowEnrollments(true)
      } else {
        window.alert('Failed to load enrollments')
      }
    } catch {
      window.alert('Failed to load enrollments')
    } finally {
      setEnrollmentsLoading(false)
    }
  }

  return (
    <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', active ? 'bg-emerald-50' : 'bg-gray-100 dark:bg-gray-800')}><Zap className={cn('h-5 w-5', active ? 'text-emerald-600' : 'text-gray-400 dark:text-gray-500')} /></div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{automation.name}</h3>
            {badge && <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1', badge.className)}>{badge.label}</span>}
          </div>
        </div>
        <button onClick={() => setActive(!active)} className="shrink-0 focus:outline-none" aria-label={active ? 'Deactivate automation' : 'Activate automation'}>
          {active ? <ToggleRight className="h-8 w-8 text-emerald-500" /> : <ToggleLeft className="h-8 w-8 text-gray-300" />}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Enrolled</p><div className="flex items-center gap-1.5 mt-1"><Users className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /><p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{automation.enrolled}</p></div></div>
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Completed</p><div className="flex items-center gap-1.5 mt-1"><CheckCircle2 className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /><p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{automation.completed}</p></div></div>
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Conversion</p><div className="flex items-center gap-1.5 mt-1"><Percent className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /><p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{automation.conversionRate}%</p></div></div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Last triggered {automation.lastTriggered}</span></div>
        <div className="flex items-center gap-2">
          <Link href={`/marketing/automations/${automation.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-200 transition-colors"><Pencil className="h-3 w-3" />Edit</Link>
          <button onClick={loadEnrollments} disabled={enrollmentsLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"><Eye className="h-3 w-3" />{enrollmentsLoading ? 'Loading...' : 'Enrollments'}</button>
        </div>
      </div>
      {/* Inline Enrollments Panel */}
      {showEnrollments && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Recent Enrollments ({enrollments.length})</p>
            <button onClick={() => setShowEnrollments(false)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Close</button>
          </div>
          {enrollments.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No enrollments yet</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {enrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{e.member?.full_name ?? 'Unknown member'}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{e.member?.email ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                      e.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                      e.status === 'completed' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' :
                      e.status === 'exited' ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700' :
                      'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    )}>
                      {e.status}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

function EmptyState() {
  return (
    <motion.div {...fadeInUp} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-12 flex flex-col items-center justify-center text-center">
      <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4"><Sparkles className="h-8 w-8 text-indigo-400" /></div>
      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">No automations yet</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">Create your first automation to engage members automatically. Start from a template or build from scratch.</p>
      <Link href="/marketing/automations/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"><Plus className="h-4 w-4" />New Automation</Link>
    </motion.div>
  )
}

// ─── Props ──────────────────────────────────────────────────
interface AutomationsClientProps {
  initialAutomations: Automation[]
}

// ─── Client Component ───────────────────────────────────────
export default function AutomationsClient({ initialAutomations }: AutomationsClientProps) {
  const [automations] = useState<Automation[]>(initialAutomations)
  const hasAutomations = automations.length > 0

  return (
    <motion.div data-testid="marketing-automations-page-root" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }} className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Automations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Set up automated workflows to engage members at the right time</p>
        </div>
        <Link href="/marketing/automations/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"><Plus className="h-4 w-4" />New Automation</Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4"><Sparkles className="h-4 w-4 text-indigo-600" /><h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Template Gallery</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEMPLATES.map((template, i) => (<TemplateCard key={template.id} template={template} delay={i * 0.05} />))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4"><Zap className="h-4 w-4 text-emerald-600" /><h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Active Automations</h2></div>
        {hasAutomations ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {automations.map((automation, i) => (<AutomationCard key={automation.id} automation={automation} delay={i * 0.05} />))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </motion.div>
  )
}
