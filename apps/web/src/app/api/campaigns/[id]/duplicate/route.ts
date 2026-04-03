import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID
const ALLOWED_ROLES = ['owner', 'admin', 'manager']

/**
 * POST /api/campaigns/[id]/duplicate
 *
 * Clone a campaign as a new draft. Copies all content and settings,
 * resets all metrics and status to draft.
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

    // ─── Fetch Source Campaign ──────────────────────────────────
    const { data: source, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .is('deleted_at', null)
      .single()

    if (fetchError || !source) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // ─── Create Duplicate ──────────────────────────────────────
    const { data: duplicate, error: insertError } = await supabase
      .from('campaigns')
      .insert({
        studio_id: STUDIO_ID,
        name: `${source.name} (Copy)`,
        type: source.type,
        status: 'draft',
        subject: source.subject,
        body_template: source.body_template,
        segment_id: source.segment_id,
        recipient_count: source.recipient_count,
        created_by: user.id,
        ab_test_enabled: source.ab_test_enabled,
        variant_a_subject: source.variant_a_subject,
        variant_a_body: source.variant_a_body,
        variant_b_subject: source.variant_b_subject,
        variant_b_body: source.variant_b_body,
        ab_split_percentage: source.ab_split_percentage,
        ab_auto_select_winner: source.ab_auto_select_winner,
        ab_winner_metric: source.ab_winner_metric,
        // Reset all metrics
        sent_count: 0,
        delivered_count: 0,
        opened_count: 0,
        clicked_count: 0,
        bounced_count: 0,
        failed_count: 0,
        unsubscribed_count: 0,
        // No schedule
        scheduled_at: null,
        sent_at: null,
        completed_at: null,
        paused_at: null,
        ab_winner: null,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: STUDIO_ID,
      actor_id: user.id,
      type: 'campaign_duplicated',
      subject_type: 'campaign',
      subject_id: duplicate.id,
      metadata: { source_campaign_id: id, source_campaign_name: source.name },
    })

    return NextResponse.json({ data: duplicate }, { status: 201 })
  } catch (err) {
    console.error('POST /api/campaigns/[id]/duplicate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
