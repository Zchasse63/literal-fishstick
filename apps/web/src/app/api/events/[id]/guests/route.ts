import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/events/[id]/guests
 *
 * List guests for an event with profile join where member_id exists.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id } = await params

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || STUDIO_ID

    // ─── Verify Event Exists ──────────────────────────────────
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // ─── Fetch Guests ─────────────────────────────────────────
    const { data: guests, error: guestsError } = await supabase
      .from('event_guests')
      .select('*, profiles:member_id(id, full_name, email, avatar_url)')
      .eq('event_id', id)
      .eq('studio_id', studioId)
      .order('created_at', { ascending: true })

    if (guestsError) {
      return NextResponse.json({ error: guestsError.message }, { status: 500 })
    }

    return NextResponse.json({ data: guests })
  } catch (err) {
    console.error('GET /api/events/[id]/guests error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/events/[id]/guests
 *
 * Add guests to an event. Accepts an array of guest objects.
 * Body: { guests: [{ guest_name, guest_email, guest_phone?, member_id? }] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id } = await params

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || STUDIO_ID

    // ─── Verify Event Exists ──────────────────────────────────
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name, max_guests')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { guests } = body as {
      guests: {
        guest_name: string
        guest_email: string
        guest_phone?: string
        member_id?: string
      }[]
    }

    if (!guests || !Array.isArray(guests) || guests.length === 0) {
      return NextResponse.json(
        { error: 'guests array is required and must not be empty' },
        { status: 400 }
      )
    }

    // ─── Check Capacity ────────────────────────────────────────
    if (event.max_guests) {
      const { count: currentCount } = await supabase
        .from('event_guests')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id)
        .eq('studio_id', studioId)

      const currentGuestCount = currentCount ?? 0
      if (currentGuestCount + guests.length > event.max_guests) {
        return NextResponse.json(
          { error: `Adding ${guests.length} guests would exceed max capacity of ${event.max_guests}. Currently ${currentGuestCount} guests.` },
          { status: 409 }
        )
      }
    }

    // ─── Insert Guests ─────────────────────────────────────────
    const guestRows = guests.map((g) => ({
      event_id: id,
      studio_id: studioId,
      guest_name: g.guest_name ?? null,
      guest_email: g.guest_email ?? null,
      guest_phone: g.guest_phone ?? null,
      member_id: g.member_id ?? null,
      rsvp_status: 'invited' as const,
      converted_to_member: false,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('event_guests')
      .insert(guestRows)
      .select()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      action: 'event_guests_added',
      entity_type: 'event',
      entity_id: id,
      metadata: { guest_count: guests.length, event_name: event.name },
    })

    return NextResponse.json({ data: inserted }, { status: 201 })
  } catch (err) {
    console.error('POST /api/events/[id]/guests error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
