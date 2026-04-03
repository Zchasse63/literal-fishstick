import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'


/**
 * POST /api/migration/jobs/[id]/rollback
 *
 * Rollback a completed import. Owner-only.
 * Deletes all rows where migration_job_id = this job's id
 * across profiles, bookings, transactions, and classes.
 * Sets job status='rolled_back', rolled_back_at=now.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id } = await params

    // ─── Auth (Owner Only) ───────────────────────────────────
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
    if (!roles.includes('owner')) {
      return NextResponse.json(
        { error: 'Only owners can rollback migration imports.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID

    // ─── Fetch Job ───────────────────────────────────────────
    const { data: job, error: jobError } = await supabase
      .from('migration_jobs')
      .select('*')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Migration job not found' }, { status: 404 })
    }

    if (job.status === 'rolled_back') {
      return NextResponse.json(
        { error: 'This migration job has already been rolled back.' },
        { status: 409 }
      )
    }

    if (job.status === 'importing' || job.status === 'validating') {
      return NextResponse.json(
        { error: 'Cannot rollback a job that is still in progress.' },
        { status: 409 }
      )
    }

    // ─── Delete Imported Rows ────────────────────────────────
    const tables = ['profiles', 'bookings', 'transactions', 'classes']
    const deletionResults: Record<string, number> = {}

    for (const table of tables) {
      const { count, error: deleteError } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .eq('migration_job_id', id)

      if (deleteError) {
        // Table might not have migration_job_id column, skip silently
        console.warn(`Rollback delete from ${table} failed:`, deleteError.message)
        deletionResults[table] = 0
      } else {
        deletionResults[table] = count ?? 0
      }
    }

    const totalDeleted = Object.values(deletionResults).reduce((sum, n) => sum + n, 0)

    // ─── Update Job Status ───────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('migration_jobs')
      .update({
        status: 'rolled_back',
        rolled_back_at: new Date().toISOString(),
        rolled_back_by: user.id,
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
      type: 'migration_import_rolled_back',
      subject_type: 'migration_job',
      subject_id: id,
      metadata: {
        data_type: job.data_type,
        total_deleted: totalDeleted,
        deletion_details: deletionResults,
      },
    })

    return NextResponse.json({
      data: updated,
      rollback_summary: {
        total_deleted: totalDeleted,
        by_table: deletionResults,
      },
    })
  } catch (err) {
    console.error('POST /api/migration/jobs/[id]/rollback error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
