import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['admin', 'manager', 'owner']

/**
 * GET /api/payroll/periods
 *
 * List payroll periods with pagination.
 * Query params: status, limit, offset
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
        { error: 'Insufficient permissions. Admin, manager, or owner role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // ─── Build Query ───────────────────────────────────────────
    let query = supabase
      .from('payroll_periods')
      .select('*', { count: 'exact' })
      .eq('studio_id', studioId)
      .order('period_start', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, count })
  } catch (err) {
    console.error('GET /api/payroll/periods error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/payroll/periods
 *
 * Create a new payroll period.
 * Body: { period_start, period_end, pay_date }
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
        { error: 'Insufficient permissions. Admin, manager, or owner role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { period_start, period_end, pay_date } = body as {
      period_start: string
      period_end: string
      pay_date: string
    }

    if (!period_start || !period_end || !pay_date) {
      return NextResponse.json(
        { error: 'period_start, period_end, and pay_date are required' },
        { status: 400 }
      )
    }

    // Validate date order
    if (new Date(period_end) <= new Date(period_start)) {
      return NextResponse.json(
        { error: 'period_end must be after period_start' },
        { status: 400 }
      )
    }

    // ─── Check for Overlapping Periods ─────────────────────────
    const { data: overlapping } = await supabase
      .from('payroll_periods')
      .select('id')
      .eq('studio_id', studioId)
      .or(`and(period_start.lte.${period_end},period_end.gte.${period_start})`)
      .limit(1)

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: 'This period overlaps with an existing payroll period' },
        { status: 409 }
      )
    }

    // ─── Insert ────────────────────────────────────────────────
    const { data: period, error: insertError } = await supabase
      .from('payroll_periods')
      .insert({
        studio_id: studioId,
        period_start,
        period_end,
        pay_date,
        status: 'open',
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
      type: 'payroll_period_created',
      subject_type: 'payroll_period',
      subject_id: period.id,
      metadata: { period_start, period_end, pay_date },
    })

    return NextResponse.json({ data: period }, { status: 201 })
  } catch (err) {
    console.error('POST /api/payroll/periods error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
