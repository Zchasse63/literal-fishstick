'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Calendar,
  DollarSign,
  Users,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  CreditCard,
  FileText,
  XCircle,
  ArrowRightLeft,
  Megaphone,
  Target,
  Plus,
  Play,
  Download,
  FileDown,
  Pencil,
  Trash2,
  MoreHorizontal,
  Clock,
  Search,
  Sparkles,
  Info,
} from 'lucide-react'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
interface ReportTemplate {
  id: string
  name: string
  description: string
  icon: typeof Calendar
  iconColor: string
  iconBg: string
  requiresModule?: string
}

interface SavedReport {
  id: string
  name: string
  type: string
  typeBadgeColor: string
  lastGenerated: string
  schedule: string
}

// ─── Report Templates (static config) ───────────────────────
const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'attendance',
    name: 'Attendance',
    description: 'Track class bookings, check-ins, no-shows, and fill rates across all time slots.',
    icon: Calendar,
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50',
  },
  {
    id: 'revenue',
    name: 'Revenue',
    description: 'Analyze revenue by source, membership type, day, and payment method.',
    icon: DollarSign,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
  },
  {
    id: 'membership',
    name: 'Membership',
    description: 'View membership distribution, upgrades, downgrades, and renewal rates.',
    icon: Users,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
  },
  {
    id: 'trainer-payroll',
    name: 'Trainer Payroll',
    description: 'Calculate trainer pay based on classes taught, bonuses earned, and hours logged.',
    icon: UserCheck,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
  },
  {
    id: 'trainer-performance',
    name: 'Trainer Performance',
    description: 'Compare trainers by class fill rates, member ratings, and retention impact.',
    icon: TrendingUp,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
  },
  {
    id: 'churn-risk',
    name: 'Churn Risk',
    description: 'Identify at-risk members based on visit frequency, engagement drop, and payment issues.',
    icon: AlertTriangle,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-50',
  },
  {
    id: 'class-performance',
    name: 'Class Performance',
    description: 'Rank classes by attendance, revenue per slot, and member satisfaction.',
    icon: BarChart3,
    iconColor: 'text-cyan-600',
    iconBg: 'bg-cyan-50',
  },
  {
    id: 'credit-pack-usage',
    name: 'Credit Pack Usage',
    description: 'Monitor credit pack sales, redemption rates, expiry, and remaining balances.',
    icon: CreditCard,
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-50',
  },
  {
    id: 'transaction-log',
    name: 'Transaction Log',
    description: 'Full ledger of all payments, refunds, adjustments, and gift card redemptions.',
    icon: FileText,
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-100',
  },
  {
    id: 'failed-payments',
    name: 'Failed Payments',
    description: 'Track failed charges, dunning attempts, and recovery rates by payment method.',
    icon: XCircle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
  },
  {
    id: 'member-movement',
    name: 'Member Movement',
    description: 'New joins, cancellations, pauses, reactivations, and net member growth over time.',
    icon: ArrowRightLeft,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
  },
  {
    id: 'campaign-performance',
    name: 'Campaign Performance',
    description: 'Measure email/SMS open rates, click-throughs, conversions, and revenue attribution.',
    icon: Megaphone,
    iconColor: 'text-pink-600',
    iconBg: 'bg-pink-50',
    requiresModule: 'Marketing',
  },
  {
    id: 'lead-pipeline',
    name: 'Lead Pipeline',
    description: 'Track leads by stage, source, conversion rate, and average time to close.',
    icon: Target,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-50',
    requiresModule: 'Marketing',
  },
]

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

const TYPE_BADGE_COLORS: Record<string, string> = {
  Attendance: 'bg-indigo-50 text-indigo-700',
  Revenue: 'bg-emerald-50 text-emerald-700',
  'Trainer Payroll': 'bg-violet-50 text-violet-700',
  'Trainer Performance': 'bg-purple-50 text-purple-700',
  'Churn Risk': 'bg-orange-50 text-orange-700',
  'Class Performance': 'bg-cyan-50 text-cyan-700',
  'Credit Pack Usage': 'bg-teal-50 text-teal-700',
  'Transaction Log': 'bg-gray-100 text-gray-700',
  'Failed Payments': 'bg-red-50 text-red-700',
  'Member Movement': 'bg-amber-50 text-amber-700',
  Membership: 'bg-blue-50 text-blue-700',
}

