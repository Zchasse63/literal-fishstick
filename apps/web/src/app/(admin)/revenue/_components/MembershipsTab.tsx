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
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">Membership Plans</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Current Pricing</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">Plan</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">Price</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">Type</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">Active</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-5 py-3">MRR</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-3.5"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5"><div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td>
                    <td className="px-5 py-3.5 text-right"><div className="h-4 w-8 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                    <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                  </tr>
                ))
              ) : (
                membershipPlans.map((plan, i) => (
                  <tr
                    key={plan.name}
                    className={cn(
                      'border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
                      i === membershipPlans.length - 1 && 'border-b-0'
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{plan.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">{plan.price}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
                        plan.type === 'Recurring'
                          ? 'bg-indigo-50 text-indigo-700'
                          : plan.type === 'Credit Pack'
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      )}>
                        {plan.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                        {plan.active !== null ? plan.active : '\u2014'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{plan.mrr}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Promo Codes */}
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">Trainer Promo Codes</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Referral Attribution</p>
            </div>
            <button onClick={() => { const code = prompt('Enter promo code (uppercase, no spaces):'); if (!code) return; const trainerId = prompt('Trainer ID (optional):'); fetch('/api/promo-codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.toUpperCase(), trainer_id: trainerId || null, discount_type: 'percent', discount_value: 10 }) }).then(r => r.ok ? window.location.reload() : alert('Failed to create promo code')).catch(() => alert('Network error')) }} className="px-3.5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
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
                  <div className="h-4 w-28 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-8 w-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
            ))
          ) : promoCodes.length > 0 ? (
            promoCodes.map((promo) => (
              <div key={promo.code} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2.5 py-1 rounded-lg text-sm font-mono font-semibold">
                      {promo.code}
                    </code>
                    <button onClick={() => { navigator.clipboard.writeText(promo.code) }} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{promo.trainer}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Uses</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{promo.uses}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Revenue</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{promo.revenue}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Last Used</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{promo.lastUsed}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No promo codes found</div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
