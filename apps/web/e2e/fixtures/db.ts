/**
 * Supabase test-database helpers — seeding + cleanup.
 *
 * Every seed helper accepts an optional `studioId`. Default is `E2E_STUDIO_ID`
 * (which resolves to `DEFAULT_STUDIO_ID` until BUG-001 is fixed), so seeded
 * rows are visible to the admin UI out of the box. Pass `studioId` explicitly
 * for advanced isolation scenarios.
 *
 * Cleanup is scoped by test-marker patterns (email prefix, title prefix,
 * description prefix) instead of a blind `studio_id` delete. This means running
 * `resetStudioTestData()` against a shared dev DB is safe — it only removes
 * rows created by the E2E suite.
 *
 * Uses the service_role key to bypass RLS. This module MUST only be imported
 * from test files — never from application code. The service role key is
 * loaded from `apps/web/.env.local`.
 *
 * Usage:
 * ```ts
 * import { testDb, seedMember, resetStudioTestData } from './fixtures/db'
 *
 * test.beforeEach(async () => {
 *   await resetStudioTestData() // wipes only E2E-seeded rows
 * })
 *
 * test('records a payment', async ({ page }) => {
 *   const { memberId } = await seedMember({ fullName: 'Jane Doe' })
 *   // ...drive UI, then assert in DB
 *   const { data } = await testDb
 *     .from('transactions')
 *     .select('*')
 *     .eq('member_id', memberId)
 *   expect(data).toHaveLength(1)
 * })
 * ```
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { randomUUID } from 'crypto'
import {
  E2E_STUDIO_ID,
  E2E_MEMBER_EMAIL_PATTERN,
  E2E_CLASS_TITLE_PREFIX,
  E2E_TRANSACTION_DESCRIPTION_PREFIX,
  E2E_PRODUCT_NAME_PREFIX,
  DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
} from './test-data'

// Load env from apps/web/.env.local (co-located with the Next app)
config({ path: path.resolve(__dirname, '../../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing Supabase env vars. Expected NEXT_PUBLIC_SUPABASE_URL and ' +
      'SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local',
  )
}

/**
 * Service-role Supabase client shared by all test helpers.
 * Bypasses RLS — never expose outside the test harness.
 */
export const testDb: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SeedMemberOptions = {
  /** Studio to seed into. Defaults to E2E_STUDIO_ID. */
  studioId?: string
  /** Full name on the profile. Defaults to "Test Member {uuid}". */
  fullName?: string
  /** Optional email. Defaults to a unique `e2e-member-{uuid}@test.meridian.app`. */
  email?: string
  /** Optional phone. */
  phone?: string
  /** Membership tier (e.g., '10_class', 'unlimited'). Default: null (no plan). */
  membershipTier?: string | null
  /** Membership status. Default: 'active'. */
  membershipStatus?: 'active' | 'paused' | 'cancelled' | 'none'
  /** Credits on the account. Default: 0. */
  creditsRemaining?: number
  /** Wallet balance in cents. Default: 0. */
  walletBalance?: number
  /** Whether profile is excluded from analytics. Default: false. */
  excludeFromAnalytics?: boolean
  /** Notes on the members row. Default: null. Tier 3.6 (Edit Member). */
  notes?: string | null
}

export type SeededMember = {
  profileId: string
  memberId: string
  email: string
  fullName: string
  studioId: string
}

export type SeedClassOptions = {
  /** Studio to seed into. Defaults to E2E_STUDIO_ID. */
  studioId?: string
  /** Class title. Default: "E2E Test Class". MUST start with E2E_CLASS_TITLE_PREFIX for cleanup to reach it. */
  title?: string
  /** ISO timestamp for class start. Default: 1 hour from now. */
  startsAt?: string
  /** ISO timestamp for class end. Default: starts_at + 1h. */
  endsAt?: string
  /** Seating capacity. Default: 12. */
  capacity?: number
  /** Trainer profile UUID (optional). */
  trainerId?: string | null
  /** Location UUID (optional — will be null for most tests). */
  locationId?: string | null
  /** Class type UUID (optional). */
  classTypeId?: string | null
  /** Class notes (the DB column the UI labels "Description"). Default: null. */
  notes?: string | null
}

export type SeededClass = {
  classId: string
  title: string
  startsAt: string
  endsAt: string
  studioId: string
}

