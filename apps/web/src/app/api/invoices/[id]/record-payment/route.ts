import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * POST /api/invoices/[id]/record-payment
 *
 * Record a manual payment against an invoice.
 * Body: { amount: number, payment_method: string }
 * If amount_paid >= total, sets status to 'paid' and paid_date to today.
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
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || STUDIO_ID

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { amount, payment_method } = body as {
      amount: number
      payment_method: string
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'amount is required and must be positive' },
        { status: 400 }
      )
    }

    if (!payment_method) {
      return NextResponse.json(
        { error: 'payment_method is required' },
        { status: 400 }
      )
    }

    // ─── Fetch Invoice ───────────────────────────────────────
    const { data: invoice, error: fetchError } = await supabase
      .from('corporate_invoices')
      .select('*')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (['void', 'refunded'].includes(invoice.status)) {
      return NextResponse.json(
        { error: `Cannot record payment for invoice with status "${invoice.status}".` },
        { status: 409 }
      )
    }

    // ─── Update Payment ───────────────────────────────────────
    const newAmountPaid = (invoice.amount_paid ?? 0) + amount
    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0]

    const updates: Record<string, unknown> = {
      amount_paid: newAmountPaid,
      payment_method,
      updated_at: now,
    }

    if (newAmountPaid >= invoice.total) {
      updates.status = 'paid'
      updates.paid_date = today
    }

    const { data: updated, error: updateError } = await supabase
      .from('corporate_invoices')
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
      type: 'invoice_payment_recorded',
      subject_type: 'corporate_invoice',
      subject_id: id,
      metadata: {
        invoice_number: invoice.invoice_number,
        amount,
        payment_method,
        new_amount_paid: newAmountPaid,
        fully_paid: newAmountPaid >= invoice.total,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('POST /api/invoices/[id]/record-payment error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
