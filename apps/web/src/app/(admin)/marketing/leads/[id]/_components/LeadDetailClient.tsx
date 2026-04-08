'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  Star,
  Clock,
  UserPlus,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileText,
  CalendarCheck,
  ArrowUpRight,
  ChevronDown,
  X,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  PhoneCall,
  UserCheck,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
type ActivityType =
  | 'created'
  | 'status_change'
  | 'note_added'
  | 'email_sent'
  | 'email_opened'
  | 'call_logged'
  | 'form_submitted'
  | 'trial_booked'
  | 'converted'

interface Activity {
  id: string
  type: ActivityType
  description: string
  timestamp: string
  performedBy?: { name: string; initials: string }
}

interface ScoreFactor {
  label: string
  impact: 'positive' | 'negative' | 'neutral'
  value: string
}

interface MembershipPlanOption {
  id: string
  name: string
  price: number
}

interface LeadData {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  source: string
  score: number
  status: string
  assignedTo: { name: string; initials: string }
  tags: string[]
  createdAt: string
  nextFollowUp: string
}

const ACTIVITY_ICONS: Record<ActivityType, typeof Star> = {
  created: UserPlus,
  status_change: ArrowUpRight,
  note_added: MessageSquare,
  email_sent: Send,
  email_opened: Eye,
  call_logged: PhoneCall,
  form_submitted: FileText,
  trial_booked: CalendarCheck,
  converted: CheckCircle2,
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  created: 'bg-blue-100 text-blue-600',
  status_change: 'bg-amber-100 text-amber-600',
  note_added: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  email_sent: 'bg-indigo-100 text-indigo-600',
  email_opened: 'bg-emerald-100 text-emerald-600',
  call_logged: 'bg-violet-100 text-violet-600',
  form_submitted: 'bg-cyan-100 text-cyan-600',
  trial_booked: 'bg-emerald-100 text-emerald-600',
  converted: 'bg-emerald-100 text-emerald-700',
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { value: 'contacted', label: 'Contacted', color: 'bg-amber-100 text-amber-700' },
  { value: 'trial', label: 'Trial', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'converted', label: 'Converted', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'lost', label: 'Lost', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
]

// ─── Score Gauge ────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444'

  return (
    <div className="relative inline-flex h-24 w-24 items-center justify-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="#F3F4F6" strokeWidth="6" />
        <motion.circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-black text-gray-900 dark:text-gray-100 tabular-nums">{score}</span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Score</span>
      </div>
    </div>
  )
}

