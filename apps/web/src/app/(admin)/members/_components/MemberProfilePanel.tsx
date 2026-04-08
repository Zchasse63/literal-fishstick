'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  X,
  Sparkles,
  CreditCard,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  Tag,
  Heart,
  Flame,
  Zap,
  Pause,
  ArrowUp,
  Mail,
  Phone,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import MemberUpgradeModal from './MemberUpgradeModal'
import MemberPauseModal from './MemberPauseModal'
import AIDetailModal from './AIDetailModal'
import type { Member, MemberBooking, MemberTransaction, ProfileTab } from './types'
import { statusDot, statusLabel, membershipBadgeColor, heatmapData, heatmapColor } from './types'

export default function MemberProfilePanel({
  member,
  onClose,
  profileTab,
  setProfileTab,
  memberBookings,
  memberTransactions,
  memberTags,
  detailLoading,
  onShowToast,
}: {
  member: Member
  onClose: () => void
  profileTab: ProfileTab
  setProfileTab: (t: ProfileTab) => void
  memberBookings: MemberBooking[]
  memberTransactions: MemberTransaction[]
  memberTags: string[]
  detailLoading: boolean
  onShowToast?: (msg: string) => void
}) {
  const notify = onShowToast ?? ((msg: string) => { /* no-op if not passed */ })
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [aiDetailOpen, setAiDetailOpen] = useState(false)
  return (
    <motion.div
      key={member.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      className="lg:col-span-4 space-y-4"
    >
      {/* Profile Header Card */}
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-14 w-14 rounded-full flex items-center justify-center text-white text-lg font-bold',
              member.avatarColor
            )}>
              {member.avatar}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {member.firstName} {member.lastName}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border',
                  membershipBadgeColor(member.membershipType)
                )}>
                  {member.membership}
                </span>
                <div className="flex items-center gap-1">
                  <div className={cn('h-1.5 w-1.5 rounded-full', statusDot(member.status))} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{statusLabel(member.status)}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Joined {member.joinDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contact Row */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => { if (member.email) window.location.href = `mailto:${member.email}` }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 transition-colors"
          >
            <Mail className="h-3 w-3" />
            Email
          </button>
          <button
            onClick={() => { if (member.phone) window.location.href = `tel:${member.phone}` }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 transition-colors"
          >
            <Phone className="h-3 w-3" />
            Call
          </button>
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
            <Tag className="h-2.5 w-2.5" />
            10% Member Discount
          </span>
        </div>

        {/* View Full Profile */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Link
            href={`/members/${member.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View Full Profile
          </Link>
        </div>

        {/* Tags */}
        {memberTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            {memberTags.map((tag) => (
              <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[11px] font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Lifetime Value', value: `$${member.ltv.toLocaleString()}`, icon: TrendingUp },
          { label: 'Total Visits', value: member.totalVisits.toString(), icon: Activity },
          { label: 'Avg Visits/Wk', value: member.avgVisitsPerWeek.toFixed(1), icon: Flame },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{stat.label}</p>
            <p className="text-[28px] font-black text-gray-900 dark:text-gray-100 tabular-nums leading-tight mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Credits', value: member.credits !== null ? member.credits.toString() : '\u221E' },
          { label: 'Last Visit', value: member.lastVisit },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{stat.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Profile Tabs */}
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {(['Overview', 'History', 'Financials', 'Communications'] as ProfileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setProfileTab(tab)}
              className={cn(
                'flex-1 py-3 text-xs font-semibold transition-colors relative',
                profileTab === tab
                  ? 'text-indigo-600'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {tab}
              {profileTab === tab && (
                <motion.div
                  layoutId="profileTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-4">
          <AnimatePresence mode="wait">
            {profileTab === 'Overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {/* AI Predictive Insights */}
                <div className="rounded-xl p-[1px] bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500">
                  <div className="bg-white dark:bg-gray-950 rounded-[11px] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-white" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">AI Predictive Insights</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className={cn(
                          'mt-0.5 h-5 w-5 rounded-md flex items-center justify-center shrink-0',
                          member.status === 'at-risk'
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-emerald-100 text-emerald-600'
                        )}>
                          {member.status === 'at-risk' ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <TrendingUp className="h-3 w-3" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                            {member.status === 'at-risk'
                              ? `Visit frequency dropped ${member.avgVisitsPerWeek < 1 ? '68%' : '42%'} over 3 weeks. Churn probability: ${member.avgVisitsPerWeek < 1 ? '73%' : '55%'}. Consider a personal re-engagement.`
                              : `Strong retention pattern. ${member.avgVisitsPerWeek >= 3 ? 'Power user' : 'Consistent visitor'} — ${member.avgVisitsPerWeek >= 3 ? 'candidate for referral program' : 'trending toward upgrade'}.`}
                          </p>
                          <button
                            onClick={() => setAiDetailOpen(true)}
                            className="mt-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5 transition-colors"
                          >
                            {member.status === 'at-risk' ? 'Send re-engagement' : 'View details'}
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 h-5 w-5 rounded-md bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                          <Zap className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                            {member.guidedSessions > 10
                              ? `${member.guidedSessions} guided sessions attended. High affinity for instructor-led experiences — prime candidate for workshop invitations.`
                              : `Primarily uses open sessions. Consider introducing to guided classes — members who try guided have 40% higher retention.`}
                          </p>
                          <button
                            onClick={() => setAiDetailOpen(true)}
                            className="mt-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5 transition-colors"
                          >
                            {member.guidedSessions > 10 ? 'Invite to workshop' : 'Suggest guided class'}
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Membership */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Active Membership</h4>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{member.membership}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">${member.membershipPrice}/mo</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Next Billing</span>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{member.nextBilling}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Payment Method</span>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{member.paymentMethod}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1.5">
                      {member.status !== 'paused' && (
                        <button
                          onClick={() => setPauseOpen(true)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Pause className="h-3 w-3" />
                          Pause
                        </button>
                      )}
                      <button
                        onClick={() => setUpgradeOpen(true)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        <ArrowUp className="h-3 w-3" />
                        Upgrade
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to archive ${member.firstName} ${member.lastName}? This action cannot be undone.`)) return
                          try {
                            const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' })
                            if (res.ok) {
                              onClose()
                              notify('Member archived')
                            } else {
                              notify('Failed to archive member')
                            }
                          } catch {
                            notify('Network error')
                          }
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </div>

                {/* Visit Activity Heatmap */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Visit Activity</h4>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
                    <div className="flex gap-0.5">
                      {heatmapData.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-0.5 flex-1">
                          {week.map((val, di) => (
                            <div
                              key={di}
                              className={cn(
                                'aspect-square rounded-[3px] transition-colors',
                                heatmapColor(val)
                              )}
                              title={`${val} session${val !== 1 ? 's' : ''}`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">Less</span>
                      {[0, 1, 2, 3, 4].map((v) => (
                        <div key={v} className={cn('h-2.5 w-2.5 rounded-[2px]', heatmapColor(v))} />
                      ))}
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">More</span>
                    </div>
                  </div>
                </div>

                {/* Upcoming Bookings (from live data) */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Recent Bookings</h4>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100">
                    {detailLoading ? (
                      <div className="p-6 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400 dark:text-gray-500" />
                      </div>
                    ) : memberBookings.length > 0 ? (
                      memberBookings.slice(0, 5).map((booking, i) => (
                        <div key={i} className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-indigo-100 text-indigo-600">
                              <Flame className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{booking.className}</p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {new Date(booking.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {' at '}
                                {new Date(booking.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <span className={cn(
                            'text-[11px] font-semibold',
                            booking.status === 'checked_in' ? 'text-emerald-600' :
                            booking.status === 'cancelled' ? 'text-gray-400 dark:text-gray-500' :
                            booking.status === 'no_show' ? 'text-orange-500' :
                            'text-indigo-600'
                          )}>
                            {booking.status === 'checked_in' ? 'Checked In' :
                             booking.status === 'cancelled' ? 'Cancelled' :
                             booking.status === 'no_show' ? 'No Show' :
                             booking.status === 'booked' ? 'Booked' :
                             booking.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">No bookings found</div>
                    )}
                  </div>
                </div>

                {/* Session Preferences */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Session Preferences</h4>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Preferred Time', value: member.preferredTime, icon: Clock },
                        { label: 'Preferred Type', value: member.preferredType, icon: Flame },
                        { label: 'Guided Sessions', value: member.guidedSessions.toString(), icon: Heart },
                        { label: 'Avg Duration', value: member.avgDuration, icon: Activity },
                      ].map((pref) => (
                        <div key={pref.label} className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                            <pref.icon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{pref.label}</p>
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{pref.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {profileTab === 'History' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {detailLoading ? (
                  <div className="py-8 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-gray-500" />
                  </div>
                ) : memberBookings.length > 0 ? (
                  <div className="space-y-2">
                    {memberBookings.map((booking, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <Flame className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{booking.className}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {new Date(booking.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {' at '}
                              {new Date(booking.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
                          booking.status === 'checked_in' ? 'bg-emerald-50 text-emerald-700' :
                          booking.status === 'cancelled' ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' :
                          booking.status === 'no_show' ? 'bg-orange-50 text-orange-600' :
                          'bg-indigo-50 text-indigo-700'
                        )}>
                          {booking.status === 'checked_in' ? 'Checked In' :
                           booking.status === 'cancelled' ? 'Cancelled' :
                           booking.status === 'no_show' ? 'No Show' :
                           booking.status === 'booked' ? 'Booked' :
                           booking.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No visit history yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Bookings will appear here once the member checks in</p>
                  </div>
                )}
              </motion.div>
            )}

            {profileTab === 'Financials' && (
              <motion.div
                key="financials"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {detailLoading ? (
                  <div className="py-8 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-gray-500" />
                  </div>
                ) : memberTransactions.length > 0 ? (
                  <div className="space-y-2">
                    {memberTransactions.map((tx, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                        <div>
                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {tx.description || tx.type}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            'text-sm font-bold tabular-nums',
                            tx.status === 'refunded' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'
                          )}>
                            ${(tx.amount / 100).toFixed(2)}
                          </p>
                          <span className={cn(
                            'text-[10px] font-semibold',
                            tx.status === 'completed' ? 'text-emerald-600' :
                            tx.status === 'failed' ? 'text-orange-500' :
                            'text-gray-400 dark:text-gray-500'
                          )}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No transactions yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Payment history will appear here</p>
                  </div>
                )}
              </motion.div>
            )}

            {profileTab === 'Communications' && (
              <motion.div
                key="communications"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="py-8 text-center"
              >
                <Mail className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Communication log will appear here</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Emails, SMS, and automated messages</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <MemberUpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        memberId={member.id}
        memberName={`${member.firstName} ${member.lastName}`}
        currentTier={member.membership}
        onSuccess={() => notify('Membership upgraded successfully')}
      />

      <MemberPauseModal
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        memberId={member.id}
        memberName={`${member.firstName} ${member.lastName}`}
        onSuccess={() => notify('Membership paused successfully')}
      />

      <AIDetailModal
        open={aiDetailOpen}
        onOpenChange={setAiDetailOpen}
        memberId={member.id}
        memberName={`${member.firstName} ${member.lastName}`}
      />
    </motion.div>
  )
}
