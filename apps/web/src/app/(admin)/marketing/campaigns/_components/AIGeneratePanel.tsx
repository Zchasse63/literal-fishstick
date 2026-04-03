'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Wand2, X } from 'lucide-react'
import type { CampaignType, ToneType } from './types'
import { CAMPAIGN_TYPES, TONES } from './constants'

export default function AIGeneratePanel({
  isOpen,
  onClose,
  onGenerate,
}: {
  isOpen: boolean
  onClose: () => void
  onGenerate: (content: string) => void
}) {
  const [campaignType, setCampaignType] = useState<CampaignType>('winback')
  const [tone, setTone] = useState<ToneType>('friendly')
  const [keyPoints, setKeyPoints] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = useCallback(() => {
    setIsGenerating(true)
    setTimeout(() => {
      const generated = `Hi {{first_name}},\n\nWe noticed it's been a little while since your last visit to {{studio_name}}, and we wanted to reach out.\n\nYour wellness journey matters to us, and we've got some exciting things happening at the studio this week:\n\n- New guided breathwork sessions with Whitney Cooper\n- Extended evening hours on Thursdays\n- Fresh cold plunge protocols for recovery\n\nWe'd love to see you back. Your body and mind will thank you!\n\nBook your next session today and pick up right where you left off.\n\nWarmly,\n{{studio_name}} Team`
      onGenerate(generated)
      setIsGenerating(false)
      onClose()
    }, 1500)
  }, [onGenerate, onClose])

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 z-20 bg-white rounded-2xl border border-indigo-200 shadow-lg p-5 flex flex-col"
      style={{
        background: 'linear-gradient(135deg, rgba(79,70,229,0.02) 0%, rgba(139,92,246,0.02) 100%)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <Wand2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">AI Content Generator</h4>
            <p className="text-[10px] text-gray-400">Powered by Claude</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
              Campaign Type
            </label>
            <select
              value={campaignType}
              onChange={(e) => setCampaignType(e.target.value as CampaignType)}
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
              Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as ToneType)}
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">
            Key Points
          </label>
          <textarea
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
            placeholder="e.g., New guided breathwork classes, extended hours, referral bonus..."
            className="w-full h-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 resize-none placeholder:text-gray-300"
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className={cn(
          'mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
          isGenerating
            ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-sm'
        )}
      >
        {isGenerating ? (
          <>
            <div className="h-4 w-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Generate Content
          </>
        )}
      </button>
    </motion.div>
  )
}
