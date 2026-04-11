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
    // B12 FIX: real schema uses body_html/body_text/sms_body + ab_variants
    // jsonb + singular counters (open_count/click_count/bounce_count/
    // unsubscribe_count). No failed_count / completed_at / paused_at / ab_winner
    // columns exist.
    const { data: duplicate, error: insertError } = await supabase
      .from('campaigns')
      .insert({
        studio_id: STUDIO_ID,
        name: `${source.name} (Copy)`,
        type: source.type,
        status: 'draft',
        subject: source.subject,
        body_html: source.body_html,
        body_text: source.body_text,
        sms_body: source.sms_body,
        preview_text: source.preview_text,
        segment_id: source.segment_id,
        recipient_filter: source.recipient_filter,
        created_by: user.id,
        ab_test_enabled: source.ab_test_enabled,
        ab_variants: source.ab_variants,
        ab_winner_metric: source.ab_winner_metric,
        // Reset metric counters
        sent_count: 0,
        delivered_count: 0,
        open_count: 0,
        click_count: 0,
        bounce_count: 0,
        unsubscribe_count: 0,
        conversion_count: 0,
        // No schedule
        scheduled_at: null,
        sent_at: null,
        send_started_at: null,
        send_completed_at: null,
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
