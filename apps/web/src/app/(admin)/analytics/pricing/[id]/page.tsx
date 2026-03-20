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

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────

interface PricingPlan {
  id: string
  name: string
  currentPrice: number
  newPrice: number
  subscribers: number
  mrrContribution: number
}

// ─── Mock Data ──────────────────────────────────────────────

const INITIAL_PLANS: PricingPlan[] = [
  { id: 'unlimited', name: 'Unlimited', currentPrice: 149, newPrice: 149, subscribers: 84, mrrContribution: 12516 },
  { id: '10-class', name: '10-Class Pack', currentPrice: 129, newPrice: 129, subscribers: 42, mrrContribution: 5418 },
  { id: '6-class', name: '6-Class Pack', currentPrice: 89, newPrice: 89, subscribers: 31, mrrContribution: 2759 },
  { id: 'dropin', name: 'Drop-in', currentPrice: 25, newPrice: 25, subscribers: 0, mrrContribution: 1875 },
  { id: 'student', name: 'Student Unlimited', currentPrice: 99, newPrice: 99, subscribers: 18, mrrContribution: 1782 },
]

type SimulationStatus = 'Draft' | 'Analyzed' | 'Applied' | 'Reverted'

interface SimulationState {
  id: string
  name: string
  status: SimulationStatus
  createdAt: string
  appliedAt: string | null
}

const MOCK_SIMULATION: SimulationState = {
  id: 'sim-2',
  name: 'Student Tier Expansion',
  status: 'Analyzed',
  createdAt: '2026-03-12',
  appliedAt: null,
}

// ─── Helpers ──────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCurrencyDetailed(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// ─── Custom Tooltip ──────────────────────────────────────────

function SensitivityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      <p className={cn('font-bold tabular-nums', payload[0].value >= 0 ? 'text-emerald-600' : 'text-red-600')}>
        {payload[0].value >= 0 ? '+' : ''}{formatCurrency(payload[0].value)}/mo
      </p>
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────

