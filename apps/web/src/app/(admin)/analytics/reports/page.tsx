import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { ReportLibraryClient } from './_components/ReportLibraryClient'

const TYPE_BADGE_COLORS: Record<string, string> = {
  Attendance: 'bg-indigo-50 text-indigo-700',
  Revenue: 'bg-emerald-50 text-emerald-700',
  'Trainer Payroll': 'bg-violet-50 text-violet-700',
  'Trainer Performance': 'bg-purple-50 text-purple-700',
  'Churn Risk': 'bg-orange-50 text-orange-700',
  'Class Performance': 'bg-cyan-50 text-cyan-700',
  'Credit Pack Usage': 'bg-teal-50 text-teal-700',
  'Transaction Log': 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  'Failed Payments': 'bg-red-50 text-red-700',
  'Member Movement': 'bg-amber-50 text-amber-700',
  Membership: 'bg-blue-50 text-blue-700',
}

export default async function ReportLibraryPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('saved_reports')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })

  const savedReports = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name ?? 'Untitled Report',
    type: r.type ?? 'Attendance',
    typeBadgeColor: TYPE_BADGE_COLORS[r.type] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    lastGenerated: r.last_generated_at ? new Date(r.last_generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014',
    schedule: r.schedule ?? 'Manual',
  }))

  return <ReportLibraryClient initialReports={savedReports} />
}
