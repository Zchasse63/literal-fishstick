// ─── Shared types & helpers for Members sub-components ──────

export type FilterTab = 'All' | 'Active' | 'Paused' | 'At Risk' | 'New'
export type ProfileTab = 'Overview' | 'History' | 'Financials' | 'Communications'

export type EngagementStatus = 'engaged' | 'active' | 'cooling' | 'at_risk' | 'lapsed' | 'never_visited'
export type BehaviorSegment = 'power_user' | 'classpass_repeat' | 'new_never_booked' | 'one_and_done' | 'regular'
export type AcquisitionChannel = 'classpass' | 'website' | 'direct' | 'mobile_app'

export interface Member {
  id: string
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
  lastVisit: string
  credits: number | null
  ltv: number
  joinDate: string
  totalVisits: number
  avgVisitsPerWeek: number
  nextBilling: string
  paymentMethod: string
  preferredTime: string
  preferredType: string
  guidedSessions: number
  avgDuration: string
  notes: string | null
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
    engaged: 'bg-emerald-500',
    active: 'bg-blue-500',
    cooling: 'bg-yellow-500',
    at_risk: 'bg-orange-500',
    lapsed: 'bg-red-500',
    never_visited: 'bg-gray-400',
  }
  return colors[status] || 'bg-gray-300'
}

export function engagementLabel(status: EngagementStatus | null | undefined): string {
  if (!status) return ''
  const labels: Record<EngagementStatus, string> = {
    engaged: 'Engaged',
    active: 'Active',
    cooling: 'Cooling Off',
    at_risk: 'At Risk',
    lapsed: 'Lapsed',
    never_visited: 'Never Visited',
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

// ─── Heatmap Data (simplified GitHub-style) ─────────────────
const HEATMAP_WEEKS = 12
const HEATMAP_DAYS = 7
function generateHeatmap() {
  const data: number[][] = []
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const week: number[] = []
    for (let d = 0; d < HEATMAP_DAYS; d++) {
      const base = d < 5 ? 0.6 : 0.3
      week.push(Math.random() < base ? Math.floor(Math.random() * 4) + 1 : 0)
    }
    data.push(week)
  }
  return data
}

export const heatmapData = generateHeatmap()

export function heatmapColor(val: number) {
  if (val === 0) return 'bg-gray-100'
  if (val === 1) return 'bg-indigo-100'
  if (val === 2) return 'bg-indigo-200'
  if (val === 3) return 'bg-indigo-400'
  return 'bg-indigo-600'
}
