import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { PricingSimulatorDetailClient } from './_components/PricingSimulatorDetailClient'

export default async function PricingSimulatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: simId } = await params
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('pricing_simulations')
    .select('*')
    .eq('id', simId)
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .single()

  let simulation = { id: '', name: 'Untitled', status: 'Draft' as const, createdAt: '', appliedAt: null as string | null }
  let plans: any[] = []
  let isAnalyzed = false

  if (data) {
    simulation = {
      id: data.id,
      name: data.name ?? 'Untitled',
      status: data.status ?? 'Draft',
      createdAt: data.created_at?.split('T')[0] ?? '',
      appliedAt: data.applied_at?.split('T')[0] ?? null,
    }
    isAnalyzed = data.status === 'Analyzed' || data.status === 'Applied'

    const simPlans = data.plans ?? []
    if (simPlans.length > 0) {
      plans = simPlans.map((p: any) => ({
        id: p.id ?? '',
        name: p.name ?? '',
        currentPrice: p.current_price ?? 0,
        newPrice: p.new_price ?? p.current_price ?? 0,
        subscribers: p.subscribers ?? 0,
        mrrContribution: p.mrr_contribution ?? 0,
      }))
    } else {
      const { data: mpData } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('studio_id', DEFAULT_STUDIO_ID)
      if (mpData) {
        plans = mpData.map((p: any) => ({
          id: p.id,
          name: p.name ?? 'Plan',
          currentPrice: p.price ?? 0,
          newPrice: p.price ?? 0,
          subscribers: p.subscriber_count ?? 0,
          mrrContribution: (p.price ?? 0) * (p.subscriber_count ?? 0),
        }))
      }
    }
  }

  return (
    <PricingSimulatorDetailClient
      initialPlans={plans}
      initialSimulation={simulation}
      initialIsAnalyzed={isAnalyzed}
    />
  )
}
