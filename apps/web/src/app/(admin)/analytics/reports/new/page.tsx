'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Megaphone,
  Mail,
  Plus,
  Save,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  ArrowRightLeft,
  BarChart3,
  AlertTriangle,
  X,
  Layers,
  Loader2,
  AlertCircle,
} from 'lucide-react'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

const stepTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4
type ScheduleFrequency = 'off' | 'daily' | 'weekly' | 'monthly'

interface ReportType {
  id: string
  name: string
  description: string
  icon: typeof Calendar
  iconColor: string
  iconBg: string
  columns: Column[]
}

interface Column {
  id: string
  label: string
  default: boolean
}

interface FilterRule {
  id: string
  field: string
  operator: string
  value: string
}

// ─── Mock Data ──────────────────────────────────────────────
const REPORT_TYPES: ReportType[] = [
  {
    id: 'attendance',
    name: 'Attendance',
    description: 'Track class bookings, check-ins, no-shows, and fill rates.',
    icon: Calendar,
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50',
    columns: [
      { id: 'date', label: 'Date', default: true },
      { id: 'class_name', label: 'Class Name', default: true },
      { id: 'trainer', label: 'Trainer', default: true },
      { id: 'bookings', label: 'Bookings', default: true },
      { id: 'check_ins', label: 'Check-Ins', default: true },
      { id: 'no_shows', label: 'No-Shows', default: true },
      { id: 'fill_rate', label: 'Fill Rate', default: true },
      { id: 'capacity', label: 'Capacity', default: false },
      { id: 'waitlist', label: 'Waitlisted', default: false },
      { id: 'revenue', label: 'Revenue', default: false },
    ],
  },
  {
    id: 'revenue',
    name: 'Revenue',
    description: 'Analyze revenue by source, membership type, and payment method.',
    icon: DollarSign,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    columns: [
      { id: 'date', label: 'Date', default: true },
      { id: 'type', label: 'Revenue Type', default: true },
      { id: 'amount', label: 'Amount', default: true },
      { id: 'member', label: 'Member', default: true },
      { id: 'payment_method', label: 'Payment Method', default: true },
      { id: 'membership_type', label: 'Membership Type', default: false },
      { id: 'refunded', label: 'Refunded', default: false },
    ],
  },
  {
    id: 'membership',
    name: 'Membership',
    description: 'View distribution, upgrades, downgrades, and renewal rates.',
    icon: Users,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    columns: [
      { id: 'member_name', label: 'Member Name', default: true },
      { id: 'plan', label: 'Plan', default: true },
      { id: 'status', label: 'Status', default: true },
      { id: 'start_date', label: 'Start Date', default: true },
      { id: 'next_billing', label: 'Next Billing', default: true },
      { id: 'mrr', label: 'MRR', default: false },
      { id: 'lifetime_value', label: 'Lifetime Value', default: false },
    ],
  },
  {
    id: 'trainer-payroll',
    name: 'Trainer Payroll',
    description: 'Calculate pay based on classes taught, bonuses, and hours.',
    icon: UserCheck,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
    columns: [
      { id: 'trainer', label: 'Trainer', default: true },
      { id: 'classes_taught', label: 'Classes Taught', default: true },
      { id: 'total_hours', label: 'Total Hours', default: true },
      { id: 'base_pay', label: 'Base Pay', default: true },
      { id: 'bonuses', label: 'Bonuses', default: true },
      { id: 'total_pay', label: 'Total Pay', default: true },
    ],
  },
  {
    id: 'trainer-performance',
    name: 'Trainer Performance',
    description: 'Compare trainers by fill rates, ratings, and retention impact.',
    icon: TrendingUp,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
    columns: [
      { id: 'trainer', label: 'Trainer', default: true },
      { id: 'avg_fill_rate', label: 'Avg Fill Rate', default: true },
      { id: 'total_check_ins', label: 'Total Check-Ins', default: true },
      { id: 'avg_rating', label: 'Avg Rating', default: true },
      { id: 'retention_impact', label: 'Retention Impact', default: false },
      { id: 'bonus_classes', label: 'Bonus Classes', default: false },
    ],
  },
  {
    id: 'churn-risk',
    name: 'Churn Risk',
    description: 'Identify at-risk members by visit frequency and engagement.',
    icon: AlertTriangle,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-50',
    columns: [
      { id: 'member', label: 'Member', default: true },
      { id: 'risk_score', label: 'Risk Score', default: true },
      { id: 'last_visit', label: 'Last Visit', default: true },
      { id: 'visit_trend', label: 'Visit Trend', default: true },
      { id: 'membership_plan', label: 'Plan', default: true },
      { id: 'payment_issues', label: 'Payment Issues', default: false },
    ],
  },
  {
    id: 'class-performance',
    name: 'Class Performance',
    description: 'Rank classes by attendance, revenue, and satisfaction.',
    icon: BarChart3,
    iconColor: 'text-cyan-600',
    iconBg: 'bg-cyan-50',
    columns: [
      { id: 'class_name', label: 'Class Name', default: true },
      { id: 'type', label: 'Type', default: true },
      { id: 'avg_attendance', label: 'Avg Attendance', default: true },
      { id: 'avg_fill_rate', label: 'Avg Fill Rate', default: true },
      { id: 'revenue_per_slot', label: 'Revenue/Slot', default: true },
      { id: 'no_show_rate', label: 'No-Show Rate', default: false },
    ],
  },
  {
    id: 'credit-pack-usage',
    name: 'Credit Pack Usage',
    description: 'Monitor credit pack sales, redemptions, and expiry rates.',
    icon: CreditCard,
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-50',
    columns: [
      { id: 'member', label: 'Member', default: true },
      { id: 'pack_type', label: 'Pack Type', default: true },
      { id: 'purchased', label: 'Purchased', default: true },
      { id: 'used', label: 'Used', default: true },
      { id: 'remaining', label: 'Remaining', default: true },
      { id: 'expires', label: 'Expires', default: true },
    ],
  },
  {
    id: 'transaction-log',
    name: 'Transaction Log',
    description: 'Full ledger of payments, refunds, and adjustments.',
    icon: FileText,
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-100',
    columns: [
      { id: 'date', label: 'Date', default: true },
      { id: 'member', label: 'Member', default: true },
      { id: 'type', label: 'Type', default: true },
      { id: 'amount', label: 'Amount', default: true },
      { id: 'method', label: 'Method', default: true },
      { id: 'status', label: 'Status', default: true },
      { id: 'reference', label: 'Reference', default: false },
    ],
  },
  {
    id: 'failed-payments',
    name: 'Failed Payments',
    description: 'Track failed charges, dunning attempts, and recovery rates.',
    icon: XCircle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
    columns: [
      { id: 'date', label: 'Date', default: true },
      { id: 'member', label: 'Member', default: true },
      { id: 'amount', label: 'Amount', default: true },
      { id: 'reason', label: 'Failure Reason', default: true },
      { id: 'dunning_attempt', label: 'Dunning Attempt', default: true },
      { id: 'recovered', label: 'Recovered', default: true },
    ],
  },
  {
    id: 'member-movement',
    name: 'Member Movement',
    description: 'New joins, cancellations, pauses, and net growth over time.',
    icon: ArrowRightLeft,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    columns: [
      { id: 'date', label: 'Date', default: true },
      { id: 'new_joins', label: 'New Joins', default: true },
      { id: 'cancellations', label: 'Cancellations', default: true },
      { id: 'pauses', label: 'Pauses', default: true },
      { id: 'reactivations', label: 'Reactivations', default: true },
      { id: 'net_change', label: 'Net Change', default: true },
    ],
  },
  {
    id: 'campaign-performance',
    name: 'Campaign Performance',
    description: 'Measure email/SMS open rates, clicks, and conversions.',
    icon: Megaphone,
    iconColor: 'text-pink-600',
    iconBg: 'bg-pink-50',
    columns: [
      { id: 'campaign', label: 'Campaign', default: true },
      { id: 'channel', label: 'Channel', default: true },
      { id: 'sent', label: 'Sent', default: true },
      { id: 'open_rate', label: 'Open Rate', default: true },
      { id: 'click_rate', label: 'Click Rate', default: true },
      { id: 'conversions', label: 'Conversions', default: true },
    ],
  },
  {
    id: 'lead-pipeline',
    name: 'Lead Pipeline',
    description: 'Track leads by stage, source, conversion rate, and time to close.',
    icon: Target,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-50',
    columns: [
      { id: 'lead', label: 'Lead', default: true },
      { id: 'source', label: 'Source', default: true },
      { id: 'stage', label: 'Stage', default: true },
      { id: 'created', label: 'Created', default: true },
      { id: 'days_in_stage', label: 'Days in Stage', default: true },
      { id: 'value', label: 'Value', default: false },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Report',
    description: 'Build a custom report from scratch with any columns and filters.',
    icon: Layers,
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-100',
    columns: [
      { id: 'date', label: 'Date', default: true },
      { id: 'member', label: 'Member', default: false },
      { id: 'class', label: 'Class', default: false },
      { id: 'trainer', label: 'Trainer', default: false },
      { id: 'amount', label: 'Amount', default: false },
      { id: 'type', label: 'Type', default: false },
      { id: 'status', label: 'Status', default: false },
    ],
  },
]

const FIELD_OPTIONS = ['Class Name', 'Trainer', 'Date', 'Fill Rate', 'Bookings', 'Check-Ins', 'No-Shows']
const OPERATOR_OPTIONS = ['equals', 'not equals', 'greater than', 'less than', 'contains', 'between']
const GROUP_BY_OPTIONS = ['None', 'Day', 'Week', 'Month', 'Membership Type', 'Trainer', 'Class']
const TIME_RANGE_OPTIONS = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'Last 12 months', 'Custom range']

