import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * PUT /api/events/[id]/guests/[gid]
 *
 * Update a guest's RSVP status, check-in time, or other details.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gid: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id, gid } = await params

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

    // ─── Verify Guest Exists ──────────────────────────────────
    const { data: guest, error: fetchError } = await supabase
      .from('event_guests')
      .select('*')
      .eq('id', gid)
      .eq('event_id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
    }

    // ─── Apply Updates ─────────────────────────────────────────
    const body = await request.json()
    const allowedFields = [
      'rsvp_status',
      'rsvp_at',
      'checked_in_at',
      'guest_name',
      'guest_email',
      'guest_phone',
      'converted_to_member',
      'conversion_date',
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

    // Auto-set rsvp_at when rsvp_status changes
    if (updates.rsvp_status && !updates.rsvp_at) {
      updates.rsvp_at = new Date().toISOString()
    }

    // Auto-set checked_in_at when status is 'attended'
    if (updates.rsvp_status === 'attended' && !updates.checked_in_at) {
      updates.checked_in_at = new Date().toISOString()
    }

    const { data: updated, error: updateError } = await supabase
      .from('event_guests')
      .update(updates)
      .eq('id', gid)
      .eq('event_id', id)
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
      type: 'event_guest_updated',
      subject_type: 'event_guest',
      subject_id: gid,
      metadata: { event_id: id, ...updates },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PUT /api/events/[id]/guests/[gid] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
