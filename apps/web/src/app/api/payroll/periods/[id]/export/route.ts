import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['admin', 'manager', 'owner']

/**
 * POST /api/payroll/periods/[id]/export
 *
 * Generate a CSV with all line items for the payroll period.
 * Returns as downloadable CSV. Sets status='exported'.
 * Columns: Employee Name, Regular Hours, OT Hours, Base Pay, OT Pay, Bonuses,
 *          Commissions, Gross Pay, Est. Taxes, Est. Net Pay
 */
export async function POST(
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

    const studioId = profile?.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Fetch Period ──────────────────────────────────────────
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('id, status, period_start, period_end, pay_date')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (periodError || !period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 })
    }

    // ─── Fetch Line Items with Employee Names ──────────────────
    const { data: lineItems, error: lineError } = await supabase
      .from('payroll_line_items')
      .select('*, profiles:employee_id(full_name, email)')
      .eq('payroll_period_id', id)
      .eq('studio_id', studioId)
      .order('gross_pay', { ascending: false })

    if (lineError) {
      return NextResponse.json({ error: lineError.message }, { status: 500 })
    }

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'No line items found. Run calculate first.' },
        { status: 400 }
      )
    }

    // ─── Build CSV ─────────────────────────────────────────────
    const headers = [
      'Employee Name',
      'Regular Hours',
      'OT Hours',
      'Base Pay',
      'OT Pay',
      'Bonuses',
      'Commissions',
      'Gross Pay',
      'Est. Taxes',
      'Est. Net Pay',
    ]

    const rows = lineItems.map((item) => {
      const employeeName = (item.profiles as { full_name?: string; email?: string } | null)?.full_name
        || (item.profiles as { full_name?: string; email?: string } | null)?.email
        || item.employee_id

      const estTaxes = (item.federal_estimate ?? 0) + (item.state_estimate ?? 0) + (item.fica_estimate ?? 0)

      return [
        escapeCsvField(String(employeeName)),
        (item.regular_hours ?? 0).toFixed(2),
        (item.overtime_hours ?? 0).toFixed(2),
        (item.base_pay ?? 0).toFixed(2),
        (item.overtime_pay ?? 0).toFixed(2),
        (item.trainer_bonuses ?? 0).toFixed(2),
        (item.promo_commissions ?? 0).toFixed(2),
        (item.gross_pay ?? 0).toFixed(2),
        estTaxes.toFixed(2),
        (item.net_pay_estimate ?? 0).toFixed(2),
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')

    // ─── Update Period Status to Exported ──────────────────────
    await supabase
      .from('payroll_periods')
      .update({ status: 'exported' })
      .eq('id', id)
      .eq('studio_id', studioId)

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'payroll_exported',
      subject_type: 'payroll_period',
      subject_id: id,
      metadata: {
        employee_count: lineItems.length,
        format: 'csv',
      },
    })

    // ─── Return CSV ────────────────────────────────────────────
    const filename = `payroll-${period.period_start}-to-${period.period_end}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('POST /api/payroll/periods/[id]/export error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Escape a CSV field value — wrap in quotes if it contains commas, quotes, or newlines.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
