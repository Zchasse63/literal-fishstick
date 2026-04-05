'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  FlaskConical,
  Save,
  RotateCcw,
  Calendar,
  Users,
  BarChart3,
  Shield,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { fadeInUp } from '@/lib/motion'

// --- Types ---
interface PricingPlan {
  id: string
  name: string
  currentPrice: number
  newPrice: number
  subscribers: number
  mrrContribution: number
}

type SimulationStatus = 'Draft' | 'Analyzed' | 'Applied' | 'Reverted'

interface SimulationState {
  id: string
  name: string
  status: SimulationStatus
  createdAt: string
  appliedAt: string | null
}

// --- Helpers ---
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function formatCurrencyDetailed(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function SensitivityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      <p className={cn('font-bold tabular-nums', payload[0].value >= 0 ? 'text-emerald-600' : 'text-red-600')}>
        {payload[0].value >= 0 ? '+' : ''}{formatCurrency(payload[0].value)}/mo
      </p>
    </div>
  )
}

// --- Props ---
interface PricingSimulatorDetailClientProps {
  initialPlans: PricingPlan[]
  initialSimulation: SimulationState
  initialIsAnalyzed: boolean
}

export function PricingSimulatorDetailClient({ initialPlans, initialSimulation, initialIsAnalyzed }: PricingSimulatorDetailClientProps) {
  const [plans, setPlans] = useState<PricingPlan[]>(initialPlans)
  const [isAnalyzed, setIsAnalyzed] = useState(initialIsAnalyzed)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [simulation, setSimulation] = useState<SimulationState>(initialSimulation)

  const isApplied = simulation.status === 'Applied'

  const updatePrice = (planId: string, value: string) => {
    const numVal = parseFloat(value.replace(/[^0-9.]/g, '')) || 0
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, newPrice: numVal } : p)))
    setIsAnalyzed(false)
  }

  const totalCurrentMRR = plans.reduce((sum, p) => sum + p.mrrContribution, 0)
  const totalNewMRR = plans.reduce((sum, p) => {
    if (p.subscribers === 0) return sum + p.mrrContribution
    return sum + p.newPrice * p.subscribers
  }, 0)
  const totalDelta = totalNewMRR - totalCurrentMRR

  const sensitivityData = [
    { label: '-20%', value: Math.round(totalDelta * 0.4) },
    { label: '-10%', value: Math.round(totalDelta * 0.7) },
    { label: 'Proposed', value: totalDelta },
    { label: '+10%', value: Math.round(totalDelta * 1.4) },
    { label: '+20%', value: Math.round(totalDelta * 1.9) },
  ]

  const churnRisk = totalDelta > 0 ? 2.4 : totalDelta < -500 ? 0.8 : 1.2
  const upgradeProb = totalDelta < 0 ? 14 : 6
  const downgradeProb = totalDelta > 0 ? 8 : 3
  const totalAffectedSubscribers = plans.filter((p) => p.newPrice !== p.currentPrice && p.subscribers > 0).reduce((sum, p) => sum + p.subscribers, 0)
  const changedPlansCount = plans.filter((p) => p.newPrice !== p.currentPrice).length

  const handleApply = () => {
    setSimulation((prev) => ({ ...prev, status: 'Applied' as const, appliedAt: '2026-03-20' }))
    setShowConfirmModal(false)
  }

  const handleRevert = () => {
    setSimulation((prev) => ({ ...prev, status: 'Reverted' as const, appliedAt: null }))
    setPlans(plans.map(p => ({ ...p, newPrice: p.currentPrice })))
    setIsAnalyzed(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/analytics/pricing" className="w-9 h-9 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{simulation.name}</h1>
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest', simulation.status === 'Draft' && 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', simulation.status === 'Analyzed' && 'bg-blue-50 text-blue-700', simulation.status === 'Applied' && 'bg-emerald-50 text-emerald-700', simulation.status === 'Reverted' && 'bg-red-50 text-red-700')}>{simulation.status}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Created {simulation.createdAt}</p>
            </div>
          </div>
        </motion.div>

        {/* Applied Banner */}
        {isApplied && simulation.appliedAt && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"><Check className="w-4 h-4 text-emerald-600" /></div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Pricing applied on {simulation.appliedAt}</p>
                <p className="text-xs text-emerald-700">All inputs are locked. Revert to restore previous pricing.</p>
              </div>
            </div>
            <button onClick={handleRevert} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-white dark:bg-gray-950 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"><RotateCcw className="w-4 h-4" />Revert</button>
          </motion.div>
        )}

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel: Price Adjustments */}
          <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.05 }} className="lg:col-span-3 space-y-5">
            <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Price Adjustments</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Set new prices for each plan to model revenue impact</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Current MRR</span>
                  <span className="text-lg font-black tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(totalCurrentMRR)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3">Plan</th>
                      <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3">Current Price</th>
                      <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3">Subscribers</th>
                      <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3">MRR</th>
                      <th className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3 pl-4">New Price</th>
                      <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 pb-3">Delta / Sub</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {plans.map((plan) => {
                      const delta = plan.newPrice - plan.currentPrice
                      const hasChanged = delta !== 0
                      return (
                        <tr key={plan.id} className="group">
                          <td className="py-3.5"><span className="text-sm font-medium text-gray-900 dark:text-gray-100">{plan.name}</span></td>
                          <td className="text-right py-3.5"><span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">{formatCurrencyDetailed(plan.currentPrice)}</span></td>
                          <td className="text-right py-3.5"><span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">{plan.subscribers > 0 ? plan.subscribers : '\u2014'}</span></td>
                          <td className="text-right py-3.5"><span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(plan.mrrContribution)}</span></td>
                          <td className="text-center py-3.5 pl-4">
                            <div className="relative inline-flex items-center">
                              <span className="absolute left-3 text-sm text-gray-400 dark:text-gray-500">$</span>
                              <input type="text" value={plan.newPrice} onChange={(e) => updatePrice(plan.id, e.target.value)} disabled={isApplied} className={cn('w-24 pl-7 pr-3 py-2 text-sm font-semibold tabular-nums text-right rounded-xl border transition-colors', hasChanged ? 'border-indigo-300 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100', isApplied && 'opacity-60 cursor-not-allowed')} />
                            </div>
                          </td>
                          <td className="text-right py-3.5">
                            {plan.subscribers > 0 ? (
                              <span className={cn('inline-flex items-center gap-1 text-sm font-bold tabular-nums', delta > 0 && 'text-emerald-600', delta < 0 && 'text-red-600', delta === 0 && 'text-gray-400 dark:text-gray-500')}>
                                {delta > 0 && <ArrowUpRight className="w-3.5 h-3.5" />}
                                {delta < 0 && <ArrowDownRight className="w-3.5 h-3.5" />}
                                {delta === 0 ? '\u2014' : `${delta > 0 ? '+' : ''}${formatCurrencyDetailed(delta)}/mo`}
                              </span>
                            ) : (<span className="text-sm text-gray-400 dark:text-gray-500">{'\u2014'}</span>)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-800">
                      <td className="pt-4 text-sm font-bold text-gray-900 dark:text-gray-100" colSpan={3}>Projected Total MRR</td>
                      <td className="pt-4 text-right"><span className="text-lg font-black tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(totalNewMRR)}</span></td>
                      <td />
                      <td className="pt-4 text-right"><span className={cn('text-base font-black tabular-nums', totalDelta > 0 && 'text-emerald-600', totalDelta < 0 && 'text-red-600', totalDelta === 0 && 'text-gray-400 dark:text-gray-500')}>{totalDelta === 0 ? '\u2014' : `${totalDelta > 0 ? '+' : ''}${formatCurrency(totalDelta)}`}</span></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {!isApplied && (
                <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => setIsAnalyzed(true)} disabled={isAnalyzed} className={cn('w-full py-3 rounded-xl text-sm font-semibold transition-all', isAnalyzed ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm')}>
                    <span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4" />{isAnalyzed ? 'Analysis Up to Date' : 'Analyze Scenario'}</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Panel: AI Projections */}
          <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.1 }} className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {isAnalyzed && (
                <>
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Monthly Revenue Impact</p>
                    <div className="flex items-center gap-3">
                      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', totalDelta >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
                        {totalDelta >= 0 ? <TrendingUp className="w-6 h-6 text-emerald-600" /> : <TrendingDown className="w-6 h-6 text-red-600" />}
                      </div>
                      <div>
                        <p className={cn('text-[28px] font-black tabular-nums', totalDelta >= 0 ? 'text-emerald-600' : 'text-red-600')}>{totalDelta >= 0 ? '+' : ''}{formatCurrency(totalDelta)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">per month projected</p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Sensitivity Analysis</p>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sensitivityData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={50} />
                          <Tooltip content={<SensitivityTooltip />} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={36}>
                            {sensitivityData.map((entry, i) => (<Cell key={i} fill={entry.value >= 0 ? '#10B981' : '#EF4444'} />))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }} className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">AI Risk Assessment</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><span className="text-xs text-gray-600 dark:text-gray-400">Est. Churn Impact</span><span className="text-sm font-bold tabular-nums text-amber-600">+{churnRisk}%</span></div>
                      <div className="flex items-center justify-between"><span className="text-xs text-gray-600 dark:text-gray-400">Upgrade Probability</span><span className="text-sm font-bold tabular-nums text-emerald-600">{upgradeProb}%</span></div>
                      <div className="flex items-center justify-between"><span className="text-xs text-gray-600 dark:text-gray-400">Downgrade Probability</span><span className="text-sm font-bold tabular-nums text-red-600">{downgradeProb}%</span></div>
                      <div className="flex items-center justify-between"><span className="text-xs text-gray-600 dark:text-gray-400">Affected Members</span><span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{totalAffectedSubscribers}</span></div>
                    </div>
                  </motion.div>

                  {!isApplied && changedPlansCount > 0 && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.15 }}>
                      <button onClick={() => setShowConfirmModal(true)} className="w-full py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">
                        <span className="inline-flex items-center gap-2"><Shield className="w-4 h-4" />Apply {changedPlansCount} Price Change{changedPlansCount > 1 ? 's' : ''}</span>
                      </button>
                    </motion.div>
                  )}
                </>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Confirm Modal */}
        <AnimatePresence>
          {showConfirmModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Confirm Price Changes</h2>
                  <button onClick={() => setShowConfirmModal(false)} className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"><X className="h-5 w-5" /></button>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">This will update {changedPlansCount} plan(s) affecting {totalAffectedSubscribers} subscribers. Changes are reflected at next billing cycle with Stripe proration.</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
                  <button onClick={handleApply} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition">Apply Changes</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
