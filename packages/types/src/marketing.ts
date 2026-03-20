// Marketing & Campaign types

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'sent' | 'paused'
export type CampaignChannel = 'email' | 'sms' | 'push'
export type AutomationTrigger = 'signup' | 'no_show' | 'churn_risk' | 'credit_expiry' | 'birthday' | 'milestone' | 'custom'

export interface Campaign {
  id: string
  studio_id: string
  name: string
  channels: CampaignChannel[]
  status: CampaignStatus
  segment_id: string | null
  subject: string | null // email subject
  body_html: string | null
  body_text: string | null
  scheduled_at: string | null
  sent_at: string | null
  recipient_count: number
  open_count: number
  click_count: number
  conversion_count: number
  revenue_attributed: number // cents
  created_by: string
  created_at: string
  updated_at: string
}

export interface AutomationFlow {
  id: string
  studio_id: string
  name: string
  trigger: AutomationTrigger
  trigger_config: Record<string, unknown> // trigger-specific params
  steps: AutomationStep[]
  is_active: boolean
  total_enrolled: number
  total_completed: number
  created_at: string
  updated_at: string
}

export interface AutomationStep {
  id: string
  order: number
  type: 'send_email' | 'send_sms' | 'wait' | 'condition' | 'tag' | 'task'
  config: Record<string, unknown>
}

export interface Lead {
  id: string
  studio_id: string
  name: string
  email: string
  phone: string | null
  source: string | null
  score: number
  status: 'new' | 'contacted' | 'nurturing' | 'converted' | 'lost'
  converted_member_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CommunityPost {
  id: string
  studio_id: string
  author_id: string
  author_role: 'trainer' | 'studio' | 'member'
  content: string
  image_url: string | null
  is_pinned: boolean
  is_approved: boolean
  like_count: number
  comment_count: number
  created_at: string
  updated_at: string
}
