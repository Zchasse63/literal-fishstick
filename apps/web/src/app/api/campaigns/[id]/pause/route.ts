import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'admin', 'manager']

/**
 * POST /api/campaigns/[id]/pause
 *
 * Pause a sending or scheduled campaign.
 * A paused campaign can be resumed by re-scheduling or re-sending.
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

    // ─── Validate Campaign ─────────────────────────────────────
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

    if (!['sending', 'scheduled'].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Cannot pause a campaign with status "${campaign.status}". Only sending or scheduled campaigns can be paused.` },
        { status: 409 }
      )
    }

    // ─── Update ────────────────────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
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
      type: 'campaign_paused',
      subject_type: 'campaign',
      subject_id: id,
      metadata: { name: campaign.name, previous_status: campaign.status },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('POST /api/campaigns/[id]/pause error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
