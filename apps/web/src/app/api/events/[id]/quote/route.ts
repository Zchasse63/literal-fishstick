import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * POST /api/events/[id]/quote
 *
 * Generate a price quote for an event.
 * Calculates total from base_price + (per_person_price * expected_guests).
 * Updates total_price and sets status to 'quoted'.
 */
export async function POST(
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

    // ─── Fetch Event ─────────────────────────────────────────
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!['inquiry'].includes(event.status)) {
      return NextResponse.json(
        { error: `Cannot generate quote for event with status "${event.status}". Must be in "inquiry" status.` },
        { status: 409 }
      )
    }

    // ─── Calculate Quote ──────────────────────────────────────
    const basePrice = event.base_price ?? 0
    const perPersonPrice = event.per_person_price ?? 0
    const expectedGuests = event.expected_guests ?? event.min_guests ?? 1
    const totalPrice = basePrice + (perPersonPrice * expectedGuests)

    // ─── Update Event ─────────────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('events')
      .update({
        total_price: totalPrice,
        status: 'quoted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('studio_id', studioId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'event_quoted',
      subject_type: 'event',
      subject_id: id,
      metadata: {
        base_price: basePrice,
        per_person_price: perPersonPrice,
        expected_guests: expectedGuests,
        total_price: totalPrice,
      },
    })

    return NextResponse.json({
      data: updated,
      quote: {
        base_price: basePrice,
        per_person_price: perPersonPrice,
        expected_guests: expectedGuests,
        total_price: totalPrice,
      },
    })
  } catch (err) {
    console.error('POST /api/events/[id]/quote error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
