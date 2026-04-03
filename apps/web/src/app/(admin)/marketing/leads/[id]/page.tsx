import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import LeadDetailClient from './_components/LeadDetailClient'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const [leadRes, plansRes] = await Promise.all([
    supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .single(),
    supabase
      .from('membership_plans')
      .select('id, name, price')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('active', true)
      .order('price'),
  ])

  const initialLead = leadRes.data
    ? {
        id: leadRes.data.id,
        firstName: leadRes.data.first_name || '',
        lastName: leadRes.data.last_name || '',
        email: leadRes.data.email || '',
        phone: leadRes.data.phone || '',
        source: leadRes.data.source || 'website',
        score: leadRes.data.score ?? 50,
        status: leadRes.data.status || 'new',
        assignedTo: leadRes.data.assigned_to_name
          ? {
              name: leadRes.data.assigned_to_name,
              initials: leadRes.data.assigned_to_name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase(),
            }
          : { name: 'Unassigned', initials: '--' },
        tags: leadRes.data.tags || [],
        createdAt: leadRes.data.created_at
          ? new Date(leadRes.data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '',
        nextFollowUp: leadRes.data.next_follow_up || '',
      }
    : null

  const initialMembershipPlans = (plansRes.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name ?? 'Unnamed',
    price: p.price ?? 0,
  }))

  return <LeadDetailClient initialLead={initialLead} initialMembershipPlans={initialMembershipPlans} />
}
