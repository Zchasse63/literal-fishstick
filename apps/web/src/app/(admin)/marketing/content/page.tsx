import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import ContentHubClient from './_components/ContentHubClient'
import type { Post } from './_components/ContentHubClient'

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

export default async function ContentHubPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('content_posts')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })

  const initialPosts: Post[] = (data ?? []).map((p: any) => ({
    id: p.id,
    author: {
      name: p.author_name || 'Unknown',
      initials: (p.author_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
      role: p.author_role || 'owner',
    },
    type: p.post_type || 'announcement',
    title: p.title || undefined,
    content: p.content || '',
    imageUrl: p.image_url || undefined,
    likes: p.likes_count ?? 0,
    comments: p.comments_count ?? 0,
    status: p.status || 'draft',
    pinned: p.pinned ?? false,
    createdAt: p.created_at ? getRelativeTime(p.created_at) : 'Just now',
  }))

  return <ContentHubClient initialPosts={initialPosts} />
}
