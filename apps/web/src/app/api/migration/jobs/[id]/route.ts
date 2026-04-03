import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/migration/jobs/[id]
 *
 * Return a migration job with full errors array and progress percentage.
 */
export async function GET(
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

    // ─── Fetch Job ───────────────────────────────────────────
    const { data: job, error } = await supabase
      .from('migration_jobs')
      .select('*')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Migration job not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        ...job,
        progress_pct:
          job.source_row_count > 0
            ? Math.round((job.processed_count / job.source_row_count) * 100)
            : 0,
      },
    })
  } catch (err) {
    console.error('GET /api/migration/jobs/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
