import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { KpiDeepDiveClient } from './_components/KpiDeepDiveClient'

const TAKEOVER_DATE = '2026-03-01'
const BASELINE_START = '2024-01-01'

export default async function KpiDeepDivePage() {
  const supabase = await createServerClient()

  // ── Current period: since takeover ──────────────────────
  const { data: currentRaw } = await supabase
    .from('daily_metrics')
    .select('revenue, attendance, new_members')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .gte('metric_date', TAKEOVER_DATE)

  const current = {
    revenue: 0,
    attendance: 0,
    newMembers: 0,
  }

  if (currentRaw) {
    for (const row of currentRaw) {
      current.revenue += Number(row.revenue ?? 0)
      current.attendance += Number(row.attendance ?? 0)
      current.newMembers += Number(row.new_members ?? 0)
    }
  }

  // ── Baseline period: monthly averages before takeover ───
  const { data: baselineRaw } = await supabase
    .from('daily_metrics')
    .select('revenue, attendance, new_members')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .gte('metric_date', BASELINE_START)
    .lt('metric_date', TAKEOVER_DATE)

  const baseline = {
    totalRevenue: 0,
    totalAttendance: 0,
    totalNewMembers: 0,
    dayCount: 0,
  }

  if (baselineRaw) {
    baseline.dayCount = baselineRaw.length
    for (const row of baselineRaw) {
      baseline.totalRevenue += Number(row.revenue ?? 0)
      baseline.totalAttendance += Number(row.attendance ?? 0)
      baseline.totalNewMembers += Number(row.new_members ?? 0)
    }
  }

  // Approximate baseline months (avoid division by zero)
  const baselineMonths = Math.max(baseline.dayCount / 30, 1)

  const baselineMonthly = {
    revenue: baseline.totalRevenue / baselineMonths,
    attendance: baseline.totalAttendance / baselineMonths,
    newMembers: baseline.totalNewMembers / baselineMonths,
  }

  return (
    <KpiDeepDiveClient
      initialSummary={{
        current,
        baselineMonthly,
        takeoverDate: TAKEOVER_DATE,
        baselineStart: BASELINE_START,
      }}
    />
  )
}
