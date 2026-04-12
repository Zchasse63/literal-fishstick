/**
 * POST /api/glofox/hydrate-memberships
 *
 * Hydrate full membership details per-member via the Glofox single-member
 * endpoint (`GET /2.0/members/{userId}`).
 *
 * Why this exists:
 *   The paginated `GET /2.0/members` list endpoint returns SPARSE member
 *   objects for active users — specifically, it either omits the embedded
 *   `membership` field entirely or returns only `{ status: 'ACTIVE' }`
 *   without plan_code, plan_price, plan_name, or user_membership_id.
 *
 *   As a result, after running the main sync, 985 of 998 active members
 *   have NULL `plan_code` / `plan_price` — we know they're active but
 *   can't answer "who is on plan X?" queries without per-member hydration.
 *
 * What it does:
 *   1. Select members needing hydration (filter: active + missing plan info,
 *      or stale, or explicit --all via query param).
 *   2. For each, call `glofox.getMember(glofox_id)` with rate-limit delay.
 *   3. Extract the embedded membership and upsert into:
 *      - `members` (backfill plan_code, plan_price, membership_status)
 *      - `member_subscriptions` (historical record of plan assignments)
 *
 * Auth: CRON_SECRET via `Authorization: Bearer <secret>` header.
 *
 * Query params:
 *   - mode=stale (default): only hydrate active members with NULL plan_code
 *   - mode=all: hydrate every member regardless (full backfill)
 *   - limit=N: cap the number of members processed (default: unlimited)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GlofoxClient } from '@/lib/glofox/client'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import type { GlofoxEmbeddedMembership } from '@/lib/glofox/types'

const STUDIO_ID = DEFAULT_STUDIO_ID

// Glofox status → Meridian members.membership_status CHECK values
const MEMBERSHIP_STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active',
  INACTIVE: 'none',
  CANCELED: 'cancelled',
  CANCELLED: 'cancelled',
  FROZEN: 'paused',
  EXPIRED: 'cancelled',
  PENDING: 'active',
  PAST_DUE: 'past_due',
}

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

function verifyCronAuth(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) return false
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const legacyHeader = request.headers.get('x-cron-secret')
  const provided = bearerToken || legacyHeader
  return provided === expectedSecret
}

function unixToISO(unix: number | undefined | null): string | null {
  if (unix == null || unix === 0) return null
  return new Date(unix * 1000).toISOString()
}

function mapStatus(rawStatus: string | undefined | null): string {
  if (!rawStatus) return 'none'
  return (
    MEMBERSHIP_STATUS_MAP[rawStatus] ??
    MEMBERSHIP_STATUS_MAP[rawStatus.toUpperCase()] ??
    'none'
  )
}

interface HydrateResult {
  total_candidates: number
  processed: number
  updated_members: number
  upserted_subscriptions: number
  skipped_no_membership: number
  errors: number
  error_samples: string[]
  duration_ms: number
}

export const maxDuration = 300 // 5 minutes — this runs long for full backfills

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      {
        error:
          'Unauthorized. Provide Authorization: Bearer <CRON_SECRET> or x-cron-secret header.',
      },
      { status: 401 }
    )
  }

  // Glofox env
  const branchId = process.env.GLOFOX_BRANCH_ID
  if (!process.env.GLOFOX_API_TOKEN || !process.env.GLOFOX_API_KEY || !branchId) {
    return NextResponse.json(
      {
        error:
          'Missing Glofox credentials. Set GLOFOX_API_TOKEN, GLOFOX_API_KEY, and GLOFOX_BRANCH_ID.',
      },
      { status: 503 }
    )
  }

  const glofox = new GlofoxClient({
    apiToken: process.env.GLOFOX_API_TOKEN,
    apiKey: process.env.GLOFOX_API_KEY,
    branchId,
  })

  let db: ReturnType<typeof getAdminDb>
  try {
    db = getAdminDb()
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to initialize Supabase admin client: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 503 }
    )
  }

  // Parse query params
  const mode = request.nextUrl.searchParams.get('mode') ?? 'stale'
  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : null

  // ── Stream NDJSON progress ──────────────────────────────────
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const start = Date.now()

  const logLine = (msg: string) => {
    console.log(`[glofox-hydrate] ${msg}`)
    writer.write(encoder.encode(JSON.stringify({ progress: msg }) + '\n')).catch(() => {})
  }

  ;(async () => {
    const result: HydrateResult = {
      total_candidates: 0,
      processed: 0,
      updated_members: 0,
      upserted_subscriptions: 0,
      skipped_no_membership: 0,
      errors: 0,
      error_samples: [],
      duration_ms: 0,
    }

    try {
      // ── 1. Select candidate members ─────────────────────────
      logLine(`Starting hydrate (mode=${mode}, limit=${limit ?? 'none'})...`)

      let selectQuery = db
        .from('members')
        .select('id, profile_id, glofox_id, membership_status, plan_code')
        .eq('studio_id', STUDIO_ID)
        .not('glofox_id', 'is', null)
        .order('id', { ascending: true })

      if (mode === 'stale') {
        // Members not yet hydrated to the new member_subscriptions table.
        // After the first full backfill, this filter narrows subsequent
        // runs to only new members + churned ones flagged for re-sync.
        const { data: alreadyHydrated } = await db
          .from('member_subscriptions')
          .select('member_id')
          .eq('studio_id', STUDIO_ID)
          .gte('glofox_synced_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        const hydratedIds = new Set(
          (alreadyHydrated ?? []).map((r) => r.member_id as string)
        )

        if (hydratedIds.size > 0) {
          selectQuery = selectQuery.not('id', 'in', `(${Array.from(hydratedIds).join(',')})`)
        }
      }
      // mode=all: no additional filter — hit every member with a glofox_id

      if (limit) {
        selectQuery = selectQuery.limit(limit)
      }

      const { data: candidates, error: selectError } = await selectQuery
      if (selectError) {
        throw new Error(`Failed to select candidates: ${selectError.message}`)
      }

      const members = candidates ?? []
      result.total_candidates = members.length
      logLine(`Selected ${members.length} candidate members`)

      // ── 2. Hydrate each member ──────────────────────────────
      // Fetch Glofox plan map once for plan_name enrichment
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

      let processed = 0
      const PROGRESS_EVERY = 25

      for (const member of members) {
        if (!member.glofox_id) continue
        processed++

        try {
          const fullMember = await glofox.getMember(member.glofox_id as string)

          const membership = fullMember.membership as
            | (GlofoxEmbeddedMembership & {
                _id?: string
                subscription?: {
                  subscription_plan_id?: string
                  stripe_id?: string
                  price?: number
                  upfront_fee?: number
                  auto_renewal?: boolean
                  paused?: boolean
                  interval?: string
                  interval_count?: number
                }
              })
            | undefined

          // Accept 'time_classes' (class packs) and 'time' (unlimited time
          // periods) as real subscriptions. 'payg' is pay-as-you-go with no
          // real plan — skip so we don't trash DB rows with sparse data.
          // Also accept plans where type is missing but plan_code is set.
          const membershipType = (membership as { type?: string } | undefined)?.type
          if (
            !membership ||
            !membership.plan_code ||
            membershipType === 'payg'
          ) {
            result.skipped_no_membership++
            if (processed % PROGRESS_EVERY === 0) {
              logLine(`Processed ${processed}/${members.length} (skipped ${result.skipped_no_membership}, errors ${result.errors})`)
            }
            continue
          }

          // Price in dollars from Glofox → cents integer.
          // Glofox sometimes returns plan_price as a string; coerce.
          const rawPrice =
            membership.plan_price ?? membership.subscription?.price ?? null
          const planPriceCents =
            rawPrice != null ? Math.round(Number(rawPrice) * 100) : null
          const upfrontCents =
            membership.plan_upfront_fee != null
              ? Math.round(Number(membership.plan_upfront_fee) * 100)
              : null
          const status = mapStatus(membership.status)
          const startedAt = unixToISO(membership.start_date)
          const endedAt = unixToISO(membership.expiry_date)
          const planMapEntry = planMap.get(membership.plan_code)
          const planName =
            membership.plan_name ?? planMapEntry?.plan_name ?? null
          const membershipName = membership.membership_name ?? null
          const stripeSubscriptionId =
            membership.subscription?.stripe_id ?? null

          // ── 2a. Backfill the members row ──────────────────
          const { error: memberUpdateError } = await db
            .from('members')
            .update({
              plan_code: membership.plan_code,
              plan_price: planPriceCents,
              plan_upfront_fee: upfrontCents,
              membership_status: status,
              glofox_subscription_id: stripeSubscriptionId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', member.id as string)
            .eq('studio_id', STUDIO_ID)

          if (memberUpdateError) {
            result.errors++
            if (result.error_samples.length < 10) {
              result.error_samples.push(
                `member ${member.glofox_id} update: ${memberUpdateError.message}`
              )
            }
          } else {
            result.updated_members++
          }

          // ── 2b. Upsert member_subscriptions row ───────────
          const subRow = {
            studio_id: STUDIO_ID,
            member_id: member.id as string,
            profile_id: member.profile_id as string,
            plan_code: String(membership.plan_code),
            plan_name: planName,
            membership_name: membershipName,
            plan_price_cents: planPriceCents,
            plan_upfront_fee_cents: upfrontCents,
            billing_interval:
              membership.subscription?.interval ??
              planMapEntry?.billing_interval ??
              null,
            status,
            started_at: startedAt,
            ended_at: endedAt,
            glofox_user_membership_id: membership.user_membership_id ?? null,
            stripe_subscription_id: stripeSubscriptionId,
            glofox_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          // Unique on glofox_user_membership_id — if Glofox didn't return
          // that field, fall back to delete+insert on (member_id, plan_code).
          if (membership.user_membership_id) {
            const { error: subError } = await db
              .from('member_subscriptions')
              .upsert(subRow as any, { onConflict: 'glofox_user_membership_id' })

            if (subError) {
              result.errors++
              if (result.error_samples.length < 10) {
                result.error_samples.push(
                  `sub ${member.glofox_id} upsert: ${subError.message}`
                )
              }
            } else {
              result.upserted_subscriptions++
            }
          } else {
            // No user_membership_id — use member_id + plan_code as natural key
            await db
              .from('member_subscriptions')
              .delete()
              .eq('member_id', member.id as string)
              .eq('plan_code', membership.plan_code)
              .is('glofox_user_membership_id', null)

            const { error: subError } = await db
              .from('member_subscriptions')
              .insert(subRow as any)

            if (subError) {
              result.errors++
              if (result.error_samples.length < 10) {
                result.error_samples.push(
                  `sub ${member.glofox_id} insert: ${subError.message}`
                )
              }
            } else {
              result.upserted_subscriptions++
            }
          }

          if (processed % PROGRESS_EVERY === 0) {
            logLine(
              `Processed ${processed}/${members.length} (updated ${result.updated_members}, subs ${result.upserted_subscriptions}, skipped ${result.skipped_no_membership}, errors ${result.errors})`
            )
          }
        } catch (err) {
          result.errors++
          if (result.error_samples.length < 10) {
            result.error_samples.push(
              `member ${member.glofox_id}: ${err instanceof Error ? err.message : String(err)}`
            )
          }
        }
      }

      result.processed = processed
      result.duration_ms = Date.now() - start
      logLine(
        `Hydrate complete in ${result.duration_ms}ms: ${result.updated_members} members updated, ${result.upserted_subscriptions} subscriptions upserted, ${result.skipped_no_membership} skipped, ${result.errors} errors`
      )

      await writer.write(
        encoder.encode(JSON.stringify({ result }) + '\n')
      )
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logLine(`FATAL: ${errorMsg}`)
      await writer.write(encoder.encode(JSON.stringify({ error: errorMsg }) + '\n'))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    },
  })
}
