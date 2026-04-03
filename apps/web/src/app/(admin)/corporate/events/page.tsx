import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import EventCalendarClient from './_components/EventCalendarClient'
import type { CalendarEvent } from './_components/EventCalendarClient'

export default async function EventCalendarPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('event_date', { ascending: true })

  const initialEvents: CalendarEvent[] = (data ?? []).map((e: any) => ({
    id: e.id,
    name: e.name || 'Unnamed Event',
    company: e.company_name || '',
    date: e.event_date ? e.event_date.split('T')[0] : '',
    time: e.event_time || '',
    eventType: e.event_type || 'corporate',
    guests: e.guest_count ?? 0,
    status: e.status || 'inquiry',
  }))

  return <EventCalendarClient initialEvents={initialEvents} />
}
