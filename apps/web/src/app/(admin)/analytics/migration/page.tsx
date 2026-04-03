'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Database,
  Users,
  CalendarDays,
  CreditCard,
  Ticket,
  Wallet,
  Crown,
  Check,
  CheckCircle2,
  Circle,
  Upload,
  FileText,
  AlertTriangle,
  Clock,
  RotateCcw,
  Search,
  ChevronRight,
  ChevronDown,
  X,
  ArrowRight,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  FileUp,
  AlertCircle,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// ─── Types ──────────────────────────────────────────────────

type ImportStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Failed'
type WaveStep = 1 | 2 | 3
type MigrationStatus = 'Unassigned' | 'Wave 2' | 'Wave 3' | 'Migrated'
type BillingStatus = 'Not Started' | 'Ready to Activate' | 'Active'

interface DataType {
  id: string
  name: string
  icon: any
  status: ImportStatus
  rowCount: number | null
  validRows?: number
  invalidRows?: number
  warnings?: number
}

interface MigrationJob {
  id: string
  dataType: string
  wave: WaveStep
  status: 'Completed' | 'Failed' | 'Rolled Back'
  successRows: number
  errorRows: number
  skipRows: number
  startedAt: string
  completedAt: string
  canRollback: boolean
}

interface MemberAssignment {
  id: string
  name: string
  email: string
  glofoxRenewalDate: string
  migrationStatus: MigrationStatus
}

interface PilotMember {
  id: string
  name: string
  glofoxRenewalDate: string
  billingStatus: BillingStatus
  renewalPassed: boolean
}

// ─── Constants ──────────────────────────────────────────────
const STUDIO_ID = DEFAULT_STUDIO_ID

const DEFAULT_DATA_TYPES: DataType[] = [
  { id: 'members', name: 'Members', icon: Users, status: 'Not Started', rowCount: null },
  { id: 'bookings', name: 'Bookings', icon: CalendarDays, status: 'Not Started', rowCount: null },
  { id: 'transactions', name: 'Transactions', icon: CreditCard, status: 'Not Started', rowCount: null },
  { id: 'classes', name: 'Classes', icon: Ticket, status: 'Not Started', rowCount: null },
  { id: 'credits', name: 'Credit Balances', icon: Wallet, status: 'Not Started', rowCount: null },
  { id: 'memberships', name: 'Memberships', icon: Crown, status: 'Not Started', rowCount: null },
]

// ─── Helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_STYLES: Record<ImportStatus, { bg: string; text: string }> = {
  'Not Started': { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
  'In Progress': { bg: 'bg-blue-50', text: 'text-blue-700' },
  'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'Failed': { bg: 'bg-red-50', text: 'text-red-700' },
}

const JOB_STATUS_STYLES: Record<string, string> = {
  'Completed': 'bg-emerald-50 text-emerald-700',
  'Failed': 'bg-red-50 text-red-700',
  'Rolled Back': 'bg-amber-50 text-amber-700',
}

