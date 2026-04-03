import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * POST /api/invoices/[id]/void
 *
 * Void an invoice. Only allowed if status is 'draft', 'sent', or 'overdue'.
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
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || STUDIO_ID

    // ─── Fetch Invoice ───────────────────────────────────────
    const { data: invoice, error: fetchError } = await supabase
      .from('corporate_invoices')
      .select('id, status, invoice_number')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const voidableStatuses = ['draft', 'sent', 'overdue']
    if (!voidableStatuses.includes(invoice.status)) {
      return NextResponse.json(
        { error: `Cannot void invoice with status "${invoice.status}". Only draft, sent, or overdue invoices can be voided.` },
        { status: 409 }
      )
    }

    // ─── Void Invoice ─────────────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('corporate_invoices')
      .update({
        status: 'void',
        updated_at: new Date().toISOString(),
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
      type: 'invoice_voided',
      subject_type: 'corporate_invoice',
      subject_id: id,
      metadata: {
        invoice_number: invoice.invoice_number,
        previous_status: invoice.status,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('POST /api/invoices/[id]/void error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
