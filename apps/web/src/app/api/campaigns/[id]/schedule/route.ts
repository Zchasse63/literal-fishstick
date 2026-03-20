import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['admin', 'manager']

/**
 * POST /api/campaigns/[id]/schedule
 *
 * Schedule a campaign for future sending.
 * Body: { scheduled_at: string (ISO 8601) }
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
    const { scheduled_at } = body as { scheduled_at: string }

    if (!scheduled_at) {
      return NextResponse.json(
        { error: 'scheduled_at is required (ISO 8601 timestamp)' },
        { status: 400 }
      )
    }

    const scheduledDate = new Date(scheduled_at)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'scheduled_at must be a valid ISO 8601 timestamp' },
        { status: 400 }
      )
    }

    // Must be at least 5 minutes in the future
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
    if (scheduledDate < fiveMinutesFromNow) {
      return NextResponse.json(
        { error: 'scheduled_at must be at least 5 minutes in the future' },
        { status: 400 }
      )
    }

    // ─── Validate Campaign ─────────────────────────────────────
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, status, subject, body_template, ab_test_enabled, variant_a_subject, variant_a_body')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .is('deleted_at', null)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Cannot schedule a campaign with status "${campaign.status}". Only draft or scheduled campaigns can be scheduled.` },
        { status: 409 }
      )
    }

    // Validate that campaign has required content
    if (campaign.ab_test_enabled) {
      if (!campaign.variant_a_subject || !campaign.variant_a_body) {
        return NextResponse.json(
          { error: 'A/B test campaign must have variant A content before scheduling' },
          { status: 400 }
        )
      }
    } else {
      if (!campaign.subject || !campaign.body_template) {
        return NextResponse.json(
          { error: 'Campaign must have a subject and body before scheduling' },
          { status: 400 }
        )
      }
    }

    // ─── Update ────────────────────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'scheduled',
        scheduled_at: scheduledDate.toISOString(),
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
      action: 'campaign_scheduled',
      entity_type: 'campaign',
      entity_id: id,
      metadata: { scheduled_at: scheduledDate.toISOString() },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('POST /api/campaigns/[id]/schedule error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
