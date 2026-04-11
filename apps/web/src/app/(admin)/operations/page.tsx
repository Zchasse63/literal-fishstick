'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import { useUrlTab } from '@/hooks/use-url-tab'
import {
  Loader2 as Spinner,
  Users,
  CalendarDays,
  DollarSign,
  Shield,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import type {
  MainTab,
  RoleFilter,
  DetailTab,
  Role,
  EmploymentType,
  ClockStatus,
  Employee,
  PayPeriod,
} from './_components/types'
import { DEFAULT_PERMISSIONS } from './_components/types'
import DirectoryTab from './_components/DirectoryTab'
import ScheduleTab from './_components/ScheduleTab'
import PayrollTab from './_components/PayrollTab'
import PermissionsTab from './_components/PermissionsTab'

// ─── Supabase ──────────────────────────────────────────────
const STUDIO_ID = DEFAULT_STUDIO_ID

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
const MAIN_TAB_VALUES = ['directory', 'schedule', 'payroll', 'permissions'] as const

export default function OperationsPage() {
  const [activeTab, setActiveTab] = useUrlTab<MainTab>(MAIN_TAB_VALUES, 'directory', '/operations')
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

      // Fetch employees joined with profiles and trainers for trainer-specific data
      const [empRes, trainerRes, clockRes] = await Promise.all([
        supabase
          .from('employees')
          .select('*, profiles:profile_id ( id, full_name, email, phone, roles )')
          .eq('studio_id', STUDIO_ID),
        supabase
          .from('trainers')
          .select('profile_id, promo_code, total_classes_led, total_bonus_earned, total_commission_earned, base_pay_per_class, bonus_threshold')
          .eq('studio_id', STUDIO_ID),
        // Fetch active clock entries (no clock_out) to determine who is clocked in
        supabase
          .from('clock_entries')
          .select('employee_id, clock_in')
          .eq('studio_id', STUDIO_ID)
          .is('clock_out', null),
      ])

      const employees = empRes.data ?? []
      const trainers = trainerRes.data ?? []
      const activeClocks = clockRes.data ?? []

      // Build lookup maps
      const trainerByProfileId = new Map<string, any>()
      for (const t of trainers) {
        trainerByProfileId.set(t.profile_id, t)
      }
      const activeClockByEmployeeId = new Map<string, any>()
      for (const c of activeClocks) {
        activeClockByEmployeeId.set(c.employee_id, c)
      }

      if (employees.length > 0) {
        const mapped: Employee[] = employees.map((emp: any) => {
          const profile = emp.profiles ?? {}
          const roles: string[] = profile.roles ?? []
          const role: Role = roles.includes('owner') ? 'Owner'
            : roles.includes('trainer') ? 'Trainer'
            : roles.includes('front_desk') ? 'Front Desk'
            : roles.includes('manager') ? 'Manager'
            : 'Front Desk'
          const trainerData = trainerByProfileId.get(emp.profile_id)
          const activeClock = activeClockByEmployeeId.get(emp.id)
          return {
            id: emp.id,
            name: profile.full_name ?? profile.email ?? 'Unknown',
            initials: getInitials(profile.full_name ?? profile.email ?? 'U'),
            role,
            status: (emp.status === 'active' ? 'Active' : emp.status === 'on_leave' ? 'On Leave' : 'Inactive') as Employee['status'],
            employmentType: (emp.employment_type ?? 'Part-Time') as EmploymentType,
            hireDate: emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
            payRate: emp.pay_rate != null ? `$${emp.pay_rate}/${emp.pay_type === 'hourly' ? 'hr' : emp.pay_type ?? 'hr'}` : null,
            hoursThisPeriod: null,
            clockStatus: activeClock ? 'in' as ClockStatus : 'out' as ClockStatus,
            clockedInSince: activeClock ? new Date(activeClock.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
            email: profile.email ?? '',
            phone: profile.phone ?? '',
            classesLed: trainerData?.total_classes_led,
            avgAttendance: undefined,
            bonusHitRate: undefined,
            promoCode: trainerData?.promo_code,
            promoRedemptions: undefined,
            promoRevenue: undefined,
            currentPeriodHours: undefined,
            grossPayEstimate: undefined,
            ytdGross: undefined,
            ytdBonuses: undefined,
          }
        })
        setEmployees(mapped)
      }

      // Fetch payroll periods
      const { data: ppData } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .order('period_start', { ascending: false })

      if (ppData && ppData.length > 0) {
        const mapped: PayPeriod[] = ppData.map((pp: any) => ({
          id: pp.id,
          label: `${new Date(pp.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(pp.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          range: `${new Date(pp.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(pp.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          rows: [],  // Payroll line items are computed separately, not stored as a JSON column
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
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] dark:bg-[#0F0F11]">
        <Spinner className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <motion.div data-testid="operations-page-root" {...fadeInUp} className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Operations</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Employee management, scheduling, payroll, and permissions</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
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
                    ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