export type SeedTransactionOptions = {
  /** Studio to seed into. Defaults to E2E_STUDIO_ID. */
  studioId?: string
  /** Member ID (from seedMember). Required. */
  memberId: string
  /** Amount in cents. Default: 5000 ($50.00). */
  amount?: number
  /** Transaction type. Default: 'drop_in'. */
  type?: 'drop_in' | 'membership' | 'credit_pack' | 'merch' | 'gift_card' | 'private_session'
  /** Status. Default: 'succeeded'. */
  status?: 'succeeded' | 'completed' | 'pending' | 'failed' | 'refunded'
  /** Human-readable description. MUST start with E2E_TRANSACTION_DESCRIPTION_PREFIX for cleanup to reach it. */
  description?: string
}

export type SeededTransaction = {
  transactionId: string
  memberId: string
  amount: number
  studioId: string
}

export type SeedProductOptions = {
  /** Studio to seed into. Defaults to E2E_STUDIO_ID. */
  studioId?: string
  /** Product name. MUST start with E2E_PRODUCT_NAME_PREFIX for cleanup to reach it. */
  name?: string
  /** Description (optional). */
  description?: string | null
  /** Category. Default: 'apparel'. */
  category?: string
  /** Price in cents. Default: 2500 ($25.00). */
  price?: number
  /** Compare-at price in cents. Default: null. */
  compareAtPrice?: number | null
  /** SKU. Default: null. */
  sku?: string | null
  /** Barcode. Default: null. */
  barcode?: string | null
  /** Initial inventory count. Default: 10. */
  inventoryCount?: number
  /** Low stock alert threshold. Default: 5. */
  lowStockThreshold?: number
  /** Image URL (single). Default: null. */
  imageUrl?: string | null
  /** Weight in ounces. Default: null. */
  weightOz?: number | null
  /** Active flag. Default: true. */
  isActive?: boolean
}

export type SeededProduct = {
  productId: string
  name: string
  price: number
  inventoryCount: number
  studioId: string
}

// ---------------------------------------------------------------------------
// Seeding helpers
// ---------------------------------------------------------------------------

/**
 * Insert a profile + member row pair in the test studio.
 *
 * Creates the profile first (with `roles: ['member']`), then the linked
 * `members` row. Returns both IDs — `profileId` for auth/booking lookups
 * and `memberId` for transactions/revenue flows.
 */
export async function seedMember(opts: SeedMemberOptions = {}): Promise<SeededMember> {
  const studioId = opts.studioId ?? E2E_STUDIO_ID
  const profileId = randomUUID()
  const memberId = randomUUID()
  const tag = profileId.slice(0, 8)
  const email = opts.email ?? `e2e-member-${tag}@test.meridian.app`
  const fullName = opts.fullName ?? `Test Member ${tag}`

  const { error: profileError } = await testDb.from('profiles').insert({
    id: profileId,
    studio_id: studioId,
    email,
    full_name: fullName,
    phone: opts.phone ?? null,
    roles: ['member'],
    is_active: true,
    exclude_from_analytics: opts.excludeFromAnalytics ?? false,
  })
  if (profileError) {
    throw new Error(`seedMember: failed to insert profile: ${profileError.message}`)
  }

  const { error: memberError } = await testDb.from('members').insert({
    id: memberId,
    profile_id: profileId,
    studio_id: studioId,
    membership_tier: opts.membershipTier ?? null,
    membership_status: opts.membershipStatus ?? 'active',
    credits_remaining: opts.creditsRemaining ?? 0,
    wallet_balance: opts.walletBalance ?? 0,
    member_discount_active: false,
    guest_passes_remaining: 0,
    guest_passes_per_cycle: 0,
    total_visits: 0,
    lifetime_value: 0,
    strike_count: 0,
    strike_penalty_exempt: false,
    waiver_signed: true,
    join_date: new Date().toISOString().slice(0, 10),
    notes: opts.notes ?? null,
  })
  if (memberError) {
    // Rollback the profile we just created so we don't leak rows.
    await testDb.from('profiles').delete().eq('id', profileId)
    throw new Error(`seedMember: failed to insert member: ${memberError.message}`)
  }

  return { profileId, memberId, email, fullName, studioId }
}

/**
 * Delete a seeded member + profile pair.
 * Cascades handle bookings/transactions on most installs; we explicitly
 * clear dependent rows to be safe across environments.
 */
export async function deleteMember(memberId: string, profileId: string): Promise<void> {
  // Order matters: rows with FKs first
  await testDb.from('transactions').delete().eq('member_id', memberId)
  await testDb.from('bookings').delete().eq('member_id', profileId)
  await testDb.from('members').delete().eq('id', memberId)
  await testDb.from('profiles').delete().eq('id', profileId)
}

/**
 * Insert a class in the test studio. Defaults to a 1-hour class starting
 * 60 minutes from now — far enough in the future that booking flows won't
 * trigger "class started" guards.
 */
