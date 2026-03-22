import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createMockProfile } from '../../../helpers/mock-supabase'

// vi.hoisted runs before vi.mock hoisting, so mockSupabase is available in the factory
const mockSupabase = vi.hoisted(() => {
  // We must inline the mock creation here because helpers aren't available in hoisted scope.
  // Instead, we'll create a placeholder and assign in beforeEach.
  // Actually, vi.hoisted just ensures the code runs before mocks — but we can't
  // use imports inside it. So we use a different pattern: return a ref object.
  const ref = { client: null as ReturnType<typeof createMockSupabaseClient>['client'] | null }
  return ref
})

// We need a stable mock client created at module level (outside hoisted)
const supabaseMock = createMockSupabaseClient()
mockSupabase.client = supabaseMock.client

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase.client)),
}))

import { requireRole } from '@/lib/auth/require-role'

describe('requireRole', () => {
  beforeEach(() => {
    // Reset to defaults: authenticated user with owner profile
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null,
    })
    supabaseMock.queryBuilder.mockResolvedData(
      createMockProfile({ roles: ['owner'], studio_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })
    )
  })

  it('returns 401 error when no authenticated user exists', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const result = await requireRole(['owner'])

    expect(result.error).not.toBeNull()
    expect(result.error!.status).toBe(401)
    const body = await result.error!.json()
    expect(body.error).toBe('Unauthorized')
    expect(result.user).toBeNull()
    expect(result.profile).toBeNull()
  })

  it('returns 403 error when user exists but no profile is found', async () => {
    supabaseMock.queryBuilder.mockResolvedData(null)

    const result = await requireRole(['owner'])

    expect(result.error).not.toBeNull()
    expect(result.error!.status).toBe(403)
    const body = await result.error!.json()
    expect(body.error).toBe('Forbidden')
    expect(result.user).toBeTruthy()
    expect(result.profile).toBeNull()
  })

  it('returns 403 when user has wrong role', async () => {
    supabaseMock.queryBuilder.mockResolvedData(
      createMockProfile({ roles: ['member'] })
    )

    const result = await requireRole(['owner'])

    expect(result.error).not.toBeNull()
    expect(result.error!.status).toBe(403)
    const body = await result.error!.json()
    expect(body.error).toBe('Forbidden')
    expect(result.user).toBeTruthy()
    expect(result.profile).toBeTruthy()
  })

  it('returns success when user has the correct single role', async () => {
    supabaseMock.queryBuilder.mockResolvedData(
      createMockProfile({ roles: ['owner'], studio_id: 'studio-123' })
    )

    const result = await requireRole(['owner'])

    expect(result.error).toBeNull()
    expect(result.user).toEqual({ id: 'test-user-id', email: 'test@example.com' })
    expect(result.profile).toMatchObject({ roles: ['owner'] })
    expect(result.studioId).toBe('studio-123')
    expect(result.supabase).toBe(supabaseMock.client)
  })

  it('returns success when user has multiple roles and one matches', async () => {
    supabaseMock.queryBuilder.mockResolvedData(
      createMockProfile({ roles: ['trainer', 'member'] })
    )

    const result = await requireRole(['manager', 'trainer'])

    expect(result.error).toBeNull()
    expect(result.profile).toMatchObject({ roles: ['trainer', 'member'] })
  })

  it('returns 403 when profile has empty roles array', async () => {
    supabaseMock.queryBuilder.mockResolvedData(
      createMockProfile({ roles: [] })
    )

    const result = await requireRole(['owner'])

    expect(result.error).not.toBeNull()
    expect(result.error!.status).toBe(403)
  })

  it('falls back to hardcoded UUID when profile has no studio_id', async () => {
    const profileNoStudio = createMockProfile({ roles: ['owner'] })
    profileNoStudio.studio_id = ''

    supabaseMock.queryBuilder.mockResolvedData(profileNoStudio)

    const result = await requireRole(['owner'])

    expect(result.error).toBeNull()
    // Falls back to DEFAULT_STUDIO_ID env var (set in test setup.ts)
    expect(result.studioId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('returns supabase client in the 401 (unauthenticated) case', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const result = await requireRole(['owner'])

    expect(result.supabase).toBe(supabaseMock.client)
  })

  it('returns supabase client in the 403 (forbidden) case', async () => {
    supabaseMock.queryBuilder.mockResolvedData(
      createMockProfile({ roles: ['member'] })
    )

    const result = await requireRole(['owner'])

    expect(result.supabase).toBe(supabaseMock.client)
  })

  it('returns studioId as null in 401 case', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const result = await requireRole(['owner'])

    expect(result.studioId).toBeNull()
  })

  it('returns studioId from profile in 403 case when profile exists', async () => {
    supabaseMock.queryBuilder.mockResolvedData(
      createMockProfile({ roles: ['member'], studio_id: 'studio-xyz' })
    )

    const result = await requireRole(['owner'])

    expect(result.error).not.toBeNull()
    expect(result.studioId).toBe('studio-xyz')
  })

  it('queries the profiles table with correct user id and columns', async () => {
    await requireRole(['owner'])

    expect(supabaseMock.client.from).toHaveBeenCalledWith('profiles')
    expect(supabaseMock.queryBuilder.select).toHaveBeenCalledWith(
      'id, roles, studio_id, full_name, email'
    )
    expect(supabaseMock.queryBuilder.eq).toHaveBeenCalledWith('id', 'test-user-id')
    expect(supabaseMock.queryBuilder.single).toHaveBeenCalled()
  })
})
