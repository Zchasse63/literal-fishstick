'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Copy,
  Share2,
  QrCode,
  Users,
  UserCheck,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

const stats = [
  { label: 'Total Signups', value: '23', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Active Members', value: '19', icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'This Period', value: '$340', icon: DollarSign, color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'All-Time', value: '$2,890', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
]

const referrals = [
  { name: 'Alex Rivera', date: 'Mar 14, 2026', plan: 'Unlimited Monthly', status: 'active' as const, commission: 25 },
  { name: 'Jordan Lee', date: 'Mar 8, 2026', plan: '10-Class Pack', status: 'active' as const, commission: 15 },
  { name: 'Morgan Chen', date: 'Feb 28, 2026', plan: 'Unlimited Monthly', status: 'active' as const, commission: 25 },
  { name: 'Casey Kim', date: 'Feb 20, 2026', plan: '6-Class Pack', status: 'active' as const, commission: 10 },
  { name: 'Taylor Brooks', date: 'Feb 12, 2026', plan: 'Unlimited Monthly', status: 'churned' as const, commission: 25 },
  { name: 'Riley Adams', date: 'Jan 30, 2026', plan: 'Drop-In', status: 'one-time' as const, commission: 5 },
  { name: 'Jamie Santos', date: 'Jan 22, 2026', plan: 'Unlimited Monthly', status: 'active' as const, commission: 25 },
  { name: 'Quinn Parker', date: 'Jan 15, 2026', plan: '10-Class Pack', status: 'active' as const, commission: 15 },
]

const statusConfig = {
  active: { label: 'Active', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  churned: { label: 'Churned', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  'one-time': { label: 'One-Time', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
}

export default function PromoPage() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText('WHITNEY25')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl font-bold text-gray-900">Promo Code</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your personal referral code and commissions</p>
      </motion.div>

      {/* Promo Code Hero */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.05 }}
        className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-8 text-white"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="text-sm font-medium text-indigo-200 mb-2">Your Promo Code</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-wider">WHITNEY25</h2>
            <p className="text-sm text-indigo-200 mt-2">Members get 25% off their first month</p>
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white text-sm font-semibold hover:bg-white/30 transition-colors border border-white/20"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white text-sm font-semibold hover:bg-white/30 transition-colors border border-white/20">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
          {/* QR Code Placeholder */}
          <div className="w-32 h-32 rounded-xl bg-white/20 backdrop-blur-sm flex flex-col items-center justify-center border border-white/20">
            <QrCode className="w-12 h-12 text-white/60 mb-1" />
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">QR Code</span>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 + 0.03 * i }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stat.label}</p>
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-4 h-4', stat.color)} />
              </div>
            </div>
            <p className="text-[28px] font-black tabular-nums text-gray-900 leading-none">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Referral Log */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.25 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Referral Log</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Member</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Signup Date</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Plan</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</span>
              </th>
              <th className="text-left px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Commission</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((ref, i) => {
              const status = statusConfig[ref.status]
              return (
                <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold text-gray-900">{ref.name}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-gray-600">{ref.date}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium text-gray-700">{ref.plan}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold',
                      status.bg, status.color
                    )}>
                      <status.icon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-bold tabular-nums text-emerald-600">${ref.commission}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </motion.div>
    </div>
  )
}
