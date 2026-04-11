import {
  FileText,
  Mail,
  Plus,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'
import type { Template, CampaignType, ToneType, CampaignStatus } from './types'

export const TEMPLATES: Template[] = [
  {
    id: 'welcome',
    name: 'Welcome',
    icon: Sparkles,
    color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    subject: 'Welcome to {{studio_name}} — Your Journey Starts Here',
    body: 'Hi {{first_name}},\n\nWelcome to the family! We\'re thrilled to have you join us.\n\nHere\'s what to expect for your first visit:\n- Arrive 10 minutes early\n- Bring a towel and water bottle\n- Wear comfortable clothing\n\nYour first session is going to be amazing. We can\'t wait to see you!\n\nWarm regards,\n{{studio_name}} Team',
  },
  {
    id: 'winback',
    name: 'Win-Back',
    icon: Zap,
    color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    subject: 'We Miss You, {{first_name}}! Come Back for a Special Offer',
    body: 'Hi {{first_name}},\n\nIt\'s been a while since we\'ve seen you at {{studio_name}}, and we miss you!\n\nWe know life gets busy, but your wellness matters. To help you get back on track, here\'s an exclusive offer just for you:\n\n[Special Offer Details]\n\nYour body and mind will thank you. Book your next session today!\n\nSee you soon,\n{{studio_name}} Team',
  },
  {
    id: 'upsell',
    name: 'Upsell',
    icon: Plus,
    color: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    subject: 'Upgrade Your Plan — Get More for Less, {{first_name}}',
    body: 'Hi {{first_name}},\n\nYou\'ve been crushing it lately! Based on your usage, we think you\'d love our {{membership_name}} upgrade.\n\nHere\'s what you\'d get:\n- Unlimited sessions\n- Priority booking\n- 10% off merchandise\n- Access to guided classes\n\nUpgrade takes effect immediately with prorated pricing. No commitment needed.\n\nKeep the momentum going!\n{{studio_name}} Team',
  },
  {
    id: 'retention',
    name: 'Retention',
    icon: Users,
    color: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800',
    subject: '{{first_name}}, You\'ve Got {{credits_remaining}} Credits Left!',
    body: 'Hi {{first_name}},\n\nJust a friendly heads up — you have {{credits_remaining}} credits remaining on your current plan.\n\nDon\'t let them go to waste! Here are some great sessions coming up this week:\n\n[Upcoming Sessions]\n\nBook now to make the most of your membership.\n\nSee you at the studio,\n{{studio_name}} Team',
  },
  {
    id: 'promo',
    name: 'Promo',
    icon: FileText,
    color: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    subject: 'Limited Time: Special Event at {{studio_name}}!',
    body: 'Hi {{first_name}},\n\nSomething special is happening at {{studio_name}}!\n\n[Event/Promo Details]\n\nSpots are limited — don\'t miss out. Grab yours before they\'re gone!\n\nBest,\n{{studio_name}} Team',
  },
  {
    id: 'general',
    name: 'General',
    icon: Mail,
    color: 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
    subject: 'A Quick Update from {{studio_name}}',
    body: 'Hi {{first_name}},\n\n[Your message here]\n\nBest,\n{{studio_name}} Team',
  },
]

export const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{email}}', label: 'Email' },
  { tag: '{{membership_name}}', label: 'Membership' },
  { tag: '{{credits_remaining}}', label: 'Credits Left' },
  { tag: '{{studio_name}}', label: 'Studio Name' },
  { tag: '{{next_class_date}}', label: 'Next Class' },
  { tag: '{{streak_count}}', label: 'Streak' },
]

export const AI_SUBJECT_SUGGESTIONS = [
  'Your Sauna Journey Awaits — Book Your Next Session Today',
  "{{first_name}}, We've Got Something Special Just for You",
  'Hot Seats, Cool Plunges: This Week at {{studio_name}}',
  "Don't Break Your Streak, {{first_name}} — Keep Going!",
  'Members Only: Exclusive Perks You Haven\'t Used Yet',
]

export const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
  { value: 'winback', label: 'Win-Back' },
  { value: 'upsell', label: 'Upsell / Upgrade' },
  { value: 'retention', label: 'Retention' },
  { value: 'promo', label: 'Promotional' },
  { value: 'welcome', label: 'Welcome Series' },
  { value: 'general', label: 'General Update' },
]

export const TONES: { value: ToneType; label: string }[] = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'celebratory', label: 'Celebratory' },
]

export const statusConfig: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-950' },
  scheduled: { label: 'Scheduled', className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' },
  sent: { label: 'Sent', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  active: { label: 'Active', className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
}
