/**
 * Live Supabase auth flow integration tests.
 * NO MOCKS — every operation hits the real auth service.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { TestDataFactory } from './helpers/test-data-factory'
import { getAdminClient } from './helpers/supabase-admin'
import { randomUUID } from 'crypto'

// Anon client using the publishable key (simulates real client-side auth)
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
)

describe('Auth Flow - Live', () => {
  const factory = new TestDataFactory()
  const db = getAdminClient()

  // Track user IDs created outside the factory for manual cleanup
  const manualUserIds: string[] = []

  afterAll(async () => {
    await factory.cleanup()
    // Clean up any users created directly via admin API
    for (const uid of manualUserIds) {
      try {
        await db.auth.admin.deleteUser(uid)
      } catch {
        // Already deleted or doesn't exist
      }
    }
  })

  // ── 1. Create user with password ────────────────────────────────
  it('creates an auth user via admin API', async () => {
    const email = `auth-test-${randomUUID().slice(0, 8)}@meridian-test.com`
    const password = `test-pass-${randomUUID()}`

    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    expect(error).toBeNull()
    expect(data.user).toBeTruthy()
    expect(data.user!.email).toBe(email)
    expect(data.user!.id).toBeTruthy()

    manualUserIds.push(data.user!.id)
  })

  // ── 2. Sign in with password ────────────────────────────────────
  it('signs in with email and password via anon client', async () => {
    const email = `signin-test-${randomUUID().slice(0, 8)}@meridian-test.com`
    const password = `secure-pass-${randomUUID()}`

    // Create user first
    const { data: created } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    manualUserIds.push(created.user!.id)

    // Sign in via anon client (like a real browser would)
    const { data: session, error } = await anonClient.auth.signInWithPassword({
      email,
      password,
    })

    expect(error).toBeNull()
    expect(session.session).toBeTruthy()
    expect(session.session!.access_token).toBeTruthy()
    expect(session.user).toBeTruthy()
    expect(session.user!.email).toBe(email)
  })

  // ── 3. Get user from session ────────────────────────────────────
  it('retrieves the current user after sign in', async () => {
    const email = `getuser-test-${randomUUID().slice(0, 8)}@meridian-test.com`
    const password = `secure-pass-${randomUUID()}`

    const { data: created } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    manualUserIds.push(created.user!.id)

    // Create a dedicated client for this test to avoid session leaking
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    )

    await client.auth.signInWithPassword({ email, password })

    const { data: userData, error } = await client.auth.getUser()

    expect(error).toBeNull()
    expect(userData.user).toBeTruthy()
    expect(userData.user!.email).toBe(email)
    expect(userData.user!.id).toBe(created.user!.id)
  })

  // ── 4. Profile lookup after auth ────────────────────────────────
  it('looks up a profile by auth user ID', async () => {
    const { userId, email } = await factory.createUser({
      fullName: 'Auth Profile Test',
      password: 'profile-lookup-pass-123',
    })

    // Query profiles table with the auth user ID
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    expect(error).toBeNull()
    expect(data).toBeTruthy()
    const profile = data as any
    expect(profile.full_name).toBe('Auth Profile Test')
    expect(profile.email).toBe(email)
    expect(profile.id).toBe(userId)
  })

  // ── 5. Invalid password rejected ────────────────────────────────
  it('rejects sign in with wrong password', async () => {
    const email = `wrongpass-test-${randomUUID().slice(0, 8)}@meridian-test.com`
    const correctPassword = `correct-pass-${randomUUID()}`

    const { data: created } = await db.auth.admin.createUser({
      email,
      password: correctPassword,
      email_confirm: true,
    })
    manualUserIds.push(created.user!.id)

    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password: 'wrong-password-entirely',
    })

    expect(error).toBeTruthy()
    expect(error!.message).toMatch(/invalid/i)
    expect(data.session).toBeNull()
  })

  // ── 6. User cleanup via admin.deleteUser ────────────────────────
  it('deletes an auth user and verifies removal', async () => {
    const email = `delete-test-${randomUUID().slice(0, 8)}@meridian-test.com`

    const { data: created } = await db.auth.admin.createUser({
      email,
      password: `delete-pass-${randomUUID()}`,
      email_confirm: true,
    })
    const userId = created.user!.id

    // Delete the user
    const { error: deleteError } = await db.auth.admin.deleteUser(userId)
    expect(deleteError).toBeNull()

    // Verify user no longer exists — getUserById should return null or error
    const { data: lookup, error: lookupError } = await db.auth.admin.getUserById(userId)

    // Supabase may return an error or a null user depending on version
    const userGone = lookupError !== null || lookup.user === null
    expect(userGone).toBe(true)
  })
})
