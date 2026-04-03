import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import LeadPipelineClient from './_components/LeadPipelineClient'
import type { Lead } from './_components/LeadPipelineClient'

function getRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

export default async function LeadPipelinePage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('leads')
    .select('*, assignee:profiles!leads_assigned_to_fkey ( full_name )')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })

  const initialLeads: Lead[] = (data ?? []).map((l: any) => {
    const assigneeName = l.assignee?.full_name ?? null
    return {
      id: l.id,
      firstName: l.first_name || '',
      lastName: l.last_name || '',
      email: l.email || '',
      phone: l.phone || undefined,
      source: l.source || 'website',
      score: l.score ?? 50,
      status: l.status || 'new',
      lastActivity: l.updated_at ? getRelativeTime(l.updated_at) : 'Just now',
      tags: l.tags || [],
      assignedTo: assigneeName
        ? { name: assigneeName, initials: assigneeName.split(' ').map((n: string) => n[0]).join('').toUpperCase() }
        : undefined,
    }
  })

  return <LeadPipelineClient initialLeads={initialLeads} />
}
