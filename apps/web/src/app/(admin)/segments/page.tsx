import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import SegmentsClient from './_components/SegmentsClient'
import type { DbSegment } from './_components/SegmentsClient'

export default async function SegmentsPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('smart_segments')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })

  const segments: DbSegment[] = (data ?? []).map((seg: any) => ({
    id: seg.id,
    name: seg.name,
    description: seg.description ?? null,
    rules: seg.rules ?? { logic: 'AND', conditions: [] },
    color: seg.color ?? '#4F46E5',
    icon: seg.icon ?? 'users',
    is_system: seg.is_system ?? false,
    member_count: seg.member_count ?? 0,
    last_computed_at: seg.last_computed_at ?? null,
    created_at: seg.created_at,
    updated_at: seg.updated_at,
  }))

  return <SegmentsClient initialSegments={segments} />
}
