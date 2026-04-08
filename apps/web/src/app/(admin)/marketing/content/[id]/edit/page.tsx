'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Megaphone,
  CalendarDays,
  Sparkles,
  Lightbulb,
  Upload,
  Image,
  Pin,
  Eye,
  Send,
  Save,
  Users,
  Shield,
  Globe,
  X,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
type PostType = 'announcement' | 'event' | 'class_promo' | 'tip'
type Visibility = 'all' | 'members' | 'staff'

interface PostTypeOption {
  value: PostType
  label: string
  description: string
  icon: typeof Megaphone
  color: string
  bgColor: string
  ringColor: string
}

// ─── Constants ──────────────────────────────────────────────
const POST_TYPES: PostTypeOption[] = [
  {
    value: 'announcement',
    label: 'Announcement',
    description: 'Studio news and updates',
    icon: Megaphone,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    ringColor: 'ring-blue-200',
  },
  {
    value: 'event',
    label: 'Event',
    description: 'Upcoming events and happenings',
    icon: CalendarDays,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    ringColor: 'ring-violet-200',
  },
  {
    value: 'class_promo',
    label: 'Class Promo',
    description: 'Promote classes and sessions',
    icon: Sparkles,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    ringColor: 'ring-indigo-200',
  },
  {
    value: 'tip',
    label: 'Tip',
    description: 'Wellness tips and advice',
    icon: Lightbulb,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    ringColor: 'ring-amber-200',
  },
]

const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string; icon: typeof Globe }[] = [
  { value: 'all', label: 'Everyone', description: 'Visible to all visitors', icon: Globe },
  { value: 'members', label: 'Members Only', description: 'Active members only', icon: Users },
  { value: 'staff', label: 'Staff Only', description: 'Internal staff communication', icon: Shield },
]

// ─── Main Page ──────────────────────────────────────────────
export default function EditPostPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string

  const [selectedType, setSelectedType] = useState<PostType | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('all')
  const [pinned, setPinned] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch existing post on mount
  useEffect(() => {
    async function fetchPost() {
      try {
        const res = await fetch(`/api/content/${postId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load post')

        const post = json.data
        setSelectedType(post.type ?? null)
        setTitle(post.title ?? '')
        setContent(post.body ?? '')
        setPinned(post.pinned ?? false)

        // Map is_published to visibility if available
        if (post.visibility) {
          setVisibility(post.visibility)
        }

        if (post.media_urls?.length > 0) {
          setImagePreview(post.media_urls[0])
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchPost()
  }, [postId])

  const isValid = selectedType && content.trim().length > 0

  async function handleSubmit(status: 'draft' | 'published') {
    if (!isValid) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/content/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          title: title.trim() || null,
          body: content,
          is_published: status === 'published',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save post')
      router.push('/marketing/content')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    // Mock image preview
    setImagePreview('preview-image.jpg')
  }

  const handleFileSelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const url = URL.createObjectURL(file)
        setImagePreview(url)
      }
    }
    input.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Back Link */}
        <motion.div {...fadeInUp}>
          <Link
            href="/marketing/content"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Content Hub
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.05 }} className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Edit Post</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update your community board post</p>
        </motion.div>

        {/* Post Type Selector */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.1 }} className="mb-6">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Post Type</label>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {POST_TYPES.map((type) => {
              const Icon = type.icon
              const isSelected = selectedType === type.value
              return (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all',
                    isSelected
                      ? `border-transparent ${type.bgColor} ring-2 ${type.ringColor} shadow-sm`
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-gray-300 hover:shadow-sm'
                  )}
                >
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', type.bgColor)}>
                    <Icon className={cn('h-5 w-5', type.color)} />
                  </div>
                  <span className={cn('text-xs font-semibold', isSelected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300')}>
                    {type.label}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-tight">{type.description}</span>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600"
                    >
                      <Check className="h-3 w-3 text-white" />
                    </motion.div>
                  )}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Title */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.15 }} className="mb-6">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Title <span className="font-normal text-gray-300">(optional)</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your post a title..."
            className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </motion.div>

        {/* Content */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.2 }} className="mb-6">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post content. Line breaks will be preserved..."
            rows={8}
            className="mt-2 w-full resize-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3 text-sm leading-relaxed text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <div className="mt-1.5 flex justify-end">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{content.length} characters</span>
          </div>
        </motion.div>

        {/* Image Upload */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.25 }} className="mb-6">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Image</label>
          {!imagePreview ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'mt-2 flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white dark:bg-gray-950 py-10 transition-all',
                isDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900 mb-3">
                <Upload className={cn('h-6 w-6', isDragOver ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500')} />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop an image here, or</p>
              <button
                onClick={handleFileSelect}
                className="mt-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                browse to upload
              </button>
              <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">Upload to Supabase Storage &middot; PNG, JPG up to 5 MB</p>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50">
                <Image className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{imagePreview}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Image ready to upload</p>
              </div>
              <button
                onClick={() => setImagePreview(null)}
                className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
          )}
        </motion.div>

        {/* Visibility */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.3 }} className="mb-6">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Visibility</label>
          <div className="mt-3 space-y-2">
            {VISIBILITY_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isSelected = visibility === opt.value
              return (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 transition-all',
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-gray-300'
                  )}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={opt.value}
                    checked={isSelected}
                    onChange={() => setVisibility(opt.value)}
                    className="sr-only"
                  />
                  <div className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                  )}>
                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-gray-950" />}
                  </div>
                  <Icon className={cn('h-4 w-4 shrink-0', isSelected ? 'text-indigo-600' : 'text-gray-400 dark:text-gray-500')} />
                  <div>
                    <p className={cn('text-sm font-semibold', isSelected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300')}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{opt.description}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </motion.div>

        {/* Pin Toggle */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.35 }} className="mb-8">
          <button
            onClick={() => setPinned(!pinned)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border-2 p-3.5 transition-all',
              pinned ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-gray-300'
            )}
          >
            <div className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all',
              pinned ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
            )}>
              {pinned && <Check className="h-3 w-3 text-white" />}
            </div>
            <Pin className={cn('h-4 w-4 shrink-0', pinned ? 'text-indigo-600' : 'text-gray-400 dark:text-gray-500')} />
            <div className="text-left">
              <p className={cn('text-sm font-semibold', pinned ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300')}>Pin this post</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Pinned posts appear at the top of the feed</p>
            </div>
          </button>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div {...fadeInUp} className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-2 mb-4">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.4 }} className="flex gap-3">
          <button
            onClick={() => handleSubmit('draft')}
            disabled={saving || !isValid}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save as Draft
          </button>
          <button
            onClick={() => handleSubmit('published')}
            disabled={!isValid || saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Update & Publish
          </button>
        </motion.div>

        {/* Preview hint */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.45 }} className="mt-4 text-center">
          <button className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <Eye className="h-3.5 w-3.5" />
            Preview before publishing
          </button>
        </motion.div>
      </div>
    </div>
  )
}