const BILLING_STATUS_STYLES: Record<BillingStatus, { bg: string; text: string; icon: any }> = {
  'Not Started': { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: Circle },
  'Ready to Activate': { bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
  'Active': { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
}

// ─── Upload Flow Sub-Component ──────────────────────────────

type UploadStep = 'upload' | 'validate' | 'import' | 'complete'

interface UploadFlowProps {
  dataType: DataType
  onClose: () => void
}

function UploadFlow({ dataType, onClose }: UploadFlowProps) {
  const [step, setStep] = useState<UploadStep>(
    dataType.status === 'Completed' ? 'complete' : 'upload'
  )
  const [progress, setProgress] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)

  // Mock validation data
  const validRows = dataType.validRows ?? 247
  const invalidRows = dataType.invalidRows ?? 3
  const warnings = dataType.warnings ?? 5
  const totalRows = validRows + invalidRows

  const sampleData = [
    ['John Smith', 'john@gmail.com', 'Unlimited', '2025-06-15', 'Active'],
    ['Amy Chen', 'amy.chen@yahoo.com', '10-Class', '2025-08-22', 'Active'],
    ['Mark Wilson', 'mark.w@outlook.com', '6-Class', '2025-09-01', 'Expired'],
    ['Lisa Park', 'lisa.p@icloud.com', 'Student', '2025-07-10', 'Active'],
    ['Tom Brown', 'tbrown@gmail.com', 'Drop-in', '—', 'Active'],
  ]

  const handleUpload = () => {
    setStep('validate')
  }

  const handleImport = () => {
    setStep('import')
    // Simulate progress
    let p = 0
    const interval = setInterval(() => {
      p += Math.random() * 15
      if (p >= 100) {
        p = 100
        clearInterval(interval)
        setTimeout(() => setStep('complete'), 500)
      }
      setProgress(Math.round(p))
    }, 300)
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t border-gray-100 dark:border-gray-800 mt-4 pt-4"
    >
      {/* Step Indicators */}
      <div className="flex items-center gap-2 mb-5">
        {(['upload', 'validate', 'import', 'complete'] as UploadStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                step === s && 'bg-indigo-600 text-white',
                (['upload', 'validate', 'import', 'complete'].indexOf(step) > i) && 'bg-emerald-500 text-white',
                (['upload', 'validate', 'import', 'complete'].indexOf(step) < i) && 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
              )}
            >
              {(['upload', 'validate', 'import', 'complete'].indexOf(step) > i) ? (
                <Check className="w-3 h-3" />
              ) : (
                i + 1
              )}
            </div>
            <span className={cn(
              'text-xs font-medium capitalize',
              step === s ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
            )}>
              {s}
            </span>
            {i < 3 && <div className="w-8 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleUpload() }}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
            isDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900'
          )}
        >
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 flex items-center justify-center mx-auto mb-3">
            <FileUp className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Drag and drop your CSV file here
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            or{' '}
            <button onClick={handleUpload} className="text-indigo-600 hover:text-indigo-700 font-medium underline">
              browse files
            </button>
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Accepted format: .csv (max 50MB)
          </p>
        </div>
      )}

      {/* Validate Step */}
      {step === 'validate' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Valid Rows</p>
              <p className="text-lg font-black tabular-nums text-emerald-700">{validRows.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">Invalid Rows</p>
              <p className="text-lg font-black tabular-nums text-red-700">{invalidRows}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1">Warnings</p>
              <p className="text-lg font-black tabular-nums text-amber-700">{warnings}</p>
            </div>
          </div>

          {/* Sample Table */}
          <div className="overflow-x-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
              Preview (first 5 rows)
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  {['Name', 'Email', 'Plan', 'Start Date', 'Status'].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sampleData.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="py-2 pr-4 text-sm text-gray-700 dark:text-gray-300">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Import {validRows.toLocaleString()} Valid Rows
          </button>
        </div>
      )}

      {/* Import Step */}
      {step === 'import' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Importing...</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-indigo-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <motion.div
              className="bg-indigo-600 h-2.5 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{Math.round((validRows * progress) / 100).toLocaleString()} / {validRows.toLocaleString()} rows</span>
            <span>~{Math.max(1, Math.round((100 - progress) / 12))}s remaining</span>
          </div>
        </div>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">Import Complete</p>
              <p className="text-xs text-emerald-700">
                {(dataType.rowCount ?? validRows).toLocaleString()} rows imported, {invalidRows} skipped (duplicates), {dataType.invalidRows ?? 3} errors
              </p>
            </div>
          </div>
          <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            View {dataType.invalidRows ?? 3} Errors
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Page Component ──────────────────────────────────────────

export default function MigrationAdminPage() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [members, setMembers] = useState<MemberAssignment[]>([])
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrationJobs, setMigrationJobs] = useState<MigrationJob[]>([])
  const [dataTypes, setDataTypes] = useState<DataType[]>(DEFAULT_DATA_TYPES)
  const [pilotMembers, setPilotMembers] = useState<PilotMember[]>([])

  useEffect(() => {
    async function fetchMigrationData() {
      const supabase = createBrowserClient()

      // Fetch migration jobs
      const { data: jobs } = await supabase
        .from('migration_jobs')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .order('created_at', { ascending: false })

      if (jobs && jobs.length > 0) {
        setMigrationJobs(jobs.map((j: any) => ({
          id: j.id,
          dataType: j.data_type ?? '',
          wave: j.wave ?? 1,
          status: j.status ?? 'Completed',
          successRows: j.success_rows ?? 0,
          errorRows: j.error_rows ?? 0,
          skipRows: j.skip_rows ?? 0,
          startedAt: j.started_at ?? '',
          completedAt: j.completed_at ?? '',
          canRollback: j.can_rollback ?? false,
        })))
      }

      setLoading(false)
    }
    fetchMigrationData()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] dark:bg-[#0F0F11]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const currentWave: WaveStep = 1
  const waveSteps = [
    { wave: 1 as WaveStep, label: 'Data Import', description: 'Import Glofox data into Meridian', complete: false },
    { wave: 2 as WaveStep, label: 'Internal Testing', description: 'Staff validates migrated data', complete: false },
    { wave: 3 as WaveStep, label: 'Pilot Group', description: 'Migrate selected members to Meridian billing', complete: false },
  ]

  const filteredUnassigned = members.filter(
    (m) =>
      m.migrationStatus === 'Unassigned' &&
      (m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase()))
  )

  const wave2Members = members.filter((m) => m.migrationStatus === 'Wave 2')
  const wave3Members = members.filter((m) => m.migrationStatus === 'Wave 3')

  const assignMember = (memberId: string, wave: MigrationStatus) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, migrationStatus: wave } : m))
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header ──────────────────────────────────── */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Database className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Glofox Migration</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Import data and manage the 3-wave migration process
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">Wave 1 in progress</span>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          </div>
        </motion.div>

        {/* ─── Wave Progress Tracker ──────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.05 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-5">
            Migration Progress
          </p>
          <div className="flex items-center gap-0">
            {waveSteps.map((step, i) => {
              const isActive = step.wave === currentWave
              const isComplete = step.complete
              const isFuture = step.wave > currentWave
              return (
                <div key={step.wave} className="flex items-center flex-1">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                        isComplete && 'bg-emerald-500 text-white',
                        isActive && 'bg-indigo-600 text-white ring-4 ring-indigo-100',
                        isFuture && 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                      )}
                    >
                      {isComplete ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">{step.wave}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        'text-sm font-semibold truncate',
                        isActive ? 'text-gray-900 dark:text-gray-100' : isFuture ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'
                      )}>
                        {step.label}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{step.description}</p>
                    </div>
                  </div>
                  {i < waveSteps.length - 1 && (
                    <div className={cn(
                      'h-px flex-1 mx-4',
                      step.complete ? 'bg-emerald-300' : 'bg-gray-200'
                    )} />
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ─── Import Section ─────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
            Data Import
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEFAULT_DATA_TYPES.map((dt) => {
              const Icon = dt.icon
              const statusStyle = STATUS_STYLES[dt.status]
              const isExpanded = expandedCard === dt.id
              return (
                <motion.div
                  key={dt.id}
                  layout
                  className={cn(
                    'bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 cursor-pointer transition-all hover:shadow-md',
                    isExpanded && 'sm:col-span-2 lg:col-span-3'
                  )}
                  onClick={() => setExpandedCard(isExpanded ? null : dt.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{dt.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest',
                            statusStyle.bg, statusStyle.text
                          )}>
                            {dt.status}
                          </span>
                          {dt.rowCount !== null && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                              {dt.rowCount.toLocaleString()} rows
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <UploadFlow
                        dataType={dt}
                        onClose={() => setExpandedCard(null)}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* ─── Migration Job History ──────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Migration Job History</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Track all import operations</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {migrationJobs.length} Jobs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Data Type', 'Wave', 'Status', 'Rows (Success / Error / Skip)', 'Started', 'Completed', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 pr-4 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {migrationJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="py-3 pr-4">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{job.dataType}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                        {job.wave}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest',
                        JOB_STATUS_STYLES[job.status]
                      )}>
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                        <span className="text-emerald-600 font-semibold">{job.successRows.toLocaleString()}</span>
                        {' / '}
                        <span className="text-red-600 font-semibold">{job.errorRows}</span>
                        {' / '}
                        <span className="text-amber-600 font-semibold">{job.skipRows}</span>
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{job.startedAt}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{job.completedAt}</span>
                    </td>
                    <td className="py-3">
                      {job.canRollback && (
                        <>
                          {rollbackConfirm === job.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setRollbackConfirm(null)}
                                className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setRollbackConfirm(null)}
                                className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRollbackConfirm(job.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Rollback
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ─── Member Wave Assignment ─────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
            Member Wave Assignment
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Unassigned */}
            <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Unassigned Members</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{filteredUnassigned.length} members</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:bg-gray-950 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-all outline-none"
                />
              </div>

              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {filteredUnassigned.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{member.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{member.email}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        Renewal: {formatDate(member.glofoxRenewalDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => assignMember(member.id, 'Wave 2')}
                        className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                      >
                        Wave 2
                      </button>
                      <button
                        onClick={() => assignMember(member.id, 'Wave 3')}
                        className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                      >
                        Wave 3
                      </button>
                    </div>
                  </div>
                ))}
                {filteredUnassigned.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-400 dark:text-gray-500">No unassigned members found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Wave 2 & Wave 3 */}
            <div className="space-y-4">
              {/* Wave 2 */}
              <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">2</span>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Wave 2 — Internal Testing</h3>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{wave2Members.length} members</span>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {wave2Members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2.5 bg-indigo-50/50 rounded-xl group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{member.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{member.email}</p>
                      </div>
                      <button
                        onClick={() => assignMember(member.id, 'Unassigned')}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white dark:bg-gray-950 rounded-lg transition-all flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                      </button>
                    </div>
                  ))}
                  {wave2Members.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No members assigned</p>
                  )}
                </div>
              </div>

              {/* Wave 3 */}
              <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">3</span>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Wave 3 — Pilot Group</h3>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{wave3Members.length} members</span>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {wave3Members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2.5 bg-violet-50/50 rounded-xl group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{member.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{member.email}</p>
                      </div>
                      <button
                        onClick={() => assignMember(member.id, 'Unassigned')}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white dark:bg-gray-950 rounded-lg transition-all flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                      </button>
                    </div>
                  ))}
                  {wave3Members.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No members assigned</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── Double-Billing Guard Panel ─────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.25 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Double-Billing Guard</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Ensure Glofox renewal has passed before activating Meridian billing
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Member', 'Glofox Renewal Date', 'Meridian Billing Status', 'Safe to Activate'].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pilotMembers.map((member) => {
                  const billingStyle = BILLING_STATUS_STYLES[member.billingStatus]
                  const BillingIcon = billingStyle.icon
                  const isSafe = member.renewalPassed
                  return (
                    <tr key={member.id}>
                      <td className="py-3 pr-4">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                          {formatDate(member.glofoxRenewalDate)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest',
                          billingStyle.bg, billingStyle.text
                        )}>
                          <BillingIcon className="w-3 h-3" />
                          {member.billingStatus}
                        </span>
                      </td>
                      <td className="py-3">
                        {isSafe ? (
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-semibold text-emerald-600">Safe</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-red-500" />
                            <span className="text-xs font-semibold text-red-600">
                              Renewal not passed
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
