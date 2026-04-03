import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * Valid status transitions:
 * Pickup flow:  pending → processing → ready_for_pickup → completed
 * Shipping flow: pending → processing → shipped → delivered
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing'],
  processing: ['ready_for_pickup', 'shipped'],
  ready_for_pickup: ['completed'],
  shipped: ['delivered'],
}

/**
 * PUT /api/orders/[id]/status
 *
 * Update order status with validated transitions.
 * Body: { status: string }
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
    if (!profile || !roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { status: newStatus } = body as { status: string }

    if (!newStatus) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    // ─── Fetch Current Order ─────────────────────────────────────
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // ─── Validate Transition ─────────────────────────────────────
    const allowed = VALID_TRANSITIONS[order.status]
    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status transition: "${order.status}" → "${newStatus}". Allowed: ${(allowed ?? []).join(', ') || 'none (terminal state)'}` },
        { status: 409 }
      )
    }

    // ─── Build Updates ───────────────────────────────────────────
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    if (newStatus === 'shipped') {
      updates.shipped_at = new Date().toISOString()
    }

    if (newStatus === 'delivered') {
      updates.delivered_at = new Date().toISOString()
    }

    // ─── Apply Update ────────────────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('orders')
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
      type: 'order_status_updated',
      subject_type: 'order',
      subject_id: id,
      metadata: { from: order.status, to: newStatus },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PUT /api/orders/[id]/status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
