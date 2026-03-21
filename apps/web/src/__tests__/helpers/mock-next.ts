import { vi } from 'vitest'

/**
 * Creates a mock NextRequest for testing API route handlers.
 */
export function createMockRequest(
  method: string = 'GET',
  options: {
    url?: string
    body?: unknown
    headers?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
): Request {
  const url = options.url ?? 'http://localhost:3000/api/test'
  const urlObj = new URL(url)

  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      urlObj.searchParams.set(key, value)
    }
  }

  const headers = new Headers(options.headers ?? {})
  if (options.body) {
    headers.set('content-type', 'application/json')
  }

  return new Request(urlObj.toString(), {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

/**
 * Parses a Response object to extract JSON body and status.
 */
export async function parseResponse(response: Response) {
  const status = response.status
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Response might not be JSON
    body = await response.text().catch(() => null)
  }
  return { status, body }
}

/**
 * Mock for next/headers cookies()
 */
export function createMockCookies() {
  const store = new Map<string, string>()

  return {
    get: vi.fn((name: string) => {
      const value = store.get(name)
      return value ? { name, value } : undefined
    }),
    getAll: vi.fn(() => Array.from(store.entries()).map(([name, value]) => ({ name, value }))),
    set: vi.fn((name: string, value: string) => {
      store.set(name, value)
    }),
    delete: vi.fn((name: string) => {
      store.delete(name)
    }),
    has: vi.fn((name: string) => store.has(name)),
  }
}
