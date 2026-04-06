'use client'

import { useState } from 'react'
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
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
export type PostType = 'announcement' | 'event' | 'class_promo' | 'tip'
export type AuthorRole = 'owner' | 'manager' | 'trainer'
export type PostStatus = 'published' | 'draft'
type TypeFilter = 'all' | PostType

export interface Post {
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
        'rounded-2xl border bg-white dark:bg-gray-950 shadow-sm transition-all hover:shadow-md',
        post.pinned ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-200 dark:border-gray-800'
      )}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300">
              {post.author.initials}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{post.author.name}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', ROLE_COLORS[post.author.role])}>
                  {post.author.role}
                </span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">{post.createdAt}</span>
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
              <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">Draft</span>
            )}
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', typeConfig.bgColor, typeConfig.color)}>
              <TypeIcon className="h-3 w-3" />
              {typeConfig.label}
            </span>

            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <MoreHorizontal className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </button>
              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-1 shadow-lg"
                  >
                    <button
                      onClick={() => {
                        onTogglePin(post.id)
                        setShowMenu(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      {post.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      {post.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); window.alert('Content editing coming in Phase 2') }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
        {post.title && <h3 className="mb-1.5 text-base font-bold text-gray-900 dark:text-gray-100">{post.title}</h3>}
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 line-clamp-3">{post.content}</p>

        {/* Image preview */}
        {post.imageUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
            <Image className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Image attached</span>
          </div>
        )}

        {/* Engagement */}
        <div className="mt-4 flex items-center gap-4 border-t border-gray-100 dark:border-gray-800 pt-3">
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors">
            <Heart className="h-3.5 w-3.5" />
            <span className="tabular-nums font-medium">{post.likes}</span>
          </button>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors">
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

// ─── Props ──────────────────────────────────────────────────
interface ContentHubClientProps {
  initialPosts: Post[]
}

// ─── Client Component ───────────────────────────────────────
export default function ContentHubClient({ initialPosts }: ContentHubClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
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
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <motion.div {...fadeInUp} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Content Hub</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
            <div key={stat.label} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{stat.label}</p>
              <p className="mt-1 text-[28px] font-black text-gray-900 dark:text-gray-100 tabular-nums">{stat.value}</p>
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
                    : 'bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                className="appearance-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2 pr-8 text-sm text-gray-700 dark:text-gray-300 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All Roles</option>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="trainer">Trainer</option>
              </select>
              <Filter className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts..."
                className="w-48 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white dark:bg-gray-950 py-16"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 mb-4">
                  <FileText className="h-7 w-7 text-indigo-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Start engaging your community</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create your first post to connect with members</p>
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
