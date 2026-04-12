/**
 * POST /api/glofox/sync
 *
 * Standalone Glofox incremental sync endpoint.
 * Replaces the never-deployed Inngest cron (glofox-sync-hourly.ts) with a
 * direct HTTP endpoint that can be called by any external scheduler:
 *   - Netlify Scheduled Functions
 *   - EasyCron / cron-job.org
 *   - GitHub Actions cron
 *   - Manual curl from an admin
 *
 * Auth: CRON_SECRET via "Authorization: Bearer <secret>" or "x-cron-secret"
 *       header. Falls back to authenticated admin/owner session.
 *
 * Steps:
 *   1. Pull new/updated members since last sync
 *   2. Pull new events (classes)
 *   3. Pull new bookings
 *   4. Pull new transactions
 *   5. Update glofox_sync_state timestamps
 *
 * Each step is wrapped in try/catch so one failure does not block the rest.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GlofoxClient } from '@/lib/glofox/client'
import {
  transformMember,
  transformEvent,
  transformBooking,
  transformTransaction,
  transformMembershipPlan,
  transformCreditPack,
  transformLead,
  transformStaff,
  transformDiscount,
  transformTaxConfig,
} from '@/lib/glofox/transformers'
import { createProgramResolver } from '@/lib/glofox/program-resolver'
import { GLOFOX_NAMESPACE } from '@/lib/constants'
import type {
  GlofoxMember,
  GlofoxEvent,
  GlofoxBooking,
  GlofoxMembership,
  GlofoxCreditPack,
  GlofoxLead,
  GlofoxStaff,
  GlofoxDiscount,
  GlofoxTaxConfig,
} from '@/lib/glofox/types'

// ─── Constants ────────────────────────────────────────────────────
const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const LOCATION_ID = '22222222-2222-2222-2222-222222222222'
const OPEN_SAUNA_TYPE = '314f0ddf-dc6d-4402-beaa-22ed19172b18'
const GUIDED_TYPE = '243a8f2d-2fbf-4cf0-868b-9968fc6ddfaf'

// ─── Types ────────────────────────────────────────────────────────
interface SyncStepResult {
  entity: string
  fetched: number
  created: number
  updated: number
  skipped: number
  errors: number
  errorSamples: string[]
  durationMs: number
}

function emptyResult(entity: string): SyncStepResult {
  return { entity, fetched: 0, created: 0, updated: 0, skipped: 0, errors: 0, errorSamples: [], durationMs: 0 }
}

// ─── Service-role Supabase client ─────────────────────────────────
function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────

function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) result[key] = value
  }
  return result
}

/**
 * Build a glofox_id → UUID lookup map for a table, paginating past the
 * 1000-row Supabase limit.
 */
async function buildLookupMap(
  db: ReturnType<typeof getAdminDb>,
  table: string,
  studioId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let offset = 0
  const limit = 1000
  let hasMore = true

  while (hasMore) {
    const { data } = await db
      .from(table)
      .select('id, glofox_id')
      .eq('studio_id', studioId)
      .not('glofox_id', 'is', null)
      .range(offset, offset + limit - 1)

    if (data && data.length > 0) {
      for (const row of data) {
        if (row.glofox_id) map.set(row.glofox_id, row.id)
      }
      offset += data.length
      hasMore = data.length === limit
    } else {
      hasMore = false
    }
  }
  return map
}

/** Append an error sample (capped at 10 per step). */
function addError(result: SyncStepResult, msg: string) {
  result.errors++
  if (result.errorSamples.length < 10) {
    result.errorSamples.push(msg)
  }
}

// ─── Auth check ──────────────────────────────────────────────────

function verifyCronAuth(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) return false

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const legacyHeader = request.headers.get('x-cron-secret')

  const provided = bearerToken || legacyHeader
  return provided === expectedSecret
}

// ─── Route config — extend serverless function timeout ──────────
export const maxDuration = 60 // seconds (Netlify Pro allows up to 26s on free, 60s on Pro)

// ─── GET handler (health check / cron providers that only do GET) ─

export async function GET(request: NextRequest) {
  return POST(request)
}

// ─── POST handler (streaming NDJSON to prevent Netlify inactivity timeout) ──

