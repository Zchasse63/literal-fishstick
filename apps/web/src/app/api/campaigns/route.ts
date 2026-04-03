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
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)
  if (search) query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count })
}

/**
 * POST /api/campaigns
 *
 * Create a new campaign.
 * Body: {
 *   name, type ('email' | 'sms'), subject?, body_template?,
 *   segment_id?, recipient_count?, ab_test_enabled?,
 *   variant_a_subject?, variant_a_body?, variant_b_subject?, variant_b_body?,
 *   ab_split_percentage?, ab_auto_select_winner?, ab_winner_metric?
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
      body_template,
      segment_id,
      recipient_count,
      ab_test_enabled,
      variant_a_subject,
      variant_a_body,
      variant_b_subject,
      variant_b_body,
      ab_split_percentage,
      ab_auto_select_winner,
      ab_winner_metric,
    } = body as {
      name: string
      type: 'email' | 'sms'
      subject?: string
      body_template?: string
      segment_id?: string
      recipient_count?: number
      ab_test_enabled?: boolean
      variant_a_subject?: string
      variant_a_body?: string
      variant_b_subject?: string
      variant_b_body?: string
      ab_split_percentage?: number
      ab_auto_select_winner?: boolean
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

    // Validate A/B test fields
    if (ab_test_enabled) {
      if (!variant_a_subject || !variant_a_body || !variant_b_subject || !variant_b_body) {
        return NextResponse.json(
          { error: 'A/B test requires variant_a_subject, variant_a_body, variant_b_subject, and variant_b_body' },
          { status: 400 }
        )
      }
    }

    // ─── Insert ────────────────────────────────────────────────
    const { data: campaign, error: insertError } = await supabase
      .from('campaigns')
      .insert({
        studio_id: studioId,
        name,
        type,
        status: 'draft',
        subject: subject ?? null,
        body_template: body_template ?? null,
        segment_id: segment_id ?? null,
        recipient_count: recipient_count ?? 0,
        created_by: user.id,
        ab_test_enabled: ab_test_enabled ?? false,
        variant_a_subject: variant_a_subject ?? null,
        variant_a_body: variant_a_body ?? null,
        variant_b_subject: variant_b_subject ?? null,
        variant_b_body: variant_b_body ?? null,
        ab_split_percentage: ab_split_percentage ?? 50,
        ab_auto_select_winner: ab_auto_select_winner ?? false,
        ab_winner_metric: ab_winner_metric ?? 'open_rate',
        sent_count: 0,
        delivered_count: 0,
        opened_count: 0,
        clicked_count: 0,
        bounced_count: 0,
        failed_count: 0,
        unsubscribed_count: 0,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'campaign_created',
      subject_type: 'campaign',
      subject_id: campaign.id,
      metadata: { name, type },
    })

    return NextResponse.json({ data: campaign }, { status: 201 })
}
