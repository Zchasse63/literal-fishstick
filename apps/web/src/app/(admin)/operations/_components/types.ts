// ─── Shared types & helpers for Operations sub-components ──────

export type MainTab = 'directory' | 'schedule' | 'payroll' | 'permissions'
export type RoleFilter = 'All' | 'Trainers' | 'Front Desk' | 'Managers' | 'Active' | 'Inactive'
export type DetailTab = 'overview' | 'performance' | 'pay'

export type Role = 'Trainer' | 'Front Desk' | 'Manager' | 'Owner'
export type EmploymentType = 'Part-Time' | 'Full-Time' | 'Contract'
export type ClockStatus = 'in' | 'out' | null

export interface Employee {
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

export interface PayrollRow {
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

export interface PayPeriod {
  id: string
  label: string
  range: string
  rows: PayrollRow[]
}

export interface ScheduleSlot {
  type: 'open' | 'guided'
  trainer?: string
  booked: number
  capacity: number
}

export interface PermissionRow {
  category: string
  permission: string
  owner: boolean
  admin: boolean
  trainer: boolean
  receptionist: boolean
}

// ─── Constants ────────────────────────────────────────────────
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const SCHEDULE_TIMES = ['5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM']
export const ROLE_FILTERS: RoleFilter[] = ['All', 'Trainers', 'Front Desk', 'Managers', 'Active', 'Inactive']

// Schedule data is computed from classes — empty until classes are scheduled
export const TRAINER_SCHEDULE: Record<string, ScheduleSlot> = {}

export const DEFAULT_PERMISSIONS: PermissionRow[] = [
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
export const roleBadgeClasses: Record<Role, string> = {
  Trainer: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Front Desk': 'bg-teal-50 text-teal-700 border-teal-200',
  Manager: 'bg-amber-50 text-amber-700 border-amber-200',
  Owner: 'bg-violet-50 text-violet-700 border-violet-200',
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
