import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * POST /api/events/[id]/confirm
 *
 * Confirm an event. Checks for class time conflicts first.
 * If conflicts exist, returns them in the response with a `conflicts` array.
 * Only confirms if body has `acknowledge_conflicts: true`.
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
      .select('id, roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || STUDIO_ID

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { acknowledge_conflicts } = body as { acknowledge_conflicts?: boolean }

    // ─── Fetch Event ─────────────────────────────────────────
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (fetchError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!['inquiry', 'quoted'].includes(event.status)) {
      return NextResponse.json(
        { error: `Cannot confirm event with status "${event.status}". Must be "inquiry" or "quoted".` },
        { status: 409 }
      )
    }

    // ─── Check for Class Conflicts ────────────────────────────
    // Include setup and cleanup time in the conflict window
    const setupMinutes = event.setup_time_minutes ?? 0
    const cleanupMinutes = event.cleanup_time_minutes ?? 0
    const eventStart = new Date(new Date(event.start_time).getTime() - setupMinutes * 60000).toISOString()
    const eventEnd = new Date(new Date(event.end_time).getTime() + cleanupMinutes * 60000).toISOString()

    // Schema: classes has title/starts_at/ends_at, not name/start_time/end_time.
    const { data: conflicts, error: conflictError } = await supabase
      .from('classes')
      .select('id, title, starts_at, ends_at')
      .eq('studio_id', studioId)
      .lt('starts_at', eventEnd)
      .gt('ends_at', eventStart)
      .neq('status', 'cancelled')

    if (conflictError) {
      return NextResponse.json({ error: conflictError.message }, { status: 500 })
    }

    if (conflicts && conflicts.length > 0 && !acknowledge_conflicts) {
      return NextResponse.json({
        error: 'Event conflicts with existing classes. Set acknowledge_conflicts to true to confirm anyway.',
        conflicts: conflicts.map((c) => ({
          class_id: c.id,
          name: c.title,
          start_time: c.starts_at,
          end_time: c.ends_at,
        })),
      }, { status: 409 })
    }

    // ─── Confirm Event ────────────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('events')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('studio_id', studioId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'event_confirmed',
      subject_type: 'event',
      subject_id: id,
      metadata: {
        name: event.name,
        had_conflicts: conflicts && conflicts.length > 0,
        conflict_count: conflicts?.length ?? 0,
      },
    })

    return NextResponse.json({
      data: updated,
      conflicts: conflicts && conflicts.length > 0 ? conflicts : [],
    })
  } catch (err) {
    console.error('POST /api/events/[id]/confirm error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
