import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['admin', 'manager', 'owner']

/**
 * GET /api/pricing-simulator/[id]
 *
 * Return full simulation with projections.
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
      .select('roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID

    // ─── Fetch Simulation ────────────────────────────────────
    const { data: simulation, error } = await supabase
      .from('pricing_simulations')
      .select('*')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (error || !simulation) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 })
    }

    return NextResponse.json({ data: simulation })
  } catch (err) {
    console.error('GET /api/pricing-simulator/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/pricing-simulator/[id]
 *
 * Update name/description/changes. Only allowed if status='draft'.
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
      .select('roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID

    // ─── Check Current Status ────────────────────────────────
    const { data: existing, error: fetchError } = await supabase
      .from('pricing_simulations')
      .select('id, status')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 })
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot edit a simulation with status "${existing.status}". Only draft simulations can be updated.` },
        { status: 409 }
      )
    }

    // ─── Apply Updates ───────────────────────────────────────
    const body = await request.json()
    const allowedFields = ['name', 'description', 'changes']

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
      .from('pricing_simulations')
      .update(updates)
      .eq('id', id)
      .eq('studio_id', studioId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PUT /api/pricing-simulator/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/pricing-simulator/[id]
 *
 * Delete a simulation. Not allowed if status='applied'.
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
      .select('roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID

    // ─── Fetch Simulation ────────────────────────────────────
    const { data: simulation, error: fetchError } = await supabase
      .from('pricing_simulations')
      .select('id, status, name')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !simulation) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 })
    }

    if (simulation.status === 'applied') {
      return NextResponse.json(
        { error: 'Cannot delete an applied simulation. It is preserved for audit history.' },
        { status: 409 }
      )
    }

    // ─── Delete ──────────────────────────────────────────────
    const { error: deleteError } = await supabase
      .from('pricing_simulations')
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
      action: 'pricing_simulation_deleted',
      entity_type: 'pricing_simulation',
      entity_id: id,
      metadata: { name: simulation.name },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/pricing-simulator/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
