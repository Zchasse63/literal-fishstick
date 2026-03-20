// Trainer-specific types

export interface TrainerProfile {
  id: string
  user_id: string
  studio_id: string
  display_name: string
  bio: string | null
  specialties: string[]
  photo_url: string | null
  promo_code: string | null
  promo_commission_rate: number // 0.10 = 10%
  base_pay_per_class: number // cents (3500 = $35)
  bonus_amount: number // cents (2000 = $20)
  bonus_threshold: number // default 7
  is_public: boolean // visible on member-facing profiles
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TrainerPayout {
  id: string
  trainer_id: string
  studio_id: string
  pay_period_start: string
  pay_period_end: string
  classes_led: number
  total_base_pay: number // cents
  bonuses_earned: number
  bonus_classes: number // how many classes hit threshold
  promo_commissions: number // cents
  total_payout: number // cents
  status: 'pending' | 'approved' | 'paid'
  approved_at: string | null
  approved_by: string | null
  created_at: string
}

export interface PromoAttribution {
  id: string
  studio_id: string
  trainer_id: string
  member_id: string
  promo_code: string
  purchase_type: 'membership' | 'credit_pack'
  purchase_amount: number // cents
  commission_amount: number // cents
  commission_paid: boolean
  attributed_at: string
  created_at: string
}
