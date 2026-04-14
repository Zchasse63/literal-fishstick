// ─── Shared types & helpers for Members sub-components ──────

export type FilterTab = 'All' | 'Active' | 'Paused' | 'At Risk' | 'New'
export type ProfileTab = 'Overview' | 'Activity' | 'History' | 'Financials' | 'Communications'

/**
 * Sort key for the members directory. All are real columns. Default order
 * is `last_visit DESC` with `full_name ASC` as a tiebreaker — that's the
 * signal that answers "who's engaging now?" first.
 */
export type SortKey =
  | 'last_visit_desc'   // most recent visits first (default)
  | 'name_asc'          // alphabetical
  | 'join_date_desc'    // newest members first
  | 'ltv_desc'          // highest lifetime value first
  | 'total_visits_desc' // most engaged first

export type EngagementStatus = 'subscriber' | 'active' | 'engaged' | 'cooling' | 'at_risk' | 'lapsed_with_credits' | 'lapsed' | 'churned' | 'new_unused' | 'lead_only'
export type BehaviorSegment = 'power_user' | 'classpass_repeat' | 'new_never_booked' | 'one_and_done' | 'regular'
export type AcquisitionChannel = 'classpass' | 'website' | 'direct' | 'mobile_app'

export interface Member {
  id: string
  // BUG-013: members.id and profiles.id are distinct UUIDs. The directory
  // query maps row.id → Member.id (members.id, used for bookings/transactions
  // FK lookups), but the per-member API routes (PUT/DELETE/pause/upgrade)
  // expect URL [id] = profile_id. profileId is the bridge until BUG-013 is
  // resolved at the broader scope in a future tier.
  profileId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  avatar: string // initials
  avatarColor: string
  membership: string
  membershipPrice: number
  membershipType: 'unlimited' | '10-class' | '6-class' | 'credit-pack'
  status: 'active' | 'paused' | 'at-risk' | 'new'
  lastVisit: string           // formatted relative ("2 days ago", "Never")
  lastVisitAt: string | null  // raw ISO timestamp, for client-side sorting
  credits: number | null
  ltv: number
  joinDate: string            // formatted for display
  joinDateAt: string | null   // raw ISO
  totalVisits: number
  avgVisitsPerWeek: number
  notes: string | null
  excludeFromAnalytics?: boolean
  // member_360 enrichment fields
  engagementStatus?: EngagementStatus | null
  acquisitionChannel?: AcquisitionChannel | null
  behaviorSegment?: BehaviorSegment | null
}

export interface MemberBooking {
  className: string
  startsAt: string
  status: string
}

export interface MemberTransaction {
  amount: number
  type: string
  status: string
  description: string | null
  createdAt: string
}

// ─── Helpers ────────────────────────────────────────────────
export function statusDot(status: Member['status']) {
  const colors: Record<Member['status'], string> = {
    active: 'bg-emerald-500',
    paused: 'bg-amber-500',
    'at-risk': 'bg-orange-500',
    new: 'bg-indigo-500',
  }
  return colors[status]
}

export function statusLabel(status: Member['status']) {
  const labels: Record<Member['status'], string> = {
    active: 'Active',
    paused: 'Paused',
    'at-risk': 'At Risk',
    new: 'New',
  }
  return labels[status]
}

export function membershipBadgeColor(type: Member['membershipType']) {
  const colors: Record<Member['membershipType'], string> = {
    unlimited: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    '10-class': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    '6-class': 'bg-amber-50 text-amber-700 border-amber-200',
    'credit-pack': 'bg-violet-50 text-violet-700 border-violet-200',
  }
  return colors[type]
}

// ─── Member 360 Helpers ────────────────────────────────────
export function engagementDotColor(status: EngagementStatus | null | undefined): string {
  if (!status) return 'bg-gray-300'
  const colors: Record<EngagementStatus, string> = {
    subscriber: 'bg-purple-500',
    active: 'bg-green-500',
    engaged: 'bg-blue-500',
    cooling: 'bg-yellow-500',
    at_risk: 'bg-orange-500',
    lapsed_with_credits: 'bg-red-500',
    lapsed: 'bg-gray-500',
    churned: 'bg-gray-800',
    new_unused: 'bg-sky-500',
    lead_only: 'bg-slate-400',
  }
  return colors[status] || 'bg-gray-300'
}

export function engagementLabel(status: EngagementStatus | null | undefined): string {
  if (!status) return ''
  const labels: Record<EngagementStatus, string> = {
    subscriber: 'Subscriber',
    active: 'Active',
    engaged: 'Engaged',
    cooling: 'Cooling Off',
    at_risk: 'At Risk',
    lapsed_with_credits: 'Lapsed (Has Credits)',
    lapsed: 'Lapsed',
    churned: 'Churned',
    new_unused: 'New (Unused)',
    lead_only: 'Lead Only',
  }
  return labels[status] || ''
}

export function acquisitionBadgeConfig(channel: AcquisitionChannel | null | undefined): { label: string; classes: string } | null {
  if (!channel) return null
  const config: Record<AcquisitionChannel, { label: string; classes: string }> = {
    classpass: { label: 'ClassPass', classes: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
    website: { label: 'Website', classes: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
    direct: { label: 'Direct', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
    mobile_app: { label: 'Mobile App', classes: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  }
  return config[channel] || null
}

// ─── Heatmap Data (GitHub-style, from real visit dates) ─────
export const HEATMAP_WEEKS = 12
const HEATMAP_DAYS = 7

/**
 * Build a 12-week × 7-day heatmap grid from an array of visit dates.
 * Each cell is the number of visits that occurred on that day.
 * Weeks are ordered oldest → newest (week 0 = 12 weeks ago).
 */
export function buildHeatmapFromVisits(visitDates: string[]): number[][] {
  const now = new Date()
  // Snap to the current Sunday, then go back 11 full weeks so the
  // current partial week occupies week index 11 (the rightmost column).
  const currentSunday = new Date(now)
  currentSunday.setDate(now.getDate() - now.getDay())
  currentSunday.setHours(0, 0, 0, 0)

  const startOfWindow = new Date(currentSunday)
  startOfWindow.setDate(currentSunday.getDate() - (HEATMAP_WEEKS - 1) * 7)

  // Initialize empty grid
  const data: number[][] = Array.from({ length: HEATMAP_WEEKS }, () =>
    Array.from({ length: HEATMAP_DAYS }, () => 0)
  )

  for (const dateStr of visitDates) {
    const d = new Date(dateStr)
    const diffMs = d.getTime() - startOfWindow.getTime()
    if (diffMs < 0) continue // before the window
    const dayIndex = Math.floor(diffMs / (24 * 60 * 60 * 1000))
    const week = Math.floor(dayIndex / 7)
    const day = dayIndex % 7
    if (week >= 0 && week < HEATMAP_WEEKS && day >= 0 && day < HEATMAP_DAYS) {
      data[week][day]++
    }
  }

  return data
}

/** Empty heatmap for members with no visit data */
export const emptyHeatmap: number[][] = Array.from({ length: HEATMAP_WEEKS }, () =>
  Array.from({ length: HEATMAP_DAYS }, () => 0)
)

export function heatmapColor(val: number) {
  if (val === 0) return 'bg-gray-100'
  if (val === 1) return 'bg-indigo-100'
  if (val === 2) return 'bg-indigo-200'
  if (val === 3) return 'bg-indigo-400'
  return 'bg-indigo-600'
}
