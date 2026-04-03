import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['admin', 'manager']

/**
 * DELETE /api/corporate/[id]/members/[mid]
 *
 * Remove a member from a company (soft-delete: set is_active=false, removed_at=now()).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id, mid } = await params

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

    // ─── Fetch Membership ────────────────────────────────────
    const { data: membership, error: fetchError } = await supabase
      .from('company_members')
      .select('id, company_id, member_id, is_active')
      .eq('id', mid)
      .eq('company_id', id)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (fetchError || !membership) {
      return NextResponse.json({ error: 'Company member not found' }, { status: 404 })
    }

    if (!membership.is_active) {
      return NextResponse.json({ error: 'Member is already removed' }, { status: 409 })
    }

    // ─── Soft-Remove ─────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('company_members')
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
      })
      .eq('id', mid)
      .eq('studio_id', STUDIO_ID)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: STUDIO_ID,
      actor_id: user.id,
      type: 'corporate.member_removed',
      subject_type: 'company_member',
      subject_id: mid,
      metadata: { company_id: id, member_id: membership.member_id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/corporate/[id]/members/[mid] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
