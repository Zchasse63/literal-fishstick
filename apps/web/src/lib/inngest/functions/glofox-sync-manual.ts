/**
 * Inngest Function: Glofox Manual Sync
 *
 * Triggered on-demand via the 'glofox/sync-manual' event (e.g., button click
 * in the admin dashboard). Supports syncing all entity types or a filtered
 * subset specified in the event data.
 *
 * Unlike the hourly sync, this performs a full sync regardless of last sync
 * timestamps — useful for recovering from errors or forcing a refresh.
 * Performs FK resolution (glofox_id → UUID) for all foreign key fields.
 */
import { inngest } from '@/lib/inngest/client'
import { getAdminClient } from '@/lib/inngest/helpers'
import { GlofoxClient } from '@/lib/glofox/client'
import type { GlofoxMember, GlofoxEvent, GlofoxBooking } from '@/lib/glofox/types'
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

const ALL_ENTITY_TYPES = ['members', 'events', 'bookings', 'transactions'] as const
type EntityType = (typeof ALL_ENTITY_TYPES)[number]

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

export const glofoxSyncManual = inngest.createFunction(
  {
    id: 'glofox-sync-manual',
    name: 'Glofox Manual Sync',
    retries: 1,
    concurrency: [{ limit: 1 }],
    triggers: [{ event: 'glofox/sync-manual' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const db = getAdminClient()
    const glofox = getGlofoxClient()

    const studioId: string =
      event.data.studio_id ?? process.env.GLOFOX_STUDIO_ID!
    const requestedTypes: EntityType[] =
      event.data.entity_types && event.data.entity_types.length > 0
        ? event.data.entity_types
        : [...ALL_ENTITY_TYPES]

    const results: SyncResult[] = []
    const syncStartedAt = new Date().toISOString()

    // ── Sync members ──────────────────────────────────────────
    if (requestedTypes.includes('members')) {
      const memberResult = await step.run('sync-members', async () => {
        const result = emptyResult('members')

        try {
          const members = await glofox.getMembers({})
          if (members.length === 0) return result

          const transformed = members.map((m: GlofoxMember) => transformMember(m, studioId))

          // Upsert profiles
          const profileRows = transformed.map((t) => t.profile)
          const { error: profileError } = await db
            .from('profiles')
            .upsert(profileRows as any[], { onConflict: 'glofox_id,studio_id' })

          if (profileError) {
            result.errors += profileRows.length
            result.errorDetails.push(`profiles upsert: ${profileError.message}`)
          }

          // Build lookup and upsert members with profile_id
          const profileMap = await buildLookupMap(db, 'profiles', studioId)
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
            }
          }

          if (result.errors === 0) {
            result.updated = members.length
          }
        } catch (err) {
          result.errors++
          result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
        }

        return result
      })
      results.push(memberResult)
    }

    // ── Sync events (classes) ─────────────────────────────────
    if (requestedTypes.includes('events')) {
      const eventResult = await step.run('sync-events', async () => {
        const result = emptyResult('events')

        try {
          const events = await glofox.getEvents({})
          if (events.length === 0) return result

          const profileMap = await buildLookupMap(db, 'profiles', studioId)
          const programResolver = await createProgramResolver(db, studioId)

          const classRows = events.map((e: GlofoxEvent) => {
            const { classRow, trainerGlofoxId } = transformEvent(e, studioId)

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
          } else {
            result.updated = events.length
          }
        } catch (err) {
          result.errors++
          result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
        }

        return result
      })
      results.push(eventResult)
    }

    // ── Sync bookings ─────────────────────────────────────────
    if (requestedTypes.includes('bookings')) {
      const bookingResult = await step.run('sync-bookings', async () => {
        const result = emptyResult('bookings')

        try {
          const bookings = await glofox.getBookings(BRANCH_ID, {})
          if (bookings.length === 0) return result

          const memberMap = await buildLookupMap(db, 'members', studioId)
          const classMap = await buildLookupMap(db, 'classes', studioId)

          const bookingRows = bookings
            .map((b: GlofoxBooking) => {
              const { booking, memberGlofoxId, classGlofoxId } = transformBooking(b, studioId)
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
            } else {
              result.updated = bookingRows.length
            }
          }
        } catch (err) {
          result.errors++
          result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
        }

        return result
      })
      results.push(bookingResult)
    }

    // ── Sync transactions ─────────────────────────────────────
    if (requestedTypes.includes('transactions')) {
      const txResult = await step.run('sync-transactions', async () => {
        const result = emptyResult('transactions')

        try {
          const today = new Date().toISOString().split('T')[0]
          const transactions = await glofox.getTransactions(
            BRANCH_ID,
            'thesaunaguys',
            '2020-01-01',
            today,
          )

          if (transactions.length === 0) return result

          const memberMap = await buildLookupMap(db, 'members', studioId)
          const profileMap = await buildLookupMap(db, 'profiles', studioId)

          const txRows = transactions.map((t) => {
            const { transaction, memberGlofoxId, soldByGlofoxId } = transformTransaction(t, studioId)
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
          } else {
            result.updated = transactions.length
          }
        } catch (err) {
          result.errors++
          result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
        }

        return result
      })
      results.push(txResult)
    }

    // ── Update sync state ─────────────────────────────────────
    await step.run('update-sync-state', async () => {
      const now = new Date().toISOString()

      for (const entityResult of results) {
        const recordsSynced = entityResult.created + entityResult.updated

        await db.from('glofox_sync_state').upsert(
          {
            studio_id: studioId,
            entity_type: entityResult.entity,
            last_synced_at: now,
            records_synced: recordsSynced,
            updated_at: now,
          },
          { onConflict: 'studio_id,entity_type' },
        )
      }
    })

    // ── Log errors ────────────────────────────────────────────
    await step.run('log-results', async () => {
      const errorResults = results.filter((r) => r.errors > 0)

      for (const er of errorResults) {
        await db.from('glofox_sync_conflicts').insert({
          studio_id: studioId,
          entity_type: er.entity,
          conflict_type: 'sync_error',
          glofox_data: { error_count: er.errors, details: er.errorDetails },
          created_at: syncStartedAt,
        })
      }
    })

    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)

    return {
      status: totalErrors > 0 ? 'completed_with_errors' : 'completed',
      sync_started_at: syncStartedAt,
      entity_types_synced: requestedTypes,
      summary: {
        updated: totalUpdated,
        errors: totalErrors,
      },
      details: results,
    }
  },
)
