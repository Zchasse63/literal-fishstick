'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Copy,
  Trash2,
  Eye,
  FlaskConical,
  Sparkles,
  Calendar,
  FileText,
  Play,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────

type SimulationStatus = 'Draft' | 'Analyzed' | 'Applied' | 'Reverted'

interface Simulation {
  id: string
  name: string
  description: string
  createdAt: string
  status: SimulationStatus
  projectedRevenueDelta?: number
  appliedAt?: string
}

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

// ─── Helpers ──────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_STYLES: Record<SimulationStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Analyzed: 'bg-blue-50 text-blue-700',
  Applied: 'bg-emerald-50 text-emerald-700',
  Reverted: 'bg-red-50 text-red-700',
}

// ─── Page Component ──────────────────────────────────────────

export default function PricingSimulatorPage() {
  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [applyLoading, setApplyLoading] = useState<string | null>(null)
  const [applyConfirm, setApplyConfirm] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSimulations() {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('pricing_simulations')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setSimulations(data.map((s: any) => ({
          id: s.id,
          name: s.name ?? 'Untitled',
          description: s.description ?? '',
          createdAt: s.created_at?.split('T')[0] ?? '',
          status: s.status ?? 'Draft',
          projectedRevenueDelta: s.projected_revenue_delta,
          appliedAt: s.applied_at?.split('T')[0],
        })))
      }
      setLoading(false)
    }
    fetchSimulations()
  }, [])

  const handleDelete = (id: string) => {
    setSimulations((prev) => prev.filter((s) => s.id !== id))
    setDeleteConfirm(null)
  }

  const handleApply = async (id: string) => {
    setApplyLoading(id)
    try {
      const res = await fetch(`/api/pricing-simulator/${id}/apply`, { method: 'POST' })
      if (res.ok) {
        setSimulations(prev => prev.map(s => s.id === id ? { ...s, status: 'Applied' as SimulationStatus, appliedAt: new Date().toISOString().split('T')[0] } : s))
      }
    } catch {} finally {
      setApplyLoading(null)
      setApplyConfirm(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* ─── Header ──────────────────────────────────── */}
        <motion.div {...fadeInUp} className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Pricing Simulator</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Model pricing scenarios and project revenue impact
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/analytics/pricing/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Simulation
          </Link>
        </motion.div>

        {/* ─── Summary Stats ──────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.05 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            {
              label: 'Total Simulations',
              value: simulations.length.toString(),
              icon: FileText,
              iconBg: 'bg-gray-100',
              iconColor: 'text-gray-600',
            },
            {
              label: 'Applied This Month',
              value: simulations.filter((s) => s.status === 'Applied').length.toString(),
              icon: DollarSign,
              iconBg: 'bg-emerald-50',
              iconColor: 'text-emerald-600',
            },
            {
              label: 'Net Projected Impact',
              value: formatCurrency(
                simulations
                  .filter((s) => s.status === 'Applied' && s.projectedRevenueDelta)
                  .reduce((sum, s) => sum + (s.projectedRevenueDelta ?? 0), 0)
              ) + '/mo',
              icon: TrendingUp,
              iconBg: 'bg-indigo-50',
              iconColor: 'text-indigo-600',
            },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', stat.iconBg)}>
                    <Icon className={cn('w-4.5 h-4.5', stat.iconColor)} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {stat.label}
                    </p>
                    <p className="text-[28px] font-black tabular-nums text-gray-900 leading-tight">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </motion.div>

        {/* ─── Simulations List ────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Saved Simulations
            </span>
          </div>

          <AnimatePresence mode="popLayout">
            {simulations.length > 0 ? (
              <div className="space-y-3">
                {simulations.map((sim, i) => (
                  <motion.div
                    key={sim.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05, duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                    className={cn(
                      'bg-white rounded-2xl border border-gray-200 shadow-sm p-5 group',
                      sim.status === 'Applied' && 'opacity-75'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {sim.name}
                          </h3>
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex-shrink-0',
                              STATUS_STYLES[sim.status]
                            )}
                          >
                            {sim.status}
                          </span>
                          {sim.appliedAt && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-widest flex-shrink-0">
                              <Calendar className="w-3 h-3" />
                              Applied {formatDate(sim.appliedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed mb-2">
                          {sim.description}
                        </p>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-gray-400">
                            Created {formatDate(sim.createdAt)}
                          </span>
                          {sim.projectedRevenueDelta !== undefined && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-sm font-bold tabular-nums',
                                sim.projectedRevenueDelta >= 0
                                  ? 'text-emerald-600'
                                  : 'text-red-600'
                              )}
                            >
                              {sim.projectedRevenueDelta >= 0 ? (
                                <TrendingUp className="w-3.5 h-3.5" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5" />
                              )}
                              {sim.projectedRevenueDelta >= 0 ? '+' : ''}
                              {formatCurrency(sim.projectedRevenueDelta)}/mo
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Link
                          href={`/analytics/pricing/${sim.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>
                        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                          <Copy className="w-3.5 h-3.5" />
                          Duplicate
                        </button>
                        {sim.status === 'Analyzed' && (
                          applyConfirm === sim.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleApply(sim.id)}
                                disabled={applyLoading === sim.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {applyLoading === sim.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Confirm Apply
                              </button>
                              <button
                                onClick={() => setApplyConfirm(null)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setApplyConfirm(sim.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Apply
                            </button>
                          )
                        )}
                        {sim.status !== 'Applied' && (
                          <>
                            {deleteConfirm === sim.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(sim.id)}
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(sim.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <FlaskConical className="w-7 h-7 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  No simulations yet
                </h3>
                <p className="text-sm text-gray-500 mb-5">
                  Create one to explore pricing scenarios.
                </p>
                <Link
                  href="/analytics/pricing/new"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Simulation
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
