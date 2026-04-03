import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID, STUDIO_SHIP_FROM } from '@/lib/constants'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * POST /api/orders/[id]/ship
 *
 * Create a shipping label for an order.
 * If EASYPOST_API_KEY is set, uses real EasyPost API.
 * Otherwise, creates a stub shipping label with mock data.
 *
 * Body (optional): { from_address?, to_address?, carrier?, service? }
 */
export async function POST(
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

    const studioId = profile.studio_id || DEFAULT_STUDIO_ID

    // ─── Fetch Order ─────────────────────────────────────────────
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, shipping_address, fulfillment_type')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.fulfillment_type !== 'shipping') {
      return NextResponse.json(
        { error: 'Cannot create shipping label for pickup orders' },
        { status: 400 }
      )
    }

    if (!['pending', 'processing'].includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot ship order with status "${order.status}". Order must be pending or processing.` },
        { status: 409 }
      )
    }

    // Check if label already exists
    const { data: existingLabel } = await supabase
      .from('shipping_labels')
      .select('id')
      .eq('order_id', id)
      .eq('studio_id', studioId)
      .maybeSingle()

    if (existingLabel) {
      return NextResponse.json(
        { error: 'Shipping label already exists for this order' },
        { status: 409 }
      )
    }

    // ─── Parse Optional Body ─────────────────────────────────────
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      // Body is optional
    }

    const toAddress = body.to_address ?? order.shipping_address ?? {}
    const fromAddress = body.from_address ?? STUDIO_SHIP_FROM

    // ─── Create Shipping Label ───────────────────────────────────
    const easypostApiKey = process.env.EASYPOST_API_KEY

    let labelData: {
      easypost_shipment_id: string | null
      carrier: string
      service: string
      tracking_number: string
      tracking_url: string | null
      rate_amount: number
      label_url: string | null
      status: string
      estimated_delivery: string | null
    }

    if (easypostApiKey) {
      // ─── Real EasyPost Integration ───────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const EasyPost = (await import(/* webpackIgnore: true */ '@easypost/api' as string)).default
      const client = new EasyPost(easypostApiKey)

      const shipment = await client.Shipment.create({
        from_address: fromAddress as Record<string, string>,
        to_address: toAddress as Record<string, string>,
        parcel: {
          weight: 16, // default 1 lb, can be overridden
        },
      })

      // Buy the lowest rate
      const lowestRate = shipment.lowestRate()
      const boughtShipment = await client.Shipment.buy(shipment.id, lowestRate)

      labelData = {
        easypost_shipment_id: boughtShipment.id,
        carrier: boughtShipment.selected_rate?.carrier ?? 'usps',
        service: boughtShipment.selected_rate?.service ?? 'priority',
        tracking_number: boughtShipment.tracking_code ?? '',
        tracking_url: boughtShipment.tracker?.public_url ?? null,
        rate_amount: Math.round(parseFloat(boughtShipment.selected_rate?.rate ?? '0') * 100),
        label_url: boughtShipment.postage_label?.label_url ?? null,
        status: 'purchased',
        estimated_delivery: boughtShipment.tracker?.est_delivery_date ?? null,
      }
    } else {
      // ─── Stub Mode ───────────────────────────────────────────
      const randomSuffix = Math.random().toString(36).substring(2, 10).toUpperCase()
      const trackingNumber = `MER-${randomSuffix}`

      labelData = {
        easypost_shipment_id: null,
        carrier: 'usps',
        service: 'priority',
        tracking_number: trackingNumber,
        tracking_url: null,
        rate_amount: 899, // $8.99 stub rate
        label_url: null,
        status: 'purchased',
        estimated_delivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      }
    }

    // ─── Insert Shipping Label ───────────────────────────────────
    const { data: shippingLabel, error: labelError } = await supabase
      .from('shipping_labels')
      .insert({
        order_id: id,
        studio_id: studioId,
        easypost_shipment_id: labelData.easypost_shipment_id,
        carrier: labelData.carrier,
        service: labelData.service,
        tracking_number: labelData.tracking_number,
        tracking_url: labelData.tracking_url,
        rate_amount: labelData.rate_amount,
        label_url: labelData.label_url,
        status: labelData.status,
        from_address: fromAddress,
        to_address: toAddress,
        tracking_events: [],
        estimated_delivery: labelData.estimated_delivery,
      })
      .select()
      .single()

    if (labelError) {
      return NextResponse.json({ error: labelError.message }, { status: 500 })
    }

    // ─── Update Order ────────────────────────────────────────────
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        tracking_number: labelData.tracking_number,
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        shipping_cost: labelData.rate_amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('studio_id', studioId)

    if (orderUpdateError) {
      return NextResponse.json({ error: orderUpdateError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'order_shipped',
      subject_type: 'order',
      subject_id: id,
      metadata: {
        carrier: labelData.carrier,
        service: labelData.service,
        tracking_number: labelData.tracking_number,
        stub_mode: !easypostApiKey,
      },
    })

    return NextResponse.json({ data: shippingLabel }, { status: 201 })
  } catch (err) {
    console.error('POST /api/orders/[id]/ship error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