export default function PricingSimulatorDetailPage() {
  const [plans, setPlans] = useState<PricingPlan[]>(INITIAL_PLANS)
  const [isAnalyzed, setIsAnalyzed] = useState(true)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [simulation, setSimulation] = useState(MOCK_SIMULATION)

  const isApplied = simulation.status === 'Applied'

  // Update new price for a plan
  const updatePrice = (planId: string, value: string) => {
    const numVal = parseFloat(value.replace(/[^0-9.]/g, '')) || 0
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, newPrice: numVal } : p))
    )
    setIsAnalyzed(false)
  }

  // Calculate deltas
  const totalCurrentMRR = plans.reduce((sum, p) => sum + p.mrrContribution, 0)
  const totalNewMRR = plans.reduce((sum, p) => {
    if (p.subscribers === 0) return sum + p.mrrContribution // drop-in stays same
    return sum + p.newPrice * p.subscribers
  }, 0)
  const totalDelta = totalNewMRR - totalCurrentMRR

  // Sensitivity data (simulated at different price points)
  const sensitivityData = [
    { label: '-20%', value: Math.round(totalDelta * 0.4) },
    { label: '-10%', value: Math.round(totalDelta * 0.7) },
    { label: 'Proposed', value: totalDelta },
    { label: '+10%', value: Math.round(totalDelta * 1.4) },
    { label: '+20%', value: Math.round(totalDelta * 1.9) },
  ]

  // AI projections (mock)
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
    setPlans(INITIAL_PLANS)
    setIsAnalyzed(false)
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header ──────────────────────────────────── */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/analytics/pricing"
              className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-gray-900">{simulation.name}</h1>
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest',
                    simulation.status === 'Draft' && 'bg-gray-100 text-gray-600',
                    simulation.status === 'Analyzed' && 'bg-blue-50 text-blue-700',
                    simulation.status === 'Applied' && 'bg-emerald-50 text-emerald-700',
                    simulation.status === 'Reverted' && 'bg-red-50 text-red-700'
                  )}
                >
                  {simulation.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Created Mar 12, 2026
              </p>
            </div>
          </div>
        </motion.div>

        {/* ─── Applied Banner ──────────────────────────── */}
        {isApplied && simulation.appliedAt && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  Pricing applied on {new Date(simulation.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-xs text-emerald-700">
                  All inputs are locked. Revert to restore previous pricing.
                </p>
              </div>
            </div>
            <button
              onClick={handleRevert}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Revert
            </button>
          </motion.div>
        )}

        {/* ─── Two-Column Layout ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ─── Left Panel (60%): Price Adjustments ─── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="lg:col-span-3 space-y-5"
          >
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Price Adjustments
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Set new prices for each plan to model revenue impact
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Current MRR
                  </span>
                  <span className="text-lg font-black tabular-nums text-gray-900">
                    {formatCurrency(totalCurrentMRR)}
                  </span>
                </div>
              </div>

              {/* Pricing Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3">
                        Plan
                      </th>
                      <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3">
                        Current Price
                      </th>
                      <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3">
                        Subscribers
                      </th>
                      <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3">
                        MRR
                      </th>
                      <th className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 pl-4">
                        New Price
                      </th>
                      <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3">
                        Delta / Sub
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {plans.map((plan) => {
                      const delta = plan.newPrice - plan.currentPrice
                      const hasChanged = delta !== 0
                      return (
                        <tr key={plan.id} className="group">
                          <td className="py-3.5">
                            <span className="text-sm font-medium text-gray-900">
                              {plan.name}
                            </span>
                          </td>
                          <td className="text-right py-3.5">
                            <span className="text-sm tabular-nums text-gray-600">
                              {formatCurrencyDetailed(plan.currentPrice)}
                            </span>
                          </td>
                          <td className="text-right py-3.5">
                            <span className="text-sm tabular-nums text-gray-600">
                              {plan.subscribers > 0 ? plan.subscribers : '—'}
                            </span>
                          </td>
                          <td className="text-right py-3.5">
                            <span className="text-sm font-semibold tabular-nums text-gray-900">
                              {formatCurrency(plan.mrrContribution)}
                            </span>
                          </td>
                          <td className="text-center py-3.5 pl-4">
                            <div className="relative inline-flex items-center">
                              <span className="absolute left-3 text-sm text-gray-400">$</span>
                              <input
                                type="text"
                                value={plan.newPrice}
                                onChange={(e) => updatePrice(plan.id, e.target.value)}
                                disabled={isApplied}
                                className={cn(
                                  'w-24 pl-7 pr-3 py-2 text-sm font-semibold tabular-nums text-right rounded-xl border transition-colors',
                                  hasChanged
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                                    : 'border-gray-200 bg-gray-50 text-gray-900',
                                  isApplied && 'opacity-60 cursor-not-allowed'
                                )}
                              />
                            </div>
                          </td>
                          <td className="text-right py-3.5">
                            {plan.subscribers > 0 ? (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 text-sm font-bold tabular-nums',
                                  delta > 0 && 'text-emerald-600',
                                  delta < 0 && 'text-red-600',
                                  delta === 0 && 'text-gray-400'
                                )}
                              >
                                {delta > 0 && <ArrowUpRight className="w-3.5 h-3.5" />}
                                {delta < 0 && <ArrowDownRight className="w-3.5 h-3.5" />}
                                {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${formatCurrencyDetailed(delta)}/mo`}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td className="pt-4 text-sm font-bold text-gray-900" colSpan={3}>
                        Projected Total MRR
                      </td>
                      <td className="pt-4 text-right">
                        <span className="text-lg font-black tabular-nums text-gray-900">
                          {formatCurrency(totalNewMRR)}
                        </span>
                      </td>
                      <td />
                      <td className="pt-4 text-right">
                        <span
                          className={cn(
                            'text-base font-black tabular-nums',
                            totalDelta > 0 && 'text-emerald-600',
                            totalDelta < 0 && 'text-red-600',
                            totalDelta === 0 && 'text-gray-400'
                          )}
                        >
                          {totalDelta === 0
                            ? '—'
                            : `${totalDelta > 0 ? '+' : ''}${formatCurrency(totalDelta)}`}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Analyze Button */}
              {!isApplied && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <button
                    onClick={() => setIsAnalyzed(true)}
                    disabled={isAnalyzed}
                    className={cn(
                      'w-full py-3 rounded-xl text-sm font-semibold transition-all',
                      isAnalyzed
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      {isAnalyzed ? 'Analysis Up to Date' : 'Analyze Scenario'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* ─── Right Panel (40%): AI Projections ──── */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="lg:col-span-2 space-y-4"
          >
            <AnimatePresence>
              {isAnalyzed && (
                <>
                  {/* Revenue Impact Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      Monthly Revenue Impact
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-2xl flex items-center justify-center',
                          totalDelta >= 0 ? 'bg-emerald-50' : 'bg-red-50'
                        )}
                      >
                        {totalDelta >= 0 ? (
                          <TrendingUp className="w-6 h-6 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-6 h-6 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p
                          className={cn(
                            'text-[28px] font-black tabular-nums',
                            totalDelta >= 0 ? 'text-emerald-600' : 'text-red-600'
                          )}
                        >
                          {totalDelta >= 0 ? '+' : ''}{formatCurrency(totalDelta)}
                        </p>
                        <p className="text-xs text-gray-500">per month</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Churn Risk Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, delay: 0.05 }}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      Estimated Churn Risk
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-[28px] font-black tabular-nums text-gray-900">
                          +{churnRisk}%
                        </p>
                        <p className="text-xs text-gray-500">increase in monthly churn</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Upgrade/Downgrade Probability Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, delay: 0.1 }}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                      Movement Probability
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm text-gray-700">May upgrade</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-emerald-600">
                          ~{upgradeProb} members
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-gray-700">May downgrade</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-red-600">
                          ~{downgradeProb} members
                        </span>
                      </div>
                    </div>
                  </motion.div>

                  {/* AI Narrative Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, delay: 0.15 }}
                    className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 rounded-2xl p-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                        AI Analysis
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Reducing the Student Unlimited plan from $99 to $79 targets a price-sensitive segment near USF campus.
                      Historical data shows student sign-ups spike during fall and spring semesters. A 20% price reduction
                      could attract an estimated 8-12 new student members within 60 days, potentially offsetting the per-subscriber
                      revenue loss. The student cohort shows 34% lower churn than drop-in users, making this a strong
                      long-term retention play. Consider pairing with a campus ambassador program for maximum impact.
                    </p>
                  </motion.div>

                  {/* Sensitivity Chart */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, delay: 0.2 }}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      Sensitivity Analysis
                    </p>
                    <p className="text-xs text-gray-400 mb-4">
                      Revenue impact at various price points
                    </p>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sensitivityData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#9CA3AF' }}
                            axisLine={{ stroke: '#E5E7EB' }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#9CA3AF' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `$${v}`}
                            width={50}
                          />
                          <Tooltip content={<SensitivityTooltip />} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {sensitivityData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.label === 'Proposed'
                                    ? '#4F46E5'
                                    : entry.value >= 0
                                    ? '#10B981'
                                    : '#EF4444'
                                }
                                opacity={entry.label === 'Proposed' ? 1 : 0.6}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {!isAnalyzed && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  Adjust prices and analyze
                </p>
                <p className="text-xs text-gray-400">
                  AI projections will appear here after analysis
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ─── Bottom Action Bar ──────────────────────── */}
        {!isApplied && (
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {changedPlansCount > 0
                  ? `${changedPlansCount} plan${changedPlansCount > 1 ? 's' : ''} modified affecting ${totalAffectedSubscribers} subscribers`
                  : 'No changes made yet'}
              </p>
              <div className="flex items-center gap-3">
                <button className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200">
                  <Save className="w-4 h-4" />
                  Save as Draft
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!isAnalyzed || changedPlansCount === 0}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all',
                    isAnalyzed && changedPlansCount > 0
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  <Check className="w-4 h-4" />
                  Apply Changes
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ─── Confirmation Modal ────────────────────────── */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Confirm Pricing Changes
                  </h3>
                  <p className="text-xs text-gray-500">This action will update live pricing</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-700">
                  This will update pricing for{' '}
                  <span className="font-bold">{changedPlansCount} plan{changedPlansCount > 1 ? 's' : ''}</span>{' '}
                  affecting{' '}
                  <span className="font-bold">{totalAffectedSubscribers} subscribers</span>.
                </p>
              </div>

              <label className="flex items-start gap-3 mb-6 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600">
                  Migrate existing subscribers to new pricing (prorated via Stripe)
                </span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