const PREVIEW_DATA = [
  { date: 'Mar 19, 2026', class: 'Guided Breathwork', trainer: 'Whitney Cooper', bookings: 11, checkIns: 10, noShows: 1, fillRate: '83%' },
  { date: 'Mar 19, 2026', class: 'Open Sauna — Evening', trainer: 'Marcus Rivera', bookings: 9, checkIns: 8, noShows: 1, fillRate: '67%' },
  { date: 'Mar 18, 2026', class: 'Guided Breathwork', trainer: 'Whitney Cooper', bookings: 12, checkIns: 11, noShows: 1, fillRate: '92%' },
  { date: 'Mar 18, 2026', class: 'Open Sauna — Morning', trainer: 'Aisha Patel', bookings: 7, checkIns: 7, noShows: 0, fillRate: '58%' },
  { date: 'Mar 18, 2026', class: 'Cold Plunge Intro', trainer: 'Jordan Lee', bookings: 10, checkIns: 9, noShows: 1, fillRate: '75%' },
  { date: 'Mar 17, 2026', class: 'Open Sauna — Evening', trainer: 'Marcus Rivera', bookings: 8, checkIns: 7, noShows: 1, fillRate: '58%' },
  { date: 'Mar 17, 2026', class: 'Recovery Flow', trainer: 'Aisha Patel', bookings: 6, checkIns: 6, noShows: 0, fillRate: '50%' },
  { date: 'Mar 16, 2026', class: 'Guided Breathwork', trainer: 'Whitney Cooper', bookings: 11, checkIns: 10, noShows: 1, fillRate: '83%' },
  { date: 'Mar 16, 2026', class: 'Open Sauna — Morning', trainer: 'Jordan Lee', bookings: 9, checkIns: 8, noShows: 1, fillRate: '67%' },
  { date: 'Mar 15, 2026', class: 'Cold Plunge Intro', trainer: 'Marcus Rivera', bookings: 10, checkIns: 10, noShows: 0, fillRate: '83%' },
]

