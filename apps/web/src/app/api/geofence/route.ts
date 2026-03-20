import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['admin', 'manager', 'owner']

/**
 * GET /api/geofence
 *
 * List all geofence locations for the studio.
 * Query params: is_active
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

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

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl
    const isActive = searchParams.get('is_active')

    // ─── Build Query ───────────────────────────────────────────
    let query = supabase
      .from('geofence_locations')
      .select('*')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET /api/geofence error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/geofence
 *
 * Create a new geofence location. Owner or manager only.
 * Body: { name, latitude, longitude, radius_meters, is_active? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

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
    if (!roles.some((r: string) => ['owner', 'manager'].includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { name, latitude, longitude, radius_meters, is_active } = body as {
      name: string
      latitude: number
      longitude: number
      radius_meters: number
      is_active?: boolean
    }

    if (!name || typeof latitude !== 'number' || typeof longitude !== 'number' || typeof radius_meters !== 'number') {
      return NextResponse.json(
        { error: 'name, latitude, longitude, and radius_meters are required' },
        { status: 400 }
      )
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'latitude must be between -90 and 90, longitude between -180 and 180' },
        { status: 400 }
      )
    }

    if (radius_meters <= 0 || radius_meters > 10000) {
      return NextResponse.json(
        { error: 'radius_meters must be between 1 and 10000' },
        { status: 400 }
      )
    }

    // ─── Insert ────────────────────────────────────────────────
    const { data: geofence, error: insertError } = await supabase
      .from('geofence_locations')
      .insert({
        studio_id: studioId,
        name,
        latitude,
        longitude,
        radius_meters,
        is_active: is_active ?? true,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      action: 'geofence_created',
      entity_type: 'geofence_location',
      entity_id: geofence.id,
      metadata: { name, latitude, longitude, radius_meters },
    })

    return NextResponse.json({ data: geofence }, { status: 201 })
  } catch (err) {
    console.error('POST /api/geofence error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
