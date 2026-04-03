import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * POST /api/migration/wave-assign
 *
 * Assign members to migration waves.
 * Body: { member_ids: string[], wave: 2 | 3 }
 * Updates profiles.migration_wave for specified members.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID

    // ─── Parse Body ──────────────────────────────────────────
    const body = await request.json()
    const { member_ids, wave } = body as {
      member_ids: string[]
      wave: number
    }

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return NextResponse.json(
        { error: 'member_ids array is required and must not be empty' },
        { status: 400 }
      )
    }

    if (!wave || ![1, 2, 3, 4, 5].includes(wave)) {
      return NextResponse.json(
        { error: 'wave must be 1, 2, 3, 4, or 5' },
        { status: 400 }
      )
    }

    // ─── Update Members ──────────────────────────────────────
    const { data: updated, error: updateError, count } = await supabase
      .from('profiles')
      .update({
        migration_wave: wave,
        updated_at: new Date().toISOString(),
      })
      .eq('studio_id', studioId)
      .in('id', member_ids)
      .select('id, email, full_name, migration_wave')

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const updatedCount = updated?.length ?? count ?? 0

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'migration_wave_assigned',
      subject_type: 'migration',
      subject_id: studioId,
      metadata: {
        wave,
        member_count: updatedCount,
        member_ids: member_ids.slice(0, 20), // Cap metadata size
      },
    })

    return NextResponse.json({
      data: {
        wave,
        updated_count: updatedCount,
        requested_count: member_ids.length,
        members: updated ?? [],
      },
    })
  } catch (err) {
    console.error('POST /api/migration/wave-assign error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
