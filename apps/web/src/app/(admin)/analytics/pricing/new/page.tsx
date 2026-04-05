'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  FlaskConical,
  Save,
  Plus,
  Trash2,
  Loader2,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID

interface MembershipPlan {
  id: string
  name: string
  price: number
  subscriber_count: number
}

interface PriceChange {
  plan_id: string
  plan_name: string
  current_price: number
  proposed_price: string
}

export default function NewPricingSimulationPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [changes, setChanges] = useState<PriceChange[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)

  // Load membership plans
  useEffect(() => {
    async function fetchPlans() {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('membership_plans')
        .select('id, name, price, subscriber_count')
        .eq('studio_id', STUDIO_ID)
        .eq('active', true)
        .order('name')

      if (data) {
        setPlans(data.map((p: any) => ({
          id: p.id,
          name: p.name ?? 'Unnamed Plan',
          price: p.price ?? 0,
          subscriber_count: p.subscriber_count ?? 0,
        })))
      }
      setLoadingPlans(false)
    }
    fetchPlans()
  }, [])

  function addPlanChange(plan: MembershipPlan) {
    if (changes.some((c) => c.plan_id === plan.id)) return
    setChanges([...changes, {
      plan_id: plan.id,
      plan_name: plan.name,
      current_price: plan.price,
      proposed_price: String(plan.price),
    }])
  }

  function removePlanChange(planId: string) {
    setChanges(changes.filter((c) => c.plan_id !== planId))
  }

  function updateProposedPrice(planId: string, value: string) {
    setChanges(changes.map((c) =>
      c.plan_id === planId ? { ...c, proposed_price: value } : c
    ))
  }

  function getPriceDelta(change: PriceChange): number {
    const proposed = parseFloat(change.proposed_price) || 0
    return proposed - change.current_price
  }

  function getPriceDeltaPct(change: PriceChange): number {
    const delta = getPriceDelta(change)
    return change.current_price > 0 ? (delta / change.current_price) * 100 : 0
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Simulation name is required.')
      return
    }
    if (changes.length === 0) {
      setError('Add at least one price change to simulate.')
      return
    }

    setSaving(true)
    setError(null)

    const supabase = createBrowserClient()

    const config = {
      plans: changes.map((c) => ({
        plan_id: c.plan_id,
        plan_name: c.plan_name,
        current_price: c.current_price,
        proposed_price: parseFloat(c.proposed_price) || 0,
      })),
    }

    const { data, error: insertError } = await supabase
      .from('pricing_simulations')
      .insert({
        studio_id: STUDIO_ID,
        name: name.trim(),
        description: description.trim() || null,
        status: 'Draft',
        config,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    router.push(`/analytics/pricing/${data.id}`)
  }

  const availablePlans = plans.filter((p) => !changes.some((c) => c.plan_id === p.id))

  return (
    <div className="space-y-6">
      <div className="max-w-[800px] mx-auto px-6 py-8">
        {/* Back */}
        <motion.div {...fadeInUp}>
          <Link
            href="/analytics/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Pricing Simulator
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.05 }} className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <FlaskConical className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">New Simulation</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Model a pricing scenario and project revenue impact</p>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="space-y-6"
        >
          {/* Simulation Details */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Simulation Details</h2>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Simulation Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q2 Price Increase Test"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the pricing scenario you want to test..."
                rows={3}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Price Changes */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Price Changes</h2>
              {availablePlans.length > 0 && (
                <div className="relative group">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                    <Plus className="h-3 w-3" />
                    Add Plan
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-10 hidden group-hover:block">
                    {availablePlans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => addPlanChange(plan)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 first:rounded-t-xl last:rounded-b-xl transition-colors"
                      >
                        <span className="font-medium">{plan.name}</span>
                        <span className="text-gray-400 dark:text-gray-500 ml-2">${plan.price}/mo</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {loadingPlans ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-gray-500" />
              </div>
            ) : changes.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No price changes added yet.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {plans.length > 0
                    ? 'Hover "Add Plan" above to select a membership plan.'
                    : 'No active membership plans found.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {changes.map((change) => {
                  const delta = getPriceDelta(change)
                  const deltaPct = getPriceDeltaPct(change)
                  return (
                    <div
                      key={change.plan_id}
                      className="flex items-center gap-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{change.plan_name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          Current: ${change.current_price}/mo
                          {change.current_price > 0 && (
                            <span className="text-gray-300 mx-1">&middot;</span>
                          )}
                          {/* Subscribers: {plans.find(p => p.id === change.plan_id)?.subscriber_count ?? 0} */}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={change.proposed_price}
                            onChange={(e) => updateProposedPrice(change.plan_id, e.target.value)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-800 pl-7 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                          />
                        </div>

                        {delta !== 0 && (
                          <span className={cn(
                            'inline-flex items-center gap-1 text-xs font-bold tabular-nums whitespace-nowrap',
                            delta > 0 ? 'text-emerald-600' : 'text-red-600'
                          )}>
                            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {delta > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                          </span>
                        )}

                        <button
                          onClick={() => removePlanChange(change.plan_id)}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/analytics/pricing"
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Creating...' : 'Create Simulation'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
