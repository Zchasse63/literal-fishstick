import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'admin', 'manager']

/**
 * GET /api/corporate/[id]/invoices
 *
 * List invoices for a company.
 * Query params: status, limit, offset
 */
export async function GET(
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

    // ─── Verify Company Exists ────────────────────────────────
    const { data: company, error: companyError } = await supabase
      .from('company_accounts')
      .select('id')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // ─── Fetch Invoices ──────────────────────────────────────
    let query = supabase
      .from('corporate_invoices')
      .select('*', { count: 'exact' })
      .eq('company_id', id)
      .eq('studio_id', STUDIO_ID)
      .order('issue_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ data, count })
  } catch (err) {
    console.error('GET /api/corporate/[id]/invoices error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/corporate/[id]/invoices
 *
 * Create a new invoice for a company.
 * Auto-generates invoice_number like INV-2026-0001.
 * Body: { line_items, due_date, tax_rate?, discount_amount?, notes? }
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

    // ─── Verify Company Exists ────────────────────────────────
    const { data: company, error: companyError } = await supabase
      .from('company_accounts')
      .select('id, name')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const {
      line_items,
      due_date,
      tax_rate,
      discount_amount,
      notes,
    } = body as {
      line_items: { description: string; quantity: number; unit_price: number; total: number }[]
      due_date: string
      tax_rate?: number
      discount_amount?: number
      notes?: string
    }

    if (!line_items || line_items.length === 0) {
      return NextResponse.json({ error: 'line_items are required' }, { status: 400 })
    }

    if (!due_date) {
      return NextResponse.json({ error: 'due_date is required' }, { status: 400 })
    }

    // ─── Generate Invoice Number ──────────────────────────────
    const year = new Date().getFullYear()
    const { count: existingCount } = await supabase
      .from('corporate_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', STUDIO_ID)
      .ilike('invoice_number', `INV-${year}-%`)

    const sequence = (existingCount ?? 0) + 1
    const invoiceNumber = `INV-${year}-${String(sequence).padStart(4, '0')}`

    // ─── Calculate Totals ─────────────────────────────────────
    const subtotal = line_items.reduce((sum: number, item: { total: number }) => sum + item.total, 0)
    const appliedTaxRate = tax_rate ?? 0
    const taxAmount = Math.round(subtotal * appliedTaxRate) / 100
    const appliedDiscount = discount_amount ?? 0
    const total = subtotal + taxAmount - appliedDiscount

    // ─── Insert Invoice ───────────────────────────────────────
    const { data: invoice, error: insertError } = await supabase
      .from('corporate_invoices')
      .insert({
        studio_id: STUDIO_ID,
        company_id: id,
        invoice_number: invoiceNumber,
        status: 'draft',
        subtotal,
        tax_rate: appliedTaxRate,
        tax_amount: taxAmount,
        discount_amount: appliedDiscount,
        total,
        amount_paid: 0,
        line_items,
        issue_date: new Date().toISOString().split('T')[0],
        due_date,
        notes: notes ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: STUDIO_ID,
      actor_id: user.id,
      type: 'corporate.invoice_created',
      subject_type: 'corporate_invoice',
      subject_id: invoice.id,
      metadata: { company_name: company.name, invoice_number: invoiceNumber, total },
    })

    return NextResponse.json({ data: invoice }, { status: 201 })
  } catch (err) {
    console.error('POST /api/corporate/[id]/invoices error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
