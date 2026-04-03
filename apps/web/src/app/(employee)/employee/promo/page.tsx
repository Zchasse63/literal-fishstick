'use client'

import { useState, useEffect } from 'react'
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
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmployeeProfile, usePromoAttributions } from '@/hooks/use-employee'
import { fadeInUp } from '@/lib/motion'

const statusConfig = {
  active: { label: 'Active', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  churned: { label: 'Churned', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  'one-time': { label: 'One-Time', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
}

export default function PromoPage() {
  const [copied, setCopied] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const { trainer, loading: profileLoading } = useEmployeeProfile()
  const { attributions, loading: attribLoading } = usePromoAttributions(trainer?.id)

  const loading = profileLoading || attribLoading
  const promoCode = trainer?.promo_code ?? 'N/A'

  // Fetch QR code image from the API endpoint when promo code is available
  useEffect(() => {
    if (!promoCode || promoCode === 'N/A') return
    let revoked = false
    setQrLoading(true)
    fetch(`/api/qr/promo/${encodeURIComponent(promoCode)}`)
      .then((res) => {
        if (res.ok) return res.blob()
        return null
      })
      .then((blob) => {
        if (blob && !revoked) {
          setQrUrl(URL.createObjectURL(blob))
        }
      })
      .catch(() => {
        // Silently fail — QR placeholder remains
      })
      .finally(() => setQrLoading(false))

    return () => {
      revoked = true
    }
  }, [promoCode])
  const commissionRate = trainer?.commission_rate ?? 0

  // Calculate stats
  const totalSignups = attributions.length
  const totalCommission = attributions.reduce((acc, a) => acc + (a.commission_amount ?? 0), 0)

  // This period (current month)
  const now = new Date()
  const thisMonthAttribs = attributions.filter((a) => {
    const d = new Date(a.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const thisMonthCommission = thisMonthAttribs.reduce((acc, a) => acc + (a.commission_amount ?? 0), 0)

  // Active vs churned — we consider commission_paid as a proxy for status
  const paidCount = attributions.filter((a) => a.commission_paid).length

  const stats = [
    { label: 'Total Signups', value: String(totalSignups), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Paid Commissions', value: String(paidCount), icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'This Period', value: `$${thisMonthCommission.toLocaleString()}`, icon: DollarSign, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'All-Time', value: `$${totalCommission.toLocaleString()}`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  const handleCopy = () => {
    navigator.clipboard.writeText(promoCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
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
            <h2 className="text-4xl md:text-5xl font-black tracking-wider">{promoCode}</h2>
            {commissionRate > 0 && (
              <p className="text-sm text-indigo-200 mt-2">
                {commissionRate}% commission on referred purchases
              </p>
            )}
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
          {/* QR Code */}
          <div className="w-32 h-32 rounded-xl bg-white/20 backdrop-blur-sm flex flex-col items-center justify-center border border-white/20 overflow-hidden">
            {qrLoading ? (
              <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
            ) : qrUrl ? (
              <img
                src={qrUrl}
                alt={`QR code for promo ${promoCode}`}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <>
                <QrCode className="w-12 h-12 text-white/60 mb-1" />
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">QR Code</span>
              </>
            )}
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
        {attributions.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No referrals yet</div>
        ) : (
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
              {attributions.map((attr) => {
                const memberName = attr.members?.profiles?.full_name ?? 'Member'
                const date = new Date(attr.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const paid = attr.commission_paid
                const statusKey = paid ? 'active' : 'one-time'
                const status = statusConfig[statusKey]

                return (
                  <tr key={attr.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-gray-900">{memberName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-gray-600">{date}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-700">{attr.plan_purchased ?? 'N/A'}</span>
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
                      <span className="text-sm font-bold tabular-nums text-emerald-600">${attr.commission_amount}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  )
}
