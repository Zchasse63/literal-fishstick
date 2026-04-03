import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { PricingSimulatorClient } from './_components/PricingSimulatorClient'

export default async function PricingSimulatorPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('pricing_simulations')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })

  const simulations = (data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name ?? 'Untitled',
    description: s.description ?? '',
    createdAt: s.created_at?.split('T')[0] ?? '',
    status: s.status ?? 'Draft',
    projectedRevenueDelta: s.projected_revenue_delta,
    appliedAt: s.applied_at?.split('T')[0],
  }))

  return <PricingSimulatorClient initialSimulations={simulations} />
}
