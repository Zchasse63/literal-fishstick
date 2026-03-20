import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['admin', 'manager']

/**
 * GET /api/corporate/[id]/members
 *
 * List members of a company with profile join.
 * Query params: limit, offset
 */
export async function GET(
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

    // ─── Verify Company Exists ────────────────────────────────
    const { data: company, error: companyError } = await supabase
      .from('company_accounts')
      .select('id')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // ─── Fetch Members with Profile Join ──────────────────────
    const { data, error, count } = await supabase
      .from('company_members')
      .select('*, profiles:member_id(id, first_name, last_name, email, phone, avatar_url)', { count: 'exact' })
      .eq('company_id', id)
      .eq('studio_id', STUDIO_ID)
      .eq('is_active', true)
      .order('added_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, count })
  } catch (err) {
    console.error('GET /api/corporate/[id]/members error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/corporate/[id]/members
 *
 * Add a member to a company.
 * Body: { member_id, role? }
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

    // ─── Verify Company Exists ────────────────────────────────
    const { data: company, error: companyError } = await supabase
      .from('company_accounts')
      .select('id, name')
      .eq('id', id)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { member_id, role } = body as {
      member_id: string
      role?: string
    }

    if (!member_id) {
      return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
    }

    // ─── Check for Existing Active Membership ─────────────────
    const { data: existingMember } = await supabase
      .from('company_members')
      .select('id, is_active')
      .eq('company_id', id)
      .eq('member_id', member_id)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (existingMember) {
      if (existingMember.is_active) {
        return NextResponse.json(
          { error: 'Member is already part of this company' },
          { status: 409 }
        )
      }

      // Reactivate previously removed member
      const { data: reactivated, error: reactivateError } = await supabase
        .from('company_members')
        .update({
          is_active: true,
          removed_at: null,
          role: role ?? 'employee',
          added_at: new Date().toISOString(),
        })
        .eq('id', existingMember.id)
        .select()
        .single()

      if (reactivateError) {
        return NextResponse.json({ error: reactivateError.message }, { status: 500 })
      }

      await supabase.from('activity_log').insert({
        studio_id: STUDIO_ID,
        actor_id: user.id,
        action: 'corporate.member_added',
        entity_type: 'company_member',
        entity_id: reactivated.id,
        metadata: { company_name: company.name, member_id, reactivated: true },
      })

      return NextResponse.json({ data: reactivated }, { status: 201 })
    }

    // ─── Insert New Member ────────────────────────────────────
    const { data: newMember, error: insertError } = await supabase
      .from('company_members')
      .insert({
        company_id: id,
        member_id,
        studio_id: STUDIO_ID,
        role: role ?? 'employee',
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Member is already part of this company' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: STUDIO_ID,
      actor_id: user.id,
      action: 'corporate.member_added',
      entity_type: 'company_member',
      entity_id: newMember.id,
      metadata: { company_name: company.name, member_id },
    })

    return NextResponse.json({ data: newMember }, { status: 201 })
  } catch (err) {
    console.error('POST /api/corporate/[id]/members error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
