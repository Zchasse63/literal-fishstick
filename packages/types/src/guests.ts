// Guest Pass types

export type GuestInviteStatus = 'pending' | 'registered' | 'checked_in' | 'expired' | 'cancelled'

export interface GuestInvite {
  id: string
  studio_id: string
  host_member_id: string
  class_id: string
  invite_code: string // unique code for QR/link
  status: GuestInviteStatus
  expires_at: string // class start time
  created_at: string
}

export interface GuestProfile {
  id: string
  studio_id: string
  name: string
  email: string
  phone: string | null
  waiver_signed: boolean
  waiver_signed_at: string | null
  visit_count: number
  converted_to_member: boolean
  converted_member_id: string | null
  created_at: string
}

export interface GuestVisit {
  id: string
  studio_id: string
  guest_id: string
  host_member_id: string
  class_id: string
  invite_id: string
  checked_in_at: string | null
  created_at: string
}

export interface MemberReferralConversion {
  id: string
  studio_id: string
  guest_id: string
  new_member_id: string
  referring_member_id: string
  conversion_date: string
  reward_type: string | null // TBD — future rewards system
  reward_issued: boolean
  created_at: string
}
