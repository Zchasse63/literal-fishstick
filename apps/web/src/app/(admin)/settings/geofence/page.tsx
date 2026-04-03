import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import GeofenceClient from './_components/GeofenceClient'
import type { GeofenceLocation } from './_components/GeofenceClient'

export default async function GeofenceSettingsPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('geofence_locations')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)

  const locations: GeofenceLocation[] = (data ?? []).map((loc: any) => ({
    id: loc.id,
    name: loc.name ?? 'Unnamed Location',
    latitude: loc.latitude ?? 0,
    longitude: loc.longitude ?? 0,
    radius: loc.radius ?? 150,
    isActive: loc.is_active ?? true,
  }))

  return <GeofenceClient initialLocations={locations} />
}
