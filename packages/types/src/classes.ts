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
  template_id: string | null
  name: string
  class_type: ClassType
  date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string // HH:MM
  duration_minutes: number
  capacity: number
  booked_count: number
  checked_in_count: number
  trainer_id: string | null
  trainer_name: string | null
  status: ClassStatus
  notes: string | null
  cancelled_at: string | null
  cancelled_reason: string | null
  bonus_threshold: number // default 7
  bonus_earned: boolean
  created_at: string
  updated_at: string
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
