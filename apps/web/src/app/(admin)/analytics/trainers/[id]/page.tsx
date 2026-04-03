import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { TrainerDetailClient } from './_components/TrainerDetailClient'

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default async function TrainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: trainerId } = await params
  const supabase = await createServerClient()

  const { data: trainer } = await supabase
    .from('trainers')
    .select('*, profiles:profile_id ( full_name )')
    .eq('id', trainerId)
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .single()

  if (!trainer) {
    return <TrainerDetailClient trainer={null} aiNarrative="" kpiCards={[]} monthlyPerformance={[]} classBreakdown={[]} highlights={[]} growthAreas={[]} payroll={{ basePay: 0, bonuses: 0, promoCommission: 0 }} />
  }

  const profile = trainer.profiles as any

  const { data: snapshots } = await supabase
    .from('trainer_metric_snapshots')
    .select('*')
    .eq('trainer_id', trainerId)
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('period_end', { ascending: false })
    .limit(6)

  const latestSnap = snapshots?.[0] ?? null
  const totalClasses = latestSnap?.total_classes ?? trainer.total_classes_led ?? 0
  const avgAtt = latestSnap?.avg_attendance ?? 0
  const bonusThresholdClasses = latestSnap?.classes_above_bonus_threshold ?? 0
  const bonusHitRate = totalClasses > 0 ? Math.round((bonusThresholdClasses / totalClasses) * 100) : 0
  const uniqueMembers = latestSnap?.unique_members_served ?? 0
  const repeatRate = latestSnap?.repeat_member_rate ?? 0

  const trainerData = {
    id: trainer.id,
    name: profile?.full_name ?? 'Unknown',
    avatar: getInitials(profile?.full_name ?? 'U'),
    role: 'Trainer',
    classesPerWeek: totalClasses > 0 ? Math.round(totalClasses / 4) : 0,
    totalMembersServed: uniqueMembers,
  }

  const kpiCards = [
    { label: 'Avg Attendance', value: String(Math.round(avgAtt * 10) / 10), change: '\u2014', changeType: 'flat', iconName: 'Users' },
    { label: 'Bonus Hit Rate', value: `${bonusHitRate}%`, change: '\u2014', changeType: 'flat', iconName: 'Trophy' },
    { label: 'Revenue Attributed', value: formatCurrency(latestSnap?.revenue_attributed ?? 0), change: '\u2014', changeType: 'flat', iconName: 'DollarSign' },
    { label: 'Promo Conversions', value: String(latestSnap?.promo_code_conversions ?? 0), change: '\u2014', changeType: 'flat', iconName: 'Tag' },
    { label: 'Repeat Member Rate', value: repeatRate > 0 ? `${Math.round(repeatRate * 100)}%` : '\u2014', change: '\u2014', changeType: 'flat', iconName: 'Repeat' },
  ]

  const payroll = {
    basePay: latestSnap?.base_pay ?? 0,
    bonuses: latestSnap?.bonus_pay ?? 0,
    promoCommission: latestSnap?.promo_commission ?? 0,
  }

  const aiNarrative = latestSnap?.ai_narrative ?? ''
  const highlights = (latestSnap?.ai_highlights && Array.isArray(latestSnap.ai_highlights)) ? latestSnap.ai_highlights : []
  const growthAreas = (latestSnap?.ai_growth_areas && Array.isArray(latestSnap.ai_growth_areas)) ? latestSnap.ai_growth_areas : []

  const monthlyPerformance = (snapshots && snapshots.length > 0)
    ? snapshots.slice().reverse().map((s: any) => {
        const periodStart = new Date(s.period_start)
        const monthLabel = periodStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        return {
          month: monthLabel,
          avgAttendance: Math.round((s.avg_attendance ?? 0) * 10) / 10,
          fillRate: Math.round((s.avg_capacity_utilization ?? 0) * 100),
        }
      })
    : []

  return (
    <TrainerDetailClient
      trainer={trainerData}
      aiNarrative={aiNarrative}
      kpiCards={kpiCards}
      monthlyPerformance={monthlyPerformance}
      classBreakdown={[]}
      highlights={highlights}
      growthAreas={growthAreas}
      payroll={payroll}
    />
  )
}
