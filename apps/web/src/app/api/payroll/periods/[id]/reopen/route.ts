import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * POST /api/payroll/periods/[id]/reopen
 *
 * Reopen a payroll period. Owner or manager only.
 * Requires body.reason. If status was 'exported' or 'paid', still allows but includes a warning.
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
    if (!roles.some((r: string) => ['owner', 'manager'].includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || DEFAULT_STUDIO_ID

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { reason } = body as { reason: string }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'reason is required to reopen a payroll period' },
        { status: 400 }
      )
    }

    // ─── Fetch Period ──────────────────────────────────────────
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('id, status')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (periodError || !period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 })
    }

    if (period.status === 'open' || period.status === 'reopened') {
      return NextResponse.json(
        { error: `Period is already "${period.status}". No need to reopen.` },
        { status: 409 }
      )
    }

    const wasExportedOrPaid = period.status === 'exported' || period.status === 'paid'

    // ─── Reopen ────────────────────────────────────────────────
    const now = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('payroll_periods')
      .update({
        status: 'reopened',
        reopened_by: user.id,
        reopened_at: now,
        reopen_reason: reason.trim(),
      })
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
      type: 'payroll_reopened',
      subject_type: 'payroll_period',
      subject_id: id,
      metadata: {
        previous_status: period.status,
        reason: reason.trim(),
        was_exported_or_paid: wasExportedOrPaid,
      },
    })

    return NextResponse.json({
      data: updated,
      ...(wasExportedOrPaid && {
        warning: `This period was previously "${period.status}". Reopening may require re-exporting or reconciliation with your payroll provider.`,
      }),
    })
  } catch (err) {
    console.error('POST /api/payroll/periods/[id]/reopen error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
