import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/require-role'

/**
 * Tier 8.5.A6/A7 — Unified search endpoint.
 *
 * One request fans out to members, classes, transactions, campaigns, and
 * leads in parallel. Returns a shaped response optimized for a palette UI
 * (id/label/sublabel/href). On a per-group failure the group returns
 * empty, not the whole response.
 *
 * Query: ?q=<string>&limit=<1..10>
 * Auth: owner/manager (same as the rest of the admin surface)
 */
export interface SearchResult {
  id: string
  label: string
  sublabel: string
  href: string
  type: 'member' | 'class' | 'transaction' | 'campaign' | 'lead'
}

export interface SearchResponse {
  members: SearchResult[]
  classes: SearchResult[]
  transactions: SearchResult[]
  campaigns: SearchResult[]
  leads: SearchResult[]
}

const MIN_QUERY_LENGTH = 2
const MAX_LIMIT = 10
const DEFAULT_LIMIT = 5

function escapeIlike(s: string): string {
  // Escape the three ilike wildcards so arbitrary user input is treated
  // as a literal substring match.
  return s.replace(/([\\%_])/g, '\\$1')
}

function emptyResponse(): SearchResponse {
  return { members: [], classes: [], transactions: [], campaigns: [], leads: [] }
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(['owner', 'manager'])
  if (auth.error) return auth.error
  const { supabase, studioId } = auth

  const { searchParams } = request.nextUrl
  const rawQ = (searchParams.get('q') ?? '').trim()
  const limit = Math.max(
    1,
    Math.min(
      MAX_LIMIT,
      parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
    )
  )

  if (rawQ.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(emptyResponse())
  }

  const q = escapeIlike(rawQ)
  const pattern = `%${q}%`

  // Run all five queries concurrently. Per-group failures return [] so a
  // single broken query doesn't collapse the whole response.
  const [membersRes, classesRes, transactionsRes, campaignsRes, leadsRes] =
    await Promise.allSettled([
      // ─── Members (join profiles for full_name / email) ─────────
      supabase
        .from('members')
        .select('id, profile_id, profiles!inner(full_name, email)')
        .eq('studio_id', studioId)
        .or(`full_name.ilike.${pattern},email.ilike.${pattern}`, {
          referencedTable: 'profiles',
        })
        .limit(limit),

      // ─── Classes (title match, upcoming sessions first) ───────
      supabase
        .from('classes')
        .select('id, title, starts_at, capacity')
        .eq('studio_id', studioId)
        .ilike('title', pattern)
        .order('starts_at', { ascending: false, nullsFirst: false })
        .limit(limit),

      // ─── Transactions (description + type match) ──────────────
      supabase
        .from('transactions')
        .select('id, amount, type, status, description, created_at, member_id, members!inner(id, profiles!inner(full_name))')
        .eq('studio_id', studioId)
        .or(`description.ilike.${pattern},type.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(limit),

      // ─── Campaigns (name + subject match) ─────────────────────
      supabase
        .from('campaigns')
        .select('id, name, subject, status')
        .eq('studio_id', studioId)
        .or(`name.ilike.${pattern},subject.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(limit),

      // ─── Leads (first_name, last_name, email) ─────────────────
      supabase
        .from('leads')
        .select('id, first_name, last_name, email, status')
        .eq('studio_id', studioId)
        .or(
          `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`
        )
        .limit(limit),
    ])

  const response: SearchResponse = emptyResponse()

  // Members
  if (membersRes.status === 'fulfilled' && membersRes.value.data) {
    response.members = membersRes.value.data.map((row: Record<string, unknown>) => {
      const profile = row.profiles as { full_name?: string; email?: string } | null
      return {
        id: row.id as string,
        label: profile?.full_name ?? 'Unknown Member',
        sublabel: profile?.email ?? '',
        // BUG-013: member detail routes use profile_id in the URL
        href: `/members?focus=${row.profile_id as string}`,
        type: 'member' as const,
      }
    })
  }

  // Classes
  if (classesRes.status === 'fulfilled' && classesRes.value.data) {
    response.classes = classesRes.value.data.map((row: Record<string, unknown>) => {
      const startsAt = row.starts_at as string | null
      const dateStr = startsAt
        ? new Date(startsAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'No date'
      return {
        id: row.id as string,
        label: (row.title as string) ?? 'Untitled class',
        sublabel: `${dateStr} · capacity ${row.capacity ?? 0}`,
        href: `/schedule?classId=${row.id as string}`,
        type: 'class' as const,
      }
    })
  }

  // Transactions
  if (transactionsRes.status === 'fulfilled' && transactionsRes.value.data) {
    response.transactions = transactionsRes.value.data.map(
      (row: Record<string, unknown>) => {
        const amount = (row.amount as number) ?? 0
        const dollars = (amount / 100).toFixed(2)
        const member = row.members as
          | { profiles?: { full_name?: string } }
          | null
        const memberName = member?.profiles?.full_name ?? 'Unknown'
        const typeStr = (row.type as string) ?? 'unknown'
        const description = (row.description as string | null) ?? typeStr
        return {
          id: row.id as string,
          label: `${description} — $${dollars}`,
          sublabel: `${memberName} · ${new Date(row.created_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          href: `/revenue?txn=${row.id as string}`,
          type: 'transaction' as const,
        }
      }
    )
  }

  // Campaigns
  if (campaignsRes.status === 'fulfilled' && campaignsRes.value.data) {
    response.campaigns = campaignsRes.value.data.map(
      (row: Record<string, unknown>) => ({
        id: row.id as string,
        label: (row.name as string) ?? 'Untitled campaign',
        sublabel: `${(row.subject as string) ?? ''} · ${(row.status as string) ?? 'draft'}`,
        href: `/marketing?campaignId=${row.id as string}`,
        type: 'campaign' as const,
      })
    )
  }

  // Leads
  if (leadsRes.status === 'fulfilled' && leadsRes.value.data) {
    response.leads = leadsRes.value.data.map((row: Record<string, unknown>) => {
      const firstName = (row.first_name as string) ?? ''
      const lastName = (row.last_name as string) ?? ''
      const name = `${firstName} ${lastName}`.trim() || 'Unknown Lead'
      return {
        id: row.id as string,
        label: name,
        sublabel: `${(row.email as string) ?? ''} · ${(row.status as string) ?? 'new'}`,
        href: `/marketing?leadId=${row.id as string}`,
        type: 'lead' as const,
      }
    })
  }

  return NextResponse.json(response)
}
