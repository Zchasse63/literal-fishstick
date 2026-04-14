import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import EngagementClient from './_components/EngagementClient'

export default async function EngagementPage() {
  const supabase = await createServerClient()

  const [countRes, leaderboardRes] = await Promise.all([
    supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('membership_status', 'active'),
    supabase
      .from('members')
      .select('*, profiles:profile_id ( full_name )')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('membership_status', 'active')
      .order('total_visits', { ascending: false })
      .limit(50),
  ])

  const initialActiveMemberCount = countRes.count ?? 0

  // NOTE: Streak and referral columns are hidden until Phase 3.
  // - currentStreak requires a visit_streaks table or daily aggregation job
  //   that calculates consecutive-day visit sequences per member.
  // - referrals requires a referrals table tracking referrer_id -> referred_member_id
  //   with conversion timestamps. Trainer promo codes exist but member-to-member
  //   referral tracking is not yet implemented.
  const initialLeaderboard = (leaderboardRes.data ?? []).map((m: any, i: number) => {
    const visits = m.total_visits ?? 0
    let badge = 'Regular'
    if (visits >= 150) badge = 'Legend'
    else if (visits >= 100) badge = 'Elite'
    else if (visits >= 50) badge = 'Pro'

    return {
      rank: i + 1,
      name: m.profiles?.full_name ?? 'Unknown',
      totalVisits: visits,
      ltv: Math.round((m.lifetime_value ?? 0) / 100),
      badge,
    }
  })

  return (
    <EngagementClient
      initialActiveMemberCount={initialActiveMemberCount}
      initialLeaderboard={initialLeaderboard}
    />
  )
}
