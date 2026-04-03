'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Tag, Copy } from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
export interface MembershipPlan {
  name: string
  price: string
  type: string
  active: number | null
  mrr: string
}

export interface PromoCode {
  code: string
  trainer: string
  uses: number
  revenue: string
  lastUsed: string
}

export default function MembershipsTab({ loading, membershipPlans, promoCodes }: {
  loading: boolean
  membershipPlans: MembershipPlan[]
  promoCodes: PromoCode[]
}) {
  return (
    <motion.div {...fadeInUp} className="space-y-5">
      {/* Plans Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Membership Plans</p>
          <p className="text-lg font-bold text-gray-900">Current Pricing</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Plan</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Price</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Type</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">Active</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">MRR</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-3.5"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-5 w-20 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5 text-right"><div className="h-4 w-8 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                    <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                  </tr>
                ))
              ) : (
                membershipPlans.map((plan, i) => (
                  <tr
                    key={plan.name}
                    className={cn(
                      'border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer',
                      i === membershipPlans.length - 1 && 'border-b-0'
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-700 tabular-nums">{plan.price}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
                        plan.type === 'Recurring'
                          ? 'bg-indigo-50 text-indigo-700'
                          : plan.type === 'Credit Pack'
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-gray-100 text-gray-600'
                      )}>
                        {plan.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">
                        {plan.active !== null ? plan.active : '\u2014'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">{plan.mrr}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Promo Codes */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Trainer Promo Codes</p>
              <p className="text-lg font-bold text-gray-900">Referral Attribution</p>
            </div>
            <button className="px-3.5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              New Code
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-7 w-24 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-8 w-10 bg-gray-100 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))
          ) : promoCodes.length > 0 ? (
            promoCodes.map((promo) => (
              <div key={promo.code} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-lg text-sm font-mono font-semibold">
                      {promo.code}
                    </code>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-sm text-gray-500">{promo.trainer}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Uses</p>
                    <p className="text-sm font-bold text-gray-900 tabular-nums">{promo.uses}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Revenue</p>
                    <p className="text-sm font-bold text-gray-900 tabular-nums">{promo.revenue}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Last Used</p>
                    <p className="text-sm text-gray-600">{promo.lastUsed}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No promo codes found</div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
