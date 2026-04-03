import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/migration/jobs
 *
 * List all migration jobs for the studio, ordered by created_at DESC.
 * Includes progress percentage (processed_count / source_row_count).
 */
export async function GET() {
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

    // ─── Query ───────────────────────────────────────────────
    const { data: jobs, error } = await supabase
      .from('migration_jobs')
      .select('*')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    // Add progress percentage to each job
    const jobsWithProgress = (jobs ?? []).map((job) => ({
      ...job,
      progress_pct:
        job.source_row_count > 0
          ? Math.round((job.processed_count / job.source_row_count) * 100)
          : 0,
    }))

    return NextResponse.json({ data: jobsWithProgress })
  } catch (err) {
    console.error('GET /api/migration/jobs error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
