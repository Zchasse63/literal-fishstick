import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { GrowthDashboardClient } from './_components/GrowthDashboardClient'

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1 day ago'
  return `${diffDays} days ago`
}

export default async function GrowthDashboardPage() {
  const supabase = await createServerClient()

  // Fetch at-risk members (active members sorted by oldest last_visit)
  const { data: members } = await supabase
    .from('members')
    .select('*, profiles:profile_id ( full_name, email )')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .eq('membership_status', 'active')
    .order('last_visit', { ascending: true, nullsFirst: true })
    .limit(10)

  const atRiskMembers = (members ?? []).map((m: any) => {
    const lastVisit = m.last_visit ? getTimeAgo(m.last_visit) : 'Never'
    const daysSince = m.last_visit
      ? Math.floor((Date.now() - new Date(m.last_visit).getTime()) / 86400000)
      : 999
    const riskScore = Math.min(99, Math.round(50 + daysSince * 2))
    return {
      name: m.profiles?.full_name ?? 'Unknown',
      membership: m.membership_tier ?? m.plan_code ?? 'Membership',
      lastVisit,
      riskScore,
      trend: daysSince > 14 ? 'inactive' : 'declining',
    }
  })

  // Fetch lead pipeline counts
  const stages = [
    { stage: 'New Leads', status: 'new', color: '#C4B5FD' },
    { stage: 'Contacted', status: 'contacted', color: '#A78BFA' },
    { stage: 'Trial', status: 'trial', color: '#8B5CF6' },
    { stage: 'Converted', status: 'converted', color: '#4F46E5' },
  ]

  const funnelResults = await Promise.all(
    stages.map(async (s) => {
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', DEFAULT_STUDIO_ID)
        .eq('status', s.status)
      return { stage: s.stage, count: count ?? 0, color: s.color }
    })
  )

  return (
    <GrowthDashboardClient
      initialAtRiskMembers={atRiskMembers}
      initialFunnelData={funnelResults}
    />
  )
}