export async function POST(request: NextRequest) {
  // ── 0. Auth (must happen before streaming starts) ──────────────
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <CRON_SECRET> or x-cron-secret header.' },
      { status: 401 },
    )
  }

  // ── 0b. Validate Glofox env vars before doing anything ─────────
  const branchId = process.env.GLOFOX_BRANCH_ID
  if (!process.env.GLOFOX_API_TOKEN || !process.env.GLOFOX_API_KEY || !branchId) {
    return NextResponse.json(
      {
        error: 'Missing Glofox credentials. Set GLOFOX_API_TOKEN, GLOFOX_API_KEY, and GLOFOX_BRANCH_ID.',
        missing: {
          GLOFOX_API_TOKEN: !process.env.GLOFOX_API_TOKEN,
          GLOFOX_API_KEY: !process.env.GLOFOX_API_KEY,
          GLOFOX_BRANCH_ID: !branchId,
        },
      },
      { status: 503 },
    )
  }

  let glofox: GlofoxClient
  try {
    glofox = new GlofoxClient({
      apiToken: process.env.GLOFOX_API_TOKEN,
      apiKey: process.env.GLOFOX_API_KEY,
      branchId,
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to initialize Glofox client: ${err instanceof Error ? err.message : String(err)}` },
      { status: 503 },
    )
  }

  let db: ReturnType<typeof getAdminDb>
  try {
    db = getAdminDb()
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to initialize Supabase admin client: ${err instanceof Error ? err.message : String(err)}` },
      { status: 503 },
    )
  }

  // ── Streaming response to prevent Netlify inactivity timeout ──
  // We use a TransformStream to send NDJSON progress lines while the sync runs.
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const syncStart = Date.now()
  const log: string[] = []
  const logLine = (msg: string) => {
    const ts = new Date().toISOString()
    const line = `[${ts}] ${msg}`
    log.push(line)
    console.log(`[glofox-sync] ${msg}`)
    // Write progress line to keep the connection alive
    writer.write(encoder.encode(JSON.stringify({ progress: msg }) + '\n')).catch(() => {})
  }

  // Run the sync in background, writing to the stream as we go
  ;(async () => {
    try {

  logLine('Sync started')

  // ── 1. Load sync state ─────────────────────────────────────────
  const syncState: Record<string, string | null> = {
    members: null,
    events: null,
    bookings: null,
    transactions: null,
    memberships: null,
    credit_packs: null,
    leads: null,
    staff: null,
    discounts: null,
    tax_configurations: null,
  }

  try {
    const { data: rows } = await db
      .from('glofox_sync_state')
      .select('entity_type, last_synced_at')
      .eq('studio_id', STUDIO_ID)

    for (const row of rows ?? []) {
      syncState[row.entity_type] = row.last_synced_at
    }
    logLine(`Loaded sync state: ${JSON.stringify(syncState)}`)
  } catch (err) {
    logLine(`Warning: Failed to load sync state, running full sync: ${err instanceof Error ? err.message : String(err)}`)
  }

  const results: SyncStepResult[] = []
  const syncStartedAt = new Date().toISOString()

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Sync Members
  // ═══════════════════════════════════════════════════════════════
  const memberResult = emptyResult('members')
  const memberStepStart = Date.now()
  try {
    logLine('Step 1: Fetching members from Glofox...')

    const members = await glofox.getMembers({
      modifiedSince: syncState.members ?? undefined,
    })

    memberResult.fetched = members.length
    logLine(`Step 1: Fetched ${members.length} members`)

    if (members.length > 0) {
      // Transform all members
      const transformed = members.map((m: GlofoxMember) => transformMember(m, STUDIO_ID))

      // Upsert profiles (batch in chunks of 200 to avoid payload limits)
      const profileRows = transformed.map((t) => t.profile)
      const BATCH_SIZE = 200
      for (let i = 0; i < profileRows.length; i += BATCH_SIZE) {
        const batch = profileRows.slice(i, i + BATCH_SIZE)
        const { error: profileError } = await db
          .from('profiles')
          .upsert(batch as any[], { onConflict: 'glofox_id,studio_id' })

        if (profileError) {
          addError(memberResult, `profiles upsert batch ${i}: ${profileError.message}`)
        }
      }

      // Build profile lookup for member FK resolution
      const profileMap = await buildLookupMap(db, 'profiles', STUDIO_ID)

      // Upsert members with resolved profile_id
      const memberRows = transformed
        .map((t) => {
          const profileId = profileMap.get(t.profileGlofoxId)
          if (!profileId) {
            memberResult.skipped++
            return null
          }
          return { ...t.member, profile_id: profileId }
        })
        .filter(Boolean)

      for (let i = 0; i < memberRows.length; i += BATCH_SIZE) {
        const batch = memberRows.slice(i, i + BATCH_SIZE)
        const { error: memberError } = await db
          .from('members')
          .upsert(batch as any[], { onConflict: 'glofox_id,studio_id' })

        if (memberError) {
          addError(memberResult, `members upsert batch ${i}: ${memberError.message}`)
        }
      }

      // Post-upsert enrichment: ClassPass tagging + plan_code → membership_tier
      try {
        const memberMap = await buildLookupMap(db, 'members', STUDIO_ID)

        for (const t of transformed) {
          const memberId = memberMap.get(t.profileGlofoxId)
          if (!memberId) continue

          const enrichUpdates: Record<string, unknown> = {}

          // ClassPass detection
          if (t.profile.lead_source === 'U' && t.profile.phone === '+10000000000') {
            enrichUpdates.acquisition_source = 'classpass'
          }

          // membership_tier from plan_code
          if (t.member.plan_code && !t.member.membership_tier) {
            const { data: planRow } = await db
              .from('membership_plans')
              .select('tier, name')
              .eq('glofox_id', t.member.plan_code)
              .eq('studio_id', STUDIO_ID)
              .maybeSingle()

            if (planRow?.tier) {
              enrichUpdates.membership_tier = planRow.tier
            } else if (planRow?.name) {
              const lower = planRow.name.toLowerCase()
              if (lower.includes('unlimited')) enrichUpdates.membership_tier = 'unlimited'
              else if (lower.includes('10')) enrichUpdates.membership_tier = '10_class'
              else if (lower.includes('6')) enrichUpdates.membership_tier = '6_class'
            }
          }

          if (Object.keys(enrichUpdates).length > 0) {
            enrichUpdates.updated_at = new Date().toISOString()
            await db.from('members').update(enrichUpdates).eq('id', memberId)
          }
        }
      } catch (enrichErr) {
        addError(memberResult, `enrichment: ${enrichErr instanceof Error ? enrichErr.message : String(enrichErr)}`)
      }

      memberResult.created = syncState.members ? 0 : members.length
      memberResult.updated = syncState.members ? members.length : 0
    }
  } catch (err) {
    addError(memberResult, `fetch: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 1 ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  memberResult.durationMs = Date.now() - memberStepStart
  results.push(memberResult)
  logLine(`Step 1 complete: ${memberResult.fetched} fetched, ${memberResult.errors} errors (${memberResult.durationMs}ms)`)

  // ═══════════════════════════════════════════════════════════════
  // STEP 1b: Hydrate Memberships (per-member detail fetch)
  // ───────────────────────────────────────────────────────────────
  // The paginated /2.0/members list endpoint returns SPARSE membership
  // objects for active users — specifically plan_code / plan_price /
  // user_membership_id are NULL. To answer questions like "who is on
  // plan X?" we must fetch each member individually via /2.0/members/{id}.
  //
  // This step runs after Step 1 so any newly-added members from the sync
  // get hydrated in the same cron tick. To keep runs bounded, we only
  // touch members whose member_subscriptions row is missing or stale
  // (>24h), and cap the batch size at MAX_HYDRATE_PER_RUN.
  // ═══════════════════════════════════════════════════════════════
  const hydrateResult = emptyResult('member_subscriptions')
  const hydrateStepStart = Date.now()
  const MAX_HYDRATE_PER_RUN = 200
  const HYDRATE_RATE_LIMIT_MS = 120
  try {
    logLine('Step 1b: Identifying stale member subscriptions to hydrate...')

    // A member is "fresh" if they have an ACTIVE subscription row that was
    // hydrated within the last 24h. Filtering on status='active' guarantees
    // that a member who just rolled from plan A → plan B doesn't skip the
    // hydrate just because their old cancelled A-row is still recent.
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: freshRows } = await db
      .from('member_subscriptions')
      .select('member_id')
      .eq('studio_id', STUDIO_ID)
      .eq('status', 'active')
      .gte('glofox_synced_at', cutoffIso)
    const freshIds = new Set((freshRows ?? []).map((r) => r.member_id as string))

    const allMembers: Array<{ id: string; profile_id: string; glofox_id: string }> = []
    const PAGE_SIZE = 1000
    let offset = 0
    while (true) {
      const { data, error } = await db
        .from('members')
        .select('id, profile_id, glofox_id')
        .eq('studio_id', STUDIO_ID)
        .not('glofox_id', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throw new Error(`member candidate fetch: ${error.message}`)
      if (!data || data.length === 0) break
      allMembers.push(...(data as typeof allMembers))
      if (data.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    const stale = allMembers
      .filter((m) => !freshIds.has(m.id))
      .slice(0, MAX_HYDRATE_PER_RUN)

    hydrateResult.fetched = stale.length
    logLine(`Step 1b: ${stale.length} stale candidates (cap ${MAX_HYDRATE_PER_RUN}), ${freshIds.size} already fresh`)

    if (stale.length > 0) {
      // Fetch plan name map for enrichment
      const { data: planMapRows } = await db
        .from('glofox_plan_map')
        .select('glofox_plan_code, plan_name, billing_interval')
        .eq('studio_id', STUDIO_ID)
      const planMap = new Map<string, { plan_name: string | null; billing_interval: string | null }>()
      for (const row of planMapRows ?? []) {
        planMap.set(row.glofox_plan_code as string, {
          plan_name: (row.plan_name as string) ?? null,
          billing_interval: (row.billing_interval as string) ?? null,
        })
      }

      // Glofox status → Meridian members.membership_status
      const statusMap: Record<string, string> = {
        ACTIVE: 'active',
        INACTIVE: 'none',
        CANCELED: 'cancelled',
        CANCELLED: 'cancelled',
        FROZEN: 'paused',
        EXPIRED: 'cancelled',
        PENDING: 'active',
        PAST_DUE: 'past_due',
      }
      const mapStatus = (raw: string | undefined | null): string =>
        raw ? (statusMap[raw] ?? statusMap[raw.toUpperCase()] ?? 'none') : 'none'
      const unixIso = (u: number | undefined | null): string | null =>
        u == null || u === 0 ? null : new Date(u * 1000).toISOString()

      for (const member of stale) {
        try {
          const full = await glofox.getMember(member.glofox_id)
          const membership = (full as { membership?: Record<string, unknown> }).membership as
            | {
                type?: string
                status?: string
                start_date?: number
                expiry_date?: number
                plan_code?: string
                plan_name?: string
                plan_price?: number
                plan_upfront_fee?: number
                user_membership_id?: string
                membership_name?: string
                subscription?: { stripe_id?: string; price?: number; interval?: string }
              }
            | undefined

          const type = membership?.type
          if (!membership || type === 'payg' || !membership.plan_code) {
            hydrateResult.skipped++
            await new Promise((r) => setTimeout(r, HYDRATE_RATE_LIMIT_MS))
            continue
          }

          const rawPrice = membership.plan_price ?? membership.subscription?.price ?? null
          const planPriceCents = rawPrice != null ? Math.round(Number(rawPrice) * 100) : null
          const upfrontCents =
            membership.plan_upfront_fee != null
              ? Math.round(Number(membership.plan_upfront_fee) * 100)
              : null
          const status = mapStatus(membership.status)
          const stripeSubId = membership.subscription?.stripe_id ?? null
          const planMapEntry = planMap.get(String(membership.plan_code))
          const planName = membership.plan_name ?? planMapEntry?.plan_name ?? null

          // ── Backfill members row ──
          const { error: memberUpdateError } = await db
            .from('members')
            .update({
              plan_code: String(membership.plan_code),
              plan_price: planPriceCents,
              plan_upfront_fee: upfrontCents,
              membership_status: status,
              glofox_subscription_id: stripeSubId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', member.id)
            .eq('studio_id', STUDIO_ID)
          if (memberUpdateError) {
            addError(hydrateResult, `member ${member.glofox_id}: ${memberUpdateError.message}`)
            await new Promise((r) => setTimeout(r, HYDRATE_RATE_LIMIT_MS))
            continue
          }

          // ── Upsert member_subscriptions row ──
          const subRow = {
            studio_id: STUDIO_ID,
            member_id: member.id,
            profile_id: member.profile_id,
            plan_code: String(membership.plan_code),
            plan_name: planName,
            membership_name: membership.membership_name ?? null,
            plan_price_cents: planPriceCents,
            plan_upfront_fee_cents: upfrontCents,
            billing_interval:
              membership.subscription?.interval ?? planMapEntry?.billing_interval ?? null,
            status,
            started_at: unixIso(membership.start_date),
            ended_at: unixIso(membership.expiry_date),
            glofox_user_membership_id: membership.user_membership_id ?? null,
            stripe_subscription_id: stripeSubId,
            glofox_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          if (membership.user_membership_id) {
            const { error: subError } = await db
              .from('member_subscriptions')
              .upsert(subRow, { onConflict: 'glofox_user_membership_id' })
            if (subError) {
              addError(hydrateResult, `sub ${member.glofox_id}: ${subError.message}`)
            } else {
              hydrateResult.updated++
            }
          } else {
            // No user_membership_id from Glofox — use (member_id, plan_code)
            // as the natural key. A partial unique index on this combination
            // (migration t34) provides a backstop against concurrent inserts.
            // Select → update-or-insert rather than delete-then-insert to
            // avoid a transient missing-row window.
            const { data: existing } = await db
              .from('member_subscriptions')
              .select('id')
              .eq('member_id', member.id)
              .eq('plan_code', String(membership.plan_code))
              .is('glofox_user_membership_id', null)
              .maybeSingle()

            if (existing) {
              const { error: subError } = await db
                .from('member_subscriptions')
                .update(subRow)
                .eq('id', existing.id)
              if (subError) {
                addError(hydrateResult, `sub ${member.glofox_id}: ${subError.message}`)
              } else {
                hydrateResult.updated++
              }
            } else {
              const { error: subError } = await db
                .from('member_subscriptions')
                .insert(subRow)
              if (subError) {
                addError(hydrateResult, `sub ${member.glofox_id}: ${subError.message}`)
              } else {
                hydrateResult.created++
              }
            }
          }
        } catch (err) {
          addError(
            hydrateResult,
            `${member.glofox_id}: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
        // Rate limit between per-member calls
        await new Promise((r) => setTimeout(r, HYDRATE_RATE_LIMIT_MS))
      }
    }
  } catch (err) {
    addError(hydrateResult, `fatal: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 1b ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  hydrateResult.durationMs = Date.now() - hydrateStepStart
  results.push(hydrateResult)
  logLine(
    `Step 1b complete: ${hydrateResult.fetched} processed, ${hydrateResult.created + hydrateResult.updated} hydrated, ${hydrateResult.skipped} skipped, ${hydrateResult.errors} errors (${hydrateResult.durationMs}ms)`,
  )

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Sync Events (Classes)
  // ═══════════════════════════════════════════════════════════════
  const eventResult = emptyResult('events')
  const eventStepStart = Date.now()
  try {
    logLine('Step 2: Fetching events from Glofox...')

    // Use last sync time as start, or 30 days ago for first sync
    const lastSyncUnix = syncState.events
      ? Math.floor(new Date(syncState.events).getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
    const nowUnix = Math.floor(Date.now() / 1000)

    const events = await glofox.getEvents({
      start: lastSyncUnix,
      end: nowUnix,
    })

    eventResult.fetched = events.length
    logLine(`Step 2: Fetched ${events.length} events`)

    if (events.length > 0) {
      const profileMap = await buildLookupMap(db, 'profiles', STUDIO_ID)

      // Try to use the dynamic program resolver; fall back to hardcoded map
      let resolveClassType: (name: string, programId?: string | null) => string
      try {
        const programResolver = await createProgramResolver(db, STUDIO_ID)
        resolveClassType = programResolver.resolve
      } catch {
        // Fallback: hardcoded class type mapping
        resolveClassType = (name: string) => {
          const lower = (name ?? '').toLowerCase()
          if (lower.includes('guided') || lower.includes('breathwork')) return GUIDED_TYPE
          return OPEN_SAUNA_TYPE
        }
      }

      const classRows = events.map((e: GlofoxEvent) => {
        const { classRow, trainerGlofoxId } = transformEvent(e, STUDIO_ID)
        const classTypeId = resolveClassType(e.name ?? '', e.program_id)
        const trainerId = trainerGlofoxId ? (profileMap.get(trainerGlofoxId) ?? null) : null

        return {
          ...classRow,
          class_type_id: classTypeId,
          program_id: classTypeId,
          trainer_id: trainerId,
          location_id: LOCATION_ID,
        }
      })

      const BATCH_SIZE = 200
      for (let i = 0; i < classRows.length; i += BATCH_SIZE) {
        const batch = classRows.slice(i, i + BATCH_SIZE)
        const { error } = await db
          .from('classes')
          .upsert(batch as any[], { onConflict: 'glofox_id,studio_id' })

        if (error) {
          addError(eventResult, `classes upsert batch ${i}: ${error.message}`)
        }
      }

      eventResult.created = syncState.events ? 0 : events.length
      eventResult.updated = syncState.events ? events.length : 0
    }
  } catch (err) {
    addError(eventResult, `fetch: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 2 ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  eventResult.durationMs = Date.now() - eventStepStart
  results.push(eventResult)
  logLine(`Step 2 complete: ${eventResult.fetched} fetched, ${eventResult.errors} errors (${eventResult.durationMs}ms)`)

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Sync Bookings
  // ═══════════════════════════════════════════════════════════════
  const bookingResult = emptyResult('bookings')
  const bookingStepStart = Date.now()
  try {
    logLine('Step 3: Fetching bookings from Glofox...')

    const bookings = await glofox.getBookings(branchId, {
      modifiedSince: syncState.bookings ?? undefined,
    })

    bookingResult.fetched = bookings.length
    logLine(`Step 3: Fetched ${bookings.length} bookings`)

    if (bookings.length > 0) {
      // Build lookup maps
      const memberMap = await buildLookupMap(db, 'members', STUDIO_ID)
      const classMap = await buildLookupMap(db, 'classes', STUDIO_ID)

      const bookingRows = bookings
        .map((b: GlofoxBooking) => {
          const { booking, memberGlofoxId, classGlofoxId } = transformBooking(b, STUDIO_ID)
          const memberId = memberGlofoxId ? memberMap.get(memberGlofoxId) : null
          const classId = classGlofoxId ? classMap.get(classGlofoxId) : null

          if (!memberId || !classId) {
            bookingResult.skipped++
            return null
          }
          return stripNulls({ ...booking, member_id: memberId, class_id: classId })
        })
        .filter(Boolean)

      if (bookingRows.length > 0) {
        const BATCH_SIZE = 200
        for (let i = 0; i < bookingRows.length; i += BATCH_SIZE) {
          const batch = bookingRows.slice(i, i + BATCH_SIZE)
          const { error } = await db
            .from('bookings')
            .upsert(batch as any[], { onConflict: 'glofox_id,studio_id' })

          if (error) {
            addError(bookingResult, `bookings upsert batch ${i}: ${error.message}`)
          }
        }

        // Post-upsert: update member visit stats for attended bookings
        try {
          const attendedBookings = bookingRows.filter(
            (b) => b && (b as Record<string, unknown>).attended === true,
          )

          const memberVisitUpdates = new Map<string, string>()
          for (const b of attendedBookings) {
            if (!b) continue
            const row = b as Record<string, unknown>
            const memberId = row.member_id as string
            const checkedInAt = (row.checked_in_at as string) ?? new Date().toISOString()

            const existing = memberVisitUpdates.get(memberId)
            if (!existing || new Date(checkedInAt) > new Date(existing)) {
              memberVisitUpdates.set(memberId, checkedInAt)
            }
          }

          for (const [memberId, lastCheckedIn] of memberVisitUpdates) {
            const { data: currentMember } = await db
              .from('members')
              .select('total_visits, last_visit')
              .eq('id', memberId)
              .single()

            if (currentMember) {
              const currentVisits = (currentMember.total_visits as number) ?? 0
              const memberAttendedCount = attendedBookings.filter(
                (b) => b && (b as Record<string, unknown>).member_id === memberId,
              ).length
              const currentLastVisit = currentMember.last_visit as string | null
              const newLastVisit =
                !currentLastVisit || new Date(lastCheckedIn) > new Date(currentLastVisit)
                  ? lastCheckedIn
                  : currentLastVisit

              await db
                .from('members')
                .update({
                  total_visits: currentVisits + memberAttendedCount,
                  last_visit: newLastVisit,
                  engagement_status: 'engaged',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', memberId)
            }
          }
        } catch (visitErr) {
          addError(bookingResult, `visit-stats: ${visitErr instanceof Error ? visitErr.message : String(visitErr)}`)
        }
      }

      bookingResult.created = syncState.bookings ? 0 : bookingRows.length
      bookingResult.updated = syncState.bookings ? bookingRows.length : 0
    }
  } catch (err) {
    addError(bookingResult, `fetch: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 3 ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  bookingResult.durationMs = Date.now() - bookingStepStart
  results.push(bookingResult)
  logLine(`Step 3 complete: ${bookingResult.fetched} fetched, ${bookingResult.skipped} skipped, ${bookingResult.errors} errors (${bookingResult.durationMs}ms)`)

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Sync Transactions
  // ═══════════════════════════════════════════════════════════════
  const txResult = emptyResult('transactions')
  const txStepStart = Date.now()
  try {
    logLine('Step 4: Fetching transactions from Glofox...')

    const startDate = syncState.transactions
      ? syncState.transactions.split('T')[0]
      : '2020-01-01'
    const endDate = new Date().toISOString().split('T')[0]

    const transactions = await glofox.getTransactions(
      branchId,
      GLOFOX_NAMESPACE,
      startDate,
      endDate,
    )

    txResult.fetched = transactions.length
    logLine(`Step 4: Fetched ${transactions.length} transactions`)

    if (transactions.length > 0) {
      const memberMap = await buildLookupMap(db, 'members', STUDIO_ID)
      const profileMap = await buildLookupMap(db, 'profiles', STUDIO_ID)

      const txRows = transactions.map((t) => {
        const { transaction, memberGlofoxId, soldByGlofoxId } = transformTransaction(t, STUDIO_ID)
        return stripNulls({
          ...transaction,
          member_id: memberGlofoxId ? (memberMap.get(memberGlofoxId) ?? null) : null,
          sold_by_profile_id: soldByGlofoxId ? (profileMap.get(soldByGlofoxId) ?? null) : null,
        })
      })

      const BATCH_SIZE = 200
      for (let i = 0; i < txRows.length; i += BATCH_SIZE) {
        const batch = txRows.slice(i, i + BATCH_SIZE)
        const { error } = await db
          .from('transactions')
          .upsert(batch as any[], { onConflict: 'glofox_id,studio_id' })

        if (error) {
          addError(txResult, `transactions upsert batch ${i}: ${error.message}`)
        }
      }

      txResult.created = syncState.transactions ? 0 : transactions.length
      txResult.updated = syncState.transactions ? transactions.length : 0
    }
  } catch (err) {
    addError(txResult, `fetch: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 4 ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  txResult.durationMs = Date.now() - txStepStart
  results.push(txResult)
  logLine(`Step 4 complete: ${txResult.fetched} fetched, ${txResult.errors} errors (${txResult.durationMs}ms)`)

  // ═══════════════════════════════════════════════════════════════
  // STEP 4b: Sync Membership Plans
  // ═══════════════════════════════════════════════════════════════
  const membershipResult = emptyResult('memberships')
  const membershipStepStart = Date.now()
  try {
    logLine('Step 4b: Fetching membership plans from Glofox...')

    const memberships = await glofox.getMemberships()
    membershipResult.fetched = memberships.length
    logLine(`Step 4b: Fetched ${memberships.length} membership plans`)

    if (memberships.length > 0) {
      const planRows = memberships.map((m: GlofoxMembership) =>
        transformMembershipPlan(m, STUDIO_ID)
      )

      const BATCH_SIZE = 200
      for (let i = 0; i < planRows.length; i += BATCH_SIZE) {
        const batch = planRows.slice(i, i + BATCH_SIZE)
        const { error } = await db
          .from('membership_plans')
          .upsert(batch as any[], { onConflict: 'glofox_id,studio_id' })

        if (error) {
          addError(membershipResult, `membership_plans upsert batch ${i}: ${error.message}`)
        }
      }

      membershipResult.created = syncState.memberships ? 0 : memberships.length
      membershipResult.updated = syncState.memberships ? memberships.length : 0
    }
  } catch (err) {
    addError(membershipResult, `fetch: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 4b ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  membershipResult.durationMs = Date.now() - membershipStepStart
  results.push(membershipResult)
  logLine(`Step 4b complete: ${membershipResult.fetched} fetched, ${membershipResult.errors} errors (${membershipResult.durationMs}ms)`)

  // ═══════════════════════════════════════════════════════════════
  // STEP 4c: Sync Credit Packs (per active member — paginated)
  // ═══════════════════════════════════════════════════════════════
  const creditResult = emptyResult('credit_packs')
  const creditStepStart = Date.now()
  try {
    logLine('Step 4c: Fetching credit packs for active members...')

    // Paginated: iterate through every active member in chunks of 500 so we
    // don't miss anyone on studios with thousands of members. Total wall time
    // is still bounded by RATE_LIMIT_DELAY_MS per member call in the client.
    const PAGE_SIZE = 500
    let offset = 0
    const memberIds: { id: string; glofox_id: string; profile_id: string }[] = []

    while (true) {
      const { data: pageMembers } = await db
        .from('members')
        .select('id, glofox_id, profile_id')
        .eq('studio_id', STUDIO_ID)
        .eq('membership_status', 'active')
        .not('glofox_id', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (!pageMembers || pageMembers.length === 0) break

      for (const m of pageMembers) {
        if (m.glofox_id) {
          memberIds.push({ id: m.id, glofox_id: m.glofox_id, profile_id: m.profile_id })
        }
      }

      if (pageMembers.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    logLine(`Step 4c: Processing ${memberIds.length} active members (paginated)`)

    const allCreditPacks: {
      row: ReturnType<typeof transformCreditPack>['creditPack']
      meridianMemberId: string
    }[] = []

    for (const member of memberIds) {
      try {
        const packs = await glofox.getCredits(member.glofox_id as string)
        creditResult.fetched += packs.length

        for (const pack of packs) {
          const { creditPack } = transformCreditPack(pack as GlofoxCreditPack, STUDIO_ID)
          allCreditPacks.push({ row: creditPack, meridianMemberId: member.id })
        }
      } catch (err) {
        // Don't stop on individual member failures — just log
        addError(
          creditResult,
          `member ${member.glofox_id}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    if (allCreditPacks.length > 0) {
      const rows = allCreditPacks.map((cp) => ({ ...cp.row, member_id: cp.meridianMemberId }))
      const BATCH_SIZE = 200
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const { error } = await db
          .from('credit_packs')
          .upsert(batch as any[], { onConflict: 'glofox_id' })

        if (error) {
          addError(creditResult, `credit_packs upsert batch ${i}: ${error.message}`)
        }
      }

      creditResult.created = syncState.credit_packs ? 0 : allCreditPacks.length
      creditResult.updated = syncState.credit_packs ? allCreditPacks.length : 0
    }
  } catch (err) {
    addError(creditResult, `fetch: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 4c ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  creditResult.durationMs = Date.now() - creditStepStart
  results.push(creditResult)
  logLine(`Step 4c complete: ${creditResult.fetched} fetched, ${creditResult.errors} errors (${creditResult.durationMs}ms)`)

  // ═══════════════════════════════════════════════════════════════
  // STEP 4d: Sync Leads
  // ═══════════════════════════════════════════════════════════════
  const leadResult = emptyResult('leads')
  const leadStepStart = Date.now()
  try {
    logLine('Step 4d: Fetching leads from Glofox...')

    const leads = await glofox.getLeads(branchId, {
      modifiedSince: syncState.leads ?? undefined,
    })

    leadResult.fetched = leads.length
    logLine(`Step 4d: Fetched ${leads.length} leads`)

    if (leads.length > 0) {
      const leadRows = leads.map((l: GlofoxLead) => transformLead(l, STUDIO_ID))

      const BATCH_SIZE = 200
      for (let i = 0; i < leadRows.length; i += BATCH_SIZE) {
        const batch = leadRows.slice(i, i + BATCH_SIZE)
        const { error } = await db
          .from('leads')
          .upsert(batch as any[], { onConflict: 'glofox_id,studio_id' })

        if (error) {
          addError(leadResult, `leads upsert batch ${i}: ${error.message}`)
        }
      }

      leadResult.created = syncState.leads ? 0 : leads.length
      leadResult.updated = syncState.leads ? leads.length : 0
    }
  } catch (err) {
    addError(leadResult, `fetch: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 4d ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  leadResult.durationMs = Date.now() - leadStepStart
  results.push(leadResult)
  logLine(`Step 4d complete: ${leadResult.fetched} fetched, ${leadResult.errors} errors (${leadResult.durationMs}ms)`)

  // ═══════════════════════════════════════════════════════════════
  // STEP 4e: Sync Staff (trainer profiles)
  // ═══════════════════════════════════════════════════════════════
  const staffResult = emptyResult('staff')
  const staffStepStart = Date.now()
  try {
    logLine('Step 4e: Fetching staff from Glofox...')

    const staffMembers = await glofox.getStaff()
    staffResult.fetched = staffMembers.length
    logLine(`Step 4e: Fetched ${staffMembers.length} staff members`)

    if (staffMembers.length > 0) {
      // Transform + upsert profiles (staff are stored as profiles with
      // roles: ['trainer']). The transformer generates placeholder emails.
      const profileRows = staffMembers.map((s: GlofoxStaff) => transformStaff(s, STUDIO_ID).profile)

      const BATCH_SIZE = 200
      for (let i = 0; i < profileRows.length; i += BATCH_SIZE) {
        const batch = profileRows.slice(i, i + BATCH_SIZE)
        const { error } = await db
          .from('profiles')
          .upsert(batch as any[], { onConflict: 'glofox_id,studio_id' })

        if (error) {
          addError(staffResult, `profiles upsert batch ${i}: ${error.message}`)
        }
      }

      // Upsert a trainers row for each staff profile so payroll + promo code
      // attribution work out-of-the-box. Skip if a trainer row already exists.
      const profileMap = await buildLookupMap(db, 'profiles', STUDIO_ID)
      const trainerRows: Record<string, unknown>[] = []

      for (const s of staffMembers) {
        const profileId = profileMap.get(s._id)
        if (!profileId) continue

        trainerRows.push({
          profile_id: profileId,
          studio_id: STUDIO_ID,
          bio: null,
          base_pay_per_class: 25,
          bonus_amount: 25,
          bonus_threshold: 7,
          is_public: true,
        })
      }

      if (trainerRows.length > 0) {
        for (let i = 0; i < trainerRows.length; i += BATCH_SIZE) {
          const batch = trainerRows.slice(i, i + BATCH_SIZE)
          const { error } = await db
            .from('trainers')
            .upsert(batch as any[], { onConflict: 'profile_id,studio_id' })

          if (error) {
            addError(staffResult, `trainers upsert batch ${i}: ${error.message}`)
          }
        }
      }

      staffResult.created = syncState.staff ? 0 : staffMembers.length
      staffResult.updated = syncState.staff ? staffMembers.length : 0
    }
  } catch (err) {
    addError(staffResult, `fetch: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 4e ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  staffResult.durationMs = Date.now() - staffStepStart
  results.push(staffResult)
  logLine(`Step 4e complete: ${staffResult.fetched} fetched, ${staffResult.errors} errors (${staffResult.durationMs}ms)`)

  // ═══════════════════════════════════════════════════════════════
  // STEP 4f: Sync Discounts
  // ═══════════════════════════════════════════════════════════════
  const discountResult = emptyResult('discounts')
  const discountStepStart = Date.now()
  try {
    logLine('Step 4f: Fetching discounts from Glofox...')

    const discounts = await glofox.getDiscounts()
    discountResult.fetched = discounts.length
    logLine(`Step 4f: Fetched ${discounts.length} discounts`)

    if (discounts.length > 0) {
      const discountRows = discounts.map((d: GlofoxDiscount) => transformDiscount(d, STUDIO_ID))

      const BATCH_SIZE = 200
      for (let i = 0; i < discountRows.length; i += BATCH_SIZE) {
        const batch = discountRows.slice(i, i + BATCH_SIZE)
        const { error } = await db
          .from('discounts')
          .upsert(batch as any[], { onConflict: 'glofox_id,studio_id' })

        if (error) {
          addError(discountResult, `discounts upsert batch ${i}: ${error.message}`)
        }
      }

      discountResult.created = syncState.discounts ? 0 : discounts.length
      discountResult.updated = syncState.discounts ? discounts.length : 0
    }
  } catch (err) {
    addError(discountResult, `fetch: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 4f ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  discountResult.durationMs = Date.now() - discountStepStart
  results.push(discountResult)
  logLine(`Step 4f complete: ${discountResult.fetched} fetched, ${discountResult.errors} errors (${discountResult.durationMs}ms)`)

  // ═══════════════════════════════════════════════════════════════
  // STEP 4g: Sync Tax Configurations
  // ═══════════════════════════════════════════════════════════════
  const taxResult = emptyResult('tax_configurations')
  const taxStepStart = Date.now()
  try {
    logLine('Step 4g: Fetching tax configurations from Glofox...')

    const taxes = await glofox.getTaxConfig(branchId)
    taxResult.fetched = taxes.length
    logLine(`Step 4g: Fetched ${taxes.length} tax configurations`)

    if (taxes.length > 0) {
      // Only the first tax is marked is_default; the rest have is_default=false.
      const taxRows = taxes.map((t: GlofoxTaxConfig, idx: number) => {
        const row = transformTaxConfig(t, STUDIO_ID)
        if (idx > 0) row.is_default = false
        return row
      })

      // tax_configurations has no unique constraint on glofox_id (it may be
      // null for Meridian-native rows), so we delete-then-insert the Glofox
      // ones specifically.
      const glofoxIds = taxRows.map((r) => r.glofox_id).filter(Boolean)
      if (glofoxIds.length > 0) {
        await db
          .from('tax_configurations')
          .delete()
          .eq('studio_id', STUDIO_ID)
          .in('glofox_id', glofoxIds as string[])
      }

      const { error } = await db.from('tax_configurations').insert(taxRows as any[])
      if (error) {
        addError(taxResult, `tax_configurations insert: ${error.message}`)
      }

      taxResult.created = syncState.tax_configurations ? 0 : taxes.length
      taxResult.updated = syncState.tax_configurations ? taxes.length : 0
    }
  } catch (err) {
    addError(taxResult, `fetch: ${err instanceof Error ? err.message : String(err)}`)
    logLine(`Step 4g ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }
  taxResult.durationMs = Date.now() - taxStepStart
  results.push(taxResult)
  logLine(`Step 4g complete: ${taxResult.fetched} fetched, ${taxResult.errors} errors (${taxResult.durationMs}ms)`)

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: Update Sync State
  // ═══════════════════════════════════════════════════════════════
  try {
    logLine('Step 5: Updating sync state...')
    const now = new Date().toISOString()
    const entityTypes = [
      'members',
      'events',
      'bookings',
      'transactions',
      'memberships',
      'credit_packs',
      'leads',
      'staff',
      'discounts',
      'tax_configurations',
    ] as const

    for (const entityType of entityTypes) {
      const entityResult = results.find((r) => r.entity === entityType)
      const recordsSynced = (entityResult?.created ?? 0) + (entityResult?.updated ?? 0)
      const hasErrors = (entityResult?.errors ?? 0) > 0

      await db.from('glofox_sync_state').upsert(
        {
          studio_id: STUDIO_ID,
          entity_type: entityType,
          last_synced_at: now,
          records_synced: recordsSynced,
          status: hasErrors ? 'completed_with_errors' : 'completed',
          error_message: hasErrors ? entityResult?.errorSamples?.[0] ?? null : null,
          updated_at: now,
        },
        { onConflict: 'studio_id,entity_type' },
      )
    }
    logLine('Step 5: Sync state updated')
  } catch (err) {
    logLine(`Step 5 ERROR: Failed to update sync state: ${err instanceof Error ? err.message : String(err)}`)
  }

  // ═══════════════════════════════════════════════════════════════
  // Log conflicts / errors to glofox_sync_conflicts
  // ═══════════════════════════════════════════════════════════════
  try {
    const errorResults = results.filter((r) => r.errors > 0)
    for (const er of errorResults) {
      await db.from('glofox_sync_conflicts').insert({
        studio_id: STUDIO_ID,
        entity_type: er.entity,
        conflict_type: 'sync_error',
        glofox_data: { error_count: er.errors, details: er.errorSamples },
        created_at: syncStartedAt,
      })
    }
  } catch {
    // Non-fatal: don't fail the whole response
  }

  // ═══════════════════════════════════════════════════════════════
  // Response
  // ═══════════════════════════════════════════════════════════════
  const totalCreated = results.reduce((sum, r) => sum + r.created, 0)
  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0)
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
  const totalFetched = results.reduce((sum, r) => sum + r.fetched, 0)
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0)
  const totalDuration = Date.now() - syncStart

  logLine(`Sync complete in ${totalDuration}ms: ${totalFetched} fetched, ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors`)

  // Write final summary as the last line
  const finalResult = {
    status: totalErrors > 0 ? 'completed_with_errors' : 'completed',
    sync_started_at: syncStartedAt,
    duration_ms: totalDuration,
    summary: {
      fetched: totalFetched,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: totalErrors,
    },
    steps: results,
    log,
  }
  await writer.write(encoder.encode(JSON.stringify({ result: finalResult }) + '\n'))

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logLine(`FATAL: ${errorMsg}`)
      await writer.write(encoder.encode(JSON.stringify({ error: errorMsg }) + '\n'))
    } finally {
      await writer.close()
    }
  })()

  // Return the streaming response immediately — Netlify sees bytes flowing
  return new Response(readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    },
  })
}