export async function seedClass(opts: SeedClassOptions = {}): Promise<SeededClass> {
  const studioId = opts.studioId ?? E2E_STUDIO_ID
  const classId = randomUUID()
  const startsAt = opts.startsAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const endsAt = opts.endsAt ?? new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString()
  const title = opts.title ?? `${E2E_CLASS_TITLE_PREFIX} Class`

  const { error } = await testDb.from('classes').insert({
    id: classId,
    studio_id: studioId,
    location_id: opts.locationId ?? null,
    class_type_id: opts.classTypeId ?? DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
    trainer_id: opts.trainerId ?? null,
    title,
    starts_at: startsAt,
    ends_at: endsAt,
    capacity: opts.capacity ?? 12,
    booked_count: 0,
    checked_in_count: 0,
    status: 'scheduled',
    is_recurring: false,
    notes: opts.notes ?? null,
  })
  if (error) {
    throw new Error(`seedClass: ${error.message}`)
  }

  return { classId, title, startsAt, endsAt, studioId }
}

/** Delete a seeded class and any bookings attached to it. */
export async function deleteClass(classId: string): Promise<void> {
  await testDb.from('bookings').delete().eq('class_id', classId)
  await testDb.from('classes').delete().eq('id', classId)
}

/**
 * Insert a transaction row for a member. Used to pre-populate the Revenue
 * module with known rows before exercising search/filter/export flows.
 */
export async function seedTransaction(opts: SeedTransactionOptions): Promise<SeededTransaction> {
  const studioId = opts.studioId ?? E2E_STUDIO_ID
  const transactionId = randomUUID()
  const amount = opts.amount ?? 5000
  const description = opts.description ?? `${E2E_TRANSACTION_DESCRIPTION_PREFIX} Transaction`

  const { error } = await testDb.from('transactions').insert({
    id: transactionId,
    studio_id: studioId,
    member_id: opts.memberId,
    amount,
    type: opts.type ?? 'drop_in',
    status: opts.status ?? 'succeeded',
    description,
    discount_applied: 0,
  })
  if (error) {
    throw new Error(`seedTransaction: ${error.message}`)
  }

  return { transactionId, memberId: opts.memberId, amount, studioId }
}

/** Delete a seeded transaction by id. */
export async function deleteTransaction(transactionId: string): Promise<void> {
  await testDb.from('transactions').delete().eq('id', transactionId)
}

/**
 * Insert a product row in the test studio. Uses the real DB column names
 * aligned by the BUG-009 migration (`price`, `inventory_count`, `is_active`,
 * `image_url`, `compare_at_price`, `barcode`, `low_stock_threshold`).
 */
export async function seedProduct(opts: SeedProductOptions = {}): Promise<SeededProduct> {
  const studioId = opts.studioId ?? E2E_STUDIO_ID
  const productId = randomUUID()
  const tag = productId.slice(0, 8)
  const name = opts.name ?? `${E2E_PRODUCT_NAME_PREFIX}${tag}`
  const price = opts.price ?? 2500
  const inventoryCount = opts.inventoryCount ?? 10

  const { error } = await testDb.from('products').insert({
    id: productId,
    studio_id: studioId,
    name,
    description: opts.description ?? null,
    category: opts.category ?? 'apparel',
    price,
    compare_at_price: opts.compareAtPrice ?? null,
    sku: opts.sku ?? null,
    barcode: opts.barcode ?? null,
    inventory_count: inventoryCount,
    low_stock_threshold: opts.lowStockThreshold ?? 5,
    image_url: opts.imageUrl ?? null,
    weight_oz: opts.weightOz ?? null,
    is_active: opts.isActive ?? true,
  })
  if (error) {
    throw new Error(`seedProduct: ${error.message}`)
  }

  return { productId, name, price, inventoryCount, studioId }
}

/** Delete a seeded product by id (hard delete, bypasses soft-delete). */
export async function deleteProduct(productId: string): Promise<void> {
  // Delete any activity_log rows pointing at this product first so FK-less
  // metadata queries stay clean.
  await testDb
    .from('activity_log')
    .delete()
    .eq('subject_type', 'product')
    .eq('subject_id', productId)
  await testDb.from('products').delete().eq('id', productId)
}

// ---------------------------------------------------------------------------
// Bulk cleanup (scoped by test-marker patterns — safe against shared dev DBs)
// ---------------------------------------------------------------------------

