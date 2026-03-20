// Booking & Waitlist types

export type BookingStatus = 'confirmed' | 'checked_in' | 'cancelled' | 'no_show' | 'late_cancelled'
export type WaitlistStatus = 'waiting' | 'offered' | 'claimed' | 'expired' | 'cancelled'
export type CancellationType = 'member' | 'studio' | 'system'

export interface Booking {
  id: string
  studio_id: string
  class_id: string
  member_id: string
  status: BookingStatus
  credit_pack_id: string | null // which credit pack was deducted
  credits_deducted: number // typically 1
  checked_in_at: string | null
  cancelled_at: string | null
  cancellation_type: CancellationType | null
  is_late_cancellation: boolean
  is_walk_in: boolean
  is_guest: boolean
  guest_id: string | null
  booked_by_user_id: string // who made the booking (staff or member)
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WaitlistEntry {
  id: string
  studio_id: string
  class_id: string
  member_id: string
  status: WaitlistStatus
  position: number
  offered_at: string | null
  claim_deadline: string | null // 15-min window (shorter if class starts sooner)
  claimed_at: string | null
  expired_at: string | null
  booking_id: string | null // created when claimed
  created_at: string
}
