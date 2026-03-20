import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/orders/[id]/tracking
 *
 * Get shipping label and tracking events for an order.
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
    if (!profile || !roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Verify Order Exists ─────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, tracking_number, shipped_at, delivered_at')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // ─── Fetch Shipping Label ────────────────────────────────────
    const { data: shippingLabel, error: labelError } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('order_id', id)
      .eq('studio_id', studioId)
      .maybeSingle()

    if (labelError) {
      return NextResponse.json({ error: labelError.message }, { status: 500 })
    }

    if (!shippingLabel) {
      return NextResponse.json(
        { error: 'No shipping label found for this order' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: {
        order: {
          id: order.id,
          status: order.status,
          tracking_number: order.tracking_number,
          shipped_at: order.shipped_at,
          delivered_at: order.delivered_at,
        },
        shipping_label: shippingLabel,
        tracking_events: shippingLabel.tracking_events ?? [],
      },
    })
  } catch (err) {
    console.error('GET /api/orders/[id]/tracking error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
