// Class & Schedule types

export type ClassType = 'open_sauna' | 'guided'
export type ClassStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface ClassTemplate {
  id: string
  studio_id: string
  name: string
  class_type: ClassType
  description: string | null
  capacity: number // default 12
  duration_minutes: number // default 60
  day_of_week: DayOfWeek
  start_time: string // HH:MM format (24hr)
  trainer_id: string | null // null for Open Sauna
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClassInstance {
  id: string
  studio_id: string
  location_id: string | null
  class_type_id: string | null
  trainer_id: string | null
  title: string
  starts_at: string // ISO timestamptz
  ends_at: string // ISO timestamptz
  capacity: number
  booked_count: number
  checked_in_count: number
  status: ClassStatus
  notes: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  glofox_id: string | null
  created_at: string
  updated_at: string
  // Joined fields (not in DB, populated via select joins)
  trainer_name?: string | null
}

export interface Equipment {
  id: string
  studio_id: string
  name: string
  type: 'sauna' | 'cold_plunge' | 'shower' | 'other'
  status: 'active' | 'maintenance' | 'cleaning' | 'inactive'
  capacity: number | null
  notes: string | null
  created_at: string
  updated_at: string
}
