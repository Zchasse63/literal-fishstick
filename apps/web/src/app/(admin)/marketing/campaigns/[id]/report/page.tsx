import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import CampaignReportClient from './_components/CampaignReportClient'

export default async function CampaignReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const [campaignRes, recipientsRes] = await Promise.all([
    supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .single(),
    supabase
      .from('campaign_recipients')
      .select('id, member_id, status, opened_at, clicked_at, members(first_name, last_name, email)')
      .eq('campaign_id', id)
      .limit(100),
  ])

  const initialCampaign = campaignRes.data
    ? {
        id: campaignRes.data.id,
        name: campaignRes.data.name || 'Untitled Campaign',
        sentDate: campaignRes.data.sent_at
          ? new Date(campaignRes.data.sent_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
          : 'Not sent yet',
        channel: campaignRes.data.channel || 'email',
        segment: campaignRes.data.segment_name || 'All Members',
        abTestEnabled: campaignRes.data.ab_test_enabled || false,
      }
    : null

  const initialRecipients = (recipientsRes.data ?? []).map((r: any) => ({
    id: r.id,
    name: r.members ? `${r.members.first_name || ''} ${r.members.last_name || ''}`.trim() : 'Unknown',
    email: r.members?.email || '',
    status: r.status || 'delivered',
    openedAt: r.opened_at ? new Date(r.opened_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null,
    clickedAt: r.clicked_at ? new Date(r.clicked_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null,
  }))

  return <CampaignReportClient initialCampaign={initialCampaign} initialRecipients={initialRecipients} />
}
