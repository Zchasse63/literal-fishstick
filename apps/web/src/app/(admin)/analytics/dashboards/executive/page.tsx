import { ExecutiveDashboardClient } from './_components/ExecutiveDashboardClient'
import { getAdminClient } from '@/lib/inngest/helpers'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * Executive Dashboard RSC (MED-015).
 *
 * Fetches initial KPI summary server-side so the dashboard renders with data
 * on first paint instead of showing a loading skeleton. The client component
 * still fetches revenue breakdown, cohorts, and AI insights on mount because
 * those involve complex aggregations or external APIs.
 */
export default async function ExecutiveDashboardPage() {
  let initialKpiMetrics: { label: string; value: string; trend: number; href: string; iconName: string }[] | undefined

  try {
    const db = getAdminClient()
    const studioId = process.env.DEFAULT_STUDIO_ID || DEFAULT_STUDIO_ID

    // Quick KPI data: active members and total revenue MTD
    const [membersRes, revenueRes] = await Promise.all([
      db
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studioId)
        .eq('membership_status', 'active'),
      db
        .from('transactions')
        .select('amount')
        .eq('studio_id', studioId)
        .eq('status', 'completed')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ])

    const activeMemberCount = membersRes.count ?? 0
    const revenueMtd = (revenueRes.data ?? []).reduce((sum, t: { amount: number }) => sum + (t.amount || 0), 0) / 100

    const fmt = (v: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

    initialKpiMetrics = [
      { label: 'Active Members', value: String(activeMemberCount), trend: 0, href: '/members', iconName: 'Users' },
      { label: 'Revenue MTD', value: fmt(revenueMtd), trend: 0, href: '/revenue', iconName: 'CreditCard' },
    ]
  } catch {
    // On error, the client component will fetch everything itself
    initialKpiMetrics = undefined
  }

  return <ExecutiveDashboardClient initialKpiMetrics={initialKpiMetrics} />
}
