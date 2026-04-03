import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/events/[id]
 *
 * Fetch a single event with guest count and company name.
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

    // ─── Fetch Event ─────────────────────────────────────────
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, company_accounts(name)')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // ─── Guest Count ─────────────────────────────────────────
    const { count: guestCount } = await supabase
      .from('event_guests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('studio_id', studioId)

    const { count: confirmedCount } = await supabase
      .from('event_guests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('studio_id', studioId)
      .eq('rsvp_status', 'confirmed')

    const { count: checkedInCount } = await supabase
      .from('event_guests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('studio_id', studioId)
      .not('checked_in_at', 'is', null)

    return NextResponse.json({
      data: {
        ...event,
        guest_counts: {
          total: guestCount ?? 0,
          confirmed: confirmedCount ?? 0,
          checked_in: checkedInCount ?? 0,
        },
      },
    })
  } catch (err) {
    console.error('GET /api/events/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/events/[id]
 *
 * Update an event. Cannot update cancelled or completed events.
 */
export async function PUT(
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

    // ─── Check Current Status ──────────────────────────────────
    const { data: existing, error: fetchError } = await supabase
      .from('events')
      .select('id, status, name')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (['cancelled', 'completed'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot edit an event with status "${existing.status}".` },
        { status: 409 }
      )
    }

    // ─── Apply Updates ─────────────────────────────────────────
    const body = await request.json()
    const allowedFields = [
      'name',
      'description',
      'event_type',
      'start_time',
      'end_time',
      'setup_time_minutes',
      'cleanup_time_minutes',
      'min_guests',
      'max_guests',
      'expected_guests',
      'actual_guests',
      'base_price',
      'per_person_price',
      'total_price',
      'deposit_amount',
      'deposit_paid',
      'company_id',
      'contact_name',
      'contact_email',
      'contact_phone',
      'status',
      'special_requests',
      'internal_notes',
      'assigned_staff',
      'resources_reserved',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('events')
      .update(updates)
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
      type: 'event_updated',
      subject_type: 'event',
      subject_id: id,
      metadata: updates,
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PUT /api/events/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/events/[id]
 *
 * Cancel an event (soft delete — sets status to 'cancelled').
 */
export async function DELETE(
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
      .select('id, status, name')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.status === 'cancelled') {
      return NextResponse.json({ error: 'Event is already cancelled' }, { status: 409 })
    }

    // ─── Cancel ───────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('events')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('studio_id', studioId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'event_cancelled',
      subject_type: 'event',
      subject_id: id,
      metadata: { name: event.name },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/events/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
