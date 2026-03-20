// Meridian business constants
// All pricing in cents. All configurable values that may change per-studio.

export const PRICING = {
  UNLIMITED_MONTHLY: 22500,
  TEN_CLASS_MONTHLY: 18000,
  SIX_CLASS_MONTHLY: 12000,
  EIGHT_PACK: 22500,
  FOUR_PACK: 12000,
  SAMPLER: 6000,
  DROP_IN: 3900,
  PRIVATE_EVENT_FIRST_HOUR: 39500,
  GIFT_CARD_PRESETS: [3900, 12000, 22500], // $39, $120, $225
} as const

export const CLASS_CONFIG = {
  DEFAULT_CAPACITY: 12,
  DEFAULT_DURATION_MINUTES: 60,
  BONUS_THRESHOLD: 7,
} as const

export const TRAINER_PAY = {
  BASE_PER_CLASS: 3500, // $35
  BONUS_AMOUNT: 2000, // $20
  PROMO_COMMISSION_RATE: 0.10, // 10%
} as const

export const MEMBER_DISCOUNT = {
  RATE: 0.10, // 10%
} as const

export const GUEST_PASSES = {
  UNLIMITED: 2,
  TEN_CLASS: 1,
  SIX_CLASS: 1,
} as const

export const POLICY = {
  LATE_CANCEL_WINDOW_MINUTES: 60,
  STRIKE_WINDOW_DAYS: 30,
  STRIKE_PENALTIES: [0, 500, 1000], // 1st free, 2nd $5, 3rd $10
  CREDIT_GRACE_PERIOD_DAYS: 7,
  WAITLIST_CLAIM_WINDOW_MINUTES: 15,
  INVENTORY_HOLD_MINUTES: 15,
  CHECKOUT_LOCK_MINUTES: 30,
  PILOT_DISCOUNT_RATE: 0.20, // 20%
  NO_SHOW_LATE_THRESHOLD_PERCENT: 50, // checked in after 50% of class = no-show
} as const

export const GEOFENCING = {
  RADIUS_METERS: 200,
} as const

// Schedule templates for The Sauna Guys
export const WEEKDAY_SLOTS = ['17:00', '18:00', '19:00'] as const
export const WEEKEND_SLOTS = ['09:00', '10:00', '11:00', '12:00'] as const
