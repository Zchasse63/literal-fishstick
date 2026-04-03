/**
 * Inngest Function: Glofox Historical Backfill
 *
 * One-time (or on-demand) full historical import of all data from Glofox.
 * Triggered manually via the 'glofox/backfill' event.
 *
 * Processes entities in dependency order with proper FK resolution:
 * 1. Staff → profiles (trainer role)
 * 2. Members → profiles + members
 * 3. Build glofox_id → UUID lookup maps
 * 4. Events → classes (with class_type_id + trainer_id resolution)
 * 5. Bookings (with member_id + class_id resolution)
 * 6. Transactions (with member_id resolution)
 * 7. Credit packs (with member_id resolution)
 * 8. Leads
 * 9. Membership plans
 */
import { inngest } from '@/lib/inngest/client'
import { getAdminClient } from '@/lib/inngest/helpers'
import { GlofoxClient } from '@/lib/glofox/client'
import type {
  GlofoxMember,
  GlofoxStaff,
  GlofoxEvent,
  GlofoxBooking,
  GlofoxMembership,
  GlofoxCreditPack,
  GlofoxLead,
} from '@/lib/glofox/types'
import {
  transformMember,
  transformStaff,
  transformEvent,
  transformBooking,
  transformTransaction,
  transformMembershipPlan,
  transformCreditPack,
  transformLead,
} from '@/lib/glofox/transformers'
import { createProgramResolver } from '@/lib/glofox/program-resolver'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STUDIO_ID = process.env.GLOFOX_STUDIO_ID!
const BRANCH_ID = process.env.GLOFOX_BRANCH_ID!
const BACKFILL_START_DATE = '2020-01-01'

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

interface BackfillStepResult {
  entity: string
  total: number
  inserted: number
  skipped: number
  errors: number
  errorDetails: string[]
}

function emptyResult(entity: string): BackfillStepResult {
  return { entity, total: 0, inserted: 0, skipped: 0, errors: 0, errorDetails: [] }
}

type SupabaseClient = ReturnType<typeof getAdminClient>

/**
 * Remove null/undefined values so DB defaults are used instead of being overridden.
 */
function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key] = value
    }
  }
  return result
}

/**
 * Batch upsert with chunking — used when rows might already exist.
 */
async function batchUpsert(
  db: SupabaseClient,
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
  onConflict: string,
  batchSize = 500,
): Promise<{ inserted: number; errors: number; errorDetails: string[] }> {
  let inserted = 0
  let errors = 0
  const errorDetails: string[] = []

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await db.from(table).upsert(batch, { onConflict })

    if (error) {
      errors += batch.length
      errorDetails.push(
        `${table} batch ${Math.floor(i / batchSize) + 1}: ${error.message}`,
      )
    } else {
      inserted += batch.length
    }
  }

  return { inserted, errors, errorDetails }
}

/**
 * Build a lookup map: glofox_id → Meridian UUID for a given table.
 */
