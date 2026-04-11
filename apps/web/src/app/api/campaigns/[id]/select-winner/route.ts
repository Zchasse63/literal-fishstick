import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID
const ALLOWED_ROLES = ['owner', 'admin', 'manager']

/**
 * POST /api/campaigns/[id]/select-winner
 *
 * Manually select the winning variant for an A/B test campaign.
 * Body: { winner: 'A' | 'B' }
 *
 * Once a winner is selected, the campaign's primary subject/body are updated
 * to match the winning variant for any future reference or re-sends.
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

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { winner } = body as { winner: 'A' | 'B' }

    if (!winner || !['A', 'B'].includes(winner)) {
      return NextResponse.json(
        { error: 'winner is required and must be "A" or "B"' },
        { status: 400 }
      )
    }

    // ─── Validate Campaign ─────────────────────────────────────
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .is('deleted_at', null)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!campaign.ab_test_enabled) {
      return NextResponse.json(
        { error: 'This campaign does not have A/B testing enabled' },
        { status: 409 }
      )
    }

    if (campaign.ab_winner) {
      return NextResponse.json(
        { error: `A winner has already been selected: variant ${campaign.ab_winner}` },
        { status: 409 }
      )
    }

    if (!['sent', 'completed', 'sending'].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Cannot select a winner for a campaign with status "${campaign.status}". Campaign must have been sent.` },
        { status: 409 }
      )
    }

    // ─── Set Winner ────────────────────────────────────────────
    // B12 FIX: real schema reads variants from ab_variants jsonb, writes the
    // promoted subject/body_html onto the top-level subject + body_html,
    // and records the selection timestamp in ab_winner_selected_at. There
    // is no `ab_winner` or `body_template` column.
    const variants = campaign.ab_variants as {
      a?: { subject?: string; body_html?: string }
      b?: { subject?: string; body_html?: string }
    } | null
    const chosen = winner === 'A' ? variants?.a : variants?.b
    const winnerSubject = chosen?.subject ?? campaign.subject
    const winnerBodyHtml = chosen?.body_html ?? campaign.body_html

    const { data: updated, error: updateError } = await supabase
      .from('campaigns')
      .update({
        subject: winnerSubject,
        body_html: winnerBodyHtml,
        ab_winner_selected_at: new Date().toISOString(),
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
      type: 'campaign_ab_winner_selected',
      subject_type: 'campaign',
      subject_id: id,
      metadata: { winner, winning_subject: winnerSubject },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('POST /api/campaigns/[id]/select-winner error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
