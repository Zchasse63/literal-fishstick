'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Loader2 as Spinner,
  Users,
  CalendarDays,
  DollarSign,
  Shield,
  Search,
  Plus,
  Download,
  MoreHorizontal,
  X,
  Clock,
  Mail,
  Phone,
  MapPin,
  Award,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Pencil,
  Lock,
  Check,
} from 'lucide-react'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type MainTab = 'directory' | 'schedule' | 'payroll' | 'permissions'
type RoleFilter = 'All' | 'Trainers' | 'Front Desk' | 'Managers' | 'Active' | 'Inactive'
type DetailTab = 'overview' | 'performance' | 'pay'

type Role = 'Trainer' | 'Front Desk' | 'Manager' | 'Owner'
type EmploymentType = 'Part-Time' | 'Full-Time' | 'Contract'
type ClockStatus = 'in' | 'out' | null

interface Employee {
  id: string
  name: string
  initials: string
  role: Role
  status: 'Active' | 'On Leave' | 'Inactive'
  employmentType: EmploymentType
  hireDate: string
  payRate: string | null
  hoursThisPeriod: number | null
  clockStatus: ClockStatus
  clockedInSince: string | null
  email: string
  phone: string
  // Performance (trainers)
  classesLed?: number
  avgAttendance?: number
  bonusHitRate?: number
  promoCode?: string
  promoRedemptions?: number
  promoRevenue?: number
  // Pay
  currentPeriodHours?: number
  grossPayEstimate?: number
  ytdGross?: number
  ytdBonuses?: number
}

interface PayrollRow {
  employeeId: string
  name: string
  role: Role
  regularHours: number
  overtime: number
  grossPay: number
  trainerBonuses: number
  promoCommissions: number
  total: number
  status: 'Pending Review' | 'Approved'
}

interface PayPeriod {
  id: string
  label: string
  range: string
  rows: PayrollRow[]
}

// ─── Supabase ──────────────────────────────────────────────
const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

// ─── Schedule Constants ──────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SCHEDULE_TIMES = ['5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM']

interface ScheduleSlot {
  type: 'open' | 'guided'
  trainer?: string
  booked: number
  capacity: number
}

// Schedule data is computed from classes — empty until classes are scheduled
const TRAINER_SCHEDULE: Record<string, ScheduleSlot> = {}

// ─── Permissions Data (static config, not from DB) ──────────
interface PermissionRow {
  category: string
  permission: string
  owner: boolean
  admin: boolean
  trainer: boolean
  receptionist: boolean
}

const DEFAULT_PERMISSIONS: PermissionRow[] = [
  { category: 'General', permission: 'View Dashboard', owner: true, admin: true, trainer: true, receptionist: true },
  { category: 'General', permission: 'View Activity Feed', owner: true, admin: true, trainer: true, receptionist: true },
  { category: 'General', permission: 'Access Command Center', owner: true, admin: true, trainer: false, receptionist: false },
  { category: 'Schedule', permission: 'View Schedule', owner: true, admin: true, trainer: true, receptionist: true },
  { category: 'Schedule', permission: 'Create/Edit Classes', owner: true, admin: true, trainer: false, receptionist: false },
  { category: 'Schedule', permission: 'Check In Members', owner: true, admin: true, trainer: true, receptionist: true },
  { category: 'Schedule', permission: 'Manage Waitlists', owner: true, admin: true, trainer: false, receptionist: true },
  { category: 'Revenue', permission: 'View Revenue Metrics', owner: true, admin: true, trainer: false, receptionist: false },
  { category: 'Revenue', permission: 'Process Refunds', owner: true, admin: true, trainer: false, receptionist: false },
  { category: 'Revenue', permission: 'Manage Pricing', owner: true, admin: false, trainer: false, receptionist: false },
  { category: 'Revenue', permission: 'View Transactions', owner: true, admin: true, trainer: false, receptionist: true },
  { category: 'Marketing', permission: 'Create Campaigns', owner: true, admin: true, trainer: false, receptionist: false },
  { category: 'Marketing', permission: 'View Lead Pipeline', owner: true, admin: true, trainer: false, receptionist: false },
  { category: 'Admin', permission: 'Manage Employees', owner: true, admin: true, trainer: false, receptionist: false },
  { category: 'Admin', permission: 'Edit Permissions', owner: true, admin: false, trainer: false, receptionist: false },
  { category: 'Admin', permission: 'System Settings', owner: true, admin: false, trainer: false, receptionist: false },
]

