import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID, STUDIO_SHIP_FROM } from '@/lib/constants'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * POST /api/shipping/rates
 *
 * Get shipping rate quotes for an order.
 * If EASYPOST_API_KEY is set, uses real EasyPost API.
 * Otherwise, returns 3 mock rates for USPS Priority/Express/Ground.
 *
 * Body: { order_id, to_address }
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
    if (!profile || !roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile.studio_id || DEFAULT_STUDIO_ID

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { order_id, to_address } = body as {
      order_id: string
      to_address: Record<string, string>
    }

    if (!order_id || !to_address) {
      return NextResponse.json(
        { error: 'order_id and to_address are required' },
        { status: 400 }
      )
    }

    // ─── Verify Order Exists ─────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, fulfillment_type')
      .eq('id', order_id)
      .eq('studio_id', studioId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // ─── Calculate Total Weight ──────────────────────────────────
    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, product:products(weight_oz)')
      .eq('order_id', order_id)

    let totalWeightOz = 0
    if (items) {
      for (const item of items) {
        const product = item.product as unknown as { weight_oz: number | null }
        const weightOz = product?.weight_oz ?? 8 // default 8oz per item
        totalWeightOz += weightOz * item.quantity
      }
    }
    if (totalWeightOz === 0) totalWeightOz = 16 // minimum 1 lb

    // ─── Get Rates ───────────────────────────────────────────────
    const easypostApiKey = process.env.EASYPOST_API_KEY

    if (easypostApiKey) {
      // ─── Real EasyPost Integration ───────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const EasyPost = (await import(/* webpackIgnore: true */ '@easypost/api' as string)).default
      const client = new EasyPost(easypostApiKey)

      const fromAddress = STUDIO_SHIP_FROM

      const shipment = await client.Shipment.create({
        from_address: fromAddress,
        to_address: to_address,
        parcel: {
          weight: totalWeightOz,
        },
      })

      const rates = (shipment.rates ?? []).map((rate: { id: string; carrier: string; service: string; rate: string; est_delivery_days: number | null; delivery_date: string | null }) => ({
        id: rate.id,
        carrier: rate.carrier,
        service: rate.service,
        rate_amount: Math.round(parseFloat(rate.rate) * 100),
        estimated_days: rate.est_delivery_days ?? null,
        estimated_delivery: rate.delivery_date ?? null,
      }))

      return NextResponse.json({ data: rates })
    }

    // ─── Stub Mode: Return Mock Rates ────────────────────────────
    const baseRate = Math.max(499, Math.round(totalWeightOz * 30)) // ~$0.30/oz min $4.99

    const rates = [
      {
        id: 'rate_ground_stub',
        carrier: 'USPS',
        service: 'Ground Advantage',
        rate_amount: baseRate,
        estimated_days: 7,
        estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'rate_priority_stub',
        carrier: 'USPS',
        service: 'Priority',
        rate_amount: Math.round(baseRate * 1.5),
        estimated_days: 3,
        estimated_delivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'rate_express_stub',
        carrier: 'USPS',
        service: 'Express',
        rate_amount: Math.round(baseRate * 2.8),
        estimated_days: 1,
        estimated_delivery: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    return NextResponse.json({ data: rates })
  } catch (err) {
    console.error('POST /api/shipping/rates error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