async function buildLookupMap(
  db: SupabaseClient,
  table: string,
  studioId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  // Fetch in batches of 1000 to avoid hitting response limits
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

export const glofoxBackfill = inngest.createFunction(
  {
    id: 'glofox-backfill',
    name: 'Glofox Historical Backfill',
    retries: 1,
    concurrency: [{ limit: 1 }],
    triggers: [{ event: 'glofox/backfill' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: { step: any }) => {
    const db = getAdminClient()
    const glofox = getGlofoxClient()
    const results: BackfillStepResult[] = []
    const backfillStartedAt = new Date().toISOString()

    // ── 1. Backfill staff (profiles with trainer role) ────────
    const staffResult = await step.run('backfill-staff', async () => {
      const result = emptyResult('staff')

      try {
        const staff = await glofox.getStaff()
        result.total = staff.length
        console.log(`[backfill] Fetched ${staff.length} staff`)

        if (staff.length === 0) return result

        const profileRows = staff.map((s: GlofoxStaff) => {
          const { profile } = transformStaff(s, STUDIO_ID)
          return profile
        })

        const r = await batchUpsert(db, 'profiles', profileRows, 'glofox_id,studio_id')
        result.inserted = r.inserted
        result.errors = r.errors
        result.errorDetails = r.errorDetails
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(staffResult)

    // ── 2. Backfill members (profiles + members table) ────────
    const memberResult = await step.run('backfill-members', async () => {
      const result = emptyResult('members')

      try {
        const members = await glofox.getMembers()
        result.total = members.length
        console.log(`[backfill] Fetched ${members.length} members`)

        if (members.length === 0) return result

        const transformed = members.map((m: GlofoxMember) => transformMember(m, STUDIO_ID))

        // Insert profiles first (generates UUIDs)
        const profileRows = transformed.map((t) => t.profile)
        const profileResult = await batchUpsert(db, 'profiles', profileRows, 'glofox_id,studio_id')
        result.errors += profileResult.errors
        result.errorDetails.push(...profileResult.errorDetails)

        if (profileResult.errors === profileRows.length) {
          // All profiles failed — can't insert members
          return result
        }

        // Build profile lookup: glofox_id → profile UUID
        const profileMap = await buildLookupMap(db, 'profiles', STUDIO_ID)

        // Insert members with resolved profile_id FK
        const memberRows = transformed
          .map((t) => {
            const profileId = profileMap.get(t.profileGlofoxId)
            if (!profileId) return null // Skip if profile wasn't inserted
            return {
              ...t.member,
              profile_id: profileId,
            }
          })
          .filter(Boolean)

        const skipped = transformed.length - memberRows.length
        result.skipped = skipped

        if (memberRows.length > 0) {
          const memberInsertResult = await batchUpsert(db, 'members', memberRows, 'glofox_id,studio_id')
          result.inserted = memberInsertResult.inserted
          result.errors += memberInsertResult.errors
          result.errorDetails.push(...memberInsertResult.errorDetails)
        }
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(memberResult)

    // ── 3. Backfill events (classes) ──────────────────────────
    const eventResult = await step.run('backfill-events', async () => {
      const result = emptyResult('events')

      try {
        const startUnix = Math.floor(new Date(BACKFILL_START_DATE).getTime() / 1000)
        const endUnix = Math.floor(Date.now() / 1000)
        const events = await glofox.getEvents({ start: startUnix, end: endUnix })
        result.total = events.length
        console.log(`[backfill] Fetched ${events.length} events`)

        if (events.length === 0) return result

        // Build trainer lookup (profile glofox_id → profile UUID)
        const profileMap = await buildLookupMap(db, 'profiles', STUDIO_ID)
        const programResolver = await createProgramResolver(db, STUDIO_ID)

        const classRows = events.map((e: GlofoxEvent) => {
          const { classRow, trainerGlofoxId } = transformEvent(e, STUDIO_ID)

          // Resolve class_type_id and program_id from event name/Glofox program
          const classTypeId = programResolver.resolve(e.name ?? '', e.program_id)

          // Resolve trainer_id from glofox_id
          const trainerId = trainerGlofoxId ? (profileMap.get(trainerGlofoxId) ?? null) : null

          return {
            ...classRow,
            class_type_id: classTypeId,
            program_id: classTypeId,
            trainer_id: trainerId,
          }
        })

        const r = await batchUpsert(db, 'classes', classRows, 'glofox_id,studio_id')
        result.inserted = r.inserted
        result.errors = r.errors
        result.errorDetails = r.errorDetails
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(eventResult)

    // ── 4. Backfill bookings ──────────────────────────────────
    const bookingResult = await step.run('backfill-bookings', async () => {
      const result = emptyResult('bookings')

      try {
        const bookings = await glofox.getBookings(BRANCH_ID, { startDate: BACKFILL_START_DATE })
        result.total = bookings.length
        console.log(`[backfill] Fetched ${bookings.length} bookings`)

        if (bookings.length === 0) return result

        // Build lookup maps for FK resolution
        const memberMap = await buildLookupMap(db, 'members', STUDIO_ID)
        const classMap = await buildLookupMap(db, 'classes', STUDIO_ID)

        const bookingRows = bookings
          .map((b: GlofoxBooking) => {
            const { booking, memberGlofoxId, classGlofoxId } = transformBooking(b, STUDIO_ID)

            // Resolve FKs — both are NOT NULL
            const memberId = memberGlofoxId ? memberMap.get(memberGlofoxId) : null
            const classId = classGlofoxId ? classMap.get(classGlofoxId) : null

            if (!memberId || !classId) {
              return null
            }

            return stripNulls({
              ...booking,
              member_id: memberId,
              class_id: classId,
            })
          })
          .filter(Boolean)

        result.skipped = bookings.length - bookingRows.length
        console.log(`[backfill] Bookings: ${bookingRows.length} resolvable, ${result.skipped} skipped (missing FK)`)

        if (bookingRows.length > 0) {
          const r = await batchUpsert(db, 'bookings', bookingRows, 'glofox_id,studio_id')
          result.inserted = r.inserted
          result.errors = r.errors
          result.errorDetails = r.errorDetails
        }
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(bookingResult)

    // ── 5. Backfill transactions ──────────────────────────────
    const txResult = await step.run('backfill-transactions', async () => {
      const result = emptyResult('transactions')

      try {
        const today = new Date().toISOString().split('T')[0]
        const transactions = await glofox.getTransactions(
          BRANCH_ID,
          'thesaunaguys',
          BACKFILL_START_DATE,
          today,
        )
        result.total = transactions.length
        console.log(`[backfill] Fetched ${transactions.length} transactions`)

        if (transactions.length === 0) return result

        // Build member lookup for FK resolution (member_id is nullable)
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

        const r = await batchUpsert(db, 'transactions', txRows, 'glofox_id,studio_id')
        result.inserted = r.inserted
        result.errors = r.errors
        result.errorDetails = r.errorDetails
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(txResult)

    // ── 6. Backfill credit packs ──────────────────────────────
    const creditResult = await step.run('backfill-credits', async () => {
      const result = emptyResult('credit_packs')

      try {
        // Fetch credits for all members with glofox_ids
        const { data: allMembers } = await db
          .from('members')
          .select('id, glofox_id')
          .eq('studio_id', STUDIO_ID)
          .not('glofox_id', 'is', null)

        if (!allMembers || allMembers.length === 0) return result

        const allCreditRows: Record<string, unknown>[] = []

        for (const member of allMembers) {
          try {
            const credits = await glofox.getCredits(member.glofox_id)
            for (const c of credits) {
              const { creditPack } = transformCreditPack(c as GlofoxCreditPack, STUDIO_ID)
              allCreditRows.push({
                ...creditPack,
                member_id: member.id, // Already have the UUID
              })
            }
          } catch {
            result.errors++
            result.errorDetails.push(`credits for member ${member.glofox_id}: fetch failed`)
          }
        }

        result.total = allCreditRows.length
        console.log(`[backfill] Fetched ${allCreditRows.length} credit packs`)

        if (allCreditRows.length > 0) {
          const r = await batchUpsert(db, 'credit_packs', allCreditRows, 'glofox_id,studio_id')
          result.inserted = r.inserted
          result.errors += r.errors
          result.errorDetails.push(...r.errorDetails)
        }
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(creditResult)

    // ── 7. Backfill leads ─────────────────────────────────────
    const leadResult = await step.run('backfill-leads', async () => {
      const result = emptyResult('leads')

      try {
        const leads = await glofox.getLeads(BRANCH_ID)
        result.total = leads.length
        console.log(`[backfill] Fetched ${leads.length} leads`)

        if (leads.length === 0) return result

        const leadRows = leads.map((l: GlofoxLead) => transformLead(l, STUDIO_ID))

        const r = await batchUpsert(db, 'leads', leadRows, 'glofox_id,studio_id')
        result.inserted = r.inserted
        result.errors = r.errors
        result.errorDetails = r.errorDetails
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(leadResult)

    // ── 8. Backfill membership plans ──────────────────────────
    const planResult = await step.run('backfill-membership-plans', async () => {
      const result = emptyResult('membership_plans')

      try {
        const plans = await glofox.getMemberships()
        result.total = plans.length
        console.log(`[backfill] Fetched ${plans.length} membership plans`)

        if (plans.length === 0) return result

        const planRows = plans.map((p: GlofoxMembership) =>
          transformMembershipPlan(p, STUDIO_ID),
        )

        const r = await batchUpsert(db, 'membership_plans', planRows, 'glofox_id,studio_id')
        result.inserted = r.inserted
        result.errors = r.errors
        result.errorDetails = r.errorDetails
      } catch (err) {
        result.errors++
        result.errorDetails.push(`fetch: ${err instanceof Error ? err.message : String(err)}`)
      }

      return result
    })
    results.push(planResult)

    // ── 9. Initialize sync state ──────────────────────────────
    await step.run('set-initial-sync-state', async () => {
      const now = new Date().toISOString()
      const entityTypes = [
        'members',
        'events',
        'bookings',
        'transactions',
        'credit_packs',
        'leads',
        'membership_plans',
        'staff',
      ]

      for (const entityType of entityTypes) {
        const entityResult = results.find((r) => r.entity === entityType)

        await db.from('glofox_sync_state').upsert(
          {
            studio_id: STUDIO_ID,
            entity_type: entityType,
            last_synced_at: now,
            last_full_sync_at: now,
            records_synced: entityResult?.inserted ?? 0,
            status: 'completed',
            updated_at: now,
          },
          { onConflict: 'studio_id,entity_type' },
        )
      }
    })

    // ── 10. Log completion ────────────────────────────────────
    await step.run('log-completion', async () => {
      const totalRecords = results.reduce((sum, r) => sum + r.total, 0)
      const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0)
      const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0)
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)

      console.log(
        `[backfill] Complete: ${totalRecords} fetched, ${totalInserted} inserted, ${totalSkipped} skipped, ${totalErrors} errors`,
      )

      // Log to activity_log if possible (activity_log has strict CHECK on type)
      // We'll just log to console since 'glofox_backfill_completed' isn't a valid type
    })

    const totalRecords = results.reduce((sum, r) => sum + r.total, 0)
    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0)
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)

    return {
      status: totalErrors > 0 ? 'completed_with_errors' : 'completed',
      backfill_started_at: backfillStartedAt,
      summary: {
        total_fetched: totalRecords,
        total_inserted: totalInserted,
        total_skipped: totalSkipped,
        total_errors: totalErrors,
      },
      details: results,
    }
  },
)