// ─── Helpers ────────────────────────────────────────────────
const roleBadgeClasses: Record<Role, string> = {
  Trainer: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Front Desk': 'bg-teal-50 text-teal-700 border-teal-200',
  Manager: 'bg-amber-50 text-amber-700 border-amber-200',
  Owner: 'bg-violet-50 text-violet-700 border-violet-200',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

// ─── Main Tabs ──────────────────────────────────────────────
const MAIN_TABS: { id: MainTab; label: string; icon: typeof Users }[] = [
  { id: 'directory', label: 'Directory', icon: Users },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
  { id: 'permissions', label: 'Permissions', icon: Shield },
]

const ROLE_FILTERS: RoleFilter[] = ['All', 'Trainers', 'Front Desk', 'Managers', 'Active', 'Inactive']

// ─── Helper: build initials ────────────────────────────────
function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Component ──────────────────────────────────────────────
export default function OperationsPage() {
  const [activeTab, setActiveTab] = useState<MainTab>('directory')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const [editPermissions, setEditPermissions] = useState(false)
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS)

  // ─── Live data ──────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createBrowserClient()

      // Fetch staff profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('studio_id', STUDIO_ID)

      if (profiles && profiles.length > 0) {
        const mapped: Employee[] = profiles.map((p: any) => {
          const roles: string[] = p.roles ?? []
          const role: Role = roles.includes('owner') ? 'Owner'
            : roles.includes('trainer') ? 'Trainer'
            : roles.includes('front_desk') ? 'Front Desk'
            : roles.includes('manager') ? 'Manager'
            : 'Front Desk'
          return {
            id: p.id,
            name: p.full_name ?? p.email ?? 'Unknown',
            initials: getInitials(p.full_name ?? p.email ?? 'U'),
            role,
            status: (p.status === 'active' ? 'Active' : p.status === 'on_leave' ? 'On Leave' : 'Inactive') as Employee['status'],
            employmentType: (p.employment_type ?? 'Part-Time') as EmploymentType,
            hireDate: p.hire_date ? new Date(p.hire_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
            payRate: p.pay_rate ?? null,
            hoursThisPeriod: p.hours_this_period ?? null,
            clockStatus: p.clock_status === 'in' ? 'in' : p.clock_status === 'out' ? 'out' : null,
            clockedInSince: p.clocked_in_since ? new Date(p.clocked_in_since).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
            email: p.email ?? '',
            phone: p.phone ?? '',
            classesLed: p.classes_led,
            avgAttendance: p.avg_attendance,
            bonusHitRate: p.bonus_hit_rate,
            promoCode: p.promo_code,
            promoRedemptions: p.promo_redemptions,
            promoRevenue: p.promo_revenue,
            currentPeriodHours: p.current_period_hours,
            grossPayEstimate: p.gross_pay_estimate,
            ytdGross: p.ytd_gross,
            ytdBonuses: p.ytd_bonuses,
          }
        })
        setEmployees(mapped)
      }

      // Fetch payroll periods
      const { data: ppData } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .order('start_date', { ascending: false })

      if (ppData && ppData.length > 0) {
        const mapped: PayPeriod[] = ppData.map((pp: any) => ({
          id: pp.id,
          label: pp.label ?? `${new Date(pp.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(pp.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          range: `${new Date(pp.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(pp.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          rows: (pp.line_items ?? []).map((li: any) => ({
            employeeId: li.employee_id ?? '',
            name: li.name ?? '',
            role: li.role ?? 'Trainer',
            regularHours: li.regular_hours ?? 0,
            overtime: li.overtime ?? 0,
            grossPay: li.gross_pay ?? 0,
            trainerBonuses: li.trainer_bonuses ?? 0,
            promoCommissions: li.promo_commissions ?? 0,
            total: li.total ?? 0,
            status: li.status ?? 'Pending Review',
          })),
        }))
        setPayPeriods(mapped)
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  const [selectedPayPeriod, setSelectedPayPeriod] = useState<string>('')
  useEffect(() => {
    if (payPeriods.length > 0 && !selectedPayPeriod) {
      setSelectedPayPeriod(payPeriods[0].id)
    }
  }, [payPeriods, selectedPayPeriod])

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchSearch) return false
      switch (roleFilter) {
        case 'Trainers': return emp.role === 'Trainer'
        case 'Front Desk': return emp.role === 'Front Desk'
        case 'Managers': return emp.role === 'Manager'
        case 'Active': return emp.status === 'Active'
        case 'Inactive': return emp.status === 'Inactive' || emp.status === 'On Leave'
        default: return true
      }
    })
  }, [searchQuery, roleFilter, employees])

  const currentPayPeriod = payPeriods.find(p => p.id === selectedPayPeriod) ?? payPeriods[0]

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <Spinner className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <motion.div {...fadeInUp} className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Operations</h1>
        <p className="mt-1 text-sm text-gray-500">Employee management, scheduling, payroll, and permissions</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
          {MAIN_TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedEmployee(null) }}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'directory' && (
          <motion.div key="directory" {...fadeInUp}>
            <DirectoryTab
              employees={filteredEmployees}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              roleFilter={roleFilter}
              setRoleFilter={setRoleFilter}
              selectedEmployee={selectedEmployee}
              setSelectedEmployee={(emp) => { setSelectedEmployee(emp); setDetailTab('overview') }}
              detailTab={detailTab}
              setDetailTab={setDetailTab}
            />
          </motion.div>
        )}
        {activeTab === 'schedule' && (
          <motion.div key="schedule" {...fadeInUp}>
            <ScheduleTab />
          </motion.div>
        )}
        {activeTab === 'payroll' && (
          <motion.div key="payroll" {...fadeInUp}>
            <PayrollTab
              payPeriods={payPeriods}
              selectedPeriod={selectedPayPeriod}
              setSelectedPeriod={setSelectedPayPeriod}
              currentPayPeriod={currentPayPeriod}
            />
          </motion.div>
        )}
        {activeTab === 'permissions' && (
          <motion.div key="permissions" {...fadeInUp}>
            <PermissionsTab
              permissions={permissions}
              setPermissions={setPermissions}
              editMode={editPermissions}
              setEditMode={setEditPermissions}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════
// DIRECTORY TAB
// ═══════════════════════════════════════════════════════════
function DirectoryTab({
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
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Main Table Area */}
      <div className={cn(selectedEmployee ? 'lg:col-span-8' : 'lg:col-span-12')}>
        {/* Search + Actions */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            Add Employee
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
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
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Employee Table */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Name</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Role</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden md:table-cell">Type</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden lg:table-cell">Hire Date</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden md:table-cell">Pay Rate</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden xl:table-cell">Hours</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Clock</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 w-10"></th>
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
                        : 'hover:bg-gray-50/80'
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
                        <span className="text-sm font-medium text-gray-900">{emp.name}</span>
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
                        <span className="text-xs text-gray-600">{emp.status}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-gray-600">{emp.employmentType}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-gray-600">{emp.hireDate}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs font-medium text-gray-900 tabular-nums">{emp.payRate ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden xl:table-cell">
                      <span className="text-xs text-gray-600 tabular-nums">{emp.hoursThisPeriod != null ? `${emp.hoursThisPeriod}h` : '—'}</span>
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
                        <span className="text-xs text-gray-400">Clocked Out</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={e => e.stopPropagation()}
                        className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
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
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// EMPLOYEE DETAIL PANEL
// ═══════════════════════════════════════════════════════════
function EmployeeDetailPanel({
  employee,
  onClose,
  detailTab,
  setDetailTab,
}: {
  employee: Employee
  onClose: () => void
  detailTab: DetailTab
  setDetailTab: (t: DetailTab) => void
}) {
  const isTrainer = employee.role === 'Trainer'
  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(isTrainer ? [{ id: 'performance' as DetailTab, label: 'Performance' }] : []),
    { id: 'pay', label: 'Pay' },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-100 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold',
              employee.role === 'Owner' ? 'bg-violet-100 text-violet-700' :
              employee.role === 'Trainer' ? 'bg-indigo-100 text-indigo-700' :
              employee.role === 'Front Desk' ? 'bg-teal-100 text-teal-700' :
              'bg-amber-100 text-amber-700'
            )}>
              {employee.initials}
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{employee.name}</h3>
              <div className="mt-1 flex items-center gap-2">
                <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', roleBadgeClasses[employee.role])}>
                  {employee.role}
                </span>
                <div className="flex items-center gap-1">
                  <div className={cn('h-1.5 w-1.5 rounded-full', employee.status === 'Active' ? 'bg-emerald-500' : employee.status === 'On Leave' ? 'bg-amber-500' : 'bg-gray-300')} />
                  <span className="text-[10px] text-gray-500">{employee.status}</span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Mail className="h-3 w-3" />
            {employee.email}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Phone className="h-3 w-3" />
            {employee.phone}
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-gray-100">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setDetailTab(tab.id)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors',
              detailTab === tab.id
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub Tab Content */}
      <div className="p-5">
        {detailTab === 'overview' && (
          <div className="space-y-4">
            <DetailRow label="Employment Type" value={employee.employmentType} />
            <DetailRow label="Hire Date" value={employee.hireDate} />
            <DetailRow label="Pay Rate" value={employee.payRate ?? 'N/A'} />
            <DetailRow label="Clock Status" value={
              employee.clockStatus === 'in' ? `Clocked In since ${employee.clockedInSince}` :
              employee.clockStatus === 'out' ? 'Clocked Out' : 'N/A'
            } />
            {employee.hoursThisPeriod != null && (
              <DetailRow label="Hours This Period" value={`${employee.hoursThisPeriod}h`} />
            )}
          </div>
        )}
        {detailTab === 'performance' && isTrainer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Classes Led" value={String(employee.classesLed ?? 0)} />
              <MiniStat label="Avg Attendance" value={String(employee.avgAttendance ?? 0)} />
              <MiniStat label="Bonus Hit Rate" value={`${employee.bonusHitRate ?? 0}%`} />
              <MiniStat label="Promo Code" value={employee.promoCode ?? '—'} />
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Promo Code Stats</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Redemptions</span>
                  <span className="font-medium text-gray-900 tabular-nums">{employee.promoRedemptions}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Revenue Attributed</span>
                  <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(employee.promoRevenue ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {detailTab === 'pay' && (
          <div className="space-y-4">
            {employee.currentPeriodHours != null ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Current Hours" value={`${employee.currentPeriodHours}h`} />
                  <MiniStat label="Gross Pay Est." value={formatCurrency(employee.grossPayEstimate ?? 0)} />
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Year to Date</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Gross Pay</span>
                      <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(employee.ytdGross ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Bonuses</span>
                      <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(employee.ytdBonuses ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-t border-gray-200 pt-2">
                      <span className="font-medium text-gray-700">Total</span>
                      <span className="font-bold text-gray-900 tabular-nums">{formatCurrency((employee.ytdGross ?? 0) + (employee.ytdBonuses ?? 0))}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">No payroll data for this employee</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900">{value}</span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-[18px] font-black text-gray-900 tabular-nums">{value}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// SCHEDULE TAB
// ═══════════════════════════════════════════════════════════
function ScheduleTab() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Trainer Schedule</h2>
          <p className="text-xs text-gray-500 mt-0.5">Week of Mar 16 – 22, 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="h-2.5 w-2.5 rounded-sm bg-indigo-100 border border-indigo-200" /> Guided
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="h-2.5 w-2.5 rounded-sm bg-gray-100 border border-gray-200" /> Open
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 w-20">Time</th>
              {DAYS.map(day => (
                <th key={day} className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_TIMES.map(time => (
              <tr key={time} className="border-t border-gray-50">
                <td className="px-3 py-2 text-xs font-medium text-gray-600 tabular-nums">{time}</td>
                {DAYS.map(day => {
                  const slot = TRAINER_SCHEDULE[`${day}-${time}`]
                  if (!slot) return <td key={day} className="px-2 py-2"><div className="h-16" /></td>
                  return (
                    <td key={day} className="px-2 py-2">
                      <div className={cn(
                        'rounded-xl border p-2.5 h-16 flex flex-col justify-between transition-colors hover:shadow-sm cursor-pointer',
                        slot.type === 'guided'
                          ? 'bg-indigo-50/70 border-indigo-200 hover:bg-indigo-50'
                          : 'bg-gray-50 border-gray-150 hover:bg-gray-100/50'
                      )}>
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            'text-[10px] font-semibold',
                            slot.type === 'guided' ? 'text-indigo-700' : 'text-gray-600'
                          )}>
                            {slot.type === 'guided' ? 'Guided' : 'Open'}
                          </span>
                          <span className="text-[10px] text-gray-400 tabular-nums">{slot.booked}/{slot.capacity}</span>
                        </div>
                        {slot.trainer && (
                          <span className="text-[10px] font-medium text-indigo-600 truncate">{slot.trainer}</span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// PAYROLL TAB
// ═══════════════════════════════════════════════════════════
function PayrollTab({
  payPeriods,
  selectedPeriod,
  setSelectedPeriod,
  currentPayPeriod,
}: {
  payPeriods: PayPeriod[]
  selectedPeriod: string
  setSelectedPeriod: (id: string) => void
  currentPayPeriod: PayPeriod
}) {
  const totals = currentPayPeriod.rows.reduce(
    (acc, row) => ({
      grossPay: acc.grossPay + row.grossPay,
      bonuses: acc.bonuses + row.trainerBonuses,
      commissions: acc.commissions + row.promoCommissions,
      total: acc.total + row.total,
    }),
    { grossPay: 0, bonuses: 0, commissions: 0, total: 0 }
  )

  return (
    <div className="space-y-4">
      {/* Period Selector + Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            {payPeriods.map(pp => (
              <option key={pp.id} value={pp.id}>{pp.label} — {pp.range}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {currentPayPeriod.rows.some(r => r.status === 'Pending Review') && (
            <button className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Approve All
            </button>
          )}
          <button className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Gross Pay</p>
          <p className="mt-1 text-[28px] font-black text-gray-900 tabular-nums">{formatCurrency(totals.grossPay)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Trainer Bonuses</p>
          <p className="mt-1 text-[28px] font-black text-gray-900 tabular-nums">{formatCurrency(totals.bonuses)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Promo Commissions</p>
          <p className="mt-1 text-[28px] font-black text-gray-900 tabular-nums">{formatCurrency(totals.commissions)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Payroll</p>
          <p className="mt-1 text-[28px] font-black text-indigo-600 tabular-nums">{formatCurrency(totals.total)}</p>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Employee</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Regular Hrs</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Overtime</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Gross Pay</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden md:table-cell">Bonuses</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden md:table-cell">Commissions</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentPayPeriod.rows.map(row => (
                <tr key={row.employeeId} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{row.name}</span>
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', roleBadgeClasses[row.role])}>
                        {row.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-700 tabular-nums">{row.regularHours}h</td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums">
                    {row.overtime > 0 ? (
                      <span className="text-amber-600 font-medium">{row.overtime}h</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(row.grossPay)}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-700 tabular-nums hidden md:table-cell">
                    {row.trainerBonuses > 0 ? formatCurrency(row.trainerBonuses) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-gray-700 tabular-nums hidden md:table-cell">
                    {row.promoCommissions > 0 ? formatCurrency(row.promoCommissions) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(row.total)}</td>
                  <td className="px-5 py-3.5 text-right">
                    {row.status === 'Pending Review' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">
                        <AlertCircle className="h-3 w-3" />
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Approved
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50/50">
                <td className="px-5 py-3 text-sm font-semibold text-gray-700">Totals</td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700 tabular-nums">
                  {currentPayPeriod.rows.reduce((s, r) => s + r.regularHours, 0)}h
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700 tabular-nums">
                  {currentPayPeriod.rows.reduce((s, r) => s + r.overtime, 0)}h
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700 tabular-nums">
                  {formatCurrency(totals.grossPay)}
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700 tabular-nums hidden md:table-cell">
                  {formatCurrency(totals.bonuses)}
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700 tabular-nums hidden md:table-cell">
                  {formatCurrency(totals.commissions)}
                </td>
                <td className="px-5 py-3 text-right text-sm font-bold text-indigo-600 tabular-nums">
                  {formatCurrency(totals.total)}
                </td>
                <td className="px-5 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// PERMISSIONS TAB
// ═══════════════════════════════════════════════════════════
function PermissionsTab({
  permissions,
  setPermissions,
  editMode,
  setEditMode,
}: {
  permissions: PermissionRow[]
  setPermissions: (p: PermissionRow[]) => void
  editMode: boolean
  setEditMode: (b: boolean) => void
}) {
  const categories = [...new Set(permissions.map(p => p.category))]

  function togglePermission(idx: number, role: 'admin' | 'trainer' | 'receptionist') {
    if (!editMode) return
    const updated = [...permissions]
    updated[idx] = { ...updated[idx], [role]: !updated[idx][role] }
    setPermissions(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Role Permissions</h2>
          <p className="text-xs text-gray-500 mt-0.5">Define what each role can access and modify</p>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
            editMode
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          {editMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          {editMode ? 'Save Changes' : 'Edit Mode'}
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 w-48">Permission</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <div className="flex items-center justify-center gap-1">
                    Owner
                    <Lock className="h-3 w-3 text-gray-300" />
                  </div>
                </th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">Admin</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">Trainer</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">Receptionist</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <>
                  <tr key={`cat-${cat}`} className="bg-gray-50/80">
                    <td colSpan={5} className="px-5 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{cat}</span>
                    </td>
                  </tr>
                  {permissions.filter(p => p.category === cat).map((perm, _i) => {
                    const globalIdx = permissions.indexOf(perm)
                    return (
                      <tr key={perm.permission} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 text-sm text-gray-700">{perm.permission}</td>
                        <td className="px-5 py-3 text-center">
                          <PermCheckbox checked={perm.owner} disabled />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <PermCheckbox
                            checked={perm.admin}
                            disabled={!editMode}
                            onChange={() => togglePermission(globalIdx, 'admin')}
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <PermCheckbox
                            checked={perm.trainer}
                            disabled={!editMode}
                            onChange={() => togglePermission(globalIdx, 'trainer')}
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <PermCheckbox
                            checked={perm.receptionist}
                            disabled={!editMode}
                            onChange={() => togglePermission(globalIdx, 'receptionist')}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PermCheckbox({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange?: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'inline-flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-150',
        checked
          ? 'bg-indigo-600 border-indigo-600 text-white'
          : 'bg-white border-gray-300',
        disabled && !checked && 'opacity-40',
        disabled && checked && 'opacity-70',
        !disabled && !checked && 'hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer',
        !disabled && checked && 'hover:bg-indigo-700 cursor-pointer',
        disabled && 'cursor-default'
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  )
}
