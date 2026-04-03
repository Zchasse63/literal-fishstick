/**
 * Inngest Cron Function: Glofox Hourly Sync
 *
 * Runs every hour to pull incremental changes from the Glofox API.
 * Syncs members, events (classes), bookings, and transactions that
 * have been modified since the last successful sync.
 *
 * Uses the glofox_sync_state table to track per-entity last-sync timestamps.
 * Performs FK resolution (glofox_id → UUID) for all foreign key fields.
 */
import { inngest } from '@/lib/inngest/client'
import { getAdminClient } from '@/lib/inngest/helpers'
import { GlofoxClient } from '@/lib/glofox/client'
import type { GlofoxMember, GlofoxEvent, GlofoxBooking } from '@/lib/glofox/types'
import { GLOFOX_NAMESPACE } from '@/lib/constants'
import {
  transformMember,
  transformEvent,
  transformBooking,
  transformTransaction,
} from '@/lib/glofox/transformers'
import { createProgramResolver } from '@/lib/glofox/program-resolver'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STUDIO_ID = process.env.GLOFOX_STUDIO_ID!
const BRANCH_ID = process.env.GLOFOX_BRANCH_ID!

function getGlofoxClient() {
  return new GlofoxClient({
    apiToken: process.env.GLOFOX_API_TOKEN!,
    apiKey: process.env.GLOFOX_API_KEY!,
    branchId: BRANCH_ID,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof getAdminClient>

interface SyncResult {
  entity: string
  created: number
  updated: number
  errors: number
  errorDetails: string[]
}

function emptyResult(entity: string): SyncResult {
  return { entity, created: 0, updated: 0, errors: 0, errorDetails: [] }
}

function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) result[key] = value
  }
  return result
}

