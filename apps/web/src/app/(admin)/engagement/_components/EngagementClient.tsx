'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Trophy,
  Users,
  Crown,
  Sparkles,
  Target,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
type Tab = 'leaderboard' | 'achievements' | 'challenges'

interface LeaderboardMember {
  rank: number
  name: string
  totalVisits: number
  // Phase 3: currentStreak and referrals columns hidden until data pipelines are built
  // - currentStreak requires visit_streaks table / daily aggregation job
  // - referrals requires referrals table with referrer_id -> referred_member_id tracking
  ltv: number
  badge: string
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
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-bold text-gray-500 dark:text-gray-400">
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
    Regular: 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-800',
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

// ─── Coming Soon Placeholder ────────────────────────────────
function ComingSoonPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm p-16 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 mx-auto mb-4">
        <Icon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        {description}
      </p>
    </motion.div>
  )
}

// ─── Props ──────────────────────────────────────────────────
interface EngagementClientProps {
  initialActiveMemberCount: number
  initialLeaderboard: LeaderboardMember[]
}

// ─── Client Component ───────────────────────────────────────
export default function EngagementClient({ initialActiveMemberCount, initialLeaderboard }: EngagementClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard')
  const [activeMemberCount] = useState(initialActiveMemberCount)
  const [leaderboard] = useState<LeaderboardMember[]>(initialLeaderboard)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'achievements', label: 'Achievements' },
    { key: 'challenges', label: 'Challenges' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Engagement</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Gamification, leaderboards, and member challenges
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2.5 shadow-sm">
              <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {activeMemberCount}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">active members</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Pill Tabs */}
      <motion.div {...fadeInUp} className="mb-6">
        <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-lg px-5 py-2 text-sm font-semibold transition-all',
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tab Content */}
      {activeTab === 'leaderboard' && <LeaderboardTab leaderboard={leaderboard} />}
      {activeTab === 'achievements' && (
        <ComingSoonPlaceholder
          icon={Sparkles}
          title="Member Achievements"
          description="Achievements will reward members for milestones like visit streaks, cold plunge records, and referral activity. Requires the gamification engine and visit streak / referral data pipelines to be built."
        />
      )}
      {activeTab === 'challenges' && (
        <ComingSoonPlaceholder
          icon={Target}
          title="Studio Challenges"
          description="Challenges will let you create time-bound goals for members with progress tracking, participant counts, and reward distribution. Requires the challenge engine and enrollment tracking pipelines."
        />
      )}
    </div>
  )
}

// ─── Leaderboard Tab ──────────────────────────────────────────
function LeaderboardTab({ leaderboard }: { leaderboard: LeaderboardMember[] }) {
  if (leaderboard.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm p-12 text-center">
        <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400 dark:text-gray-500">No leaderboard data yet</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
    >
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
        {/* Table Header */}
        {/* Phase 3: Streak and Referrals columns shown as "Coming Soon" until data pipelines are built */}
        <div className="grid grid-cols-[56px_1fr_100px_100px_90px_100px_90px] gap-4 border-b border-gray-100 dark:border-gray-800 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Rank</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Name</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Visits</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Streak <span className="text-[8px] text-amber-500 ml-0.5">Coming Soon</span>
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Referrals <span className="text-[8px] text-amber-500 ml-0.5">Coming Soon</span>
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">LTV</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Badge</p>
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
              'grid grid-cols-[56px_1fr_100px_100px_90px_100px_90px] items-center gap-4 border-b border-gray-50 px-5 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
              member.rank <= 3 && 'bg-gradient-to-r from-amber-50/50 to-transparent'
            )}
          >
            <div>
              <RankBadge rank={member.rank} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-400">
                {member.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</p>
              {member.rank === 1 && <Crown className="h-4 w-4 text-amber-400" />}
            </div>
            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{member.totalVisits}</p>
            {/* Phase 3: Streak column — placeholder until visit_streaks pipeline */}
            <span className="text-sm text-gray-300 dark:text-gray-600">--</span>
            {/* Phase 3: Referrals column — placeholder until referrals pipeline */}
            <span className="text-sm text-gray-300 dark:text-gray-600">--</span>
            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              ${member.ltv.toLocaleString()}
            </p>
            <MemberBadge badge={member.badge} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
