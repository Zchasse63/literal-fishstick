import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['admin', 'manager', 'owner']

/**
 * PUT /api/geofence/[id]
 *
 * Update a geofence location's coordinates, radius, or active status.
 * Body: { name?, latitude?, longitude?, radius_meters?, is_active? }
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
        { error: 'Insufficient permissions. Admin, manager, or owner role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { name, latitude, longitude, radius_meters, is_active } = body as {
      name?: string
      latitude?: number
      longitude?: number
      radius_meters?: number
      is_active?: boolean
    }

    if (typeof latitude === 'number' && (latitude < -90 || latitude > 90)) {
      return NextResponse.json(
        { error: 'latitude must be between -90 and 90' },
        { status: 400 }
      )
    }

    if (typeof longitude === 'number' && (longitude < -180 || longitude > 180)) {
      return NextResponse.json(
        { error: 'longitude must be between -180 and 180' },
        { status: 400 }
      )
    }

    if (typeof radius_meters === 'number' && (radius_meters <= 0 || radius_meters > 10000)) {
      return NextResponse.json(
        { error: 'radius_meters must be between 1 and 10000' },
        { status: 400 }
      )
    }

    // ─── Build Update ──────────────────────────────────────────
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (latitude !== undefined) updateData.latitude = latitude
    if (longitude !== undefined) updateData.longitude = longitude
    if (radius_meters !== undefined) updateData.radius_meters = radius_meters
    if (is_active !== undefined) updateData.is_active = is_active

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data: geofence, error: updateError } = await supabase
      .from('geofence_locations')
      .update(updateData)
      .eq('id', id)
      .eq('studio_id', studioId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!geofence) {
      return NextResponse.json({ error: 'Geofence location not found' }, { status: 404 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      action: 'geofence_updated',
      entity_type: 'geofence_location',
      entity_id: id,
      metadata: updateData,
    })

    return NextResponse.json({ data: geofence })
  } catch (err) {
    console.error('PUT /api/geofence/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/geofence/[id]
 *
 * Delete a geofence location.
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
        { error: 'Insufficient permissions. Admin, manager, or owner role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || '11111111-1111-1111-1111-111111111111'

    const { error: deleteError } = await supabase
      .from('geofence_locations')
      .delete()
      .eq('id', id)
      .eq('studio_id', studioId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      action: 'geofence_deleted',
      entity_type: 'geofence_location',
      entity_id: id,
      metadata: {},
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/geofence/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
