import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'admin', 'manager']

/**
 * GET /api/corporate/[id]
 *
 * Fetch a single company account with member count, event count, and invoice totals.
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
      .select('roles')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin or manager role required.' },
        { status: 403 }
      )
    }

    // ─── Fetch Company ───────────────────────────────────────
    const { data: company, error: companyError } = await supabase
      .from('company_accounts')
      .select('*')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // ─── Aggregate Counts ────────────────────────────────────
    const { count: memberCount } = await supabase
      .from('company_members')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)
      .eq('studio_id', STUDIO_ID)
      .eq('is_active', true)

    const { count: eventCount } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)
      .eq('studio_id', STUDIO_ID)

    const { data: invoiceAgg } = await supabase
      .from('corporate_invoices')
      .select('total, amount_paid, status')
      .eq('company_id', id)
      .eq('studio_id', STUDIO_ID)

    const invoiceTotals = {
      total_invoiced: 0,
      total_paid: 0,
      total_outstanding: 0,
      overdue_count: 0,
    }

    if (invoiceAgg) {
      for (const inv of invoiceAgg) {
        invoiceTotals.total_invoiced += inv.total ?? 0
        invoiceTotals.total_paid += inv.amount_paid ?? 0
        if (['sent', 'viewed', 'overdue'].includes(inv.status)) {
          invoiceTotals.total_outstanding += (inv.total ?? 0) - (inv.amount_paid ?? 0)
        }
        if (inv.status === 'overdue') {
          invoiceTotals.overdue_count += 1
        }
      }
    }

    return NextResponse.json({
      data: {
        ...company,
        member_count: memberCount ?? 0,
        event_count: eventCount ?? 0,
        invoice_totals: invoiceTotals,
      },
    })
  } catch (err) {
    console.error('GET /api/corporate/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/corporate/[id]
 *
 * Update a company account.
 * Body: partial company fields
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
      .select('roles')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin or manager role required.' },
        { status: 403 }
      )
    }

    // ─── Check Exists ────────────────────────────────────────
    const { data: existing, error: fetchError } = await supabase
      .from('company_accounts')
      .select('id, name')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // ─── Apply Updates ───────────────────────────────────────
    const body = await request.json()
    const allowedFields = [
      'name',
      'legal_name',
      'tax_id',
      'industry',
      'company_size',
      'contact_name',
      'contact_email',
      'contact_phone',
      'contact_title',
      'billing_email',
      'billing_address',
      'stripe_customer_id',
      'payment_terms',
      'contract_start',
      'contract_end',
      'contract_value',
      'monthly_credit_allocation',
      'credit_rollover_cap',
      'auto_renew',
      'status',
      'notes',
      'tags',
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
      .from('company_accounts')
      .update(updates)
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: STUDIO_ID,
      actor_id: user.id,
      type: 'corporate.company_updated',
      subject_type: 'company_account',
      subject_id: id,
      metadata: { company_name: existing.name, updated_fields: Object.keys(updates) },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PUT /api/corporate/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/corporate/[id]
 *
 * Soft-delete a company by setting status to 'churned'.
 */
export async function DELETE(
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
      .select('roles')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin or manager role required.' },
        { status: 403 }
      )
    }

    // ─── Fetch Company ───────────────────────────────────────
    const { data: company, error: fetchError } = await supabase
      .from('company_accounts')
      .select('id, name, status')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (fetchError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (company.status === 'churned') {
      return NextResponse.json({ error: 'Company is already churned' }, { status: 409 })
    }

    // ─── Soft Delete ─────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('company_accounts')
      .update({ status: 'churned', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: STUDIO_ID,
      actor_id: user.id,
      type: 'corporate.company_churned',
      subject_type: 'company_account',
      subject_id: id,
      metadata: { company_name: company.name, previous_status: company.status },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/corporate/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
