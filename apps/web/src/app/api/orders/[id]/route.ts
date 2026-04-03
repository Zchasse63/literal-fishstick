import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/orders/[id]
 *
 * Fetch a single order with items (joined to product names),
 * shipping label (if exists), and member profile.
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

    const studioId = profile.studio_id || DEFAULT_STUDIO_ID

    // ─── Fetch Order ─────────────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, member:profiles!orders_member_id_fkey(id, full_name, email, avatar_url, phone)')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // ─── Fetch Order Items with Product Names ────────────────────
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*, product:products(id, name, sku, images)')
      .eq('order_id', id)
      .order('created_at', { ascending: true })

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // ─── Fetch Shipping Label (if exists) ────────────────────────
    const { data: shippingLabel } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('order_id', id)
      .eq('studio_id', studioId)
      .maybeSingle()

    return NextResponse.json({
      data: {
        ...order,
        items: items ?? [],
        shipping_label: shippingLabel ?? null,
      },
    })
  } catch (err) {
    console.error('GET /api/orders/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
