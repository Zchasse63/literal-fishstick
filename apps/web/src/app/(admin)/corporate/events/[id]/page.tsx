import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import EventDetailClient from './_components/EventDetailClient'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .single()

  const initialEvent = data
    ? {
        id: data.id,
        name: data.name || 'Unnamed Event',
        company: data.company_name || '',
        companyId: data.company_id || '',
        eventType: data.event_type || 'corporate',
        status: (data.status || 'inquiry') as string,
        date: data.event_date ? new Date(data.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
        time: data.event_time || '',
        location: data.location || 'The Sauna Guys — Main Facility',
        description: data.description || '',
        capacity: data.capacity ?? 24,
        guests: data.guest_count ?? 0,
        basePrice: data.base_price ?? 0,
        perPersonPrice: data.per_person_price ?? 0,
        totalPrice: data.total_price ?? 0,
        specialRequests: data.special_requests || '',
        assignedStaff: data.assigned_staff || [],
        internalNotes: data.internal_notes || '',
        invoiceId: data.invoice_id || null,
      }
    : null

  return <EventDetailClient initialEvent={initialEvent} initialGuests={[]} />
}