/**
 * Delete every E2E-seeded row in the given studio.
 *
 * Scopes by test marker patterns (email prefix, title prefix, description
 * prefix) so real/dev data in the same studio is NEVER touched. Safe to run
 * against a shared dev DB.
 *
 * Does NOT delete:
 * - The studio row itself
 * - Auth test users (`meridian-e2e-admin@`, `meridian-e2e-employee@`) — owned
 *   by `auth.setup.ts`
 * - Any row that lacks an E2E marker (description not starting with
 *   "E2E Test", title not starting with "E2E Test", email not matching
 *   `e2e-member-*@test.meridian.app`)
 *
 * @param studioId Studio to clean. Defaults to `E2E_STUDIO_ID`.
 */
export async function resetStudioTestData(studioId: string = E2E_STUDIO_ID): Promise<void> {
  // 1. Collect E2E-seeded member profile IDs in this studio.
  const { data: testProfiles } = await testDb
    .from('profiles')
    .select('id')
    .eq('studio_id', studioId)
    .like('email', E2E_MEMBER_EMAIL_PATTERN)

  const testProfileIds = (testProfiles ?? []).map((p) => p.id)

  // 2. Collect member row IDs for those profiles.
  let testMemberIds: string[] = []
  if (testProfileIds.length > 0) {
    const { data: testMembers } = await testDb
      .from('members')
      .select('id')
      .in('profile_id', testProfileIds)
    testMemberIds = (testMembers ?? []).map((m) => m.id)
  }

  // 3. Delete transactions that are either (a) explicitly marked as E2E or
  //    (b) attached to an E2E member row.
  await testDb
    .from('transactions')
    .delete()
    .eq('studio_id', studioId)
    .like('description', `${E2E_TRANSACTION_DESCRIPTION_PREFIX}%`)

  if (testMemberIds.length > 0) {
    await testDb.from('transactions').delete().in('member_id', testMemberIds)
  }

  // 4. Delete E2E-marked classes and any bookings for them.
  const { data: testClasses } = await testDb
    .from('classes')
    .select('id')
    .eq('studio_id', studioId)
    .like('title', `${E2E_CLASS_TITLE_PREFIX}%`)

  const testClassIds = (testClasses ?? []).map((c) => c.id)

  if (testClassIds.length > 0) {
    await testDb.from('bookings').delete().in('class_id', testClassIds)
    await testDb.from('classes').delete().in('id', testClassIds)
  }

  // 5. Delete any remaining bookings made by test member profiles.
  if (testProfileIds.length > 0) {
    await testDb.from('bookings').delete().in('member_id', testProfileIds)
  }

  // 5b. Delete activity_log rows keyed to test profiles. Required after the
  // BUG-010 Tier 3.5 fix because POST /api/members now writes a real activity
  // row for every created member. There is no ON DELETE CASCADE from profiles,
  // so orphans would accumulate otherwise. Scoped to the collected
  // testProfileIds so dev/prod rows are untouched.
  if (testProfileIds.length > 0) {
    await testDb
      .from('activity_log')
      .delete()
      .in('subject_id', testProfileIds)
  }

  // 5c. Delete activity_log rows for test-created classes. The 'class_*'
  //     types are new as of Tier 3.8's migration (20260410) and are only
  //     produced by the test suite — the feature was completely broken
  //     before that tier so no prod code has written class_* rows yet.
  //     Scoped to the test studio. Safe against shared dev DBs.
  await testDb
    .from('activity_log')
    .delete()
    .eq('studio_id', studioId)
    .like('type', 'class_%')

  // 6. Delete test member rows.
  if (testMemberIds.length > 0) {
    await testDb.from('members').delete().in('id', testMemberIds)
  }

  // 7. Delete test member profiles. Auth test users (meridian-e2e-admin@,
  //    meridian-e2e-employee@) are NOT matched by the e2e-member-% pattern,
  //    so they're preserved.
  if (testProfileIds.length > 0) {
    await testDb.from('profiles').delete().in('id', testProfileIds)
  }

  // 8. Delete E2E-marked products and any product activity_log rows pointing
  //    at them. Scoped by the E2E_PRODUCT_NAME_PREFIX so dev products in the
  //    same studio are never touched.
  const { data: testProducts } = await testDb
    .from('products')
    .select('id')
    .eq('studio_id', studioId)
    .like('name', `${E2E_PRODUCT_NAME_PREFIX}%`)

  const testProductIds = (testProducts ?? []).map((p) => p.id)

  if (testProductIds.length > 0) {
    await testDb
      .from('activity_log')
      .delete()
      .eq('subject_type', 'product')
      .in('subject_id', testProductIds)
    await testDb.from('products').delete().in('id', testProductIds)
  }
}
