import { ExecutiveDashboardClient } from './_components/ExecutiveDashboardClient'

export default function ExecutiveDashboardPage() {
  // All data for this dashboard comes from internal API routes
  // (/api/analytics/summary, /api/analytics/revenue-breakdown, /api/analytics/cohorts,
  // /api/ai/insights) which cannot be called from RSC without a full URL.
  // The client component handles its own data fetching via those API routes.
  return <ExecutiveDashboardClient />
}
