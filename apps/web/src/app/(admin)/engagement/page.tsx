'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Trophy,
  Medal,
  Flame,
  Snowflake,
  Star,
  Sun,
  CalendarCheck,
  Zap,
  Users,
  Clock,
  Gift,
  Target,
  TrendingUp,
  Crown,
  Heart,
} from 'lucide-react'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type Tab = 'leaderboard' | 'achievements' | 'challenges'

interface LeaderboardMember {
  rank: number
  name: string
  totalVisits: number
  currentStreak: number
  referrals: number
  ltv: number
  badge: string
}

interface Achievement {
  id: string
  name: string
  icon: React.ElementType
  color: string
  iconBg: string
  description: string
  criteria: string
  memberCount: number
}

interface Challenge {
  id: string
  name: string
  description: string
  progress: number
  total: number
  participants: number
  endDate: string
  reward: string
  status: 'active' | 'ongoing'
}

// ─── Static data for achievements and challenges (config, not DB data) ───
const ACHIEVEMENTS: Achievement[] = [
  { id: '100-sessions', name: '100 Sessions', icon: Trophy, color: 'text-emerald-500', iconBg: 'bg-emerald-100', description: 'Reach 100 total visits', criteria: 'Visit 100 times', memberCount: 0 },
  { id: 'streak-warrior', name: 'Streak Warrior', icon: Flame, color: 'text-orange-500', iconBg: 'bg-orange-100', description: 'Maintain a 7-day streak', criteria: '7-day visit streak', memberCount: 0 },
  { id: 'cold-plunge-pro', name: 'Cold Plunge Pro', icon: Snowflake, color: 'text-teal-500', iconBg: 'bg-teal-100', description: 'Complete 50 cold plunges', criteria: '50 cold plunge sessions', memberCount: 0 },
  { id: 'community-star', name: 'Community Star', icon: Star, color: 'text-amber-500', iconBg: 'bg-amber-100', description: 'Be a top referrer', criteria: 'Refer 3+ members', memberCount: 0 },
  { id: 'early-bird', name: 'Early Bird', icon: Sun, color: 'text-indigo-600', iconBg: 'bg-indigo-100', description: 'Morning session regular', criteria: '10 morning sessions', memberCount: 0 },
  { id: 'consistency-king', name: 'Consistency King', icon: CalendarCheck, color: 'text-violet-500', iconBg: 'bg-violet-100', description: 'Unwavering commitment', criteria: 'Visit every week for 3 months', memberCount: 0 },
]

const CHALLENGES: Challenge[] = [
  { id: 'march-madness', name: 'March Madness', description: 'Visit 15 times in March', progress: 0, total: 15, participants: 0, endDate: 'Mar 31', reward: 'Exclusive March Madness badge + free guest pass', status: 'active' },
  { id: 'bring-a-friend', name: 'Bring a Friend', description: 'Refer 1 new member', progress: 0, total: 1, participants: 0, endDate: 'Ongoing', reward: '$10 credit for each successful referral', status: 'ongoing' },
  { id: 'guided-explorer', name: 'Guided Explorer', description: 'Try 3 different guided classes', progress: 0, total: 3, participants: 0, endDate: 'Apr 15', reward: 'Free guided session + Guided Explorer badge', status: 'active' },
]

function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 animate-pulse rounded', className)} />
}

// ─── Rank Badge ──────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-sm font-black text-white shadow-sm">
        1
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-sm font-black text-white shadow-sm">
        2
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-amber-700 text-sm font-black text-white shadow-sm">
        3
      </div>
    )
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500">
      {rank}
    </div>
  )
}

// ─── Member Badge ──────────────────────────────────────────────
function MemberBadge({ badge }: { badge: string }) {
  const styles: Record<string, string> = {
    Legend: 'bg-amber-50 text-amber-600 border-amber-200',
    Elite: 'bg-violet-50 text-violet-600 border-violet-200',
    Pro: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    Regular: 'bg-gray-50 text-gray-500 border-gray-200',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest',
        styles[badge] ?? styles.Regular
      )}
    >
      {badge}
    </span>
  )
}

// ─── Page Component ──────────────────────────────────────────
export default function EngagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard')
  const [activeMemberCount, setActiveMemberCount] = useState<number | null>(null)
  const supabase = createBrowserClient()

  // Fetch active member count
  useEffect(() => {
    async function fetchCount() {
      const { count } = await supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'active')
      setActiveMemberCount(count ?? 0)
    }
    fetchCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'achievements', label: 'Achievements' },
    { key: 'challenges', label: 'Challenges' },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6 lg:p-8">
      {/* Header */}
      <motion.div {...fadeInUp} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Engagement</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gamification, leaderboards, and member challenges
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-900">
                {activeMemberCount !== null ? activeMemberCount : '\u2014'}
              </span>
              <span className="text-sm text-gray-500">active members</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Pill Tabs */}
      <motion.div {...fadeInUp} className="mb-6">
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-lg px-5 py-2 text-sm font-semibold transition-all',
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tab Content */}
      {activeTab === 'leaderboard' && <LeaderboardTab />}
      {activeTab === 'achievements' && <AchievementsTab />}
      {activeTab === 'challenges' && <ChallengesTab />}
    </div>
  )
}

