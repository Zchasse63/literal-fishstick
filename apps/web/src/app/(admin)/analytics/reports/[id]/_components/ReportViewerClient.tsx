'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileDown,
  Pencil,
  Search,
  Sparkles,
  X,
  Users,
  CheckCircle2,
  XCircle,
  BarChart3,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { fadeInUp } from '@/lib/motion'

// --- Types ---
type TimeRange = '7d' | '30d' | '90d' | '12m' | 'custom'
type SortDir = 'asc' | 'desc'

interface AttendanceRow {
  id: string
  date: string
  className: string
  classId: string
  trainer: string
  trainerId: string
  bookings: number
  checkIns: number
  noShows: number
  fillRate: number
}

const ROWS_PER_PAGE = 50

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '12m', label: '12m' },
  { key: 'custom', label: 'Custom' },
]

const COLUMNS: { key: keyof AttendanceRow; label: string; align?: 'right' }[] = [
  { key: 'date', label: 'Date' },
  { key: 'className', label: 'Class' },
  { key: 'trainer', label: 'Trainer' },
  { key: 'bookings', label: 'Bookings', align: 'right' },
  { key: 'checkIns', label: 'Check-Ins', align: 'right' },
  { key: 'noShows', label: 'No-Shows', align: 'right' },
  { key: 'fillRate', label: 'Fill Rate', align: 'right' },
]

interface ReportViewerClientProps {
  initialRows: AttendanceRow[]
  reportName: string
  reportId: string
}

