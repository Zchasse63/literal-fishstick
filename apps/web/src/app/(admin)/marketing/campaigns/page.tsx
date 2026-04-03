import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import CampaignsClient from './_components/CampaignsClient'

export default async function CampaignsPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })

  const initialCampaigns = (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name || 'Untitled Campaign',
    status: c.status || 'draft',
    channels: [c.channel || 'email'] as string[],
    recipients: c.recipient_count ?? 0,
    openRate: c.open_rate ?? null,
    clickRate: c.click_rate ?? null,
    revenue: c.revenue_attributed ?? null,
    sentDate: c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
    scheduledDate: c.scheduled_at ? new Date(c.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : null,
  }))

  return <CampaignsClient initialCampaigns={initialCampaigns} />
}
