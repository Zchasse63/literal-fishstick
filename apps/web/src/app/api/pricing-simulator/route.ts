import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['admin', 'manager', 'owner']

/**
 * GET /api/pricing-simulator
 *
 * List pricing simulations for the studio, ordered by created_at DESC.
 */
export async function GET() {
  try {
    const supabase = await createServerClient()

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
        { error: 'Insufficient permissions. Admin, manager, or owner role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID

    // ─── Query ───────────────────────────────────────────────
    const { data, error } = await supabase
      .from('pricing_simulations')
      .select('*')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET /api/pricing-simulator error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/pricing-simulator
 *
 * Create a new pricing simulation.
 * Body: { name, description?, changes: [{ plan_id, plan_name, current_price, new_price }] }
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
      .select('roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin, manager, or owner role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID

    // ─── Parse Body ──────────────────────────────────────────
    const body = await request.json()
    const { name, description, changes } = body as {
      name: string
      description?: string
      changes: { plan_id: string; plan_name: string; current_price: number; new_price: number }[]
    }

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json(
        { error: 'changes array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate each change entry
    for (const change of changes) {
      if (!change.plan_id || !change.plan_name || change.current_price == null || change.new_price == null) {
        return NextResponse.json(
          { error: 'Each change must have plan_id, plan_name, current_price, and new_price' },
          { status: 400 }
        )
      }
    }

    // ─── Insert ──────────────────────────────────────────────
    const { data: simulation, error: insertError } = await supabase
      .from('pricing_simulations')
      .insert({
        studio_id: studioId,
        name,
        description: description ?? null,
        changes,
        status: 'draft',
        created_by: user.id,
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
      type: 'pricing_simulation_created',
      subject_type: 'pricing_simulation',
      subject_id: simulation.id,
      metadata: { name, change_count: changes.length },
    })

    return NextResponse.json({ data: simulation }, { status: 201 })
  } catch (err) {
    console.error('POST /api/pricing-simulator error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
