import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * PUT /api/payroll/periods/[id]/approve
 *
 * Approve a payroll period. Owner only.
 * Sets status='approved', approved_by, approved_at.
 */
export async function PUT(
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
    if (!roles.includes('owner')) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner role required to approve payroll.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Fetch Period ──────────────────────────────────────────
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('id, status')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (periodError || !period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 })
    }

    if (period.status === 'approved' || period.status === 'exported' || period.status === 'paid') {
      return NextResponse.json(
        { error: `Period is already "${period.status}". Cannot approve again.` },
        { status: 409 }
      )
    }

    // ─── Approve ───────────────────────────────────────────────
    const now = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('payroll_periods')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: now,
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
      action: 'payroll_approved',
      entity_type: 'payroll_period',
      entity_id: id,
      metadata: { previous_status: period.status },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PUT /api/payroll/periods/[id]/approve error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
