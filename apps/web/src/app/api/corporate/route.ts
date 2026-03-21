import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { validateBody, corporateCreateSchema } from '@/lib/validation'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['admin', 'manager']

/**
 * GET /api/corporate
 *
 * List company accounts with filtering and pagination.
 * Query params: status, search, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

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

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // ─── Build Query ───────────────────────────────────────────
    let query = supabase
      .from('company_accounts')
      .select('*', { count: 'exact' })
      .eq('studio_id', STUDIO_ID)
      .neq('status', 'churned')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, count })
  } catch (err) {
    console.error('GET /api/corporate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/corporate
 *
 * Create a new company account.
 * Body: { name, contact_name, contact_email, ... }
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

    // ─── Parse & Validate Body ─────────────────────────────────
    const body = await request.json()
    const { data: validated, error: validationError } = validateBody(corporateCreateSchema, body)
    if (validationError) return validationError

    const {
      name,
      legal_name,
      tax_id,
      industry,
      company_size,
      contact_name,
      contact_email,
      contact_phone,
      contact_title,
      billing_email,
      billing_address,
      stripe_customer_id,
      payment_terms,
      contract_start,
      contract_end,
      contract_value,
      monthly_credit_allocation,
      credit_rollover_cap,
      auto_renew,
      status,
      notes,
      tags,
    } = validated

    // ─── Insert ────────────────────────────────────────────────
    const { data: company, error: insertError } = await supabase
      .from('company_accounts')
      .insert({
        studio_id: STUDIO_ID,
        name,
        legal_name: legal_name ?? null,
        tax_id: tax_id ?? null,
        industry: industry ?? null,
        company_size: company_size ?? null,
        contact_name,
        contact_email,
        contact_phone: contact_phone ?? null,
        contact_title: contact_title ?? null,
        billing_email: billing_email ?? null,
        billing_address: billing_address ?? null,
        stripe_customer_id: stripe_customer_id ?? null,
        payment_terms: payment_terms ?? 'net_30',
        contract_start: contract_start ?? null,
        contract_end: contract_end ?? null,
        contract_value: contract_value ?? null,
        monthly_credit_allocation: monthly_credit_allocation ?? 0,
        credits_remaining: monthly_credit_allocation ?? 0,
        credit_rollover_cap: credit_rollover_cap ?? null,
        auto_renew: auto_renew ?? false,
        status: status ?? 'prospect',
        notes: notes ?? null,
        tags: tags ?? [],
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
      action: 'corporate.company_created',
      entity_type: 'company_account',
      entity_id: company.id,
      metadata: { company_name: name },
    })

    return NextResponse.json({ data: company }, { status: 201 })
  } catch (err) {
    console.error('POST /api/corporate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
