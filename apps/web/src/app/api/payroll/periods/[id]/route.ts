import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ['admin', 'manager', 'owner']

/**
 * GET /api/payroll/periods/[id]
 *
 * Get a single payroll period with all line items joined to profiles for employee names.
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
        { error: 'Insufficient permissions. Admin, manager, or owner role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || DEFAULT_STUDIO_ID

    // ─── Fetch Period ──────────────────────────────────────────
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (periodError || !period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 })
    }

    // ─── Fetch Line Items with Employee Profiles ───────────────
    const { data: lineItems, error: lineError } = await supabase
      .from('payroll_line_items')
      .select('*, profiles:employee_id(id, full_name, email, avatar_url)')
      .eq('payroll_period_id', id)
      .eq('studio_id', studioId)
      .order('gross_pay', { ascending: false })

    if (lineError) {
      return NextResponse.json({ error: lineError.message }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        ...period,
        line_items: lineItems ?? [],
      },
    })
  } catch (err) {
    console.error('GET /api/payroll/periods/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
