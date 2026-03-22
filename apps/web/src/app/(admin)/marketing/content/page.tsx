'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Plus,
  Heart,
  MessageCircle,
  Pin,
  MoreHorizontal,
  Edit3,
  Trash2,
  Megaphone,
  CalendarDays,
  Sparkles,
  Lightbulb,
  Image,
  Filter,
  Search,
  Eye,
  PinOff,
  FileText,
} from 'lucide-react'
import Link from 'next/link'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type PostType = 'announcement' | 'event' | 'class_promo' | 'tip'
type AuthorRole = 'owner' | 'manager' | 'trainer'
type PostStatus = 'published' | 'draft'
type TypeFilter = 'all' | PostType

interface Post {
  id: string
  author: { name: string; initials: string; role: AuthorRole }
  type: PostType
  title?: string
  content: string
  imageUrl?: string
  likes: number
  comments: number
  status: PostStatus
  pinned: boolean
  createdAt: string
}

// ─── Constants ──────────────────────────────────────────────
const TYPE_CONFIG: Record<PostType, { label: string; icon: typeof Megaphone; color: string; bgColor: string }> = {
  announcement: { label: 'Announcement', icon: Megaphone, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  event: { label: 'Event', icon: CalendarDays, color: 'text-violet-600', bgColor: 'bg-violet-50' },
  class_promo: { label: 'Class Promo', icon: Sparkles, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  tip: { label: 'Tip', icon: Lightbulb, color: 'text-amber-600', bgColor: 'bg-amber-50' },
}

const ROLE_COLORS: Record<AuthorRole, string> = {
  owner: 'bg-indigo-100 text-indigo-700',
  manager: 'bg-emerald-100 text-emerald-700',
  trainer: 'bg-amber-100 text-amber-700',
}

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'event', label: 'Event' },
  { value: 'class_promo', label: 'Class Promo' },
  { value: 'tip', label: 'Tip' },
]

// ─── Post Card ──────────────────────────────────────────────
function PostCard({
  post,
  onTogglePin,
  onDelete,
}: {
  post: Post
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const typeConfig = TYPE_CONFIG[post.type]
  const TypeIcon = typeConfig.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md',
        post.pinned ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-200'
      )}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
              {post.author.initials}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{post.author.name}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', ROLE_COLORS[post.author.role])}>
                  {post.author.role}
                </span>
              </div>
              <span className="text-xs text-gray-400">{post.createdAt}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {post.pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                <Pin className="h-3 w-3" />
                Pinned
              </span>
            )}
            {post.status === 'draft' && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Draft</span>
            )}
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', typeConfig.bgColor, typeConfig.color)}>
              <TypeIcon className="h-3 w-3" />
              {typeConfig.label}
            </span>

            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
              >
                <MoreHorizontal className="h-4 w-4 text-gray-400" />
              </button>
              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                  >
                    <button
                      onClick={() => {
                        onTogglePin(post.id)
                        setShowMenu(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {post.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      {post.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      onClick={() => setShowMenu(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        onDelete(post.id)
                        setShowMenu(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Content */}
        {post.title && <h3 className="mb-1.5 text-base font-bold text-gray-900">{post.title}</h3>}
        <p className="text-sm leading-relaxed text-gray-700 line-clamp-3">{post.content}</p>

        {/* Image preview */}
        {post.imageUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
            <Image className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-500">Image attached</span>
          </div>
        )}

        {/* Engagement */}
        <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3">
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors">
            <Heart className="h-3.5 w-3.5" />
            <span className="tabular-nums font-medium">{post.likes}</span>
          </button>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="tabular-nums font-medium">{post.comments}</span>
          </button>
          {post.status === 'published' && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-600">
              <Eye className="h-3 w-3" />
              Published
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function getRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

// ─── Main Page ──────────────────────────────────────────────
export default function ContentHubPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserClient()

    async function loadPosts() {
      const { data } = await supabase
        .from('content_posts')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (data) {
        setPosts(
          data.map((p: any) => ({
            id: p.id,
            author: {
              name: p.author_name || 'Unknown',
              initials: (p.author_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
              role: (p.author_role || 'owner') as AuthorRole,
            },
            type: (p.post_type || 'announcement') as PostType,
            title: p.title || undefined,
            content: p.content || '',
            imageUrl: p.image_url || undefined,
            likes: p.likes_count ?? 0,
            comments: p.comments_count ?? 0,
            status: (p.status || 'draft') as PostStatus,
            pinned: p.pinned ?? false,
            createdAt: p.created_at ? getRelativeTime(p.created_at) : 'Just now',
          }))
        )
      }

      setLoading(false)
    }

    loadPosts()
    return () => { cancelled = true }
  }, [])
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [roleFilter, setRoleFilter] = useState<AuthorRole | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPosts = posts
    .filter((post) => {
      if (typeFilter !== 'all' && post.type !== typeFilter) return false
      if (roleFilter !== 'all' && post.author.role !== roleFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          (post.title?.toLowerCase().includes(q) ?? false) ||
          post.content.toLowerCase().includes(q) ||
          post.author.name.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      // Pinned first
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return 0
    })

  const togglePin = (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)))
  }

  const deletePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  const stats = {
    total: posts.length,
    published: posts.filter((p) => p.status === 'published').length,
    totalLikes: posts.reduce((sum, p) => sum + p.likes, 0),
    totalComments: posts.reduce((sum, p) => sum + p.comments, 0),
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-[960px] px-6 py-8">
        {/* Header */}
        <motion.div {...fadeInUp} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Content Hub</h1>
            <p className="mt-1 text-sm text-gray-500">
              {stats.published} published &middot; {stats.totalLikes} likes &middot; {stats.totalComments} comments
            </p>
          </div>
          <Link
            href="/marketing/content/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Post
          </Link>
        </motion.div>

        {/* Stats Row */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.05 }} className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Posts', value: stats.total },
            { label: 'Published', value: stats.published },
            { label: 'Total Likes', value: stats.totalLikes },
            { label: 'Total Comments', value: stats.totalComments },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stat.label}</p>
              <p className="mt-1 text-[28px] font-black text-gray-900 tabular-nums">{stat.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.1 }} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Type Pills */}
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                  typeFilter === f.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 sm:ml-auto">
            {/* Author Role Filter */}
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as AuthorRole | 'all')}
                className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2 pr-8 text-sm text-gray-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All Roles</option>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="trainer">Trainer</option>
              </select>
              <Filter className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts..."
                className="w-48 rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        </motion.div>

        {/* Post Feed */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.15 }}>
          <AnimatePresence mode="popLayout">
            {filteredPosts.length > 0 ? (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} onTogglePin={togglePin} onDelete={deletePost} />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 mb-4">
                  <FileText className="h-7 w-7 text-indigo-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Start engaging your community</h3>
                <p className="mt-1 text-sm text-gray-500">Create your first post to connect with members</p>
                <Link
                  href="/marketing/content/new"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create Post
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}