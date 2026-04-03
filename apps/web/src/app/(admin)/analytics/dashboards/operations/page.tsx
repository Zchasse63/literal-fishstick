import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { OperationsDashboardClient } from './_components/OperationsDashboardClient'

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

export default async function OperationsDashboardPage() {
  const supabase = await createServerClient()

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]!
  const todayStart = `${todayStr}T00:00:00`
  const todayEnd = `${todayStr}T23:59:59`
  const todayDayOfWeek = now.getDay()
  const todayIdx = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1

  // Fetch today's classes
  const { data: classes } = await supabase
    .from('classes')
    .select('*, class_types:class_type_id ( name, category )')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .gte('starts_at', todayStart)
    .lte('starts_at', todayEnd)
    .order('starts_at', { ascending: true })

  const classRows = (classes ?? []).map((cls: any) => {
    const startTime = new Date(cls.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    return {
      time: startTime,
      name: cls.class_types?.name ?? cls.title ?? 'Class',
      trainer: cls.trainer_name ?? null,
      booked: cls.booked_count ?? 0,
      capacity: cls.capacity ?? 12,
      checkedIn: cls.checked_in_count ?? 0,
      type: cls.class_types?.category === 'guided' ? 'Guided' : 'Open',
    }
  })

  // Compute KPIs from classes
  const totalBooked = classRows.reduce((s: number, c: any) => s + c.booked, 0)
  const totalCheckedIn = classRows.reduce((s: number, c: any) => s + c.checkedIn, 0)
  const totalCapacity = classRows.reduce((s: number, c: any) => s + c.capacity, 0)
  const fillRate = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0

  // Get walk-in and no-show counts
  const [walkInResult, noShowResult] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('booking_type', 'walk_in')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('status', 'no_show')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd),
  ])

  const kpis = [
    { label: 'Bookings', value: String(totalBooked), trend: 0, iconName: 'CalendarCheck' },
    { label: 'Check-ins', value: String(totalCheckedIn), trend: 0, iconName: 'UserCheck' },
    { label: 'Walk-ins', value: String(walkInResult.count ?? 0), trend: 0, iconName: 'Footprints' },
    { label: 'No-shows', value: String(noShowResult.count ?? 0), trend: 0, iconName: 'AlertTriangle' },
    { label: 'Fill Rate', value: `${fillRate}%`, trend: 0, iconName: 'Percent' },
  ]

  // Fetch activity feed
  const { data: activityData } = await supabase
    .from('activity_log')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })
    .limit(20)

  const ACTIVITY_ICON_MAP: Record<string, { iconName: string; color: string; bg: string }> = {
    'check_in': { iconName: 'UserCheck', color: 'text-emerald-500', bg: 'bg-emerald-50' },
    'booking.created': { iconName: 'CalendarCheck', color: 'text-blue-500', bg: 'bg-blue-50' },
    'booking.cancelled': { iconName: 'XCircle', color: 'text-red-500', bg: 'bg-red-50' },
    'payment': { iconName: 'CreditCard', color: 'text-indigo-500', bg: 'bg-indigo-50' },
    'walk_in': { iconName: 'Footprints', color: 'text-amber-500', bg: 'bg-amber-50' },
    'member.created': { iconName: 'UserPlus', color: 'text-violet-500', bg: 'bg-violet-50' },
  }
  const defaultStyle = { iconName: 'CalendarCheck', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900' }

  const activityItems = (activityData ?? []).map((entry: any) => {
    const style = ACTIVITY_ICON_MAP[entry.action] ?? defaultStyle
    return {
      id: entry.id,
      iconName: style.iconName,
      color: style.color,
      bg: style.bg,
      text: entry.actor_name
        ? `${entry.actor_name}: ${entry.action?.replace(/_/g, ' ') ?? 'action'}`
        : entry.action?.replace(/_/g, ' ') ?? 'Activity',
      time: getTimeAgo(entry.created_at),
    }
  })

  const formattedDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <OperationsDashboardClient
      initialKPIs={kpis}
      initialClasses={classRows}
      initialActivity={activityItems}
      formattedDate={formattedDate}
      todayIdx={todayIdx}
    />
  )
}
