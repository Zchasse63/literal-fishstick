// Employee & Payroll types

export type EmploymentType = 'full_time' | 'part_time' | 'contract'
export type EmployeeStatus = 'active' | 'inactive' | 'terminated' | 'on_leave'
export type ClockStatus = 'clocked_in' | 'clocked_out' | 'on_break'
export type TimesheetStatus = 'pending' | 'approved' | 'disputed'
export type DocumentStatus = 'current' | 'expiring_soon' | 'expired' | 'missing'
export type DocumentUploadStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface Employee {
  id: string
  user_id: string
  studio_id: string
  employee_id_number: string | null
  employment_type: EmploymentType
  status: EmployeeStatus
  hire_date: string
  termination_date: string | null
  hourly_rate: number | null // cents — null if per-class only (trainers)
  department: string | null
  reporting_manager_id: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  direct_deposit_last_four: string | null
  direct_deposit_bank: string | null
  notes: string | null // admin-only
  created_at: string
  updated_at: string
}

export interface ClockEntry {
  id: string
  employee_id: string
  studio_id: string
  clock_in: string
  clock_out: string | null
  break_start: string | null
  break_end: string | null
  break_minutes: number
  total_hours: number | null // calculated on clock out
  geofence_verified_in: boolean
  geofence_verified_out: boolean | null
  latitude_in: number | null
  longitude_in: number | null
  latitude_out: number | null
  longitude_out: number | null
  status: ClockStatus
  manually_edited: boolean
  edited_by: string | null
  edit_reason: string | null
  created_at: string
  updated_at: string
}

export interface TimesheetPeriod {
  id: string
  studio_id: string
  employee_id: string
  period_start: string
  period_end: string
  regular_hours: number
  overtime_hours: number
  break_hours: number
  gross_pay: number // cents
  trainer_bonuses: number // cents
  promo_commissions: number // cents
  total_compensation: number // cents
  status: TimesheetStatus
  approved_at: string | null
  approved_by: string | null
  disputed_at: string | null
  dispute_reason: string | null
  created_at: string
}

export interface EmployeeDocument {
  id: string
  employee_id: string
  studio_id: string
  document_type: 'w4' | 'w9' | 'i9' | 'w2' | '1099' | 'contract' | 'certification' | 'direct_deposit' | 'other'
  name: string
  file_url: string
  status: DocumentStatus
  expires_at: string | null
  uploaded_at: string
  created_at: string
}

export interface TimeOffRequest {
  id: string
  employee_id: string
  studio_id: string
  start_date: string
  end_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'denied'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}
