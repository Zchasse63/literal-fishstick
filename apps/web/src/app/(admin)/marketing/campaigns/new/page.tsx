'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Mail,
  Monitor,
  Phone,
  Save,
  Send,
  Smartphone,
  Sparkles,
  Split,
  Type,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import { fadeInUpWithExit as fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import type { Step, ChannelType, PreviewMode, Segment } from '../_components/types'
import { TEMPLATES, MERGE_TAGS, AI_SUBJECT_SUGGESTIONS } from '../_components/constants'
import StepIndicator from '../_components/StepIndicator'
import EmailPreview from '../_components/EmailPreview'
import TemplateCard from '../_components/TemplateCard'
import AIGeneratePanel from '../_components/AIGeneratePanel'

const STUDIO_ID = DEFAULT_STUDIO_ID

// ─── Page ───────────────────────────────────────────────────
export default function CampaignBuilderPage() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [currentStep, setCurrentStep] = useState<Step>(1)

  // Load segments from Supabase
  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserClient()

    async function loadSegments() {
      const { data } = await supabase
        .from('smart_segments')
        .select('id, name, member_count')
        .eq('studio_id', STUDIO_ID)
        .order('name')

      if (cancelled) return
      if (data) {
        setSegments(data.map((s: any) => ({
          id: s.id,
          name: s.name,
          count: s.member_count ?? 0,
        })))
      }
    }

    loadSegments()
    return () => { cancelled = true }
  }, [])

  // Step 1 state
  const [campaignName, setCampaignName] = useState('')
  const [selectedChannels, setSelectedChannels] = useState<ChannelType[]>(['email'])
  const [selectedSegment, setSelectedSegment] = useState('all')

  // Step 2 state
  const [subject, setSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [smsBody, setSmsBody] = useState('')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop')
  const [contentTab, setContentTab] = useState<'email' | 'sms'>('email')
  const [showAiSuggestions, setShowAiSuggestions] = useState(false)
  const [showAiGenerate, setShowAiGenerate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  // Step 3 state
  const [abTestEnabled, setAbTestEnabled] = useState(false)
  const [variantBSubject, setVariantBSubject] = useState('')
  const [variantBBody, setVariantBBody] = useState('')
  const [abSplit, setAbSplit] = useState(50)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [testSent, setTestSent] = useState(false)

  const recipientCount = useMemo(() => {
    return segments.find((s) => s.id === selectedSegment)?.count ?? 0
  }, [selectedSegment])

  const toggleChannel = useCallback((ch: ChannelType) => {
    setSelectedChannels((prev) => {
      if (prev.includes(ch)) {
        return prev.length > 1 ? prev.filter((c) => c !== ch) : prev
      }
      return [...prev, ch]
    })
  }, [])

  const insertMergeTag = useCallback(
    (tag: string) => {
      if (contentTab === 'email') {
        setEmailBody((prev) => prev + tag)
      } else {
        setSmsBody((prev) => prev + tag)
      }
    },
    [contentTab]
  )

  const selectTemplate = useCallback((template: Template) => {
    setSubject(template.subject)
    setEmailBody(template.body)
    setShowTemplates(false)
  }, [])

  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSendTest = useCallback(() => {
    setTestSent(true)
    setTimeout(() => setTestSent(false), 3000)
  }, [])

  const buildCampaignPayload = useCallback(() => {
    const memberIds = selectedSegment === 'all' ? undefined : undefined // resolved server-side from segment
    return {
      name: campaignName,
      studio_id: STUDIO_ID,
      channel: selectedChannels[0],
      segment_id: selectedSegment === 'all' ? null : selectedSegment,
      subject,
      preview_text: previewText,
      body: selectedChannels.includes('email') ? emailBody : smsBody,
      ab_test_enabled: abTestEnabled,
      variant_b_subject: abTestEnabled ? variantBSubject : null,
      variant_b_body: abTestEnabled ? variantBBody : null,
      ab_split: abTestEnabled ? abSplit : null,
      schedule_mode: scheduleMode,
      scheduled_at: scheduleMode === 'schedule' && scheduleDate && scheduleTime
        ? `${scheduleDate}T${scheduleTime}:00`
        : null,
    }
  }, [campaignName, selectedChannels, selectedSegment, subject, previewText, emailBody, smsBody, abTestEnabled, variantBSubject, variantBBody, abSplit, scheduleMode, scheduleDate, scheduleTime])

  const handleSaveDraft = useCallback(async () => {
    if (!campaignName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildCampaignPayload(), status: 'draft' }),
      })
      if (res.ok) {
        const data = await res.json()
        window.location.href = `/marketing/campaigns/${data.id ?? ''}`
      }
    } catch (err) {
      console.error('Failed to save draft:', err)
    } finally {
      setSaving(false)
    }
  }, [campaignName, buildCampaignPayload])

  const handleSendCampaign = useCallback(async () => {
    setSending(true)
    try {
      // First create the campaign
      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildCampaignPayload(), status: 'sending' }),
      })
      if (!createRes.ok) return
      const campaign = await createRes.json()

      // Then trigger the send
      const memberIds = segments.find(s => s.id === selectedSegment)
        ? undefined  // resolved from segment server-side
        : undefined

      await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          subject,
          bodyTemplate: emailBody,
          batchSize: 10,
        }),
      })
      window.location.href = `/marketing/campaigns/${campaign.id}`
    } catch (err) {
      console.error('Failed to send campaign:', err)
    } finally {
      setSending(false)
    }
  }, [buildCampaignPayload, subject, emailBody, segments, selectedSegment])

  const canProceed = useMemo(() => {
    if (currentStep === 1) {
      return campaignName.trim().length > 0 && selectedChannels.length > 0
    }
    if (currentStep === 2) {
      const hasEmail = selectedChannels.includes('email')
      const hasSms = selectedChannels.includes('sms')
      if (hasEmail && (!subject.trim() || !emailBody.trim())) return false
      if (hasSms && !smsBody.trim()) return false
      return true
    }
    return true
  }, [currentStep, campaignName, selectedChannels, subject, emailBody, smsBody])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA] p-6 lg:p-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <a
            href="/marketing"
            className="h-9 w-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </a>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">New Campaign</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and send email or SMS campaigns</p>
          </div>
        </div>
        <button
          onClick={handleSaveDraft}
          disabled={saving || !campaignName.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save as Draft'}
        </button>
      </div>

      {/* Step Indicator */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
        <StepIndicator currentStep={currentStep} />
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {/* ─── Step 1: Setup ─────────────────────────────────── */}
        {currentStep === 1 && (
          <motion.div key="step-1" {...fadeInUp} className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-5">Campaign Setup</h2>

              {/* Campaign Name */}
              <div className="mb-5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Win-Back: 14-Day Inactive Members"
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 placeholder:text-gray-300 transition-all"
                />
              </div>

              {/* Channel Selection */}
              <div className="mb-5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">
                  Channel
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleChannel('email')}
                    className={cn(
                      'flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
                      selectedChannels.includes('email')
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    )}
                  >
                    <Mail className="h-4 w-4" />
                    Email
                    {selectedChannels.includes('email') && (
                      <Check className="h-3.5 w-3.5 text-indigo-600" />
                    )}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => toggleChannel('sms')}
                      className={cn(
                        'flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
                        selectedChannels.includes('sms')
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      )}
                    >
                      <Smartphone className="h-4 w-4" />
                      SMS
                      {selectedChannels.includes('sms') && (
                        <Check className="h-3.5 w-3.5 text-indigo-600" />
                      )}
                    </button>
                    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </div>

              {/* Segment Selection */}
              <div className="mb-5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
                  Target Segment
                </label>
                <select
                  value={selectedSegment}
                  onChange={(e) => setSelectedSegment(e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                  }}
                >
                  {segments.map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name} ({seg.count.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient Count */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    Estimated Recipients
                  </p>
                  <p className="text-2xl font-black text-indigo-700 tabular-nums">
                    {recipientCount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Step 2: Content ───────────────────────────────── */}
        {currentStep === 2 && (
          <motion.div key="step-2" {...fadeInUp}>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Left: Editor */}
              <div className="xl:col-span-2 space-y-4">
                {/* Channel Tabs */}
                {selectedChannels.length > 1 && (
                  <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
                    {selectedChannels.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => setContentTab(ch)}
                        className={cn(
                          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                          contentTab === ch
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        )}
                      >
                        {ch === 'email' ? (
                          <Mail className="h-3.5 w-3.5" />
                        ) : (
                          <Smartphone className="h-3.5 w-3.5" />
                        )}
                        {ch === 'email' ? 'Email' : 'SMS'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Email Editor */}
                {contentTab === 'email' && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                    {/* Subject Line */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Subject Line
                        </label>
                        <span
                          className={cn(
                            'text-xs tabular-nums',
                            subject.length > 60 ? 'text-amber-500 font-semibold' : 'text-gray-400'
                          )}
                        >
                          {subject.length}/60
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Write a compelling subject line..."
                          className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 pr-28 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 placeholder:text-gray-300 transition-all"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <button
                            onClick={() => setShowAiSuggestions(!showAiSuggestions)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 text-xs font-semibold text-indigo-600 hover:from-indigo-100 hover:to-violet-100 transition-all"
                          >
                            <Sparkles className="h-3 w-3" />
                            AI Suggest
                          </button>
                        </div>
                      </div>

                      {/* AI Suggestions Dropdown */}
                      <AnimatePresence>
                        {showAiSuggestions && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -4, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/50 to-white overflow-hidden">
                              <div className="px-3 py-2 border-b border-indigo-100">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                  AI-Suggested Subject Lines
                                </p>
                              </div>
                              {AI_SUBJECT_SUGGESTIONS.map((s, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setSubject(s)
                                    setShowAiSuggestions(false)
                                  }}
                                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-0"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Preview Text */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
                        Preview Text
                      </label>
                      <input
                        type="text"
                        value={previewText}
                        onChange={(e) => setPreviewText(e.target.value)}
                        placeholder="Text that appears in the inbox preview..."
                        className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 placeholder:text-gray-300 transition-all"
                      />
                    </div>

                    {/* Merge Tags */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
                        Merge Tags
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {MERGE_TAGS.map((mt) => (
                          <button
                            key={mt.tag}
                            onClick={() => insertMergeTag(mt.tag)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all"
                          >
                            <Type className="h-3 w-3" />
                            {mt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Body Editor */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Email Body
                        </label>
                        <button
                          onClick={() => setShowAiGenerate(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 text-xs font-semibold text-indigo-600 hover:from-indigo-100 hover:to-violet-100 transition-all"
                        >
                          <Wand2 className="h-3 w-3" />
                          AI Generate
                        </button>
                      </div>
                      <div className="relative">
                        <textarea
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          placeholder="Write your email content here. Use merge tags above to personalize..."
                          className="w-full min-h-[240px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 placeholder:text-gray-300 transition-all resize-y leading-relaxed"
                        />
                        <AnimatePresence>
                          {showAiGenerate && (
                            <AIGeneratePanel
                              isOpen={showAiGenerate}
                              onClose={() => setShowAiGenerate(false)}
                              onGenerate={(content) => setEmailBody(content)}
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )}

                {/* SMS Editor */}
                {contentTab === 'sms' && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          SMS Body
                        </label>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-xs tabular-nums',
                              smsBody.length > 160
                                ? 'text-red-500 font-semibold'
                                : smsBody.length > 140
                                ? 'text-amber-500 font-semibold'
                                : 'text-gray-400'
                            )}
                          >
                            {smsBody.length}/160
                          </span>
                          {smsBody.length > 160 && (
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md">
                              {Math.ceil(smsBody.length / 160)} segments
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Merge Tags for SMS */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {MERGE_TAGS.slice(0, 4).map((mt) => (
                          <button
                            key={mt.tag}
                            onClick={() => insertMergeTag(mt.tag)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all"
                          >
                            <Type className="h-3 w-3" />
                            {mt.label}
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={smsBody}
                        onChange={(e) => setSmsBody(e.target.value)}
                        placeholder="Write your SMS message (160 characters per segment)..."
                        className="w-full min-h-[120px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 placeholder:text-gray-300 transition-all resize-y"
                        maxLength={480}
                      />

                      {/* Character bar */}
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            smsBody.length > 160
                              ? 'bg-amber-400'
                              : smsBody.length > 140
                              ? 'bg-amber-300'
                              : 'bg-indigo-400'
                          )}
                          style={{
                            width: `${Math.min((smsBody.length / 160) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Pane */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">Preview</h3>
                    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                      <button
                        onClick={() => setPreviewMode('desktop')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                          previewMode === 'desktop'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        )}
                      >
                        <Monitor className="h-3 w-3" />
                        Desktop
                      </button>
                      <button
                        onClick={() => setPreviewMode('mobile')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                          previewMode === 'mobile'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        )}
                      >
                        <Phone className="h-3 w-3" />
                        Mobile
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 flex items-start justify-center min-h-[200px]">
                    <EmailPreview
                      subject={subject}
                      previewText={previewText}
                      body={emailBody}
                      mode={previewMode}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Template Library */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">Templates</h3>
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      {showTemplates ? 'Hide' : 'Show All'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(showTemplates ? TEMPLATES : TEMPLATES.slice(0, 4)).map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={selectTemplate}
                      />
                    ))}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Campaign Info</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Recipients</span>
                      <span className="text-sm font-bold text-gray-900 tabular-nums">
                        {recipientCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Channel(s)</span>
                      <div className="flex items-center gap-1.5">
                        {selectedChannels.map((ch) => (
                          <span
                            key={ch}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600 capitalize"
                          >
                            {ch === 'email' ? (
                              <Mail className="h-3 w-3" />
                            ) : (
                              <Smartphone className="h-3 w-3" />
                            )}
                            {ch}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Segment</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {segments.find((s) => s.id === selectedSegment)?.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Step 3: Review & Schedule ─────────────────────── */}
        {currentStep === 3 && (
          <motion.div key="step-3" {...fadeInUp} className="space-y-4">
            {/* Summary Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-5">Campaign Summary</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      Campaign Name
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{campaignName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      Channel(s)
                    </p>
                    <div className="flex items-center gap-2">
                      {selectedChannels.map((ch) => (
                        <span
                          key={ch}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700 capitalize"
                        >
                          {ch === 'email' ? (
                            <Mail className="h-3.5 w-3.5" />
                          ) : (
                            <Smartphone className="h-3.5 w-3.5" />
                          )}
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      Segment
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {segments.find((s) => s.id === selectedSegment)?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      Subject Line
                    </p>
                    <p className="text-sm text-gray-700">{subject || 'No subject'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Body Preview
                  </p>
                  <div className="h-48 rounded-xl bg-gray-50 border border-gray-200 p-4 overflow-y-auto">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                      {emailBody || smsBody || 'No content'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recipient Count */}
              <div className="mt-5 flex items-center gap-3 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    Sending To
                  </p>
                  <p className="text-2xl font-black text-indigo-700 tabular-nums">
                    {recipientCount.toLocaleString()} recipients
                  </p>
                </div>
              </div>
            </div>

            {/* A/B Test */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center">
                    <Split className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">A/B Testing</h3>
                    <p className="text-xs text-gray-400">
                      Test different versions to optimize performance
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAbTestEnabled(!abTestEnabled)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    abTestEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                      abTestEnabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              <AnimatePresence>
                {abTestEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 border-t border-gray-100 space-y-4">
                      {/* Split Slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Traffic Split
                          </label>
                          <span className="text-xs font-semibold text-gray-600">
                            A: {abSplit}% / B: {100 - abSplit}%
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="range"
                            min={10}
                            max={90}
                            step={10}
                            value={abSplit}
                            onChange={(e) => setAbSplit(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                          />
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] font-bold text-indigo-600">
                              Variant A ({abSplit}%)
                            </span>
                            <span className="text-[10px] font-bold text-violet-600">
                              Variant B ({100 - abSplit}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Variant B Fields */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
                          Variant B — Subject Line
                        </label>
                        <input
                          type="text"
                          value={variantBSubject}
                          onChange={(e) => setVariantBSubject(e.target.value)}
                          placeholder="Alternative subject line for Variant B..."
                          className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 placeholder:text-gray-300 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
                          Variant B — Body
                        </label>
                        <textarea
                          value={variantBBody}
                          onChange={(e) => setVariantBBody(e.target.value)}
                          placeholder="Alternative body content for Variant B..."
                          className="w-full min-h-[120px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 placeholder:text-gray-300 transition-all resize-y"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Send Options */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Send Options</h3>

              <div className="flex items-center gap-3 mb-5">
                <button
                  onClick={() => setScheduleMode('now')}
                  className={cn(
                    'flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
                    scheduleMode === 'now'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  )}
                >
                  <Send className="h-4 w-4" />
                  Send Now
                </button>
                <button
                  onClick={() => setScheduleMode('schedule')}
                  className={cn(
                    'flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
                    scheduleMode === 'schedule'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  )}
                >
                  <Calendar className="h-4 w-4" />
                  Schedule
                </button>
              </div>

              <AnimatePresence>
                {scheduleMode === 'schedule' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
                          Date
                        </label>
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
                          Time
                        </label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Send Test */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <Mail className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700">Send Test Email</p>
                  <p className="text-xs text-gray-400">
                    Preview in your inbox before sending to all recipients
                  </p>
                </div>
                <button
                  onClick={handleSendTest}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                    testSent
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {testSent ? (
                    <span className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      Sent!
                    </span>
                  ) : (
                    'Send Test'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Navigation Footer ───────────────────────────────── */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1) as Step)}
          disabled={currentStep === 1}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
            currentStep === 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving || !campaignName.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>

          {currentStep < 3 ? (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(3, prev + 1) as Step)}
              disabled={!canProceed}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                canProceed
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              )}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSendCampaign}
              disabled={sending}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending...' : scheduleMode === 'schedule' ? 'Schedule Campaign' : 'Send Campaign'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
