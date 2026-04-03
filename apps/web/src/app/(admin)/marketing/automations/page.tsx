import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import AutomationsClient from './_components/AutomationsClient'
import type { Automation } from './_components/AutomationsClient'

function getRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function AutomationsPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('automation_flows')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })

  const initialAutomations: Automation[] = (data ?? []).map((a: any) => ({
    id: a.id,
    name: a.name || 'Untitled Automation',
    triggerType: a.trigger_type || 'signup',
    triggerLabel: a.trigger_label || a.trigger_type || 'Trigger',
    active: a.active ?? false,
    enrolled: a.enrolled_count ?? 0,
    completed: a.completed_count ?? 0,
    conversionRate: a.conversion_rate ?? 0,
    lastTriggered: a.last_triggered_at ? getRelativeTime(a.last_triggered_at) : 'Never',
    steps: a.step_count ?? 0,
  }))

  return <AutomationsClient initialAutomations={initialAutomations} />
}
