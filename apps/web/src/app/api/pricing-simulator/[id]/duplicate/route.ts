import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ['admin', 'manager', 'owner']

/**
 * POST /api/pricing-simulator/[id]/duplicate
 *
 * Clone a pricing simulation as a new draft. Copies all content and changes,
 * resets projections, AI narrative, and analysis timestamps.
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

    // ─── Fetch Source Simulation ──────────────────────────────
    const { data: source, error: fetchError } = await supabase
      .from('pricing_simulations')
      .select('*')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !source) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 })
    }

    // ─── Create Duplicate ─────────────────────────────────────
    // Schema has no `analyzed_at` — use updated_at / status='draft' instead.
    const { data: duplicate, error: insertError } = await supabase
      .from('pricing_simulations')
      .insert({
        studio_id: studioId,
        name: `${source.name} (Copy)`,
        description: source.description,
        changes: source.changes,
        status: 'draft',
        created_by: user.id,
        // Reset analysis fields
        projections: null,
        ai_narrative: null,
        applied_at: null,
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
      type: 'pricing_simulation_duplicated',
      subject_type: 'pricing_simulation',
      subject_id: duplicate.id,
      metadata: { source_simulation_id: id, source_simulation_name: source.name },
    })

    return NextResponse.json({ data: duplicate }, { status: 201 })
  } catch (err) {
    console.error('POST /api/pricing-simulator/[id]/duplicate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
