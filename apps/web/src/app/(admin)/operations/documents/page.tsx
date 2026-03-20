'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft,
  FileText,
  Upload,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  ChevronDown,
  Filter,
  User,
  Calendar,
  Shield,
  FileCheck,
  FilePlus,
  File,
} from 'lucide-react'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type DocType = 'W4' | 'W9' | 'I9' | 'W2' | '1099' | 'Contract' | 'Certification' | 'Direct Deposit'
type DocStatus = 'pending' | 'approved' | 'rejected' | 'expired'
type DocFilter = 'All' | DocType

interface EmployeeDocument {
  id: string
  employeeId: string
  employeeName: string
  employeeInitials: string
  documentType: DocType
  documentName: string
  taxYear: string
  status: DocStatus
  uploadedDate: string
  expiresDate: string | null
}

// ─── Mock Data ──────────────────────────────────────────────
const DOCUMENTS: EmployeeDocument[] = [
  {
    id: 'doc-001',
    employeeId: '1',
    employeeName: 'Whitney Cooper',
    employeeInitials: 'WC',
    documentType: 'W4',
    documentName: 'W4_Whitney_Cooper_2026.pdf',
    taxYear: '2026',
    status: 'approved',
    uploadedDate: 'Jan 12, 2026',
    expiresDate: null,
  },
  {
    id: 'doc-002',
    employeeId: '1',
    employeeName: 'Whitney Cooper',
    employeeInitials: 'WC',
    documentType: 'Certification',
    documentName: 'CPR_Certification.pdf',
    taxYear: '2026',
    status: 'pending',
    uploadedDate: 'Mar 5, 2026',
    expiresDate: 'Jun 15, 2026',
  },
  {
    id: 'doc-003',
    employeeId: '2',
    employeeName: 'Drennen',
    employeeInitials: 'DR',
    documentType: 'I9',
    documentName: 'I9_Drennen_2026.pdf',
    taxYear: '2026',
    status: 'approved',
    uploadedDate: 'Mar 1, 2026',
    expiresDate: null,
  },
  {
    id: 'doc-004',
    employeeId: '2',
    employeeName: 'Drennen',
    employeeInitials: 'DR',
    documentType: 'W9',
    documentName: 'W9_Drennen_2026.pdf',
    taxYear: '2026',
    status: 'pending',
    uploadedDate: 'Mar 10, 2026',
    expiresDate: null,
  },
  {
    id: 'doc-005',
    employeeId: '3',
    employeeName: 'Trent',
    employeeInitials: 'TR',
    documentType: 'Contract',
    documentName: 'Trainer_Contract_Trent.pdf',
    taxYear: '2025',
    status: 'expired',
    uploadedDate: 'Feb 20, 2025',
    expiresDate: 'Feb 20, 2026',
  },
  {
    id: 'doc-006',
    employeeId: '3',
    employeeName: 'Trent',
    employeeInitials: 'TR',
    documentType: 'W4',
    documentName: 'W4_Trent_2026.pdf',
    taxYear: '2026',
    status: 'approved',
    uploadedDate: 'Jan 8, 2026',
    expiresDate: null,
  },
  {
    id: 'doc-007',
    employeeId: '4',
    employeeName: 'Tara Kim',
    employeeInitials: 'TK',
    documentType: 'Direct Deposit',
    documentName: 'DirectDeposit_TaraKim.pdf',
    taxYear: '2026',
    status: 'approved',
    uploadedDate: 'Nov 15, 2025',
    expiresDate: null,
  },
  {
    id: 'doc-008',
    employeeId: '4',
    employeeName: 'Tara Kim',
    employeeInitials: 'TK',
    documentType: '1099',
    documentName: '1099_TaraKim_2025.pdf',
    taxYear: '2025',
    status: 'rejected',
    uploadedDate: 'Feb 1, 2026',
    expiresDate: null,
  },
]

const EMPLOYEES_LIST = [
  { id: 'all', name: 'All Employees' },
  { id: '1', name: 'Whitney Cooper' },
  { id: '2', name: 'Drennen' },
  { id: '3', name: 'Trent' },
  { id: '4', name: 'Tara Kim' },
  { id: '5', name: 'Alex Park' },
]

const DOC_TYPE_FILTERS: DocFilter[] = ['All', 'W4', 'W9', 'I9', 'W2', '1099', 'Contract', 'Certification', 'Direct Deposit']

const TAX_YEARS = ['All', '2026', '2025', '2024']

// ─── Helpers ────────────────────────────────────────────────
const statusConfig: Record<DocStatus, { label: string; bg: string; text: string; border: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
  expired: { label: 'Expired', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: AlertTriangle },
}