export function ReportViewerClient({ initialRows, reportName, reportId }: ReportViewerClientProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCol, setSortCol] = useState<keyof AttendanceRow>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [allRows] = useState<AttendanceRow[]>(initialRows)
  const [scheduleModal, setScheduleModal] = useState(false)

  const totalBookings = allRows.length
  const totalCheckins = allRows.filter(r => r.checkIns > 0).length
  const totalNoShows = allRows.filter(r => r.noShows > 0).length
  const avgFill = totalBookings > 0 ? Math.round((totalCheckins / totalBookings) * 100) : 0

  const summaryMetrics = [
    { label: 'Total Bookings', value: totalBookings.toString(), icon: Users, color: 'text-indigo-600' },
    { label: 'Total Check-Ins', value: totalCheckins.toString(), icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Total No-Shows', value: totalNoShows.toString(), icon: XCircle, color: 'text-red-500' },
    { label: 'Avg Fill Rate', value: `${avgFill}%`, icon: BarChart3, color: 'text-blue-600' },
  ]

  const filtered = useMemo(() => {
    let rows = [...allRows]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(
        (r) =>
          r.className.toLowerCase().includes(q) ||
          r.trainer.toLowerCase().includes(q) ||
          r.date.toLowerCase().includes(q)
      )
    }
    rows.sort((a, b) => {
      const aVal = a[sortCol]
      const bVal = b[sortCol]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
    return rows
  }, [allRows, searchQuery, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const paginatedRows = filtered.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  )

  function toggleSort(col: keyof AttendanceRow) {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  return (
    <div data-testid="analytics-reports-detail-root" className="space-y-6">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* --- Top Bar --- */}
        <motion.div {...fadeInUp} className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/analytics/reports" className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Weekly Attendance Summary</h1>
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">Attendance</span>
              </div>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Report ID: {reportId} &middot; Last run: Mar 19, 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-0.5">
              {TIME_RANGES.map((tr) => (
                <button key={tr.key} onClick={() => setTimeRange(tr.key)} className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition', timeRange === tr.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}>{tr.label}</button>
              ))}
            </div>
            <button onClick={() => fetch(`/api/reports/${reportId}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'csv' }) }).then(r => r.ok ? r.json() : Promise.reject()).then(d => { if (d.data?.download_url) window.open(d.data.download_url, '_blank') }).catch(() => alert('Export failed'))} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"><Download className="h-3.5 w-3.5" />CSV</button>
            <button onClick={() => fetch(`/api/reports/${reportId}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'pdf' }) }).then(r => r.ok ? r.json() : Promise.reject()).then(d => { if (d.async) { alert(d.message || 'PDF is being generated. Check back shortly.') } else if (d.data?.download_url) { window.open(d.data.download_url, '_blank') } }).catch(() => alert('Export failed'))} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"><FileDown className="h-3.5 w-3.5" />PDF</button>
            <button onClick={() => setScheduleModal(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"><Clock className="h-3.5 w-3.5" />Schedule</button>
            <button onClick={() => { window.location.href = `/analytics/reports/${reportId}/edit` }} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"><Pencil className="h-3.5 w-3.5" />Edit</button>
          </div>
        </motion.div>

        {/* --- Summary Row --- */}
        <motion.div {...fadeInUp} className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {summaryMetrics.map((metric, i) => {
            const Icon = metric.icon
            return (
              <motion.div key={metric.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.05, ease: [0.25, 1, 0.5, 1] }} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', metric.color)} />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{metric.label}</p>
                </div>
                <p className="mt-2 text-[28px] font-black tabular-nums text-gray-900 dark:text-gray-100">{metric.value}</p>
              </motion.div>
            )
          })}
        </motion.div>

        {/* --- Chart --- */}
        <motion.div {...fadeInUp} className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Attendance Trend</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line type="monotone" dataKey="bookings" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3, fill: '#4F46E5' }} name="Bookings" />
                <Line type="monotone" dataKey="checkIns" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981' }} name="Check-Ins" />
                <Line type="monotone" dataKey="noShows" stroke="#EF4444" strokeWidth={2} dot={{ r: 3, fill: '#EF4444' }} name="No-Shows" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* --- Data Table --- */}
        <motion.div {...fadeInUp} className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Data ({filtered.length} rows)</p>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input type="text" placeholder="Filter rows..." aria-label="Filter report rows" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }} className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-8 pr-3 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:border-indigo-300 focus:bg-white dark:bg-gray-950 focus:outline-none focus:ring-1 focus:ring-indigo-600/10" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
                  {COLUMNS.map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} className={cn('cursor-pointer select-none px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 transition hover:text-gray-600 dark:hover:text-gray-300', col.align === 'right' ? 'text-right' : 'text-left')}>
                      <span className="inline-flex items-center gap-1">{col.label}<ArrowUpDown className={cn('h-3 w-3', sortCol === col.key ? 'text-indigo-500' : 'text-gray-300')} /></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 transition hover:bg-gray-50 dark:hover:bg-gray-800/50 last:border-0">
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">{row.date}</td>
                    <td className="px-5 py-3"><Link href="/schedule" className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 transition">{row.className}</Link></td>
                    <td className="px-5 py-3"><Link href={`/analytics/trainers/${row.trainerId}`} className="text-sm text-gray-700 dark:text-gray-300 hover:text-indigo-600 transition">{row.trainer}</Link></td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums font-medium text-gray-900 dark:text-gray-100">{row.bookings}</td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums font-medium text-emerald-600">{row.checkIns}</td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums font-medium text-red-500">{row.noShows}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn('text-sm tabular-nums font-semibold', row.fillRate >= 80 ? 'text-emerald-600' : row.fillRate >= 60 ? 'text-amber-600' : 'text-red-500')}>{row.fillRate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 px-5 py-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}--{Math.min(currentPage * ROWS_PER_PAGE, filtered.length)} of {filtered.length}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button key={page} onClick={() => setCurrentPage(page)} className={cn('h-8 w-8 rounded-lg text-xs font-semibold transition', page === currentPage ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')}>{page}</button>
              ))}
              <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </motion.div>

        {/* --- AI Narrative Card --- */}
        <motion.div {...fadeInUp} className="rounded-2xl border border-transparent bg-white dark:bg-gray-950 p-6 shadow-sm" style={{ borderImage: 'linear-gradient(135deg, #4F46E5, #7C3AED, #4F46E5) 1', borderWidth: '1px', borderStyle: 'solid' }}>
          <div className="rounded-2xl border border-gray-0 p-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">AI Narrative Summary</p>
            </div>
            <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              <p>Over the past 30 days, your studio recorded <strong>{totalBookings} bookings</strong> with an <strong>{avgFill}% check-in rate</strong> ({totalCheckins} check-ins).</p>
              <p><strong>Guided Breathwork</strong> sessions consistently fill above 80% capacity. Consider adding additional guided slots to capture overflow demand.</p>
              <p>No-shows are concentrated on <strong>Monday mornings</strong>. Moving the reminder to the evening before could reduce Monday no-shows.</p>
            </div>
          </div>
        </motion.div>

        {/* --- Schedule Modal --- */}
        <AnimatePresence>
          {scheduleModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setScheduleModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Schedule Report</h2>
                  <button onClick={() => setScheduleModal(false)} className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition"><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Frequency</p>
                    <div className="flex gap-2">
                      {['Daily', 'Weekly', 'Monthly'].map((freq) => (
                        <button key={freq} className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-600 transition first:bg-indigo-600 first:text-white first:border-indigo-600">{freq}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Email Recipients</p>
                    <input type="email" placeholder="Add email address..." className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-600/10" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Format</p>
                    <div className="flex gap-2">
                      {['CSV', 'PDF'].map((fmt) => (
                        <button key={fmt} className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-600 transition first:bg-indigo-600 first:text-white first:border-indigo-600">{fmt}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button onClick={() => setScheduleModal(false)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
                  <button onClick={() => setScheduleModal(false)} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition">Save Schedule</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
