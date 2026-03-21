import { vi } from 'vitest'

/**
 * Creates a chainable Supabase query builder mock.
 * Usage:
 *   const { client, queryBuilder } = createMockSupabaseClient()
 *   queryBuilder.mockResolvedData([{ id: '1' }])
 *   // client.from('table').select('*').eq('col', 'val') => resolves to { data: [...], error: null }
 */
export function createMockQueryBuilder(defaultData: unknown = null, defaultError: unknown = null) {
  const state = {
    data: defaultData,
    error: defaultError,
    count: null as number | null,
  }

  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    mockResolvedData: (data: unknown, count?: number | null) => void
    mockResolvedError: (error: { message: string; code?: string }) => void
  } = {} as never

  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'in', 'is', 'not', 'or', 'and', 'filter',
    'order', 'limit', 'range', 'offset',
    'single', 'maybeSingle',
    'match', 'contains', 'containedBy', 'overlaps',
    'textSearch',
    'csv', 'returns',
    'throwOnError',
  ]

  // Each method returns the builder itself (chaining)
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockImplementation(() => {
      // Return a thenable that resolves to { data, error, count }
      const result = {
        ...builder,
        then: (resolve: (val: unknown) => void) => {
          resolve({ data: state.data, error: state.error, count: state.count })
        },
      }
      return result
    })
  }

  // rpc returns the builder too
  builder.rpc = vi.fn().mockImplementation(() => ({
    ...builder,
    then: (resolve: (val: unknown) => void) => {
      resolve({ data: state.data, error: state.error })
    },
  }))

  builder.mockResolvedData = (data: unknown, count: number | null = null) => {
    state.data = data
    state.error = null
    state.count = count
  }

  builder.mockResolvedError = (error: { message: string; code?: string }) => {
    state.data = null
    state.error = error
    state.count = null
  }

  return builder
}

export function createMockSupabaseClient() {
  const queryBuilder = createMockQueryBuilder()

  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null,
    }),
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  }

  const client = {
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn().mockImplementation(() => ({
      ...queryBuilder,
      then: (resolve: (val: unknown) => void) => {
        resolve({ data: null, error: null })
      },
    })),
    auth,
  }

  return { client, queryBuilder, auth }
}

/**
 * Creates a mock profile object for testing requireRole and related auth utils.
 */
export function createMockProfile(overrides: Partial<{
  id: string
  roles: string[]
  studio_id: string
  full_name: string
  email: string
}> = {}) {
  return {
    id: overrides.id ?? 'test-user-id',
    roles: overrides.roles ?? ['owner'],
    studio_id: overrides.studio_id ?? 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    full_name: overrides.full_name ?? 'Test User',
    email: overrides.email ?? 'test@example.com',
  }
}
