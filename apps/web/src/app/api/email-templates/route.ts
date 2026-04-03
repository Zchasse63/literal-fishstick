import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID

/**
 * GET /api/email-templates
 *
 * List email templates. Optional filter by campaign_type.
 * Query params: campaign_type, active_only (default true)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Role check
    const { data: _rp } = await supabase.from('profiles').select('roles').eq('id', user.id).single()
    if (!_rp?.roles?.some((r: string) => ['owner', 'manager'].includes(r))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const campaignType = searchParams.get('campaign_type')
    const activeOnly = searchParams.get('active_only') !== 'false'

    let query = supabase
      .from('email_templates')
      .select('*')
      .eq('studio_id', STUDIO_ID)
      .order('created_at', { ascending: false })

    if (campaignType) {
      query = query.eq('campaign_type', campaignType)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET /api/email-templates error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/email-templates
 *
 * Create a new email template.
 * Body: { name, subject, body, campaign_type?, merge_tags?, channel? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Role check
    const { data: _rp } = await supabase.from('profiles').select('roles').eq('id', user.id).single()
    if (!_rp?.roles?.some((r: string) => ['owner', 'manager'].includes(r))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, subject, body: templateBody, campaign_type, merge_tags, channel } = body

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'name, subject, and body are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('email_templates')
      .insert({
        studio_id: STUDIO_ID,
        name,
        subject,
        body: templateBody,
        campaign_type: campaign_type ?? null,
        merge_tags: merge_tags ?? [],
        channel: channel ?? 'email',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/email-templates error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/email-templates
 *
 * Update an existing email template (or soft delete via is_active = false).
 * Body: { id, name?, subject?, body?, campaign_type?, merge_tags?, channel?, is_active? }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Role check
    const { data: _rp } = await supabase.from('profiles').select('roles').eq('id', user.id).single()
    if (!_rp?.roles?.some((r: string) => ['owner', 'manager'].includes(r))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Template id is required' },
        { status: 400 }
      )
    }

    // Rename 'body' field if present to avoid confusion
    if ('body' in updates) {
      updates.body = updates.body
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('email_templates')
      .update(updates)
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('PUT /api/email-templates error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
