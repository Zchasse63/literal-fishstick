import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/require-role'

/**
 * GET /api/campaigns
 *
 * List campaigns with filtering and pagination.
 * Query params: status, type, limit, offset, search
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(['owner', 'manager'])
  if (auth.error) return auth.error
  const { supabase, studioId } = auth

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const search = searchParams.get('search')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = supabase
    .from('campaigns')
    .select('*', { count: 'exact' })
    .eq('studio_id', studioId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)
  if (search) query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ data, count })
}

/**
 * POST /api/campaigns
 *
 * Create a new campaign draft. Matches real schema:
 *   body_html / body_text / sms_body instead of body_template,
 *   ab_variants jsonb (rather than per-variant columns),
 *   open_count / click_count / bounce_count / unsubscribe_count (singular).
 *
 * Body: {
 *   name, type ('email' | 'sms'),
 *   subject?, body_html?, body_text?, sms_body?,
 *   preview_text?, segment_id?, recipient_filter?,
 *   ab_test_enabled?, ab_variants?, ab_winner_metric?
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(['owner', 'manager'])
  if (auth.error) return auth.error
  const { user, supabase, studioId } = auth

  const body = await request.json()
  const {
    name,
    type,
    subject,
    body_html,
    body_text,
    sms_body,
    preview_text,
    segment_id,
    recipient_filter,
    ab_test_enabled,
    ab_variants,
    ab_winner_metric,
  } = body as {
    name: string
    type: 'email' | 'sms'
    subject?: string
    body_html?: string
    body_text?: string
    sms_body?: string
    preview_text?: string
    segment_id?: string
    recipient_filter?: Record<string, unknown>
    ab_test_enabled?: boolean
    ab_variants?: Record<string, unknown>
    ab_winner_metric?: 'open_rate' | 'click_rate'
  }

  if (!name || !type) {
    return NextResponse.json(
      { error: 'name and type are required' },
      { status: 400 }
    )
  }

  if (!['email', 'sms'].includes(type)) {
    return NextResponse.json(
      { error: 'type must be "email" or "sms"' },
      { status: 400 }
    )
  }

  // Validate A/B test fields — require both variants in ab_variants jsonb
  if (ab_test_enabled) {
    const v = ab_variants as
      | { a?: { subject?: string; body_html?: string }; b?: { subject?: string; body_html?: string } }
      | undefined
    if (!v?.a?.subject || !v?.a?.body_html || !v?.b?.subject || !v?.b?.body_html) {
      return NextResponse.json(
        { error: 'A/B test requires ab_variants.a and ab_variants.b, each with subject and body_html' },
        { status: 400 }
      )
    }
  }

  const channels = type === 'sms' ? ['sms'] : ['email']

  const { data: campaign, error: insertError } = await supabase
    .from('campaigns')
    .insert({
      studio_id: studioId,
      name,
      type,
      status: 'draft',
      channels,
      subject: subject ?? null,
      body_html: body_html ?? null,
      body_text: body_text ?? null,
      sms_body: sms_body ?? null,
      preview_text: preview_text ?? null,
      segment_id: segment_id ?? null,
      recipient_filter: recipient_filter ?? null,
      ab_test_enabled: ab_test_enabled ?? false,
      ab_variants: ab_variants ?? null,
      ab_winner_metric: ab_winner_metric ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Tier 5.1 fix: description + capture-and-log pattern.
  const { error: activityError } = await supabase.from('activity_log').insert({
    studio_id: studioId,
    actor_id: user.id,
    type: 'campaign_created',
    subject_type: 'campaign',
    subject_id: campaign.id,
    description: `Campaign created: ${name} (${type})`,
    metadata: { name, type },
  })

  if (activityError) {
    console.error(
      'POST /api/campaigns: activity_log insert failed',
      activityError.message
    )
  }

  return NextResponse.json({ data: campaign }, { status: 201 })
}