// ─── Leaderboard Tab ──────────────────────────────────────────
function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardMember[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    async function fetchLeaderboard() {
      // Query members ordered by total_visits descending
      const { data } = await supabase
        .from('memberships')
        .select('*, profiles:member_id ( full_name )')
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'active')
        .order('total_visits', { ascending: false })
        .limit(50)

      const members: LeaderboardMember[] = (data ?? []).map((m: any, i: number) => {
        const visits = m.total_visits ?? 0
        let badge = 'Regular'
        if (visits >= 150) badge = 'Legend'
        else if (visits >= 100) badge = 'Elite'
        else if (visits >= 50) badge = 'Pro'

        return {
          rank: i + 1,
          name: m.profiles?.full_name ?? 'Unknown',
          totalVisits: visits,
          currentStreak: m.current_streak ?? 0,
          referrals: m.referral_count ?? 0,
          ltv: m.lifetime_value ?? 0,
          badge,
        }
      })
      setLeaderboard(members)
      setLoading(false)
    }
    fetchLeaderboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <LoadingSkeleton className="w-8 h-8 rounded-full" />
              <LoadingSkeleton className="w-9 h-9 rounded-full" />
              <LoadingSkeleton className="h-4 w-32 flex-1" />
              <LoadingSkeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (leaderboard.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-12 text-center">
        <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No leaderboard data yet</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
    >
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-[56px_1fr_100px_100px_90px_100px_90px] gap-4 border-b border-gray-100 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rank</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Name</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Visits</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Streak</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Referrals</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">LTV</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Badge</p>
        </div>

        {/* Table Rows */}
        {leaderboard.map((member, i) => (
          <motion.div
            key={member.rank}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.2,
              delay: i * 0.03,
              ease: [0.25, 1, 0.5, 1],
            }}
            className={cn(
              'grid grid-cols-[56px_1fr_100px_100px_90px_100px_90px] items-center gap-4 border-b border-gray-50 px-5 py-3.5 transition-colors hover:bg-gray-50',
              member.rank <= 3 && 'bg-gradient-to-r from-amber-50/50 to-transparent'
            )}
          >
            <div>
              <RankBadge rank={member.rank} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                {member.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <p className="text-sm font-medium text-gray-900">{member.name}</p>
              {member.rank === 1 && <Crown className="h-4 w-4 text-amber-400" />}
            </div>
            <p className="text-sm font-semibold tabular-nums text-gray-900">{member.totalVisits}</p>
            <div className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <p className="text-sm font-semibold tabular-nums text-gray-900">
                {member.currentStreak}d
              </p>
            </div>
            <p className="text-sm tabular-nums text-gray-600">{member.referrals}</p>
            <p className="text-sm font-semibold tabular-nums text-gray-900">
              ${member.ltv.toLocaleString()}
            </p>
            <MemberBadge badge={member.badge} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Achievements Tab ──────────────────────────────────────────
function AchievementsTab() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {ACHIEVEMENTS.map((achievement, i) => {
        const Icon = achievement.icon
        return (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.25,
              delay: i * 0.05,
              ease: [0.25, 1, 0.5, 1],
            }}
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
          >
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full',
                achievement.iconBg
              )}
            >
              <Icon className={cn('h-6 w-6', achievement.color)} />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-gray-900">{achievement.name}</h3>
            <p className="mt-1 text-xs text-gray-500">{achievement.description}</p>
            <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Unlock Criteria
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-700">{achievement.criteria}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Challenges Tab ──────────────────────────────────────────
function ChallengesTab() {
  return (
    <div className="space-y-4">
      {CHALLENGES.map((challenge, i) => (
        <motion.div
          key={challenge.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.25,
            delay: i * 0.05,
            ease: [0.25, 1, 0.5, 1],
          }}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100">
                <Target className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900">{challenge.name}</h3>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest',
                      challenge.status === 'active'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-amber-50 text-amber-600'
                    )}
                  >
                    {challenge.status === 'active' ? 'Active' : 'Ongoing'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{challenge.description}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{challenge.endDate}</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Progress
              </p>
              <p className="text-xs font-semibold tabular-nums text-gray-700">
                {challenge.progress} / {challenge.total}
              </p>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(challenge.progress / challenge.total) * 100}%`,
                }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.25, 1, 0.5, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{challenge.participants}</span>{' '}
                  participants
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5">
              <Gift className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium text-amber-700">{challenge.reward}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