async function buildLookupMap(
  db: SupabaseClient,
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

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

export const glofoxSyncHourly = inngest.createFunction(
  {
    id: 'glofox-sync-hourly',
    name: 'Glofox Hourly Sync',
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '0 * * * *' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: { step: any }) => {
    const db = getAdminClient()
    const glofox = getGlofoxClient()

    // ── 1. Load sync state ────────────────────────────────────
    const syncState = await step.run('load-sync-state', async () => {
      const { data: rows } = await db
        .from('glofox_sync_state')
        .select('entity_type, last_synced_at')
        .eq('studio_id', STUDIO_ID)

      const state: Record<string, string | null> = {
        members: null,
        events: null,
        bookings: null,
        transactions: null,
      }

      for (const row of rows ?? []) {
        state[row.entity_type] = row.last_synced_at
      }

      return state
    })

    const results: SyncResult[] = []
    const syncStartedAt = new Date().toISOString()

    // ── 2. Sync members ───────────────────────────────────────
    const memberResult = await step.run('sync-members', async () => {
      const result = emptyResult('members')

      try {
        const members = await glofox.getMembers({
          modifiedSince: syncState.members ?? undefined,
        })

        if (members.length === 0) return result

        const transformed = members.map((m: GlofoxMember) => transformMember(m, STUDIO_ID))

        // Upsert profiles
        const profileRows = transformed.map((t) => t.profile)
        const { error: profileError } = await db
          .from('profiles')
          .upsert(profileRows as any[], { onConflict: 'glofox_id,studio_id' })

        if (profileError) {
          result.errors += profileRows.length
          result.errorDetails.push(`profiles upsert: ${profileError.message}`)
          return result
        }

        // Build profile lookup for member FK resolution
        const profileMap = await buildLookupMap(db, 'profiles', STUDIO_ID)

        // Upsert members with resolved profile_id
        const memberRows = transformed
          .map((t) => {
            const profileId = profileMap.get(t.profileGlofoxId)
            if (!profileId) return null
            return { ...t.member, profile_id: profileId }
          })
          .filter(Boolean)

        if (memberRows.length > 0) {
          const { error: memberError } = await db
            .from('members')
            .upsert(memberRows as any[], { onConflict: 'glofox_id,studio_id' })

          if (memberError) {
            result.errors += memberRows.length
            result.errorDetails.push(`members upsert: ${memberError.message}`)
            return result
          }
        }

        result.updated = syncState.members ? members.length : 0
        result.created = syncState.members ? 0 : members.length
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(memberResult)

    // ── 3. Sync events (classes) ──────────────────────────────
    const eventResult = await step.run('sync-events', async () => {
      const result = emptyResult('events')

      try {
        const events = await glofox.getEvents({
          modifiedSince: syncState.events ?? undefined,
        })

        if (events.length === 0) return result

        const profileMap = await buildLookupMap(db, 'profiles', STUDIO_ID)
        const programResolver = await createProgramResolver(db, STUDIO_ID)

        const classRows = events.map((e: GlofoxEvent) => {
          const { classRow, trainerGlofoxId } = transformEvent(e, STUDIO_ID)

          const classTypeId = programResolver.resolve(e.name ?? '', e.program_id)
          const trainerId = trainerGlofoxId ? (profileMap.get(trainerGlofoxId) ?? null) : null

          return { ...classRow, class_type_id: classTypeId, program_id: classTypeId, trainer_id: trainerId }
        })

        const { error } = await db
          .from('classes')
          .upsert(classRows as any[], { onConflict: 'glofox_id,studio_id' })

        if (error) {
          result.errors += classRows.length
          result.errorDetails.push(`classes upsert: ${error.message}`)
          return result
        }

        result.updated = syncState.events ? events.length : 0
        result.created = syncState.events ? 0 : events.length
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(eventResult)

    // ── 4. Sync bookings ──────────────────────────────────────
    const bookingResult = await step.run('sync-bookings', async () => {
      const result = emptyResult('bookings')

      try {
        const bookings = await glofox.getBookings(BRANCH_ID, {
          modifiedSince: syncState.bookings ?? undefined,
        })

        if (bookings.length === 0) return result

        // Build lookup maps
        const memberMap = await buildLookupMap(db, 'members', STUDIO_ID)
        const classMap = await buildLookupMap(db, 'classes', STUDIO_ID)

        const bookingRows = bookings
          .map((b: GlofoxBooking) => {
            const { booking, memberGlofoxId, classGlofoxId } = transformBooking(b, STUDIO_ID)
            const memberId = memberGlofoxId ? memberMap.get(memberGlofoxId) : null
            const classId = classGlofoxId ? classMap.get(classGlofoxId) : null
            if (!memberId || !classId) return null
            return stripNulls({ ...booking, member_id: memberId, class_id: classId })
          })
          .filter(Boolean)

        if (bookingRows.length > 0) {
          const { error } = await db
            .from('bookings')
            .upsert(bookingRows as any[], { onConflict: 'glofox_id,studio_id' })

          if (error) {
            result.errors += bookingRows.length
            result.errorDetails.push(`bookings upsert: ${error.message}`)
            return result
          }
        }

        result.updated = syncState.bookings ? bookingRows.length : 0
        result.created = syncState.bookings ? 0 : bookingRows.length
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(bookingResult)

    // ── 5. Sync transactions ──────────────────────────────────
    const transactionResult = await step.run('sync-transactions', async () => {
      const result = emptyResult('transactions')

      try {
        const startDate = syncState.transactions
          ? syncState.transactions.split('T')[0]
          : '2020-01-01'
        const endDate = new Date().toISOString().split('T')[0]

        const transactions = await glofox.getTransactions(
          BRANCH_ID,
          GLOFOX_NAMESPACE,
          startDate,
          endDate,
        )

        if (transactions.length === 0) return result

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

        const { error } = await db
          .from('transactions')
          .upsert(txRows as any[], { onConflict: 'glofox_id,studio_id' })

        if (error) {
          result.errors += txRows.length
          result.errorDetails.push(`transactions upsert: ${error.message}`)
          return result
        }

        result.updated = syncState.transactions ? transactions.length : 0
        result.created = syncState.transactions ? 0 : transactions.length
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(transactionResult)

    // ── 6. Update sync state ──────────────────────────────────
    await step.run('update-sync-state', async () => {
      const now = new Date().toISOString()
      const entityTypes = ['members', 'events', 'bookings', 'transactions']

      for (const entityType of entityTypes) {
        const entityResult = results.find((r) => r.entity === entityType)
        const recordsSynced =
          (entityResult?.created ?? 0) + (entityResult?.updated ?? 0)

        await db.from('glofox_sync_state').upsert(
          {
            studio_id: STUDIO_ID,
            entity_type: entityType,
            last_synced_at: now,
            records_synced: recordsSynced,
            status: 'completed',
            updated_at: now,
          },
          { onConflict: 'studio_id,entity_type' },
        )
      }
    })

    // ── 7. Log conflicts / errors ─────────────────────────────
    await step.run('log-results', async () => {
      const errorResults = results.filter((r) => r.errors > 0)
      for (const er of errorResults) {
        await db.from('glofox_sync_conflicts').insert({
          studio_id: STUDIO_ID,
          entity_type: er.entity,
          conflict_type: 'sync_error',
          glofox_data: { error_count: er.errors, details: er.errorDetails },
          created_at: syncStartedAt,
        })
      }
    })

    const totalCreated = results.reduce((sum, r) => sum + r.created, 0)
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)

    return {
      status: totalErrors > 0 ? 'completed_with_errors' : 'completed',
      sync_started_at: syncStartedAt,
      summary: {
        created: totalCreated,
        updated: totalUpdated,
        errors: totalErrors,
      },
      details: results,
    }
  },
)
