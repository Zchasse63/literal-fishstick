import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { TrainerPerformanceClient } from './_components/TrainerPerformanceClient'

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default async function TrainerPerformancePage() {
  const supabase = await createServerClient()

  const { data: trainers } = await supabase
    .from('trainers')
    .select('id, profile_id, total_classes_led, total_bonus_earned, total_commission_earned, promo_code, profiles:profile_id ( full_name )')
    .eq('studio_id', DEFAULT_STUDIO_ID)

  let mapped: any[] = []

  if (trainers && trainers.length > 0) {
    const trainerIds = trainers.map((t: any) => t.id)
    const { data: snapshots } = await supabase
      .from('trainer_metric_snapshots')
      .select('trainer_id, total_classes, avg_attendance, avg_capacity_utilization, classes_above_bonus_threshold, promo_code_conversions, revenue_attributed')
      .in('trainer_id', trainerIds)
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .order('period_end', { ascending: false })

    const snapshotMap: Record<string, any> = {}
    for (const s of (snapshots || [])) {
      if (!snapshotMap[s.trainer_id]) {
        snapshotMap[s.trainer_id] = s
      }
    }

    mapped = trainers.map((t: any) => {
      const profile = t.profiles as any
      const snap = snapshotMap[t.id]
      const totalClasses = snap?.total_classes ?? t.total_classes_led ?? 0
      const avgAtt = snap?.avg_attendance ?? 0
      const bonusThresholdClasses = snap?.classes_above_bonus_threshold ?? 0
      const bonusHitRate = totalClasses > 0 ? Math.round((bonusThresholdClasses / totalClasses) * 100) : 0

      return {
        id: t.id,
        name: profile?.full_name ?? 'Unknown',
        avatar: getInitials(profile?.full_name ?? 'U'),
        classesLed: totalClasses,
        avgAttendance: Math.round(avgAtt * 10) / 10,
        bonusHitRate,
        revenueAttributed: snap?.revenue_attributed ?? 0,
        promoConversions: snap?.promo_code_conversions ?? 0,
      }
    })
    mapped.sort((a: any, b: any) => b.avgAttendance - a.avgAttendance)
  }

  return <TrainerPerformanceClient initialTrainers={mapped} />
}