// ─── Component ──────────────────────────────────────────────
export default function ReportBuilderPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterRule[]>([])
  const [timeRange, setTimeRange] = useState('Last 30 days')
  const [groupBy, setGroupBy] = useState('None')
  const [reportName, setReportName] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [scheduleFrequency, setScheduleFrequency] = useState<ScheduleFrequency>('off')
  const [scheduleDay, setScheduleDay] = useState('Monday')
  const [scheduleDate, setScheduleDate] = useState('1')
  const [recipients, setRecipients] = useState<string[]>([])
  const [newRecipient, setNewRecipient] = useState('')
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const selectedReportType = useMemo(
    () => REPORT_TYPES.find((t) => t.id === selectedType),
    [selectedType]
  )

  function handleSelectType(id: string) {
    setSelectedType(id)
    const rt = REPORT_TYPES.find((t) => t.id === id)
    if (rt) {
      setSelectedColumns(rt.columns.filter((c) => c.default).map((c) => c.id))
    }
  }

  function toggleColumn(colId: string) {
    setSelectedColumns((prev) =>
      prev.includes(colId) ? prev.filter((c) => c !== colId) : [...prev, colId]
    )
  }

  function addFilter() {
    setFilters((prev) => [
      ...prev,
      { id: `filter-${Date.now()}`, field: FIELD_OPTIONS[0], operator: OPERATOR_OPTIONS[0], value: '' },
    ])
  }

  function updateFilter(id: string, key: keyof FilterRule, value: string) {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: value } : f)))
  }

  function removeFilter(id: string) {
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }

  function addRecipient() {
    if (newRecipient && !recipients.includes(newRecipient)) {
      setRecipients((prev) => [...prev, newRecipient])
      setNewRecipient('')
    }
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r !== email))
  }

  async function handleSaveReport() {
    if (!reportName.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName.trim(),
          description: reportDescription.trim() || null,
          type: selectedType,
          columns: selectedColumns,
          filters: filters.map(({ field, operator, value }) => ({ field, operator, value })),
          time_range: timeRange,
          group_by: groupBy,
          schedule_frequency: scheduleFrequency,
          schedule_day: scheduleFrequency === 'weekly' ? scheduleDay : null,
          schedule_date: scheduleFrequency === 'monthly' ? Number(scheduleDate) : null,
          recipients,
          export_format: exportFormat,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save report')
      router.push('/analytics/reports')
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const STEP_LABELS = ['Choose Type', 'Configure', 'Preview', 'Save & Schedule']

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <motion.div {...fadeInUp} className="mb-8 flex items-center gap-3">
          <Link
            href="/analytics/reports"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Report</h1>
            <p className="mt-0.5 text-xs text-gray-400">
              Build a custom report in 4 steps.
            </p>
          </div>
        </motion.div>

        {/* Step Indicator */}
        <motion.div {...fadeInUp} className="mb-8">
          <div className="flex items-center gap-2">
            {STEP_LABELS.map((label, i) => {
              const stepNum = (i + 1) as Step
              const isActive = step === stepNum
              const isCompleted = step > stepNum
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && (
                    <div
                      className={cn(
                        'h-px w-8',
                        isCompleted || isActive ? 'bg-indigo-300' : 'bg-gray-200'
                      )}
                    />
                  )}
                  <button
                    onClick={() => {
                      if (isCompleted) setStep(stepNum)
                    }}
                    disabled={!isCompleted && !isActive}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isCompleted
                          ? 'bg-indigo-50 text-indigo-700 cursor-pointer hover:bg-indigo-100'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                        {stepNum}
                      </span>
                    )}
                    {label}
                  </button>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ─── Step Content ───────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {/* Step 1: Choose Type */}
          {step === 1 && (
            <motion.div key="step-1" {...stepTransition}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                Select Report Type
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {REPORT_TYPES.map((type, i) => {
                  const Icon = type.icon
                  const isSelected = selectedType === type.id
                  return (
                    <motion.button
                      key={type.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.025, ease: [0.25, 1, 0.5, 1] }}
                      onClick={() => handleSelectType(type.id)}
                      className={cn(
                        'group relative flex flex-col items-start rounded-2xl border bg-white p-5 shadow-sm text-left transition hover:shadow-md',
                        isSelected
                          ? 'border-indigo-400 ring-2 ring-indigo-600/20'
                          : 'border-gray-200 hover:border-indigo-200'
                      )}
                    >
                      {isSelected && (
                        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl',
                          type.iconBg
                        )}
                      >
                        <Icon className={cn('h-5 w-5', type.iconColor)} />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">{type.name}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">
                        {type.description}
                      </p>
                    </motion.button>
                  )
                })}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => step === 1 && selectedType && setStep(2)}
                  disabled={!selectedType}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition',
                    selectedType
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && selectedReportType && (
            <motion.div key="step-2" {...stepTransition}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left: Column Selector */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                    Columns
                  </p>
                  <p className="mb-3 text-xs text-gray-500">
                    Select which columns to include in your report.
                  </p>
                  <div className="space-y-2">
                    {selectedReportType.columns.map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-gray-50 cursor-pointer"
                      >
                        <div
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-md border-2 transition',
                            selectedColumns.includes(col.id)
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-gray-300 bg-white'
                          )}
                        >
                          {selectedColumns.includes(col.id) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Right: Filters, Time Range, Group By */}
                <div className="space-y-6">
                  {/* Filters */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                      Filters
                    </p>

                    {filters.length === 0 ? (
                      <p className="mb-3 text-xs text-gray-400">
                        No filters added. All data will be included.
                      </p>
                    ) : (
                      <div className="space-y-3 mb-4">
                        {filters.map((filter) => (
                          <div
                            key={filter.id}
                            className="flex items-center gap-2"
                          >
                            <select
                              value={filter.field}
                              onChange={(e) => updateFilter(filter.id, 'field', e.target.value)}
                              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600/10"
                            >
                              {FIELD_OPTIONS.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                            <select
                              value={filter.operator}
                              onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                              className="w-32 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600/10"
                            >
                              {OPERATOR_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Value..."
                              value={filter.value}
                              onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600/10"
                            />
                            <button
                              onClick={() => removeFilter(filter.id)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={addFilter}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Filter
                    </button>
                  </div>

                  {/* Time Range */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                      Time Range
                    </p>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600/10"
                    >
                      {TIME_RANGE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Group By */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                      Group By
                    </p>
                    <select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600/10"
                    >
                      {GROUP_BY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={selectedColumns.length === 0}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition',
                    selectedColumns.length > 0
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <motion.div key="step-3" {...stepTransition}>
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Data Preview
                  </p>
                  <p className="text-xs text-gray-500">
                    Showing first 10 rows. Full report will be generated upon save.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/40">
                        <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Date
                        </th>
                        <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Class
                        </th>
                        <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Trainer
                        </th>
                        <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Bookings
                        </th>
                        <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Check-Ins
                        </th>
                        <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          No-Shows
                        </th>
                        <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Fill Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {PREVIEW_DATA.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition"
                        >
                          <td className="px-5 py-3 text-sm text-gray-600">{row.date}</td>
                          <td className="px-5 py-3 text-sm font-medium text-gray-900">{row.class}</td>
                          <td className="px-5 py-3 text-sm text-gray-700">{row.trainer}</td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums font-medium text-gray-900">
                            {row.bookings}
                          </td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums font-medium text-emerald-600">
                            {row.checkIns}
                          </td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums font-medium text-red-500">
                            {row.noShows}
                          </td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums font-semibold text-gray-900">
                            {row.fillRate}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Configure
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
                >
                  Looks Good
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Save & Schedule */}
          {step === 4 && (
            <motion.div key="step-4" {...stepTransition}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left: Report Info */}
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                      Report Details
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                          Report Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Weekly Attendance Summary"
                          value={reportName}
                          onChange={(e) => setReportName(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/10"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                          Description <span className="text-xs font-normal text-gray-400">(optional)</span>
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Briefly describe what this report tracks..."
                          value={reportDescription}
                          onChange={(e) => setReportDescription(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Default Export Format */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                      Default Export Format
                    </p>
                    <div className="flex gap-3">
                      {(['csv', 'pdf'] as const).map((fmt) => (
                        <label
                          key={fmt}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 transition',
                            exportFormat === fmt
                              ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-600/20'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded-full border-2',
                              exportFormat === fmt
                                ? 'border-indigo-600'
                                : 'border-gray-300'
                            )}
                          >
                            {exportFormat === fmt && (
                              <div className="h-2 w-2 rounded-full bg-indigo-600" />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-700 uppercase">
                            {fmt}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Schedule & Recipients */}
                <div className="space-y-6">
                  {/* Schedule */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                      Schedule
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(
                        [
                          { key: 'off', label: 'Manual Only' },
                          { key: 'daily', label: 'Daily' },
                          { key: 'weekly', label: 'Weekly' },
                          { key: 'monthly', label: 'Monthly' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setScheduleFrequency(opt.key)}
                          className={cn(
                            'rounded-lg border px-4 py-2 text-xs font-semibold transition',
                            scheduleFrequency === opt.key
                              ? 'border-indigo-400 bg-indigo-600 text-white'
                              : 'border-gray-200 text-gray-600 hover:border-indigo-200 hover:text-indigo-600'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {scheduleFrequency === 'weekly' && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                          Day of Week
                        </label>
                        <select
                          value={scheduleDay}
                          onChange={(e) => setScheduleDay(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600/10"
                        >
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                            (d) => (
                              <option key={d} value={d}>{d}</option>
                            )
                          )}
                        </select>
                      </div>
                    )}

                    {scheduleFrequency === 'monthly' && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                          Day of Month
                        </label>
                        <select
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600/10"
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={String(d)}>
                              {d === 1 ? '1st' : d === 2 ? '2nd' : d === 3 ? '3rd' : `${d}th`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {scheduleFrequency === 'off' && (
                      <p className="text-xs text-gray-400">
                        Report will only run when manually triggered.
                      </p>
                    )}
                  </div>

                  {/* Recipients */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                      Recipients
                    </p>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="email"
                        placeholder="Enter email address..."
                        value={newRecipient}
                        onChange={(e) => setNewRecipient(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-600/10"
                      />
                      <button
                        onClick={addRecipient}
                        className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        Add
                      </button>
                    </div>

                    {recipients.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        No recipients added. Reports will only be available in the dashboard.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {recipients.map((email) => (
                          <div
                            key={email}
                            className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-sm text-gray-700">{email}</span>
                            </div>
                            <button
                              onClick={() => removeRecipient(email)}
                              className="rounded p-0.5 text-gray-400 hover:text-red-500 transition"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {saveError && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{saveError}</p>
                </div>
              )}

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={handleSaveReport}
                  disabled={!reportName.trim() || saving}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition',
                    reportName.trim() && !saving
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Report
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
