import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { ReportViewerClient } from './_components/ReportViewerClient'

export default async function ReportViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: reportId } = await params
  const supabase = await createServerClient()

  // Fetch saved report metadata
  const { data: report } = await supabase
    .from('saved_reports')
    .select('*')
    .eq('id', reportId)
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .single()

  const reportName = report?.name ?? 'Report'

  // Fetch bookings for attendance data
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, class_id, member_id, status, created_at, classes(name, trainer_id, profiles:trainer_id(full_name))')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })
    .limit(200)

  const allRows = (bookings ?? []).map((b: any, i: number) => {
    const cls = b.classes as any
    return {
      id: b.id ?? `row-${i}`,
      date: b.created_at ? new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014',
      className: cls?.name ?? 'Unknown Class',
      classId: b.class_id ?? '',
      trainer: cls?.profiles?.full_name ?? '\u2014',
      trainerId: cls?.trainer_id ?? '',
      bookings: 1,
      checkIns: b.status === 'checked_in' ? 1 : 0,
      noShows: b.status === 'no_show' ? 1 : 0,
      fillRate: b.status === 'checked_in' ? 100 : 0,
    }
  })

  return <ReportViewerClient initialRows={allRows} reportName={reportName} reportId={reportId} />
}
