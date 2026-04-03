import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID
const ALLOWED_ROLES = ['owner', 'admin', 'manager']

/**
 * GET /api/campaigns/[id]
 *
 * Fetch a single campaign with engagement metrics.
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

    // ─── Fetch Campaign ────────────────────────────────────────
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .is('deleted_at', null)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // ─── Compute Engagement Metrics ────────────────────────────
    const metrics = {
      open_rate: campaign.sent_count > 0
        ? Math.round((campaign.opened_count / campaign.sent_count) * 10000) / 100
        : 0,
      click_rate: campaign.sent_count > 0
        ? Math.round((campaign.clicked_count / campaign.sent_count) * 10000) / 100
        : 0,
      bounce_rate: campaign.sent_count > 0
        ? Math.round((campaign.bounced_count / campaign.sent_count) * 10000) / 100
        : 0,
      unsubscribe_rate: campaign.sent_count > 0
        ? Math.round((campaign.unsubscribed_count / campaign.sent_count) * 10000) / 100
        : 0,
    }

    // ─── A/B Test Variant Metrics (if applicable) ──────────────
    let variantMetrics = null
    if (campaign.ab_test_enabled) {
      const { data: variantA } = await supabase
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('variant', 'A')

      const { data: variantAOpened } = await supabase
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('variant', 'A')
        .not('opened_at', 'is', null)

      const { data: variantAClicked } = await supabase
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('variant', 'A')
        .not('clicked_at', 'is', null)

      const { data: variantB } = await supabase
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('variant', 'B')

      const { data: variantBOpened } = await supabase
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('variant', 'B')
        .not('opened_at', 'is', null)

      const { data: variantBClicked } = await supabase
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('variant', 'B')
        .not('clicked_at', 'is', null)

      // Use the count from the response metadata
      const aTotal = (variantA as unknown as { count: number })?.count ?? 0
      const aOpened = (variantAOpened as unknown as { count: number })?.count ?? 0
      const aClicked = (variantAClicked as unknown as { count: number })?.count ?? 0
      const bTotal = (variantB as unknown as { count: number })?.count ?? 0
      const bOpened = (variantBOpened as unknown as { count: number })?.count ?? 0
      const bClicked = (variantBClicked as unknown as { count: number })?.count ?? 0

      variantMetrics = {
        variant_a: {
          total: aTotal,
          opened: aOpened,
          clicked: aClicked,
          open_rate: aTotal > 0 ? Math.round((aOpened / aTotal) * 10000) / 100 : 0,
          click_rate: aTotal > 0 ? Math.round((aClicked / aTotal) * 10000) / 100 : 0,
        },
        variant_b: {
          total: bTotal,
          opened: bOpened,
          clicked: bClicked,
          open_rate: bTotal > 0 ? Math.round((bOpened / bTotal) * 10000) / 100 : 0,
          click_rate: bTotal > 0 ? Math.round((bClicked / bTotal) * 10000) / 100 : 0,
        },
        winner: campaign.ab_winner ?? null,
      }
    }

    return NextResponse.json({
      data: {
        ...campaign,
        metrics,
        variant_metrics: variantMetrics,
      },
    })
  } catch (err) {
    console.error('GET /api/campaigns/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/campaigns/[id]
 *
 * Update a campaign. Only allowed for draft or scheduled campaigns.
 * Body: partial campaign fields
 */
export async function PUT(
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

    // ─── Check Current Status ──────────────────────────────────
    const { data: existing, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!['draft', 'scheduled'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot edit a campaign with status "${existing.status}". Only draft or scheduled campaigns can be updated.` },
        { status: 409 }
      )
    }

    // ─── Apply Updates ─────────────────────────────────────────
    const body = await request.json()
    const allowedFields = [
      'name',
      'subject',
      'body_template',
      'segment_id',
      'recipient_count',
      'type',
      'ab_test_enabled',
      'variant_a_subject',
      'variant_a_body',
      'variant_b_subject',
      'variant_b_body',
      'ab_split_percentage',
      'ab_auto_select_winner',
      'ab_winner_metric',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    // If editing a scheduled campaign, revert to draft
    if (existing.status === 'scheduled') {
      updates.status = 'draft'
      updates.scheduled_at = null
    }

    const { data: updated, error: updateError } = await supabase
      .from('campaigns')
      .update(updates)
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
      type: 'campaign_updated',
      subject_type: 'campaign',
      subject_id: id,
      metadata: updates,
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PUT /api/campaigns/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/campaigns/[id]
 *
 * Soft-delete if sent/completed, hard-delete if draft.
 */
export async function DELETE(
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

    // ─── Fetch Campaign ────────────────────────────────────────
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, status, name')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .is('deleted_at', null)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status === 'draft' || campaign.status === 'scheduled') {
      // Hard delete for drafts and scheduled (no sends yet)
      const { error: deleteError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id)
        .eq('studio_id', STUDIO_ID)

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }
    } else {
      // Soft delete for sent/completed/paused campaigns (preserve history)
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('studio_id', STUDIO_ID)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: STUDIO_ID,
      actor_id: user.id,
      type: 'campaign_deleted',
      subject_type: 'campaign',
      subject_id: id,
      metadata: { name: campaign.name, was_hard_delete: campaign.status === 'draft' || campaign.status === 'scheduled' },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/campaigns/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
