import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { MigrationClient } from './_components/MigrationClient'

export default async function MigrationAdminPage() {
  const supabase = await createServerClient()

  const { data: jobs } = await supabase
    .from('migration_jobs')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })

  const migrationJobs = (jobs ?? []).map((j: any) => ({
    id: j.id,
    dataType: j.data_type ?? '',
    wave: j.wave ?? 1,
    status: j.status ?? 'Completed',
    successRows: j.success_rows ?? 0,
    errorRows: j.error_rows ?? 0,
    skipRows: j.skip_rows ?? 0,
    startedAt: j.started_at ?? '',
    completedAt: j.completed_at ?? '',
    canRollback: j.can_rollback ?? false,
  }))

  return <MigrationClient initialMigrationJobs={migrationJobs} />
}
