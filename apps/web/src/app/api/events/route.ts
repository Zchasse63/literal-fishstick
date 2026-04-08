import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { validateBody, eventCreateSchema, normalizePhone } from '@/lib/validation'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/events
 *
 * List events with filtering and pagination.
 * Query params: event_type, status, start_date, end_date, company_id, limit, offset, search
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

    const studioId = profile?.studio_id
    if (!studioId) {
      return NextResponse.json({ error: 'No studio associated with this account' }, { status: 403 })
    }

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl
    const eventType = searchParams.get('event_type')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const companyId = searchParams.get('company_id')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // ─── Build Query ───────────────────────────────────────────
    let query = supabase
      .from('events')
      .select('*, company_accounts(name)', { count: 'exact' })
      .eq('studio_id', studioId)
      .order('start_time', { ascending: false })
      .range(offset, offset + limit - 1)

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (startDate) {
      query = query.gte('start_time', startDate)
    }

    if (endDate) {
      query = query.lte('start_time', endDate)
    }

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ data, count })
  } catch (err) {
    console.error('GET /api/events error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/events
 *
 * Create a new event or inquiry.
 * Body: Event fields (name, event_type, start_time, end_time, etc.)
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
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id
    if (!studioId) {
      return NextResponse.json({ error: 'No studio associated with this account' }, { status: 403 })
    }

    // ─── Parse & Validate Body ─────────────────────────────────
    const body = await request.json()
    const { data: validated, error: validationError } = validateBody(eventCreateSchema, body)
    if (validationError) return validationError

    const {
      name,
      description,
      event_type,
      start_time,
      end_time,
      setup_time_minutes,
      cleanup_time_minutes,
      min_guests,
      max_guests,
      expected_guests,
      base_price,
      per_person_price,
      total_price,
      deposit_amount,
      company_id,
      contact_name,
      contact_email,
      contact_phone,
      special_requests,
      internal_notes,
      assigned_staff,
      resources_reserved,
    } = validated

    // ─── Insert ────────────────────────────────────────────────
    const { data: event, error: insertError } = await supabase
      .from('events')
      .insert({
        studio_id: studioId,
        name,
        description: description ?? null,
        event_type,
        start_time,
        end_time,
        setup_time_minutes: setup_time_minutes ?? 0,
        cleanup_time_minutes: cleanup_time_minutes ?? 0,
        min_guests: min_guests ?? 1,
        max_guests: max_guests ?? null,
        expected_guests: expected_guests ?? null,
        base_price: base_price ?? null,
        per_person_price: per_person_price ?? null,
        total_price: total_price ?? null,
        deposit_amount: deposit_amount ?? null,
        deposit_paid: false,
        company_id: company_id ?? null,
        contact_name: contact_name ?? null,
        contact_email: contact_email ?? null,
        contact_phone: normalizePhone(contact_phone) ?? null,
        status: 'inquiry',
        special_requests: special_requests ?? null,
        internal_notes: internal_notes ?? null,
        assigned_staff: assigned_staff ?? [],
        resources_reserved: resources_reserved ?? [],
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'event_created',
      subject_type: 'event',
      subject_id: event.id,
      metadata: { name, event_type },
    })

    return NextResponse.json({ data: event }, { status: 201 })
  } catch (err) {
    console.error('POST /api/events error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
