'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Search,
  Plus,
  Download,
  MoreHorizontal,
  User,
  Pencil,
} from 'lucide-react'
import type { Employee, RoleFilter, DetailTab } from './types'
import { ROLE_FILTERS, roleBadgeClasses } from './types'
import EmployeeDetailPanel from './EmployeeDetailPanel'
import EmployeeFormModal from './EmployeeFormModal'

export default function DirectoryTab({
  employees,
  searchQuery,
  setSearchQuery,
  roleFilter,
  setRoleFilter,
  selectedEmployee,
  setSelectedEmployee,
  detailTab,
  setDetailTab,
}: {
  employees: Employee[]
  searchQuery: string
  setSearchQuery: (q: string) => void
  roleFilter: RoleFilter
  setRoleFilter: (f: RoleFilter) => void
  selectedEmployee: Employee | null
  setSelectedEmployee: (e: Employee | null) => void
  detailTab: DetailTab
  setDetailTab: (t: DetailTab) => void
}) {
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [employeeEditData, setEmployeeEditData] = useState<{
    id: string; name: string; email: string; phone: string;
    role: string; employmentType: string; hireDate: string; payRate: string;
  } | null>(null)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Main Table Area */}
      <div className={cn(selectedEmployee ? 'lg:col-span-8' : 'lg:col-span-12')}>
        {/* Search + Actions */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button onClick={() => { setEmployeeEditData(null); setEmployeeModalOpen(true) }} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            Add Employee
          </button>
          <button onClick={async () => { try { const res = await fetch('/api/payroll/periods/current/export', { method: 'POST' }); if (!res.ok) { alert('Export failed'); return }; const text = await res.text(); const blob = new Blob([text], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'payroll-export.csv'; a.click(); URL.revokeObjectURL(url) } catch { alert('Network error') } }} className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
            <Download className="h-4 w-4" />
            Export Payroll
          </button>
        </div>

        {/* Filter Pills */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {ROLE_FILTERS.map(filter => (
            <button
              key={filter}
              onClick={() => setRoleFilter(filter)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
                roleFilter === filter
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Employee Table */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Name</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Role</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Status</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 hidden md:table-cell">Type</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 hidden lg:table-cell">Hire Date</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 hidden md:table-cell">Pay Rate</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 hidden xl:table-cell">Hours</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Clock</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr
                    key={emp.id}
                    onClick={() => setSelectedEmployee(selectedEmployee?.id === emp.id ? null : emp)}
                    className={cn(
                      'cursor-pointer border-b border-gray-50 transition-colors duration-150',
                      selectedEmployee?.id === emp.id
                        ? 'bg-indigo-50/50'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/80'
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          emp.role === 'Owner' ? 'bg-violet-100 text-violet-700' :
                          emp.role === 'Trainer' ? 'bg-indigo-100 text-indigo-700' :
                          emp.role === 'Front Desk' ? 'bg-teal-100 text-teal-700' :
                          'bg-amber-100 text-amber-700'
                        )}>
                          {emp.initials}
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', roleBadgeClasses[emp.role])}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          'h-2 w-2 rounded-full',
                          emp.status === 'Active' ? 'bg-emerald-500' :
                          emp.status === 'On Leave' ? 'bg-amber-500' :
                          'bg-gray-300'
                        )} />
                        <span className="text-xs text-gray-600 dark:text-gray-400">{emp.status}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-gray-600 dark:text-gray-400">{emp.employmentType}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-gray-600 dark:text-gray-400">{emp.hireDate}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100 tabular-nums">{emp.payRate ?? '\u2014'}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden xl:table-cell">
                      <span className="text-xs text-gray-600 dark:text-gray-400 tabular-nums">{emp.hoursThisPeriod != null ? `${emp.hoursThisPeriod}h` : '\u2014'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {emp.clockStatus === 'in' ? (
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </div>
                          <span className="text-xs text-emerald-600 font-medium">In since {emp.clockedInSince}</span>
                        </div>
                      ) : emp.clockStatus === 'out' ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Clocked Out</span>
                      ) : (
                        <span className="text-xs text-gray-300">\u2014</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <EmployeeActionDropdown
                        employee={emp}
                        onViewProfile={() => { setSelectedEmployee(emp); setDetailTab('overview') }}
                        onEdit={() => {
                          setEmployeeEditData({
                            id: emp.id,
                            name: emp.name,
                            email: '',
                            phone: '',
                            role: emp.role,
                            employmentType: emp.employmentType,
                            hireDate: emp.hireDate,
                            payRate: emp.payRate ?? '',
                          })
                          setEmployeeModalOpen(true)
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedEmployee && (
          <motion.div
            key="detail-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="lg:col-span-4"
          >
            <EmployeeDetailPanel
              employee={selectedEmployee}
              onClose={() => setSelectedEmployee(null)}
              detailTab={detailTab}
              setDetailTab={setDetailTab}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <EmployeeFormModal
        open={employeeModalOpen}
        onOpenChange={setEmployeeModalOpen}
        onSuccess={() => window.location.reload()}
        editData={employeeEditData}
      />
    </div>
  )
}

function EmployeeActionDropdown({ employee, onViewProfile, onEdit }: { employee: Employee; onViewProfile: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        className="rounded-lg p-1 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setOpen(false) }} />
          <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 text-left">
            <button
              onClick={e => { e.stopPropagation(); setOpen(false); onViewProfile() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <User className="h-3.5 w-3.5" />
              View Profile
            </button>
            <button
              onClick={e => { e.stopPropagation(); setOpen(false); onEdit() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  )
}