// ─── Component ──────────────────────────────────────────────
export default function ReportLibraryPage() {
  const [search, setSearch] = useState('')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [savedReports, setSavedReports] = useState<SavedReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReports() {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('saved_reports')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setSavedReports(data.map((r: any) => ({
          id: r.id,
          name: r.name ?? 'Untitled Report',
          type: r.type ?? 'Attendance',
          typeBadgeColor: TYPE_BADGE_COLORS[r.type] ?? 'bg-gray-100 text-gray-700',
          lastGenerated: r.last_generated_at ? new Date(r.last_generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
          schedule: r.schedule ?? 'Manual',
        })))
      }
      setLoading(false)
    }
    fetchReports()
  }, [])

  const filteredTemplates = REPORT_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  )

  const filteredReports = savedReports.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.type.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <motion.div {...fadeInUp} className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="mt-1 text-sm text-gray-500">
              Build, schedule, and export reports from your studio data.
            </p>
          </div>
          <Link
            href="/analytics/reports/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Report
          </Link>
        </motion.div>

        {/* Search */}
        <motion.div {...fadeInUp} className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates and saved reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/10"
            />
          </div>
        </motion.div>

        {/* ─── Templates Section ─────────────────────────────── */}
        <motion.div {...fadeInUp}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            Report Templates
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTemplates.map((template, i) => {
              const Icon = template.icon
              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: i * 0.03,
                    ease: [0.25, 1, 0.5, 1],
                  }}
                  className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-indigo-200"
                >
                  {template.requiresModule && (
                    <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                      <Info className="h-3 w-3" />
                      Requires {template.requiresModule} module
                    </div>
                  )}
                  <div
                    className={cn(
                      'mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl',
                      template.iconBg
                    )}
                  >
                    <Icon className={cn('h-5 w-5', template.iconColor)} />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">{template.name}</h3>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-gray-500">
                    {template.description}
                  </p>
                  <Link
                    href={`/analytics/reports/new?type=${template.id}`}
                    className={cn(
                      'mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
                      template.requiresModule
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Report
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* ─── Saved Reports Section ─────────────────────────── */}
        <motion.div
          {...fadeInUp}
          className="mt-12"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            Saved Reports
          </p>

          {filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 shadow-sm text-center">
              <FileText className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-500">
                No saved reports yet.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Create one from a template above.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Report Name
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Type
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Last Generated
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Schedule
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-b border-gray-50 transition hover:bg-gray-50/50 last:border-0"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/analytics/reports/${report.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition"
                        >
                          {report.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                            report.typeBadgeColor
                          )}
                        >
                          {report.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">
                        {report.lastGenerated}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-medium',
                            report.schedule === 'Manual'
                              ? 'text-gray-400'
                              : 'text-indigo-600'
                          )}
                        >
                          <Clock className="h-3 w-3" />
                          {report.schedule}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() =>
                              setOpenDropdown(
                                openDropdown === report.id ? null : report.id
                              )
                            }
                            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          <AnimatePresence>
                            {openDropdown === report.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={{ duration: 0.12 }}
                                className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg"
                              >
                                <button className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                                  <Play className="h-3.5 w-3.5 text-gray-400" />
                                  Run Now
                                </button>
                                <button className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                                  <Download className="h-3.5 w-3.5 text-gray-400" />
                                  Export CSV
                                </button>
                                <button className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                                  <FileDown className="h-3.5 w-3.5 text-gray-400" />
                                  Export PDF
                                </button>
                                <div className="my-1 border-t border-gray-100" />
                                <button className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                                  <Pencil className="h-3.5 w-3.5 text-gray-400" />
                                  Edit
                                </button>
                                <button className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition">
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
