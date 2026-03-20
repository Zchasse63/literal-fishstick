import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/migration/status
 *
 * Migration overview: summary of what has been imported per data_type,
 * total rows imported, pending wave assignments, member wave counts.
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

    // ─── Fetch All Migration Jobs ────────────────────────────
    const { data: jobs, error: jobsError } = await supabase
      .from('migration_jobs')
      .select('id, data_type, status, source_row_count, success_count, error_count, wave, created_at, completed_at')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })

    if (jobsError) {
      return NextResponse.json({ error: jobsError.message }, { status: 500 })
    }

    // ─── Aggregate By Data Type ──────────────────────────────
    const dataTypes = ['members', 'bookings', 'transactions', 'classes']
    const byDataType: Record<string, {
      total_jobs: number
      completed_jobs: number
      total_source_rows: number
      total_imported: number
      total_errors: number
      last_import_at: string | null
      latest_status: string | null
    }> = {}

    for (const dt of dataTypes) {
      const dtJobs = (jobs ?? []).filter((j) => j.data_type === dt)
      const completedJobs = dtJobs.filter((j) =>
        j.status === 'completed' || j.status === 'completed_with_errors'
      )

      byDataType[dt] = {
        total_jobs: dtJobs.length,
        completed_jobs: completedJobs.length,
        total_source_rows: dtJobs.reduce((sum, j) => sum + (j.source_row_count ?? 0), 0),
        total_imported: completedJobs.reduce((sum, j) => sum + (j.success_count ?? 0), 0),
        total_errors: dtJobs.reduce((sum, j) => sum + (j.error_count ?? 0), 0),
        last_import_at: dtJobs.length > 0 ? dtJobs[0].completed_at : null,
        latest_status: dtJobs.length > 0 ? dtJobs[0].status : null,
      }
    }

    // ─── Total Counts ────────────────────────────────────────
    const totalImported = Object.values(byDataType).reduce(
      (sum, dt) => sum + dt.total_imported, 0
    )
    const totalErrors = Object.values(byDataType).reduce(
      (sum, dt) => sum + dt.total_errors, 0
    )

    // ─── Wave Assignment Counts ──────────────────────────────
    const waveAssignments: Record<string, number> = {}
    let pendingWaveAssignment = 0

    // Count members by migration_wave
    for (const wave of [1, 2, 3, 4, 5]) {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studioId)
        .eq('source', 'glofox')
        .eq('migration_wave', wave)

      waveAssignments[`wave_${wave}`] = count ?? 0
    }

    // Count members with no wave assigned (migrated but not assigned to a wave)
    const { count: noWaveCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', studioId)
      .eq('source', 'glofox')
      .is('migration_wave', null)

    pendingWaveAssignment = noWaveCount ?? 0

    // ─── Active Jobs Check ───────────────────────────────────
    const activeJobs = (jobs ?? []).filter(
      (j) => j.status === 'importing' || j.status === 'validating'
    )

    return NextResponse.json({
      data: {
        by_data_type: byDataType,
        totals: {
          total_imported: totalImported,
          total_errors: totalErrors,
          total_jobs: (jobs ?? []).length,
        },
        wave_assignments: {
          ...waveAssignments,
          pending_assignment: pendingWaveAssignment,
        },
        active_jobs: activeJobs.map((j) => ({
          id: j.id,
          data_type: j.data_type,
          status: j.status,
        })),
      },
    })
  } catch (err) {
    console.error('GET /api/migration/status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