// ─── Convert Panel ──────────────────────────────────────────
function ConvertPanel({
  lead,
  onClose,
  converting,
  convertError,
  convertSuccess,
  newMemberId,
  onConfirm,
  onViewMember,
  membershipPlans,
  selectedPlanId,
  onPlanChange,
}: {
  lead: any
  onClose: () => void
  converting: boolean
  convertError: string | null
  convertSuccess: boolean
  newMemberId: string | null
  onConfirm: () => void
  onViewMember: () => void
  membershipPlans: MembershipPlanOption[]
  selectedPlanId: string
  onPlanChange: (planId: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Convert to Member</h3>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {convertSuccess ? (
        <div className="text-center py-4">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">Conversion Complete</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{lead.firstName} {lead.lastName} is now a member.</p>
          <button
            onClick={onViewMember}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            View Member Profile
          </button>
        </div>
      ) : (
        <>
          {/* Lead info */}
          <div className="flex items-center gap-3 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
              {(lead.firstName?.[0] || '?') + (lead.lastName?.[0] || '')}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{lead.firstName} {lead.lastName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{lead.email}</p>
            </div>
          </div>

          {/* Membership Assignment */}
          {membershipPlans.length > 0 && (
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Assign Membership (optional)</label>
              <select
                value={selectedPlanId}
                onChange={(e) => onPlanChange(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">No membership</option>
                {membershipPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — ${plan.price}/mo
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* What happens */}
          <div className="bg-indigo-50 rounded-xl p-3 mb-3 space-y-1.5">
            <p className="text-xs text-indigo-800">• A member account will be created with this lead&apos;s info</p>
            <p className="text-xs text-indigo-800">• All lead activity history will be preserved</p>
            <p className="text-xs text-indigo-800">• Lead status will be updated to Converted</p>
            {selectedPlanId && (
              <p className="text-xs text-indigo-800">• Membership will be assigned to the new member</p>
            )}
          </div>

          {convertError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 mb-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{convertError}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onConfirm}
              disabled={converting}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {converting ? (
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              Confirm Conversion
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </motion.div>
  )
}

// ─── Props ──────────────────────────────────────────────────
interface LeadDetailClientProps {
  initialLead: LeadData | null
  initialMembershipPlans: MembershipPlanOption[]
}

// ─── Client Component ───────────────────────────────────────
export default function LeadDetailClient({ initialLead, initialMembershipPlans }: LeadDetailClientProps) {
  const router = useRouter()
  const [lead, setLead] = useState<LeadData | null>(initialLead)
  const [activities] = useState<Activity[]>([])
  const [newNote, setNewNote] = useState('')
  const [tags, setTags] = useState<string[]>(initialLead?.tags || [])
  const [newTag, setNewTag] = useState('')
  const [showConvert, setShowConvert] = useState(false)
  const [status, setStatus] = useState(initialLead?.status || 'new')
  const [assigned, setAssigned] = useState(initialLead?.assignedTo?.name || '')
  const [followUp, setFollowUp] = useState(initialLead?.nextFollowUp || '')

  // Score state
  const [scoreFactors, setScoreFactors] = useState<ScoreFactor[]>([])
  const [rescoring, setRescoring] = useState(false)
  const [rescoreError, setRescoreError] = useState<string | null>(null)

  // Convert state
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertSuccess, setConvertSuccess] = useState(false)
  const [newMemberId, setNewMemberId] = useState<string | null>(null)
  const [membershipPlans] = useState<MembershipPlanOption[]>(initialMembershipPlans)
  const [selectedPlanId, setSelectedPlanId] = useState('')

  async function handleConvert() {
    if (!lead) return
    setConverting(true)
    setConvertError(null)
    try {
      const convertBody: Record<string, string> = {}
      if (selectedPlanId) {
        convertBody.membership_plan_id = selectedPlanId
      }
      const res = await fetch(`/api/leads/${lead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(convertBody),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Conversion failed')
      setNewMemberId(json.data.member_id)
      setConvertSuccess(true)
      setLead((prev: any) => ({ ...prev, status: 'converted' }))
      setStatus('converted')
    } catch (err: any) {
      setConvertError(err.message)
    } finally {
      setConverting(false)
    }
  }

  async function handleRescore() {
    if (!lead) return
    setRescoring(true)
    setRescoreError(null)
    try {
      const res = await fetch('/api/leads/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Scoring failed')
      if (json.data?.score !== undefined) {
        setLead((prev: any) => ({ ...prev, score: json.data.score }))
      }
      if (json.data?.factors) {
        setScoreFactors(json.data.factors.map((f: any) => ({
          label: f.label || f.name,
          impact: f.points > 0 ? 'positive' : f.points < 0 ? 'negative' : 'neutral',
          value: (f.points > 0 ? '+' : '') + f.points,
        })))
      }
    } catch (err: any) {
      setRescoreError(err.message)
    } finally {
      setRescoring(false)
    }
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <UserPlus className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">Lead not found</h3>
          <Link href="/marketing/leads" className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-indigo-600">
            <ArrowLeft className="h-4 w-4" /> Back to Leads
          </Link>
        </div>
      </div>
    )
  }

  const currentStatusOption = STATUS_OPTIONS.find((s) => s.value === status)!

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim().toLowerCase())) {
      setTags([...tags, newTag.trim().toLowerCase()])
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        {/* Back Link */}
        <motion.div {...fadeInUp}>
          <Link
            href="/marketing/leads"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Pipeline
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.05 }} className="mb-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-5">
            <ScoreGauge score={lead.score} />
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">
                {lead.firstName} {lead.lastName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {lead.email}
                </span>
                {lead.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {lead.phone}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', currentStatusOption.color)}>
                  {currentStatusOption.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                  <Globe className="h-3 w-3" />
                  {lead.source.charAt(0).toUpperCase() + lead.source.slice(1)}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">Lead since {lead.createdAt}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left — Activity Timeline (2/3) */}
          <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.1 }} className="lg:col-span-2 space-y-4">
            {/* Add Note */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Add Note</label>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note about this lead..."
                rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <div className="mt-3 flex justify-end">
                <button
                  disabled={!newNote.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Add Note
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-5">Activity Timeline</h2>

              <div className="relative space-y-0">
                {/* Vertical line */}
                <div className="absolute left-[17px] top-2 bottom-2 w-px bg-gray-200" />

                {activities.map((activity, idx) => {
                  const Icon = ACTIVITY_ICONS[activity.type]
                  const colorClass = ACTIVITY_COLORS[activity.type]

                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className="relative flex gap-4 pb-6 last:pb-0"
                    >
                      <div className={cn('z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', colorClass)}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-sm text-gray-900 dark:text-gray-100">{activity.description}</p>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-xs text-gray-400 dark:text-gray-500">{activity.timestamp}</span>
                          {activity.performedBy && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-[8px] font-bold text-gray-600 dark:text-gray-400">
                                {activity.performedBy.initials}
                              </span>
                              {activity.performedBy.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>

          {/* Right — Details Panel (1/3) */}
          <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.15 }} className="space-y-4">
            {/* Score Breakdown */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Score Breakdown</h3>
                <button
                  onClick={handleRescore}
                  disabled={rescoring}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  {rescoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Rescore
                </button>
              </div>
              {rescoreError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 mb-3">
                  <p className="text-xs text-red-700">{rescoreError}</p>
                </div>
              )}
              {scoreFactors.length > 0 ? (
                <div className="space-y-2.5">
                  {scoreFactors.map((factor) => (
                    <div key={factor.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {factor.impact === 'positive' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                        {factor.impact === 'negative' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                        {factor.impact === 'neutral' && <Minus className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />}
                        <span className="text-sm text-gray-700 dark:text-gray-300">{factor.label}</span>
                      </div>
                      <span
                        className={cn(
                          'text-xs font-bold tabular-nums',
                          factor.impact === 'positive' && 'text-emerald-600',
                          factor.impact === 'negative' && 'text-red-600',
                          factor.impact === 'neutral' && 'text-gray-500 dark:text-gray-400'
                        )}
                      >
                        {factor.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">Click Rescore to generate score factors.</p>
              )}
            </div>

            {/* Assignment */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Assigned To</h3>
              <div className="relative">
                <select
                  value={assigned}
                  onChange={(e) => setAssigned(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Zach">Zach</option>
                  <option value="Whitney">Whitney Cooper</option>
                  <option value="Unassigned">Unassigned</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              </div>
            </div>

            {/* Status */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Status</h3>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className="w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              </div>
            </div>

            {/* Tags */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-indigo-900 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {tags.length === 0 && <span className="text-xs text-gray-400 dark:text-gray-500">No tags</span>}
              </div>
              <div className="flex gap-2">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Add tag..."
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <button onClick={addTag} className="rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 hover:bg-gray-200 transition-colors">
                  <Plus className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Source Details */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Source Details</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Source</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <Globe className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    Website
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Landing Page</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">/recovery</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">UTM Campaign</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">spring_2026</span>
                </div>
              </div>
            </div>

            {/* Next Follow-up */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Next Follow-up</h3>
              <input
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm space-y-2.5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Quick Actions</h3>
              <button onClick={() => {
                const notes = prompt('Call notes:')
                if (!notes || !lead) return
                fetch(`/api/leads/${lead.id}/activity`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'call_logged', description: notes }),
                }).then(r => r.ok ? window.location.reload() : r.json().then(d => alert(d.error || 'Failed to log activity')))
                  .catch(() => alert('Failed to log activity'))
              }} className="flex w-full items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <PhoneCall className="h-4 w-4 text-violet-500" />
                Log Call
              </button>
              <button onClick={() => { if (lead?.email) window.location.href = `mailto:${lead.email}`; else window.alert('No email available') }} className="flex w-full items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <Send className="h-4 w-4 text-indigo-500" />
                Send Email
              </button>
              {status === 'converted' ? (
                <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Converted to Member
                </div>
              ) : (
                <button
                  onClick={() => setShowConvert(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  <UserCheck className="h-4 w-4" />
                  Convert to Member
                </button>
              )}
            </div>

            {/* Convert Panel */}
            <AnimatePresence>
              {showConvert && (
                <ConvertPanel
                  lead={lead}
                  onClose={() => { setShowConvert(false); setConvertError(null); setConvertSuccess(false); setNewMemberId(null); setSelectedPlanId('') }}
                  converting={converting}
                  convertError={convertError}
                  convertSuccess={convertSuccess}
                  newMemberId={newMemberId}
                  onConfirm={handleConvert}
                  onViewMember={() => newMemberId && router.push(`/members/${newMemberId}`)}
                  membershipPlans={membershipPlans}
                  selectedPlanId={selectedPlanId}
                  onPlanChange={setSelectedPlanId}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
