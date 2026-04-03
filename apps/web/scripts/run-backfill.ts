/**
 * Direct backfill script — runs the Glofox historical import without Inngest.
 *
 * Usage: npx tsx scripts/run-backfill.ts
 *
 * This script replicates the logic of the glofox-backfill Inngest function
 * but runs directly for immediate execution.
 */
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local from the web app directory
config({ path: resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
import { GlofoxClient } from '../src/lib/glofox/client'
import {
  transformMember,
  transformStaff,
  transformEvent,
  transformBooking,
  transformTransaction,
  transformMembershipPlan,
  transformCreditPack,
  transformLead,
} from '../src/lib/glofox/transformers'
import type {
  GlofoxMember,
  GlofoxStaff,
  GlofoxEvent,
  GlofoxBooking,
  GlofoxMembership,
  GlofoxCreditPack,
  GlofoxLead,
} from '../src/lib/glofox/types'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const STUDIO_ID = process.env.GLOFOX_STUDIO_ID!
const BRANCH_ID = process.env.GLOFOX_BRANCH_ID!
const BACKFILL_START_DATE = '2020-01-01'

const CLASS_TYPE_MAP: Record<string, string> = {
  open: '314f0ddf-dc6d-4402-beaa-22ed19172b18',
  guided: '243a8f2d-2fbf-4cf0-868b-9968fc6ddfaf',
  private: '19ee6486-c3d7-4d85-9250-829c878f7d95',
}
const DEFAULT_CLASS_TYPE_ID = CLASS_TYPE_MAP.open

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const glofox = new GlofoxClient({
  apiToken: process.env.GLOFOX_API_TOKEN!,
  apiKey: process.env.GLOFOX_API_KEY!,
  branchId: BRANCH_ID,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Remove null values from an object so DB defaults are used instead.
 * Keys with null values are stripped from the result.
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

async function batchUpsert(
  table: string,
  rows: any[],
  onConflict: string,
  options?: { ignoreDuplicates?: boolean },
  batchSize = 500,
) {
  let inserted = 0
  let errors = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await db.from(table).upsert(batch, {
      onConflict,
      ...(options?.ignoreDuplicates ? { ignoreDuplicates: true } : {}),
    })

    if (error) {
      errors += batch.length
      console.error(`  ✗ ${table} batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  return { inserted, errors }
}

/**
 * For profiles, we need a special approach:
 * - INSERT new profiles (with generated id)
 * - UPDATE existing profiles (don't touch id)
 */
async function upsertProfiles(rows: any[], batchSize = 500) {
  let inserted = 0
  let updated = 0
  let errors = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)

    // Try insert first, ignoring duplicates
    const { error: insertError } = await db.from('profiles').upsert(batch, {
      onConflict: 'glofox_id,studio_id',
      ignoreDuplicates: false,
    })

    if (insertError) {
      // If upsert fails (FK violation on id update), try insert + update separately
      for (const row of batch) {
        // Check if profile exists
        const { data: existing } = await db
          .from('profiles')
          .select('id')
          .eq('glofox_id', row.glofox_id)
          .eq('studio_id', row.studio_id)
          .maybeSingle()

        if (existing) {
          // Update without touching id
          const { id: _id, ...updateData } = row
          const { error } = await db
            .from('profiles')
            .update(updateData)
            .eq('id', existing.id)

          if (error) {
            errors++
          } else {
            updated++
          }
        } else {
          // Insert new
          const { error } = await db.from('profiles').insert(row)
          if (error) {
            errors++
          } else {
            inserted++
          }
        }
      }
    } else {
      inserted += batch.length
    }
  }

  return { inserted, updated, errors }
}

async function buildLookupMap(table: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let offset = 0
  const limit = 1000
  let hasMore = true

  while (hasMore) {
    const { data } = await db
      .from(table)
      .select('id, glofox_id')
      .eq('studio_id', STUDIO_ID)
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Glofox → Meridian Historical Backfill')
  console.log('═══════════════════════════════════════════════════')
  console.log(`Studio: ${STUDIO_ID}`)
  console.log(`Branch: ${BRANCH_ID}`)
  console.log()

  const startTime = Date.now()

  // ── 1. Staff ────────────────────────────────────────────────
  console.log('▸ Step 1: Fetching staff...')
  try {
    const staff = await glofox.getStaff()
    console.log(`  Fetched ${staff.length} staff`)

    if (staff.length > 0) {
      const profileRows = staff.map((s: GlofoxStaff) => transformStaff(s, STUDIO_ID).profile)
      const r = await upsertProfiles(profileRows)
      console.log(`  ✓ Profiles: ${r.inserted} new, ${r.updated} updated, ${r.errors} errors`)
    }
  } catch (err) {
    console.error(`  ✗ Staff fetch failed: ${err instanceof Error ? err.message : err}`)
  }

  // ── 2. Members ──────────────────────────────────────────────
  console.log('\n▸ Step 2: Fetching members...')
  try {
    const members = await glofox.getMembers()
    console.log(`  Fetched ${members.length} members`)

    if (members.length > 0) {
      const transformed = members.map((m: GlofoxMember) => transformMember(m, STUDIO_ID))

      // Insert/update profiles
      const profileRows = transformed.map((t) => t.profile)
      const pr = await upsertProfiles(profileRows)
      console.log(`  ✓ Profiles: ${pr.inserted} new, ${pr.updated} updated, ${pr.errors} errors`)

      // Build lookup → insert members
      const profileMap = await buildLookupMap('profiles')
      const memberRows = transformed
        .map((t) => {
          const profileId = profileMap.get(t.profileGlofoxId)
          if (!profileId) return null
          return { ...t.member, profile_id: profileId }
        })
        .filter(Boolean)

      const mr = await batchUpsert('members', memberRows, 'glofox_id,studio_id')
      console.log(`  ✓ Members upserted: ${mr.inserted}, skipped: ${transformed.length - memberRows.length}, errors: ${mr.errors}`)
    }
  } catch (err) {
    console.error(`  ✗ Members fetch failed: ${err instanceof Error ? err.message : err}`)
  }

  // ── 3. Events (classes) ─────────────────────────────────────
  console.log('\n▸ Step 3: Fetching events...')
  try {
    const startUnix = Math.floor(new Date(BACKFILL_START_DATE).getTime() / 1000)
    const endUnix = Math.floor(Date.now() / 1000)
    const events = await glofox.getEvents({ start: startUnix, end: endUnix })
    console.log(`  Fetched ${events.length} events`)

    if (events.length > 0) {
      const profileMap = await buildLookupMap('profiles')

      const classRows = events.map((e: GlofoxEvent) => {
        const { classRow, trainerGlofoxId } = transformEvent(e, STUDIO_ID)

        let classTypeId = DEFAULT_CLASS_TYPE_ID
        const name = (e.name ?? '').toLowerCase()
        if (name.includes('guided') || name.includes('breathwork')) {
          classTypeId = CLASS_TYPE_MAP.guided
        } else if (name.includes('private') || name.includes('event') || name.includes('party')) {
          classTypeId = CLASS_TYPE_MAP.private
        }

        const trainerId = trainerGlofoxId ? (profileMap.get(trainerGlofoxId) ?? null) : null
        return { ...classRow, class_type_id: classTypeId, trainer_id: trainerId }
      })

      const r = await batchUpsert('classes', classRows, 'glofox_id,studio_id')
      console.log(`  ✓ Classes upserted: ${r.inserted}, errors: ${r.errors}`)
    }
  } catch (err) {
    console.error(`  ✗ Events fetch failed: ${err instanceof Error ? err.message : err}`)
  }

  // ── 4. Bookings ─────────────────────────────────────────────
  console.log('\n▸ Step 4: Fetching bookings...')
  try {
    const bookings = await glofox.getBookings(BRANCH_ID, { startDate: BACKFILL_START_DATE })
    console.log(`  Fetched ${bookings.length} bookings`)

    if (bookings.length > 0) {
      const memberMap = await buildLookupMap('members')
      const classMap = await buildLookupMap('classes')

      const bookingRows = bookings
        .map((b: GlofoxBooking) => {
          const { booking, memberGlofoxId, classGlofoxId } = transformBooking(b, STUDIO_ID)
          const memberId = memberGlofoxId ? memberMap.get(memberGlofoxId) : null
          const classId = classGlofoxId ? classMap.get(classGlofoxId) : null
          if (!memberId || !classId) return null
          // Strip null values so DB defaults (created_at, updated_at) are used
          return stripNulls({ ...booking, member_id: memberId, class_id: classId })
        })
        .filter(Boolean)

      const skipped = bookings.length - bookingRows.length
      const r = await batchUpsert('bookings', bookingRows, 'glofox_id,studio_id')
      console.log(`  ✓ Bookings upserted: ${r.inserted}, skipped: ${skipped} (missing FK), errors: ${r.errors}`)
    }
  } catch (err) {
    console.error(`  ✗ Bookings fetch failed: ${err instanceof Error ? err.message : err}`)
  }

  // ── 5. Transactions ─────────────────────────────────────────
  console.log('\n▸ Step 5: Fetching transactions...')
  try {
    const today = new Date().toISOString().split('T')[0]
    const transactions = await glofox.getTransactions(BRANCH_ID, 'thesaunaguys', BACKFILL_START_DATE, today)
    console.log(`  Fetched ${transactions.length} transactions`)

    if (transactions.length > 0) {
      const memberMap = await buildLookupMap('members')
      const profileMap = await buildLookupMap('profiles')

      const txRows = transactions.map((t) => {
        const { transaction, memberGlofoxId, soldByGlofoxId } = transformTransaction(t, STUDIO_ID)
        return stripNulls({
          ...transaction,
          member_id: memberGlofoxId ? (memberMap.get(memberGlofoxId) ?? null) : null,
          sold_by_profile_id: soldByGlofoxId ? (profileMap.get(soldByGlofoxId) ?? null) : null,
        })
      })

      const r = await batchUpsert('transactions', txRows, 'glofox_id,studio_id')
      console.log(`  ✓ Transactions upserted: ${r.inserted}, errors: ${r.errors}`)
    }
  } catch (err) {
    console.error(`  ✗ Transactions fetch failed: ${err instanceof Error ? err.message : err}`)
  }

  // ── 6. Leads ────────────────────────────────────────────────
  console.log('\n▸ Step 6: Fetching leads...')
  try {
    const leads = await glofox.getLeads(BRANCH_ID)
    console.log(`  Fetched ${leads.length} leads`)

    if (leads.length > 0) {
      const leadRows = leads.map((l: GlofoxLead) => transformLead(l, STUDIO_ID))
      const r = await batchUpsert('leads', leadRows, 'glofox_id,studio_id')
      console.log(`  ✓ Leads upserted: ${r.inserted}, errors: ${r.errors}`)
    }
  } catch (err) {
    console.error(`  ✗ Leads fetch failed: ${err instanceof Error ? err.message : err}`)
  }

  // ── 7. Membership plans ─────────────────────────────────────
  console.log('\n▸ Step 7: Fetching membership plans...')
  try {
    const plans = await glofox.getMemberships()
    console.log(`  Fetched ${plans.length} membership plans`)

    if (plans.length > 0) {
      const planRows = plans.map((p: GlofoxMembership) => transformMembershipPlan(p, STUDIO_ID))
      const r = await batchUpsert('membership_plans', planRows, 'glofox_id,studio_id')
      console.log(`  ✓ Membership plans upserted: ${r.inserted}, errors: ${r.errors}`)
    }
  } catch (err) {
    console.error(`  ✗ Membership plans fetch failed: ${err instanceof Error ? err.message : err}`)
  }

  // ── 8. Set sync state ───────────────────────────────────────
  console.log('\n▸ Step 8: Setting sync state...')
  const now = new Date().toISOString()
  const entities = ['members', 'events', 'bookings', 'transactions', 'leads', 'membership_plans', 'staff']
  for (const entity of entities) {
    await db.from('glofox_sync_state').upsert(
      {
        studio_id: STUDIO_ID,
        entity_type: entity,
        last_synced_at: now,
        last_full_sync_at: now,
        status: 'completed',
        updated_at: now,
      },
      { onConflict: 'studio_id,entity_type' },
    )
  }
  console.log('  ✓ Sync state initialized')

  // ── Summary ─────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Backfill complete in ${elapsed}s`)
  console.log('═══════════════════════════════════════════════════')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
