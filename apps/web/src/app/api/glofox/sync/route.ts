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
} from '@/lib/glofox/transformers'
import { createProgramResolver } from '@/lib/glofox/program-resolver'
import { GLOFOX_NAMESPACE } from '@/lib/constants'
import type {
  GlofoxMember,
  GlofoxEvent,
  GlofoxBooking,
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

// ─── GET handler (health check / cron providers that only do GET) ─

export async function GET(request: NextRequest) {
  return POST(request)
}

// ─── POST handler ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const syncStart = Date.now()
  const log: string[] = []
  const logLine = (msg: string) => {
    const ts = new Date().toISOString()
    log.push(`[${ts}] ${msg}`)
    console.log(`[glofox-sync] ${msg}`)
  }

  // ── 0. Auth ────────────────────────────────────────────────────
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

  logLine('Sync started')

  // ── 1. Load sync state ─────────────────────────────────────────
  const syncState: Record<string, string | null> = {
    members: null,
    events: null,
    bookings: null,
    transactions: null,
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
  // STEP 5: Update Sync State
  // ═══════════════════════════════════════════════════════════════
  try {
    logLine('Step 5: Updating sync state...')
    const now = new Date().toISOString()
    const entityTypes = ['members', 'events', 'bookings', 'transactions'] as const

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

  return NextResponse.json({
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
  })
}
