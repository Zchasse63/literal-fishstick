import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'admin', 'manager']

/**
 * POST /api/corporate/[id]/credits
 *
 * Allocate or adjust credits for a company.
 * Body: { amount, reason }
 * Positive amount = add credits, negative = deduct credits.
 * Updates credits_remaining on company_accounts and logs to activity_log.
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

    // ─── Fetch Company ───────────────────────────────────────
    const { data: company, error: companyError } = await supabase
      .from('company_accounts')
      .select('id, name, credits_remaining')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { amount, reason } = body as {
      amount: number
      reason: string
    }

    if (amount === undefined || amount === null || typeof amount !== 'number') {
      return NextResponse.json({ error: 'amount is required and must be a number' }, { status: 400 })
    }

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    }

    const newBalance = company.credits_remaining + amount

    if (newBalance < 0) {
      return NextResponse.json(
        { error: `Insufficient credits. Current balance: ${company.credits_remaining}, attempted adjustment: ${amount}` },
        { status: 400 }
      )
    }

    // ─── Update Credits ──────────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('company_accounts')
      .update({
        credits_remaining: newBalance,
        updated_at: new Date().toISOString(),
      })
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
      type: amount >= 0 ? 'corporate.credits_allocated' : 'corporate.credits_deducted',
      subject_type: 'company_account',
      subject_id: id,
      metadata: {
        company_name: company.name,
        amount,
        reason,
        previous_balance: company.credits_remaining,
        new_balance: newBalance,
      },
    })

    return NextResponse.json({
      data: {
        company_id: id,
        previous_balance: company.credits_remaining,
        adjustment: amount,
        new_balance: newBalance,
        reason,
        company: updated,
      },
    })
  } catch (err) {
    console.error('POST /api/corporate/[id]/credits error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
