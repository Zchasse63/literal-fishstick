import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/invoices/[id]
 *
 * Fetch a single invoice with company name.
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
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || STUDIO_ID

    // ─── Fetch Invoice ───────────────────────────────────────
    const { data: invoice, error: invoiceError } = await supabase
      .from('corporate_invoices')
      .select('*, company_accounts(name, contact_name, contact_email, billing_email, billing_address)')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({ data: invoice })
  } catch (err) {
    console.error('GET /api/invoices/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/invoices/[id]
 *
 * Update a draft invoice. Rejects if status is not 'draft'.
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
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || STUDIO_ID

    // ─── Check Current Status ──────────────────────────────────
    const { data: existing, error: fetchError } = await supabase
      .from('corporate_invoices')
      .select('id, status, invoice_number')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot edit invoice with status "${existing.status}". Only draft invoices can be updated.` },
        { status: 409 }
      )
    }

    // ─── Apply Updates ─────────────────────────────────────────
    const body = await request.json()
    const allowedFields = [
      'company_id',
      'line_items',
      'subtotal',
      'tax_rate',
      'tax_amount',
      'discount_amount',
      'total',
      'issue_date',
      'due_date',
      'notes',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

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
      type: 'invoice_updated',
      subject_type: 'corporate_invoice',
      subject_id: id,
      metadata: { invoice_number: existing.invoice_number, ...updates },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PUT /api/invoices/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