const docTypeColors: Record<DocType, string> = {
  W4: 'bg-blue-50 text-blue-700 border-blue-200',
  W9: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  I9: 'bg-violet-50 text-violet-700 border-violet-200',
  W2: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  '1099': 'bg-teal-50 text-teal-700 border-teal-200',
  Contract: 'bg-amber-50 text-amber-700 border-amber-200',
  Certification: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Direct Deposit': 'bg-pink-50 text-pink-700 border-pink-200',
}

// ─── Component ──────────────────────────────────────────────
export default function DocumentsPage() {
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [docTypeFilter, setDocTypeFilter] = useState<DocFilter>('All')
  const [taxYearFilter, setTaxYearFilter] = useState('All')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadDocType, setUploadDocType] = useState<DocType>('W4')
  const [uploadTaxYear, setUploadTaxYear] = useState('2026')
  const [uploadEmployee, setUploadEmployee] = useState('1')

  const pendingCount = DOCUMENTS.filter(d => d.status === 'pending').length

  const filteredDocuments = useMemo(() => {
    return DOCUMENTS.filter(doc => {
      if (selectedEmployee !== 'all' && doc.employeeId !== selectedEmployee) return false
      if (docTypeFilter !== 'All' && doc.documentType !== docTypeFilter) return false
      if (taxYearFilter !== 'All' && doc.taxYear !== taxYearFilter) return false
      return true
    })
  }, [selectedEmployee, docTypeFilter, taxYearFilter])

  return (
    <motion.div {...fadeInUp} className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/operations"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Employee Documents</h1>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                  {pendingCount} Pending Review
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-500">Tax forms, contracts, certifications, and employee documentation</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="mb-6 flex flex-wrap items-center gap-4"
      >
        {/* Employee Dropdown */}
        <div className="relative">
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-10 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {EMPLOYEES_LIST.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Doc Type Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DOC_TYPE_FILTERS.map(type => (
            <button
              key={type}
              onClick={() => setDocTypeFilter(type)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                docTypeFilter === type
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              )}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Tax Year Dropdown */}
        <div className="relative">
          <select
            value={taxYearFilter}
            onChange={(e) => setTaxYearFilter(e.target.value)}
            className="appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-10 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {TAX_YEARS.map(year => (
              <option key={year} value={year}>{year === 'All' ? 'All Years' : year}</option>
            ))}
          </select>
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </motion.div>

      {/* Documents Table */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Documents ({filteredDocuments.length})</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Employee', 'Type', 'Document', 'Tax Year', 'Status', 'Uploaded', 'Expires', 'Actions'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDocuments.map((doc) => {
                const status = statusConfig[doc.status]
                const StatusIcon = status.icon
                return (
                  <tr key={doc.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {doc.employeeInitials}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{doc.employeeName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold', docTypeColors[doc.documentType])}>
                        {doc.documentType}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{doc.documentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-sm tabular-nums text-gray-600">{doc.taxYear}</td>
                    <td className="px-6 py-3.5">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', status.bg, status.text, status.border)}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-500">{doc.uploadedDate}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-500">{doc.expiresDate ?? '—'}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1">
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" title="Download">
                          <Download className="h-4 w-4" />
                        </button>
                        {doc.status === 'pending' && (
                          <>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700" title="Approve">
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Reject">
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <FileText className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm font-semibold text-gray-500">No documents found</p>
                    <p className="text-xs text-gray-400">Try adjusting your filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Upload Section */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.15 }}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 text-sm font-bold text-gray-900">Upload Document</h2>

        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Employee select */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">Employee</label>
            <select
              value={uploadEmployee}
              onChange={(e) => setUploadEmployee(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {EMPLOYEES_LIST.filter(e => e.id !== 'all').map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          {/* Document type select */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">Document Type</label>
            <select
              value={uploadDocType}
              onChange={(e) => setUploadDocType(e.target.value as DocType)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {DOC_TYPE_FILTERS.filter(t => t !== 'All').map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          {/* Tax year */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">Tax Year</label>
            <select
              value={uploadTaxYear}
              onChange={(e) => setUploadTaxYear(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {['2026', '2025', '2024'].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false) }}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200',
            isDragging
              ? 'border-indigo-400 bg-indigo-50/50'
              : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
          )}
        >
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
            isDragging ? 'bg-indigo-100' : 'bg-gray-100'
          )}>
            <Upload className={cn('h-5 w-5', isDragging ? 'text-indigo-600' : 'text-gray-400')} />
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-700">
            {isDragging ? 'Drop file here' : 'Drag and drop a file here'}
          </p>
          <p className="mt-1 text-xs text-gray-400">or click to browse &middot; PDF, DOCX, JPG, PNG up to 10MB</p>
          <button className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
            Browse Files
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
