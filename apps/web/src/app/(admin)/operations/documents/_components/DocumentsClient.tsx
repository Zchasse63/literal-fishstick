'use client'

import { useState, useMemo, useRef } from 'react'
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
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
type DocType = 'W4' | 'W9' | 'I9' | 'W2' | '1099' | 'Contract' | 'Certification' | 'Direct Deposit'
type DocStatus = 'pending' | 'approved' | 'rejected' | 'expired'
type DocFilter = 'All' | DocType

export interface EmployeeDocument {
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
  fileUrl: string | null
}

export interface EmployeeListItem {
  id: string
  name: string
}

const DOC_TYPE_FILTERS: DocFilter[] = ['All', 'W4', 'W9', 'I9', 'W2', '1099', 'Contract', 'Certification', 'Direct Deposit']

const TAX_YEARS = ['All', '2026', '2025', '2024']

// ─── Helpers ────────────────────────────────────────────────
const statusConfig: Record<DocStatus, { label: string; bg: string; text: string; border: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
  expired: { label: 'Expired', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-800', icon: AlertTriangle },
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
function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

interface DocumentsClientProps {
  initialDocuments: EmployeeDocument[]
  initialEmployees: EmployeeListItem[]
}

export default function DocumentsClient({ initialDocuments, initialEmployees }: DocumentsClientProps) {
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [docTypeFilter, setDocTypeFilter] = useState<DocFilter>('All')
  const [taxYearFilter, setTaxYearFilter] = useState('All')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadDocType, setUploadDocType] = useState<DocType>('W4')
  const [uploadTaxYear, setUploadTaxYear] = useState('2026')
  const [uploadEmployee, setUploadEmployee] = useState(
    initialEmployees.find(e => e.id !== 'all')?.id ?? ''
  )

  const [documents] = useState<EmployeeDocument[]>(initialDocuments)
  const [employeesList] = useState<EmployeeListItem[]>(initialEmployees)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (file: File) => {
    if (!uploadEmployee) {
      window.alert('Please select an employee first')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      window.alert('File size must be under 10MB')
      return
    }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('document_type', uploadDocType)
      formData.append('name', file.name)
      formData.append('tax_year', uploadTaxYear)
      const res = await fetch(`/api/employees/${uploadEmployee}/documents`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        window.location.reload()
      } else {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        window.alert(err.error || 'Upload failed')
      }
    } catch {
      window.alert('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const pendingCount = documents.filter(d => d.status === 'pending').length

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (selectedEmployee !== 'all' && doc.employeeId !== selectedEmployee) return false
      if (docTypeFilter !== 'All' && doc.documentType !== docTypeFilter) return false
      if (taxYearFilter !== 'All' && doc.taxYear !== taxYearFilter) return false
      return true
    })
  }, [selectedEmployee, docTypeFilter, taxYearFilter, documents])

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/operations"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Employee Documents</h1>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                  {pendingCount} Pending Review
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Tax forms, contracts, certifications, and employee documentation</p>
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
            className="appearance-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-2 pl-9 pr-10 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {employeesList.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
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
                  : 'bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
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
            className="appearance-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-2 pl-9 pr-10 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {TAX_YEARS.map(year => (
              <option key={year} value={year}>{year === 'All' ? 'All Years' : year}</option>
            ))}
          </select>
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        </div>
      </motion.div>

      {/* Documents Table */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm"
      >
        <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Documents ({filteredDocuments.length})</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Employee', 'Type', 'Document', 'Tax Year', 'Status', 'Uploaded', 'Expires', 'Actions'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
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
                  <tr key={doc.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {doc.employeeInitials}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{doc.employeeName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold', docTypeColors[doc.documentType])}>
                        {doc.documentType}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{doc.documentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-sm tabular-nums text-gray-600 dark:text-gray-400">{doc.taxYear}</td>
                    <td className="px-6 py-3.5">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', status.bg, status.text, status.border)}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-500 dark:text-gray-400">{doc.uploadedDate}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-500 dark:text-gray-400">{doc.expiresDate ?? '—'}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (doc.fileUrl) {
                              window.open(doc.fileUrl, '_blank')
                            } else {
                              window.alert('No file URL available for this document')
                            }
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (doc.fileUrl) {
                              const a = document.createElement('a')
                              a.href = doc.fileUrl
                              a.download = doc.documentName
                              a.click()
                            } else {
                              window.alert('No file URL available for download')
                            }
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {doc.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                fetch(`/api/employees/${doc.employeeId}/documents/${doc.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'approved' }),
                                }).then(r => r.ok ? window.location.reload() : window.alert('Failed to approve document'))
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                              title="Approve"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                fetch(`/api/employees/${doc.employeeId}/documents/${doc.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'rejected' }),
                                }).then(r => r.ok ? window.location.reload() : window.alert('Failed to reject document'))
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Reject"
                            >
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
                    <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">No documents yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{documents.length === 0 ? 'Upload employee documents using the form below' : 'Try adjusting your filters'}</p>
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
        className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm"
      >
        <h2 className="mb-4 text-sm font-bold text-gray-900 dark:text-gray-100">Upload Document</h2>

        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Employee select */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Employee</label>
            <select
              value={uploadEmployee}
              onChange={(e) => setUploadEmployee(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {employeesList.filter(e => e.id !== 'all').map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          {/* Document type select */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Document Type</label>
            <select
              value={uploadDocType}
              onChange={(e) => setUploadDocType(e.target.value as DocType)}
              className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {DOC_TYPE_FILTERS.filter(t => t !== 'All').map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          {/* Tax year */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Tax Year</label>
            <select
              value={uploadTaxYear}
              onChange={(e) => setUploadTaxYear(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFileUpload(file)
          }}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200',
            isDragging
              ? 'border-indigo-400 bg-indigo-50/50'
              : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          )}
        >
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
            isDragging ? 'bg-indigo-100' : 'bg-gray-100 dark:bg-gray-800'
          )}>
            <Upload className={cn('h-5 w-5', isDragging ? 'text-indigo-600' : 'text-gray-400 dark:text-gray-500')} />
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {isDragging ? 'Drop file here' : 'Drag and drop a file here'}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">or click to browse &middot; PDF, DOCX, JPG, PNG up to 10MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Browse Files'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
