import type { Mail } from 'lucide-react'

// ─── Shared types & constants for Campaign sub-components ──────

export type Step = 1 | 2 | 3
export type ChannelType = 'email' | 'sms'
export type PreviewMode = 'desktop' | 'mobile'
export type CampaignType = 'winback' | 'upsell' | 'retention' | 'promo' | 'welcome' | 'general'
export type ToneType = 'friendly' | 'urgent' | 'professional' | 'casual' | 'celebratory'
export type CampaignStatus = 'draft' | 'scheduled' | 'sent' | 'active'

export interface Template {
  id: string
  name: string
  icon: typeof Mail
  subject: string
  body: string
  color: string
}

export interface Segment {
  id: string
  name: string
  count: number
}

export interface MockCampaign {
  id: string
  name: string
  status: CampaignStatus
  channels: ChannelType[]
  segment: string
  subject: string
  previewText: string
  emailBody: string
  smsBody: string
  scheduledDate?: string
  scheduledTime?: string
}
