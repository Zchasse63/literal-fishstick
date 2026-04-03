import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/webhooks/easypost
 *
 * EasyPost tracking webhook handler.
 * Receives tracking updates and updates shipping_labels and orders accordingly.
 *
 * EasyPost sends webhook events for tracker updates:
 * https://www.easypost.com/docs/api#webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // ─── Validate Webhook Secret ─────────────────────────────────
    const webhookSecret = process.env.EASYPOST_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = request.headers.get('x-hmac-signature')
      if (!signature) {
        return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 })
      }

      // Verify HMAC signature
      const rawBody = await request.text()
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(rawBody)
      )
      const computedSignature = `hmac-sha256-hex=${Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')}`

      if (computedSignature !== signature) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
      }

      // Parse the verified body
      const event = JSON.parse(rawBody)
      return await handleEvent(event)
    }

    // No secret configured — parse body directly (development mode)
    const event = await request.json()
    return await handleEvent(event)
  } catch (err) {
    console.error('POST /api/webhooks/easypost error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleEvent(event: {
  description: string
  result?: {
    id?: string
    tracking_code?: string
    status?: string
    est_delivery_date?: string
    tracking_details?: Array<{
      message: string
      status: string
      datetime: string
      tracking_location?: {
        city?: string
        state?: string
        zip?: string
        country?: string
      }
    }>
  }
}) {
  // Only handle tracker.updated events
  if (event.description !== 'tracker.updated') {
    return NextResponse.json({ received: true })
  }

  const tracker = event.result
  if (!tracker?.tracking_code) {
    return NextResponse.json({ error: 'Missing tracking code' }, { status: 400 })
  }

  const supabase = await createServerClient()

  // ─── Find Shipping Label by Tracking Number ──────────────────
  const { data: label, error: labelError } = await supabase
    .from('shipping_labels')
    .select('id, order_id, studio_id, status')
    .eq('tracking_number', tracker.tracking_code)
    .maybeSingle()

  if (labelError || !label) {
    // Unknown tracking number — ignore gracefully
    return NextResponse.json({ received: true, matched: false })
  }

  // ─── Map EasyPost Status to Label Status ───────────────────────
  const statusMap: Record<string, string> = {
    pre_transit: 'purchased',
    in_transit: 'in_transit',
    out_for_delivery: 'in_transit',
    delivered: 'delivered',
    return_to_sender: 'returned',
    failure: 'failed',
    unknown: label.status, // keep current
    available_for_pickup: 'in_transit',
    error: 'failed',
  }

  const newLabelStatus = statusMap[tracker.status ?? ''] ?? label.status

  // ─── Build Tracking Events ─────────────────────────────────────
  const trackingEvents = (tracker.tracking_details ?? []).map((detail) => ({
    message: detail.message,
    status: detail.status,
    datetime: detail.datetime,
    location: detail.tracking_location ?? null,
  }))

  // ─── Update Shipping Label ─────────────────────────────────────
  const labelUpdates: Record<string, unknown> = {
    status: newLabelStatus,
    tracking_events: trackingEvents,
    updated_at: new Date().toISOString(),
  }

  if (tracker.est_delivery_date) {
    labelUpdates.estimated_delivery = tracker.est_delivery_date
  }

  if (newLabelStatus === 'delivered') {
    labelUpdates.actual_delivery = new Date().toISOString()
  }

  await supabase
    .from('shipping_labels')
    .update(labelUpdates)
    .eq('id', label.id)

  // ─── Update Order Status if Delivered ──────────────────────────
  if (newLabelStatus === 'delivered') {
    await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', label.order_id)

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: label.studio_id,
      actor_id: null,
      type: 'order_delivered',
      subject_type: 'order',
      subject_id: label.order_id,
      metadata: {
        tracking_number: tracker.tracking_code,
        source: 'easypost_webhook',
      },
    })
  }

  return NextResponse.json({ received: true, matched: true, status: newLabelStatus })
}
